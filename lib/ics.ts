/**
 * ICS (RFC 5545) → ReviewPayload adapter.
 *
 * Parses an uploaded `.ics` file with ical.js and produces the same
 * ReviewPayload the Google Calendar flow emits — so the review UI and
 * the apply action work unchanged.
 *
 * Recurring events are expanded within a 366-day forward window to match
 * the Google flow's horizon. ical.js handles RRULE / EXDATE / RDATE.
 */

import ICAL from "ical.js";
import type { ReviewableEvent, ReviewPayload, ReviewSeries } from "@/types/calendar-import";

/** Keywords that override an event's "free" transparency flag. Mirrors
 *  the Google classifier so the two sources behave consistently. */
const TRAVEL_RE =
  /\b(flight|flying|airline|train|driving to|drive to|stay at|staying at|hotel|airbnb|lodging|vacation|holiday|trip|traveling|travelling|away|out of office|ooo|pto|offsite|off-site)\b/i;

function looksLikeTravel(summary: string): boolean {
  return TRAVEL_RE.test(summary);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function diffDaysInclusive(start: string, end: string): number {
  const a = new Date(`${start}T00:00:00`).getTime();
  const b = new Date(`${end}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

type NormalizedOccurrence = {
  uid: string;
  summary: string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  isTransparent: boolean;
  isCancelled: boolean;
  seriesId: string | null;
  /** Stable per-occurrence id when a series is expanded. */
  occurrenceId: string;
};

function normalizeOccurrence(
  vevent: ICAL.Event,
  startTime: ICAL.Time,
  endTime: ICAL.Time,
  isSeriesInstance: boolean,
): NormalizedOccurrence {
  const isAllDay = startTime.isDate;
  const startJs = startTime.toJSDate();
  // ical.js end for an all-day event is exclusive (same convention as iCal
  // itself). Subtract one day to match our stored end_date (inclusive).
  const endJsRaw = endTime.toJSDate();
  const endJs =
    isAllDay
      ? new Date(endJsRaw.getTime() - 86_400_000)
      : endJsRaw;
  const startDate = toLocalDate(startJs);
  const endDate = toLocalDate(endJs);
  const summary = vevent.summary?.trim() || "(Untitled event)";
  const uid = vevent.uid ?? `${startDate}-${summary}`;
  const transp = vevent.component.getFirstPropertyValue("transp");
  const status = vevent.component.getFirstPropertyValue("status");
  return {
    uid,
    summary,
    startDate,
    endDate: endDate < startDate ? startDate : endDate,
    isAllDay,
    isTransparent: typeof transp === "string" && transp.toUpperCase() === "TRANSPARENT",
    isCancelled: typeof status === "string" && status.toUpperCase() === "CANCELLED",
    seriesId: isSeriesInstance ? uid : null,
    occurrenceId: isSeriesInstance ? `${uid}@${startDate}` : uid,
  };
}

function expandRecurrence(
  vevent: ICAL.Event,
  from: Date,
  to: Date,
  cancelledOverrides: ReadonlySet<string>,
): NormalizedOccurrence[] {
  const results: NormalizedOccurrence[] = [];
  const iterator = vevent.iterator();
  const fromTime = ICAL.Time.fromJSDate(from, false);
  const toTime = ICAL.Time.fromJSDate(to, false);
  // Count KEPT occurrences against the 1000 cap so ancient DTSTART values
  // don't silently exhaust the budget before reaching the forward window.
  // A separate 100k iteration ceiling catches a runaway/malformed RRULE.
  let kept = 0;
  for (let i = 0; i < 100_000 && kept < 1000; i++) {
    const next = iterator.next();
    if (!next) break;
    if (next.compare(toTime) > 0) break;
    if (next.compare(fromTime) < 0) continue;
    const details = vevent.getOccurrenceDetails(next);
    const occ = normalizeOccurrence(vevent, details.startDate, details.endDate, true);
    // Skip occurrences the ICS file explicitly cancelled via a
    // RECURRENCE-ID override with STATUS:CANCELLED.
    if (cancelledOverrides.has(occ.startDate)) continue;
    results.push(occ);
    kept++;
  }
  return results;
}

/** Collects CANCELLED recurrence overrides keyed by UID → set of YYYY-MM-DD
 *  dates. The main loop uses this to filter out occurrences the author
 *  explicitly cancelled, which ical.js's isRecurrenceException() hides
 *  from the master iterator. */
function collectCancelledOverrides(vevents: ICAL.Component[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const vcomp of vevents) {
    const statusVal = vcomp.getFirstPropertyValue("status");
    const isCancelled =
      typeof statusVal === "string" && statusVal.toUpperCase() === "CANCELLED";
    if (!isCancelled) continue;
    const recId = vcomp.getFirstPropertyValue("recurrence-id");
    if (!recId || typeof (recId as ICAL.Time).toJSDate !== "function") continue;
    const uid = vcomp.getFirstPropertyValue("uid");
    if (typeof uid !== "string") continue;
    const date = (recId as ICAL.Time).toJSDate();
    const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    if (!out.has(uid)) out.set(uid, new Set());
    out.get(uid)!.add(dateStr);
  }
  return out;
}

/**
 * Parse an .ics file text payload into a ReviewPayload. Expands recurring
 * events across [now, now + 366 days). Mirrors the Google classifier's
 * preselect rules so the review UI reads the same.
 */
export function parseIcsToReviewPayload(text: string): ReviewPayload {
  const jcal = ICAL.parse(text);
  const comp = new ICAL.Component(jcal);
  const vevents = comp.getAllSubcomponents("vevent");

  const now = new Date();
  const horizon = new Date(now.getTime() + 366 * 24 * 60 * 60 * 1000);

  const cancelledOverrides = collectCancelledOverrides(vevents);

  let skippedCount = 0;
  const occurrences: NormalizedOccurrence[] = [];

  for (const comp of vevents) {
    let event: ICAL.Event;
    try {
      event = new ICAL.Event(comp);
    } catch {
      skippedCount++;
      continue;
    }
    if (event.isRecurrenceException()) continue;

    if (event.isRecurring()) {
      const uidKey = typeof event.uid === "string" ? event.uid : "";
      const cancelledForThis = cancelledOverrides.get(uidKey) ?? new Set<string>();
      const expanded = expandRecurrence(event, now, horizon, cancelledForThis);
      occurrences.push(...expanded);
    } else {
      const start = event.startDate;
      const end = event.endDate ?? event.startDate;
      if (!start) {
        skippedCount++;
        continue;
      }
      const occ = normalizeOccurrence(event, start, end, false);
      // Skip past-dated one-offs.
      if (occ.endDate < toLocalDate(now)) continue;
      occurrences.push(occ);
    }
  }

  const oneOffs: ReviewableEvent[] = [];
  const missed: ReviewableEvent[] = [];
  const seriesMap = new Map<string, ReviewSeries>();

  for (const occ of occurrences) {
    if (occ.isCancelled) {
      skippedCount++;
      continue;
    }
    const spanDays = diffDaysInclusive(occ.startDate, occ.endDate);
    const isMultiDay = spanDays >= 2;
    const isRecurring = occ.seriesId !== null;
    const transparentButObviousBlock =
      occ.isTransparent && (isMultiDay || looksLikeTravel(occ.summary));

    if (occ.isTransparent && !transparentButObviousBlock) {
      missed.push({
        id: occ.occurrenceId,
        summary: occ.summary,
        startDate: occ.startDate,
        endDate: occ.endDate,
        isAllDay: occ.isAllDay,
        spanDays,
        seriesId: occ.seriesId,
        preselect: false,
      });
      continue;
    }

    const preselect = !isRecurring || isMultiDay;
    const review: ReviewableEvent = {
      id: occ.occurrenceId,
      summary: occ.summary,
      startDate: occ.startDate,
      endDate: occ.endDate,
      isAllDay: occ.isAllDay,
      spanDays,
      seriesId: occ.seriesId,
      preselect,
    };

    if (occ.seriesId) {
      const existing = seriesMap.get(occ.seriesId);
      if (existing) existing.instances.push(review);
      else
        seriesMap.set(occ.seriesId, {
          seriesId: occ.seriesId,
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
