"use client";

import { useEffect, useMemo, useState } from "react";
import {
  statusInputValue,
  type ImportStatus,
  type ReviewPayload,
  type ReviewableEvent,
  type ReviewSeries,
} from "@/types/calendar-import";

type ViewMode = "list" | "table";
const VIEW_STORAGE_KEY = "bandsnap:import-view";

function readStoredView(): ViewMode {
  if (typeof window === "undefined") return "list";
  try {
    const v = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return v === "table" ? "table" : "list";
  } catch {
    return "list";
  }
}

type Props = {
  payload: ReviewPayload;
  applyAction: (formData: FormData) => void | Promise<void>;
  applyLabel?: string;
};

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const fmt = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00`));

function rangeLabel(e: ReviewableEvent) {
  return e.startDate === e.endDate ? fmt(e.startDate) : `${fmt(e.startDate)} → ${fmt(e.endDate)}`;
}

const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short" });
function dayLabel(iso: string): string {
  return dayFmt.format(new Date(`${iso}T00:00:00`));
}

/**
 * Default status for an event, derived from its section:
 * - missed  → "free"  (Google said free; user confirms by moving to busy/maybe)
 * - oneOff  → "busy"  (matches today's preselect: on by default)
 * - recurring instance → "free" (matches today's preselect: off by default)
 */
function defaultStatus(e: ReviewableEvent, section: "missed" | "oneOff" | "instance"): ImportStatus {
  if (section === "missed") return "free";
  if (section === "oneOff") return "busy";
  return "free";
}

export function ImportReview({ payload, applyAction, applyLabel = "Import" }: Props) {
  const allEvents: ReviewableEvent[] = useMemo(
    () => [
      ...payload.oneOffs,
      ...payload.recurringSeries.flatMap((s) => s.instances),
      ...payload.missed,
    ],
    [payload],
  );
  const payloadJson = useMemo(() => JSON.stringify(allEvents), [allEvents]);

  const [status, setStatus] = useState<Record<string, ImportStatus>>(() => {
    const map: Record<string, ImportStatus> = {};
    for (const e of payload.oneOffs) map[e.id] = defaultStatus(e, "oneOff");
    for (const s of payload.recurringSeries) {
      for (const inst of s.instances) map[inst.id] = defaultStatus(inst, "instance");
    }
    for (const e of payload.missed) map[e.id] = defaultStatus(e, "missed");
    return map;
  });

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [view, setView] = useState<ViewMode>("list");

  useEffect(() => {
    const stored = readStoredView();
    if (stored !== "list") setView(stored);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      // Private browsing / storage disabled — just remember for this session.
    }
  }, [view]);

  function setEventStatus(id: string, next: ImportStatus) {
    setStatus((prev) => ({ ...prev, [id]: next }));
  }

  function setSeriesStatus(series: ReviewSeries, next: ImportStatus) {
    setStatus((prev) => {
      const copy = { ...prev };
      for (const inst of series.instances) copy[inst.id] = next;
      return copy;
    });
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  }

  const blockedCount = Object.values(status).filter((s) => s !== "free").length;

  return (
    <form action={applyAction} className="flex flex-col gap-8">
      <input type="hidden" name="payload" value={payloadJson} />
      {allEvents.map((e) => (
        <input
          key={e.id}
          type="hidden"
          name="status"
          value={statusInputValue(e.id, status[e.id] ?? "free")}
        />
      ))}

      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="opacity-70">
          {payload.missed.length} missed · {payload.oneOffs.length} one-off ·{" "}
          {payload.recurringSeries.length} series
        </span>
        <div
          role="group"
          aria-label="View mode"
          className="inline-flex overflow-hidden rounded-full border border-black/15 dark:border-white/20"
        >
          <button
            type="button"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
            className={
              "px-3 py-1 text-xs font-medium " +
              (view === "list" ? "bg-ink text-paper dark:bg-white dark:text-black" : "opacity-70")
            }
          >
            ≡ List
          </button>
          <button
            type="button"
            aria-pressed={view === "table"}
            onClick={() => setView("table")}
            className={
              "px-3 py-1 text-xs font-medium " +
              (view === "table" ? "bg-ink text-paper dark:bg-white dark:text-black" : "opacity-70")
            }
          >
            ▦ Table
          </button>
        </div>
      </div>

      {payload.missed.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="rounded-xl border border-dashed border-amber-500/60 bg-amber-500/5 p-3">
            <h2 className="text-xl font-semibold">
              Google marked these as free — any you can&apos;t play?
            </h2>
            <p className="text-sm opacity-70">
              {payload.missed.length} event{payload.missed.length === 1 ? "" : "s"} came back as &quot;free&quot;
              in your calendar. Switch any that are actually conflicts to Busy or Maybe.
            </p>
          </div>
          {view === "table" ? (
            <EventTableRows events={payload.missed} status={status} onChange={setEventStatus} />
          ) : (
            <EventListRows events={payload.missed} status={status} onChange={setEventStatus} />
          )}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">
          One-off & multi-day events{" "}
          <span className="text-sm font-normal opacity-60">({payload.oneOffs.length})</span>
        </h2>
        {payload.oneOffs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/20 p-4 text-sm opacity-70 dark:border-white/20">
            No single or multi-day events found.
          </p>
        ) : view === "table" ? (
          <EventTableRows events={payload.oneOffs} status={status} onChange={setEventStatus} />
        ) : (
          <EventListRows events={payload.oneOffs} status={status} onChange={setEventStatus} />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">
          Recurring events{" "}
          <span className="text-sm font-normal opacity-60">
            ({payload.recurringSeries.length} series)
          </span>
        </h2>
        <p className="text-sm opacity-70">
          Off by default — rehearsal and standing meetings rarely mean you can&apos;t play. Flip a
          series on if it&apos;s a real conflict.
        </p>
        {payload.recurringSeries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/20 p-4 text-sm opacity-70 dark:border-white/20">
            No recurring events found.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {payload.recurringSeries.map((s) => {
              const total = s.instances.length;
              const blocked = s.instances.filter((i) => (status[i.id] ?? "free") !== "free").length;
              const isOpen = expanded.has(s.seriesId);
              return (
                <li key={s.seriesId} className="rounded-xl border border-black/10 dark:border-white/10">
                  <div className="flex flex-wrap items-center gap-3 p-3">
                    <div className="flex flex-1 flex-col">
                      <span className="font-medium">{s.summary}</span>
                      <span className="text-sm opacity-70">
                        {total} instance{total === 1 ? "" : "s"}
                        {blocked > 0 && ` · ${blocked} blocked`}
                      </span>
                    </div>
                    <BulkStatusButtons onPick={(next) => setSeriesStatus(s, next)} />
                    <button
                      type="button"
                      onClick={() => toggleExpanded(s.seriesId)}
                      className="text-sm underline opacity-70 hover:opacity-100"
                    >
                      {isOpen ? "Hide" : "Instances"}
                    </button>
                  </div>
                  {isOpen && (
                    <div className="border-t border-black/10 p-3 dark:border-white/10">
                      {view === "table" ? (
                        <EventTableRows
                          events={s.instances}
                          status={status}
                          onChange={setEventStatus}
                        />
                      ) : (
                        <EventListRows
                          events={s.instances}
                          status={status}
                          onChange={setEventStatus}
                        />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-full border border-black/15 bg-paper/95 px-5 py-3 shadow-lg backdrop-blur dark:border-white/20 dark:bg-black/70">
        <span className="text-sm">
          <span className="font-semibold">{blockedCount}</span> event
          {blockedCount === 1 ? "" : "s"} to block
        </span>
        <button
          type="submit"
          disabled={blockedCount === 0}
          className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {applyLabel} {blockedCount || ""} as unavailability
        </button>
      </div>
    </form>
  );
}

type RowsProps = {
  events: ReviewableEvent[];
  status: Record<string, ImportStatus>;
  onChange: (id: string, next: ImportStatus) => void;
};

function EventListRows({ events, status, onChange }: RowsProps) {
  return (
    <ul className="flex flex-col gap-2">
      {events.map((e) => (
        <li
          key={e.id}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-black/10 p-3 dark:border-white/10"
        >
          <div className="flex flex-1 flex-col min-w-0">
            <span className="font-medium">{e.summary}</span>
            <span className="text-sm opacity-70">
              {rangeLabel(e)}
              {e.spanDays >= 2 && (
                <> · <span className="font-medium">{e.spanDays} days</span></>
              )}
              {!e.isAllDay && e.spanDays === 1 && <> · timed</>}
            </span>
          </div>
          <StatusPill current={status[e.id] ?? "free"} onChange={(next) => onChange(e.id, next)} />
        </li>
      ))}
    </ul>
  );
}

function EventTableRows({ events, status, onChange }: RowsProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
      <table className="w-full text-sm">
        <thead className="bg-black/5 text-left text-xs uppercase tracking-wide dark:bg-white/5">
          <tr>
            <th className="px-3 py-2" scope="col">Date</th>
            <th className="px-3 py-2" scope="col">Day</th>
            <th className="px-3 py-2" scope="col">Event</th>
            <th className="px-3 py-2" scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-t border-black/5 dark:border-white/10">
              <td className="px-3 py-2 align-middle whitespace-nowrap">{rangeLabel(e)}</td>
              <td className="px-3 py-2 align-middle opacity-70 whitespace-nowrap">{dayLabel(e.startDate)}</td>
              <td className="px-3 py-2 align-middle">
                {e.summary}
                {e.spanDays >= 2 && (
                  <span className="opacity-60"> · {e.spanDays} days</span>
                )}
              </td>
              <td className="px-3 py-2 align-middle">
                <StatusPill
                  current={status[e.id] ?? "free"}
                  onChange={(next) => onChange(e.id, next)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type PillProps = {
  current: ImportStatus;
  onChange: (next: ImportStatus) => void;
};

const PILL_OPTIONS: { value: ImportStatus; label: string; on: string }[] = [
  { value: "free",  label: "Free",  on: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { value: "busy",  label: "Busy",  on: "bg-red-500/15 text-red-700 dark:text-red-300" },
  { value: "maybe", label: "Maybe", on: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
];

function StatusPill({ current, onChange }: PillProps) {
  return (
    <div
      role="group"
      aria-label="Status"
      className="inline-flex overflow-hidden rounded-full border border-black/15 bg-black/5 p-0.5 dark:border-white/20 dark:bg-white/5"
    >
      {PILL_OPTIONS.map((opt) => {
        const active = current === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={
              "rounded-full px-3 py-1 text-xs font-medium transition-colors " +
              (active ? opt.on + " font-semibold" : "opacity-70 hover:opacity-100")
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function BulkStatusButtons({ onPick }: { onPick: (next: ImportStatus) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <span className="mr-1 opacity-60">Mark all:</span>
      {PILL_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onPick(opt.value)}
          className="rounded-full border border-black/15 bg-white px-2.5 py-1 font-medium hover:bg-black/5 dark:border-white/20 dark:bg-white/5 dark:hover:bg-white/10"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
