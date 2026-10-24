/**
 * Thin Google Calendar v3 client.
 *
 * Scope: `calendar.events` — read AND write events on the user's calendars.
 * We need read for the import flow and write for pushing confirmed show
 * dates (Phase 2 Bill Builder) back to members' calendars. Asking for both
 * now means a single consent + Google verification review.
 * Sensitive scope — Google verification required before non-test users.
 */
import { getGoogleOAuthEnv } from "@/utils/supabase/env";
import type { Tables } from "@/types/database.types";

export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const EVENTS_ENDPOINT = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export type GoogleConnection = Tables<"google_calendar_connections">;

/** Minimal subset of Google's Event resource we actually read. */
type GoogleEventTime = { dateTime?: string; date?: string; timeZone?: string };
export type GoogleEvent = {
  id: string;
  status?: string;
  summary?: string;
  transparency?: "opaque" | "transparent";
  start: GoogleEventTime;
  end: GoogleEventTime;
  recurringEventId?: string;
  htmlLink?: string;
};

type RefreshResponse = {
  access_token: string;
  expires_in: number; // seconds
  scope?: string;
  token_type?: string;
};

/** Refreshes an access token against Google's token endpoint. */
async function refreshAccessToken(refreshToken: string): Promise<RefreshResponse> {
  const { clientId, clientSecret } = getGoogleOAuthEnv();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token refresh failed (${res.status}): ${text}`);
  }
  return (await res.json()) as RefreshResponse;
}

/**
 * Returns a usable access token for this connection, refreshing on-demand.
 * Writes the refreshed token + expiry back via the supplied `onRefresh`
 * callback so the caller can persist it.
 */
export async function getValidAccessToken(
  connection: GoogleConnection,
  onRefresh: (next: { access_token: string; expires_at: string }) => Promise<void>,
): Promise<string> {
  const now = Date.now();
  const expiresAtMs = new Date(connection.expires_at).getTime();
  // 60s skew buffer
  if (expiresAtMs - now > 60_000) return connection.access_token;

  if (!connection.refresh_token) {
    throw new Error(
      "Google refresh token missing. Disconnect and reconnect Google Calendar.",
    );
  }

  const refreshed = await refreshAccessToken(connection.refresh_token);
  const nextExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await onRefresh({ access_token: refreshed.access_token, expires_at: nextExpiresAt });
  return refreshed.access_token;
}

/**
 * Lists events on the user's primary calendar between timeMin and timeMax
 * (inclusive-exclusive, RFC3339). Expands recurring events into instances.
 * Caps at 5 pages (12,500 events) to avoid unbounded reads.
 */
export async function listCalendarEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date,
): Promise<GoogleEvent[]> {
  const events: GoogleEvent[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 5; page++) {
    const params = new URLSearchParams({
      singleEvents: "true",
      showDeleted: "false",
      maxResults: "2500",
      orderBy: "startTime",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`${EVENTS_ENDPOINT}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Calendar list failed (${res.status}): ${text}`);
    }
    const body = (await res.json()) as { items?: GoogleEvent[]; nextPageToken?: string };
    if (body.items) events.push(...body.items);
    if (!body.nextPageToken) break;
    pageToken = body.nextPageToken;
  }
  return events;
}

// -----------------------------------------------------------------------------
// Event → unavailability shaping
// -----------------------------------------------------------------------------

export type ReviewableEvent = {
  /** Google event id (unique within the pulled window). */
  id: string;
  summary: string;
  /** Local-date YYYY-MM-DD (what we'd store in member_unavailabilities). */
  startDate: string;
  endDate: string;
  /** True when start.date / end.date were used (no clock time). */
  isAllDay: boolean;
  /** endDate - startDate in days, inclusive (1 = single day). */
  spanDays: number;
  /** Grouping key for recurring instances; null for one-offs. */
  seriesId: string | null;
  /** Preselect default based on the user's rules. */
  preselect: boolean;
};

export type ReviewSeries = {
  seriesId: string;
  summary: string;
  instances: ReviewableEvent[];
};

export type ReviewPayload = {
  oneOffs: ReviewableEvent[];
  recurringSeries: ReviewSeries[];
  skippedCount: number;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** YYYY-MM-DD for a Date in the server's local time. */
function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function diffDaysInclusive(start: string, end: string): number {
  const a = new Date(`${start}T00:00:00`).getTime();
  const b = new Date(`${end}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

function eventToRange(ev: GoogleEvent): { startDate: string; endDate: string; isAllDay: boolean } {
  if (ev.start.date && ev.end.date) {
    // All-day: Google's end.date is exclusive — subtract one day.
    const endExclusive = new Date(`${ev.end.date}T00:00:00`);
    endExclusive.setDate(endExclusive.getDate() - 1);
    const endDate = toLocalDate(endExclusive);
    const startDate = ev.start.date;
    return {
      startDate,
      endDate: endDate < startDate ? startDate : endDate,
      isAllDay: true,
    };
  }
  // Timed event (or edge case): use the dates of the dateTime boundaries.
  const startDt = new Date(ev.start.dateTime ?? ev.start.date ?? "");
  const endDt = new Date(ev.end.dateTime ?? ev.end.date ?? ev.start.dateTime ?? "");
  return {
    startDate: toLocalDate(startDt),
    endDate: toLocalDate(endDt),
    isAllDay: false,
  };
}

/**
 * Shapes raw Google events for the review page.
 * - Drops `transparency: "transparent"` ("free" events) and cancelled statuses.
 * - Groups recurring instances by `recurringEventId`.
 * - Preselect rules (from user): one-off events ON; multi-day events ON;
 *   recurring instances OFF (user opts in by toggling the series).
 */
export function classifyEvents(events: GoogleEvent[]): ReviewPayload {
  let skippedCount = 0;
  const oneOffs: ReviewableEvent[] = [];
  const seriesMap = new Map<string, ReviewSeries>();

  for (const ev of events) {
    if (ev.status === "cancelled") {
      skippedCount++;
      continue;
    }
    if (ev.transparency === "transparent") {
      skippedCount++;
      continue;
    }
    if (!ev.start || !ev.end) {
      skippedCount++;
      continue;
    }

    const range = eventToRange(ev);
    const spanDays = diffDaysInclusive(range.startDate, range.endDate);
    const seriesId = ev.recurringEventId ?? null;
    const isRecurring = seriesId !== null;
    const isMultiDay = spanDays >= 2;
    const preselect = !isRecurring || isMultiDay;

    const review: ReviewableEvent = {
      id: ev.id,
      summary: ev.summary?.trim() || "(Untitled event)",
      startDate: range.startDate,
      endDate: range.endDate,
      isAllDay: range.isAllDay,
      spanDays,
      seriesId,
      preselect,
    };

    if (seriesId) {
      const existing = seriesMap.get(seriesId);
      if (existing) existing.instances.push(review);
      else
        seriesMap.set(seriesId, {
          seriesId,
          summary: review.summary,
          instances: [review],
        });
    } else {
      oneOffs.push(review);
    }
  }

  oneOffs.sort((a, b) => a.startDate.localeCompare(b.startDate));
  const recurringSeries = Array.from(seriesMap.values()).map((s) => ({
    ...s,
    instances: s.instances.sort((a, b) => a.startDate.localeCompare(b.startDate)),
  }));
  recurringSeries.sort((a, b) => a.summary.localeCompare(b.summary));

  return { oneOffs, recurringSeries, skippedCount };
}
