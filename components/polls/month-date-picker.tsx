"use client";

import { useMemo, useState } from "react";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toIsoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromIsoLocal(s: string): Date {
  const parts = s.split("-").map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(y, m - 1, d);
}

function startOfToday(): Date {
  const n = new Date();
  n.setHours(0, 0, 0, 0);
  return n;
}

export function MonthDatePicker({
  value,
  onChange,
  max,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  max: number;
}) {
  const today = startOfToday();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const selected = useMemo(() => new Set(value), [value]);
  const count = value.length;
  const atCap = count >= max;

  // Build a 6-row grid of 7 days starting on Sunday
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }

  const toggleDate = (d: Date) => {
    const iso = toIsoLocal(d);
    const next = new Set(selected);
    if (next.has(iso)) {
      next.delete(iso);
    } else {
      if (atCap) return;
      next.add(iso);
    }
    onChange(Array.from(next).sort());
  };

  // Toggle every day of `weekday` in the visible month that's today-or-later.
  // If every eligible day is already selected, unselect them all. Otherwise
  // select as many as the cap allows (prioritizing earliest first).
  const toggleWeekday = (weekday: number) => {
    const eligibleInMonth: string[] = [];
    for (let d = 1; d <= monthEnd.getDate(); d++) {
      const date = new Date(cursor.getFullYear(), cursor.getMonth(), d);
      if (date < today) continue;
      if (date.getDay() !== weekday) continue;
      eligibleInMonth.push(toIsoLocal(date));
    }
    if (eligibleInMonth.length === 0) return;

    const next = new Set(selected);
    const allOn = eligibleInMonth.every((iso) => next.has(iso));
    if (allOn) {
      for (const iso of eligibleInMonth) next.delete(iso);
    } else {
      for (const iso of eligibleInMonth) {
        if (next.size >= max) break;
        next.add(iso);
      }
    }
    onChange(Array.from(next).sort());
  };

  const removeOne = (iso: string) => {
    const next = new Set(selected);
    next.delete(iso);
    onChange(Array.from(next).sort());
  };

  const stepMonth = (delta: number) => {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
  };

  const chipFmt = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => stepMonth(-1)}
          className="rounded-full border border-black/15 px-3 py-1 text-sm dark:border-white/15"
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="font-medium">
          {MONTH_LABELS[cursor.getMonth()]} {cursor.getFullYear()}
        </span>
        <button
          type="button"
          onClick={() => stepMonth(1)}
          className="rounded-full border border-black/15 px-3 py-1 text-sm dark:border-white/15"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => toggleWeekday(i)}
            className="rounded-md border border-black/10 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
            title={`Toggle every ${label} in ${MONTH_LABELS[cursor.getMonth()]}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          const iso = toIsoLocal(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const isPast = d < today;
          const isSelected = selected.has(iso);
          const isToday = toIsoLocal(d) === toIsoLocal(today);
          const disabled = isPast;
          const base = "aspect-square rounded-md text-sm transition";
          const cls = disabled
            ? `${base} cursor-not-allowed text-black/25 dark:text-white/20`
            : isSelected
              ? `${base} bg-accent text-white font-semibold`
              : inMonth
                ? `${base} border border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5`
                : `${base} text-black/30 hover:bg-black/5 dark:text-white/30 dark:hover:bg-white/5`;
          const atCapAndNotSelected = atCap && !isSelected;
          return (
            <button
              key={i}
              type="button"
              disabled={disabled || atCapAndNotSelected}
              onClick={() => toggleDate(d)}
              className={cls}
              aria-pressed={isSelected}
              aria-label={d.toDateString()}
            >
              <span className={isToday ? "underline" : undefined}>{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className={atCap ? "font-semibold" : "opacity-70"}>
          {count} / {max} selected
        </span>
        {count > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-sm underline opacity-70 hover:opacity-100"
          >
            Clear all
          </button>
        )}
      </div>

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((iso) => (
            <li key={iso}>
              <button
                type="button"
                onClick={() => removeOne(iso)}
                className="group flex items-center gap-1 rounded-full border border-black/15 bg-black/5 px-3 py-1 text-xs dark:border-white/15 dark:bg-white/5"
                title="Remove"
              >
                <span>{chipFmt.format(fromIsoLocal(iso))}</span>
                <span className="opacity-50 group-hover:opacity-100">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
