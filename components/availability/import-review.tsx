"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReviewPayload, ReviewableEvent, ReviewSeries } from "@/types/calendar-import";

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
  /** Server Action that receives the FormData with payload + selected ids. */
  applyAction: (formData: FormData) => void | Promise<void>;
  /** Button label while nothing is selected. */
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

export function ImportReview({ payload, applyAction, applyLabel = "Import" }: Props) {
  // Flat list of every event we show, serialized once as the hidden form payload.
  const allEvents: ReviewableEvent[] = useMemo(
    () => [
      ...payload.oneOffs,
      ...payload.recurringSeries.flatMap((s) => s.instances),
      ...payload.missed,
    ],
    [payload],
  );
  const payloadJson = useMemo(() => JSON.stringify(allEvents), [allEvents]);

  // selected: Set of event ids. Initialized from each event's preselect flag.
  const [selected, setSelected] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const e of allEvents) if (e.preselect) s.add(e.id);
    return s;
  });
  // Which series panels are expanded.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // List vs table view, hydrated from localStorage.
  // SSR and the initial client paint must agree, so we initialize to "list"
  // unconditionally and read the saved preference on mount. A returning user
  // whose preference is "table" sees one frame of List before the effect swaps.
  const [view, setView] = useState<ViewMode>("list");

  useEffect(() => {
    const stored = readStoredView();
    if (stored !== "list") setView(stored);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      // Private browsing or storage disabled — remember only for this session.
    }
  }, [view]);

  function toggleEvent(id: string, next: boolean) {
    setSelected((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  }

  function setSeries(series: ReviewSeries, next: boolean) {
    setSelected((prev) => {
      const copy = new Set(prev);
      for (const inst of series.instances) {
        if (next) copy.add(inst.id);
        else copy.delete(inst.id);
      }
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

  const selectedCount = selected.size;

  return (
    <form action={applyAction} className="flex flex-col gap-8">
      <input type="hidden" name="payload" value={payloadJson} />

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

      {/* Google marked these as free — surfaced first so users can rescue real conflicts
          before they move on. */}
      {payload.missed.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="rounded-xl border border-dashed border-amber-500/60 bg-amber-500/5 p-3">
            <h2 className="text-xl font-semibold">
              Google marked these as free — any you can&apos;t play?
            </h2>
            <p className="text-sm opacity-70">
              {payload.missed.length} event{payload.missed.length === 1 ? "" : "s"} came back as &quot;free&quot;
              in your calendar. Tap any that are actually conflicts to add them to your blocks.
            </p>
          </div>
          {view === "table" ? (
            <EventTableRows
              events={payload.missed}
              selected={selected}
              onToggle={toggleEvent}
              idPrefix="miss"
            />
          ) : (
            <EventListRows
              events={payload.missed}
              selected={selected}
              onToggle={toggleEvent}
              idPrefix="miss"
            />
          )}
        </section>
      )}

      {/* One-off and multi-day events — on by default */}
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
          <EventTableRows
            events={payload.oneOffs}
            selected={selected}
            onToggle={toggleEvent}
            idPrefix="ev"
          />
        ) : (
          <EventListRows
            events={payload.oneOffs}
            selected={selected}
            onToggle={toggleEvent}
            idPrefix="ev"
          />
        )}
      </section>

      {/* Recurring series — off by default, grouped under one toggle */}
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
              const picked = s.instances.filter((i) => selected.has(i.id)).length;
              const allOn = picked === total && total > 0;
              const isOpen = expanded.has(s.seriesId);
              return (
                <li key={s.seriesId} className="rounded-xl border border-black/10 dark:border-white/10">
                  <div className="flex items-center gap-3 p-3">
                    <input
                      type="checkbox"
                      id={`ser-${s.seriesId}`}
                      checked={allOn}
                      onChange={(ev) => setSeries(s, ev.currentTarget.checked)}
                      className="h-5 w-5"
                    />
                    <label htmlFor={`ser-${s.seriesId}`} className="flex flex-1 flex-col">
                      <span className="font-medium">{s.summary}</span>
                      <span className="text-sm opacity-70">
                        {total} instance{total === 1 ? "" : "s"}
                        {picked > 0 && picked < total && ` · ${picked} selected`}
                      </span>
                    </label>
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
                          selected={selected}
                          onToggle={toggleEvent}
                          idPrefix={`inst-${s.seriesId}`}
                        />
                      ) : (
                        <ul className="flex flex-col gap-1 pl-7">
                          {s.instances.map((inst) => (
                            <li key={inst.id} className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                id={`inst-${inst.id}`}
                                name="selected"
                                value={inst.id}
                                checked={selected.has(inst.id)}
                                onChange={(ev) => toggleEvent(inst.id, ev.currentTarget.checked)}
                                className="h-4 w-4"
                              />
                              <label htmlFor={`inst-${inst.id}`} className="text-sm opacity-80">
                                {rangeLabel(inst)}
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  {/* Hidden inputs: when series is checked but panel is closed,
                      we still need to submit all instance ids. The checkbox
                      inside the open panel already supplies them when open. */}
                  {!isOpen &&
                    s.instances
                      .filter((inst) => selected.has(inst.id))
                      .map((inst) => (
                        <input key={inst.id} type="hidden" name="selected" value={inst.id} />
                      ))}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-full border border-black/15 bg-paper/95 px-5 py-3 shadow-lg backdrop-blur dark:border-white/20 dark:bg-black/70">
        <span className="text-sm">
          <span className="font-semibold">{selectedCount}</span> event
          {selectedCount === 1 ? "" : "s"} selected
        </span>
        <button
          type="submit"
          disabled={selectedCount === 0}
          className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {applyLabel} {selectedCount || ""} as unavailability
        </button>
      </div>
    </form>
  );
}

type RowsProps = {
  events: ReviewableEvent[];
  selected: Set<string>;
  onToggle: (id: string, next: boolean) => void;
  /** Prefix for input ids so the three sections never collide. */
  idPrefix: string;
};

function EventListRows({ events, selected, onToggle, idPrefix }: RowsProps) {
  return (
    <ul className="flex flex-col gap-2">
      {events.map((e) => (
        <li
          key={e.id}
          className="flex items-center gap-3 rounded-xl border border-black/10 p-3 dark:border-white/10"
        >
          <input
            type="checkbox"
            id={`${idPrefix}-${e.id}`}
            name="selected"
            value={e.id}
            checked={selected.has(e.id)}
            onChange={(ev) => onToggle(e.id, ev.currentTarget.checked)}
            className="h-5 w-5"
          />
          <label htmlFor={`${idPrefix}-${e.id}`} className="flex flex-1 flex-col">
            <span className="font-medium">{e.summary}</span>
            <span className="text-sm opacity-70">
              {rangeLabel(e)}
              {e.spanDays >= 2 && (
                <> · <span className="font-medium">{e.spanDays} days</span></>
              )}
              {!e.isAllDay && e.spanDays === 1 && <> · timed</>}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short" });
function dayLabel(iso: string): string {
  return dayFmt.format(new Date(`${iso}T00:00:00`));
}

function EventTableRows({ events, selected, onToggle, idPrefix }: RowsProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
      <table className="w-full text-sm">
        <thead className="bg-black/5 text-left text-xs uppercase tracking-wide dark:bg-white/5">
          <tr>
            <th className="w-10 px-3 py-2" scope="col">
              <span className="sr-only">Pick</span>
            </th>
            <th className="px-3 py-2" scope="col">Date</th>
            <th className="px-3 py-2" scope="col">Day</th>
            <th className="px-3 py-2" scope="col">Event</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-t border-black/5 dark:border-white/10">
              <td className="px-3 py-2 align-middle">
                <input
                  type="checkbox"
                  id={`${idPrefix}-${e.id}`}
                  name="selected"
                  value={e.id}
                  checked={selected.has(e.id)}
                  onChange={(ev) => onToggle(e.id, ev.currentTarget.checked)}
                  className="h-5 w-5"
                />
              </td>
              <td className="px-3 py-2 align-middle">
                <label htmlFor={`${idPrefix}-${e.id}`}>{rangeLabel(e)}</label>
              </td>
              <td className="px-3 py-2 align-middle opacity-70">{dayLabel(e.startDate)}</td>
              <td className="px-3 py-2 align-middle">
                {e.summary}
                {e.spanDays >= 2 && (
                  <span className="opacity-60"> · {e.spanDays} days</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
