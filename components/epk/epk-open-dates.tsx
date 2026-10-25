"use client";

import { useMemo, useState } from "react";
import type { BandOpenDate, GigStatus } from "@/types";

type OpenDateItem = Pick<BandOpenDate, "target_date" | "status">;

type Props = {
  openDates: OpenDateItem[];
  bandName: string;
};

type GroupedMonth = {
  monthKey: string; // "2026-11"
  monthLabel: string; // "November 2026"
  dates: {
    iso: string;
    dayNum: number;
    weekdayName: string;
    isWeekend: boolean;
    status: GigStatus | null;
  }[];
};

export function EpkOpenDates({ openDates, bandName }: Props) {
  const [showAll, setShowAll] = useState(false);

  // Group dates by Month
  const groupedMonths = useMemo(() => {
    const map = new Map<string, GroupedMonth>();

    for (const d of openDates) {
      if (!d.target_date) continue;
      // Use UTC to prevent timezone skew on date-only ISO strings
      const dateObj = new Date(`${d.target_date}T00:00:00Z`);
      const year = dateObj.getUTCFullYear();
      const month = dateObj.getUTCMonth();
      const dow = dateObj.getUTCDay(); // 0 = Sun, 5 = Fri, 6 = Sat
      const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

      if (!map.has(monthKey)) {
        const monthLabel = dateObj.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        });
        map.set(monthKey, { monthKey, monthLabel, dates: [] });
      }

      const weekdayName = dateObj.toLocaleDateString("en-US", {
        weekday: "short",
        timeZone: "UTC",
      });

      map.get(monthKey)!.dates.push({
        iso: d.target_date,
        dayNum: dateObj.getUTCDate(),
        weekdayName,
        isWeekend: dow === 5 || dow === 6, // Fri or Sat
        status: d.status,
      });
    }

    return Array.from(map.values());
  }, [openDates]);

  if (openDates.length === 0) {
    return (
      <section className="flex flex-col gap-2 rounded-xl border border-black/10 p-5 dark:border-white/10">
        <h2 className="text-xl font-semibold">Open dates</h2>
        <p className="text-sm opacity-70">
          No open dates posted right now. Contact {bandName} directly for booking inquiries.
        </p>
      </section>
    );
  }

  // Count total and decide how many months to display initially
  // Default to showing the first 2 months or first 12 dates
  const INITIAL_MONTHS_CAP = 2;
  const hasMoreMonths = groupedMonths.length > INITIAL_MONTHS_CAP;
  const visibleMonths = showAll ? groupedMonths : groupedMonths.slice(0, INITIAL_MONTHS_CAP);

  const totalHiddenCount = groupedMonths
    .slice(INITIAL_MONTHS_CAP)
    .reduce((sum, m) => sum + m.dates.length, 0);

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-black/10 pb-2 dark:border-white/10">
        <h2 className="text-xl font-bold tracking-tight">Available show dates</h2>
        <span className="text-xs opacity-60">
          {openDates.length} upcoming bookable night{openDates.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex flex-col gap-6">
        {visibleMonths.map((m) => (
          <div key={m.monthKey} className="flex flex-col gap-2.5">
            <h3 className="text-sm font-bold uppercase tracking-wider opacity-60">
              {m.monthLabel}
            </h3>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {m.dates.map((d) => {
                const isHold = d.status === "penciled_in";
                return (
                  <div
                    key={d.iso}
                    className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-sm transition-all ${
                      d.isWeekend
                        ? "border-black/25 bg-black/[0.03] font-medium shadow-xs dark:border-white/25 dark:bg-white/[0.04]"
                        : "border-black/10 opacity-80 dark:border-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`text-xs font-semibold ${
                          d.isWeekend ? "text-accent" : "opacity-60"
                        }`}
                      >
                        {d.weekdayName}
                      </span>
                      <span className="truncate font-semibold">{d.dayNum}</span>
                    </div>

                    {isHold ? (
                      <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                        Hold
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                        Open
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {hasMoreMonths && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="self-center rounded-full border border-black/15 px-5 py-2 text-xs font-semibold hover:border-current dark:border-white/20 transition-colors"
        >
          {showAll ? "Show fewer dates ↑" : `Show more dates (+${totalHiddenCount} more) ↓`}
        </button>
      )}
    </section>
  );
}
