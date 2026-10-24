"use client";

import { useMemo, useState } from "react";
import { applyGoogleImport } from "@/app/dashboard/availability/actions";
import type { ReviewPayload, ReviewableEvent, ReviewSeries } from "@/lib/google-calendar";

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

export function GoogleImportReview({ payload }: { payload: ReviewPayload }) {
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
  const [showMissed, setShowMissed] = useState(false);

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
    <form action={applyGoogleImport} className="flex flex-col gap-8">
      <input type="hidden" name="payload" value={payloadJson} />

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
        ) : (
          <ul className="flex flex-col gap-2">
            {payload.oneOffs.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-3 rounded-xl border border-black/10 p-3 dark:border-white/10"
              >
                <input
                  type="checkbox"
                  id={`ev-${e.id}`}
                  name="selected"
                  value={e.id}
                  checked={selected.has(e.id)}
                  onChange={(ev) => toggleEvent(e.id, ev.currentTarget.checked)}
                  className="h-5 w-5"
                />
                <label htmlFor={`ev-${e.id}`} className="flex flex-1 flex-col">
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
                    <ul className="flex flex-col gap-1 border-t border-black/10 p-3 pl-10 dark:border-white/10">
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

      {/* "Did I miss one?" — events we skipped because Google marks them "free" */}
      {payload.missed.length > 0 && (
        <section className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setShowMissed((v) => !v)}
            className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-black/20 p-3 text-left dark:border-white/20"
          >
            <span>
              <span className="font-semibold">Did I miss one?</span>
              <span className="block text-sm opacity-70">
                {payload.missed.length} event{payload.missed.length === 1 ? "" : "s"} you marked
                &ldquo;free&rdquo; in Google — tap to rescue any real blocks.
              </span>
            </span>
            <span className="text-sm underline opacity-70">{showMissed ? "Hide" : "Show"}</span>
          </button>
          {showMissed && (
            <ul className="flex flex-col gap-2">
              {payload.missed.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-3 rounded-xl border border-black/10 p-3 dark:border-white/10"
                >
                  <input
                    type="checkbox"
                    id={`miss-${e.id}`}
                    name="selected"
                    value={e.id}
                    checked={selected.has(e.id)}
                    onChange={(ev) => toggleEvent(e.id, ev.currentTarget.checked)}
                    className="h-5 w-5"
                  />
                  <label htmlFor={`miss-${e.id}`} className="flex flex-1 flex-col">
                    <span className="font-medium">{e.summary}</span>
                    <span className="text-sm opacity-70">
                      {rangeLabel(e)}
                      {e.spanDays >= 2 && (
                        <> · <span className="font-medium">{e.spanDays} days</span></>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
          Import {selectedCount || ""} as unavailability
        </button>
      </div>
    </form>
  );
}
