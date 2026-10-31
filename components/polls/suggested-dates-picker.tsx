"use client";

import { useMemo, useState } from "react";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_WEEKDAYS = [5, 6]; // Fri, Sat
const INITIAL_WEEKS = 8;
const SHOW_MORE_WEEKS = 4;

function toIsoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfToday(): Date {
  const n = new Date();
  n.setHours(0, 0, 0, 0);
  return n;
}

const chipFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

export function SuggestedDatesPicker({
  value,
  onChange,
  max,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  max: number;
}) {
  const today = startOfToday();
  const [weeks, setWeeks] = useState(INITIAL_WEEKS);
  const [weekdayFilter, setWeekdayFilter] = useState<Set<number>>(
    () => new Set(DEFAULT_WEEKDAYS),
  );

  const selected = useMemo(() => new Set(value), [value]);
  const count = value.length;
  const atCap = count >= max;

  const upcomingDates = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if (weekdayFilter.has(d.getDay())) dates.push(d);
    }
    return dates;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks, weekdayFilter]);

  const toggleDate = (iso: string) => {
    const next = new Set(selected);
    if (next.has(iso)) {
      next.delete(iso);
    } else {
      if (atCap) return;
      next.add(iso);
    }
    onChange(Array.from(next).sort());
  };

  const toggleWeekday = (idx: number) => {
    const next = new Set(weekdayFilter);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setWeekdayFilter(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-xs opacity-70">Days of the week to show</span>
        <div className="flex flex-wrap gap-1">
          {WEEKDAY_LABELS.map((label, i) => {
            const on = weekdayFilter.has(i);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleWeekday(i)}
                className={
                  on
                    ? "rounded-full border border-accent bg-accent px-3 py-1 text-xs font-semibold text-white"
                    : "rounded-full border border-black/15 px-3 py-1 text-xs font-semibold opacity-70 hover:opacity-100 dark:border-white/15"
                }
                aria-pressed={on}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {upcomingDates.length === 0 ? (
        <p className="rounded-xl border border-black/10 p-4 text-sm opacity-70 dark:border-white/10">
          Pick at least one weekday above to see dates.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {upcomingDates.map((d) => {
            const iso = toIsoLocal(d);
            const isSelected = selected.has(iso);
            const disabled = atCap && !isSelected;
            return (
              <li key={iso}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleDate(iso)}
                  aria-pressed={isSelected}
                  className={
                    isSelected
                      ? "rounded-full border border-accent bg-accent px-3 py-1.5 text-sm font-semibold text-white"
                      : disabled
                        ? "cursor-not-allowed rounded-full border border-black/10 px-3 py-1.5 text-sm opacity-40 dark:border-white/10"
                        : "rounded-full border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
                  }
                >
                  {chipFmt.format(d)}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center justify-between gap-3 text-sm">
        <span className={atCap ? "font-semibold" : "opacity-70"}>
          {count} / {max} selected
        </span>
        <div className="flex items-center gap-3">
          {count > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-sm underline opacity-70 hover:opacity-100"
            >
              Clear all
            </button>
          )}
          <button
            type="button"
            onClick={() => setWeeks((w) => w + SHOW_MORE_WEEKS)}
            className="rounded-full border border-black/15 px-3 py-1 text-xs dark:border-white/15"
          >
            Show {SHOW_MORE_WEEKS} more weeks
          </button>
        </div>
      </div>
    </div>
  );
}
