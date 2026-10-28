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

/** The non-secret metadata row. Tokens live in the Vault now; see
 *  loadGoogleTokens / storeGoogleTokens / clearGoogleTokens below. */
export type GoogleConnection = Tables<"google_calendar_connections">;

/** The decrypted token pair for a user — read via the get_google_tokens RPC. */
export type GoogleTokens = { access_token: string; refresh_token: string | null };

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
 * Returns a usable access token, refreshing on-demand.
 *
 * Takes the Vault-decrypted token pair (from `loadGoogleTokens`) plus the
 * expiry timestamp (from `google_calendar_connections.expires_at`), and an
 * `onRefresh` callback the caller uses to persist the new access_token +
 * expires_at. The refresh_token is not re-issued by Google on refresh, so
 * the callback only needs to deal with those two fields.
 */
export async function getValidAccessToken(
  current: { access_token: string; refresh_token: string | null; expires_at: string },
  onRefresh: (next: { access_token: string; expires_at: string }) => Promise<void>,
): Promise<string> {
  const now = Date.now();
  const expiresAtMs = new Date(current.expires_at).getTime();
  // 60s skew buffer
  if (expiresAtMs - now > 60_000) return current.access_token;

  if (!current.refresh_token) {
    throw new Error(
      "Google refresh token missing. Disconnect and reconnect Google Calendar.",
    );
  }

  const refreshed = await refreshAccessToken(current.refresh_token);
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

import type { ReviewableEvent, ReviewPayload, ReviewSeries } from "@/types/calendar-import";
export type { ReviewableEvent, ReviewPayload, ReviewSeries };

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

/**
 * Local wall-clock date (YYYY-MM-DD) of an RFC3339 dateTime at its own offset.
 * Google returns timed events as e.g. "2026-11-07T19:00:00-05:00"; the first
 * 10 chars already name the event's local date, which is what the user sees
 * on their calendar. Round-tripping through `new Date(...)` would re-interpret
 * it in the server's timezone (UTC on Vercel), shifting East-Coast evenings
 * to the next day. For a bare "Z" (UTC) string we honor UTC as-is.
 */
function localDateOfDateTime(iso: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T/.exec(iso);
  if (m && m[1]) return m[1];
  return toLocalDate(new Date(iso));
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
  // Timed event: read the local wall-clock date straight from the dateTime
  // string so the server's timezone can't shift it.
  const startRaw = ev.start.dateTime ?? ev.start.date ?? "";
  const endRaw = ev.end.dateTime ?? ev.end.date ?? ev.start.dateTime ?? "";
  return {
    startDate: localDateOfDateTime(startRaw),
    endDate: localDateOfDateTime(endRaw),
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
/**
 * Words/phrases that signal "I'm actually unavailable" even when Google says
 * the event is `transparent` (free). Airline bookings and hotel reservations
 * are usually synced in as free, which is wrong for our purposes.
 */
const TRAVEL_RE =
  /\b(flight|flying|airline|train|driving to|drive to|stay at|staying at|hotel|airbnb|lodging|vacation|holiday|trip|traveling|travelling|away|out of office|ooo|pto|offsite|off-site)\b/i;

function looksLikeTravel(summary: string): boolean {
  return TRAVEL_RE.test(summary);
}

export function classifyEvents(events: GoogleEvent[]): ReviewPayload {
  let skippedCount = 0;
  const oneOffs: ReviewableEvent[] = [];
  const missed: ReviewableEvent[] = [];
  const seriesMap = new Map<string, ReviewSeries>();

  for (const ev of events) {
    if (ev.status === "cancelled" || !ev.start || !ev.end) {
      skippedCount++;
      continue;
    }

    const range = eventToRange(ev);
    const spanDays = diffDaysInclusive(range.startDate, range.endDate);
    const seriesId = ev.recurringEventId ?? null;
    const isRecurring = seriesId !== null;
    const isMultiDay = spanDays >= 2;
    const summary = ev.summary?.trim() || "(Untitled event)";
    const isTransparent = ev.transparency === "transparent";
    const isTravel = looksLikeTravel(summary);

    // Transparent events usually mean "I'm free during this" — but travel
    // bookings and multi-day stays sync in as transparent while being
    // obvious unavailability. Rescue those into the main list.
    const transparentButObviousBlock = isTransparent && (isMultiDay || isTravel);
    if (isTransparent && !transparentButObviousBlock) {
      missed.push({
        id: ev.id,
        summary,
        startDate: range.startDate,
        endDate: range.endDate,
        isAllDay: range.isAllDay,
        spanDays,
        seriesId,
        preselect: false,
      });
      continue;
    }

    // Preselect: one-off ON, multi-day ON, recurring OFF (user opts in
    // per series).
    const preselect = !isRecurring || isMultiDay;
    const review: ReviewableEvent = {
      id: ev.id,
      summary,
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
  missed.sort((a, b) => a.startDate.localeCompare(b.startDate));
  const recurringSeries = Array.from(seriesMap.values()).map((s) => ({
    ...s,
    instances: s.instances.sort((a, b) => a.startDate.localeCompare(b.startDate)),
  }));
  recurringSeries.sort((a, b) => a.summary.localeCompare(b.summary));

  return { oneOffs, recurringSeries, missed, skippedCount };
}
