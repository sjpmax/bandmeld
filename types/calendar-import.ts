/**
 * Shared shapes for calendar import flows (Google OAuth and Apple ICS).
 * The review UI and the Server Action both consume these — the source of
 * the events (Google API vs. parsed ICS file) is irrelevant past the
 * classification step.
 */

export type ReviewableEvent = {
  /** Unique id within the pulled set — Google event id, or ICS UID. */
  id: string;
  summary: string;
  /** Local-date YYYY-MM-DD. */
  startDate: string;
  endDate: string;
  /** True when the source was an all-day/date-only event (no clock time). */
  isAllDay: boolean;
  /** endDate - startDate in days, inclusive (1 = single day). */
  spanDays: number;
  /** Grouping key for recurring instances; null for one-offs. */
  seriesId: string | null;
  /** Preselect default: one-offs + multi-day on, recurring instances off. */
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
  /**
   * Events we would have shown but skipped because the source marked them
   * as "free" / "available" / transparent. Offered as a rescue list.
   */
  missed: ReviewableEvent[];
  /** Count of events dropped for other reasons (cancelled, no times, etc). */
  skippedCount: number;
};

/**
 * Per-event decision on the import review form.
 * - `free`  → do not create a member_unavailability row.
 * - `busy`  → create a firm block (is_tentative = false).
 * - `maybe` → create a tentative block (is_tentative = true).
 */
export type ImportStatus = "free" | "busy" | "maybe";

/** Hidden-input value: "<eventId>|<state>". `|` is safe for both Google event ids and ICS UIDs. */
export function statusInputValue(id: string, status: ImportStatus): string {
  return `${id}|${status}`;
}

/** Inverse of statusInputValue. Returns null if the value is malformed. */
export function parseStatusEntry(raw: string): { id: string; status: ImportStatus } | null {
  const sep = raw.lastIndexOf("|");
  if (sep <= 0) return null;
  const id = raw.slice(0, sep);
  const tail = raw.slice(sep + 1);
  const status: ImportStatus =
    tail === "maybe" ? "maybe" : tail === "busy" ? "busy" : tail === "free" ? "free" : "free";
  return { id, status };
}
