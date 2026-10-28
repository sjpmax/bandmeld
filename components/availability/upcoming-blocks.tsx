"use client";

import { useEffect, useState } from "react";
import { ClearScheduleButton } from "./clear-schedule-button";

type ViewMode = "list" | "table";
const VIEW_STORAGE_KEY = "bandmeld:availability-view";

function readStoredView(): ViewMode {
  if (typeof window === "undefined") return "list";
  try {
    const v = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return v === "table" ? "table" : "list";
  } catch {
    return "list";
  }
}

type Block = {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  is_tentative: boolean;
};

type Props = {
  blocks: Block[];
  removeAction: (id: string) => Promise<void> | void;
  toggleTentativeAction: (id: string, tentative: boolean) => Promise<void> | void;
};

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const fmt = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00`));
const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const dayLabel = (iso: string) => dayFmt.format(new Date(`${iso}T00:00:00`));

function rangeLabel(b: Block): string {
  return b.start_date === b.end_date ? fmt(b.start_date) : `${fmt(b.start_date)} → ${fmt(b.end_date)}`;
}

export function UpcomingBlocks({ blocks, removeAction, toggleTentativeAction }: Props) {
  const [view, setView] = useState<ViewMode>("list");

  useEffect(() => {
    const stored = readStoredView();
    if (stored !== "list") setView(stored);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      // Private browsing / storage disabled.
    }
  }, [view]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Upcoming blocks</h2>
        <div className="flex items-center gap-3">
          {blocks.length > 0 && (
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
          )}
          <ClearScheduleButton count={blocks.length} />
        </div>
      </div>

      {blocks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/20 p-6 text-center opacity-80 dark:border-white/20">
          No blocked dates. Add a range above or pull from Google Calendar.
        </p>
      ) : view === "table" ? (
        <BlocksTable
          blocks={blocks}
          removeAction={removeAction}
          toggleTentativeAction={toggleTentativeAction}
        />
      ) : (
        <BlocksList
          blocks={blocks}
          removeAction={removeAction}
          toggleTentativeAction={toggleTentativeAction}
        />
      )}
    </section>
  );
}

function BlocksList({ blocks, removeAction, toggleTentativeAction }: Props) {
  return (
    <ul className="flex flex-col gap-2">
      {blocks.map((b) => (
        <li
          key={b.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 p-3 dark:border-white/10"
        >
          <div className="flex-1 min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              <span>{rangeLabel(b)}</span>
              {b.is_tentative && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  Maybe
                </span>
              )}
            </p>
            {b.reason && <p className="text-sm opacity-70">{b.reason}</p>}
          </div>
          <div className="flex items-center gap-3">
            <form action={toggleTentativeAction.bind(null, b.id, !b.is_tentative)}>
              <button type="submit" className="text-sm opacity-70 hover:underline hover:opacity-100">
                {b.is_tentative ? "Mark as firm" : "Switch to maybe"}
              </button>
            </form>
            <form action={removeAction.bind(null, b.id)}>
              <button type="submit" className="text-sm text-red-600 hover:underline">
                Remove
              </button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}

function BlocksTable({ blocks, removeAction, toggleTentativeAction }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
      <table className="w-full text-sm">
        <thead className="bg-black/5 text-left text-xs uppercase tracking-wide dark:bg-white/5">
          <tr>
            <th className="px-3 py-2" scope="col">Date</th>
            <th className="px-3 py-2" scope="col">Day</th>
            <th className="px-3 py-2" scope="col">Status</th>
            <th className="px-3 py-2" scope="col">Reason</th>
            <th className="px-3 py-2 text-right" scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((b) => (
            <tr key={b.id} className="border-t border-black/5 dark:border-white/10">
              <td className="px-3 py-2 align-middle whitespace-nowrap">{rangeLabel(b)}</td>
              <td className="px-3 py-2 align-middle opacity-70 whitespace-nowrap">
                {dayLabel(b.start_date)}
              </td>
              <td className="px-3 py-2 align-middle">
                {b.is_tentative ? (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                    Maybe
                  </span>
                ) : (
                  <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">
                    Firm
                  </span>
                )}
              </td>
              <td className="px-3 py-2 align-middle opacity-80">{b.reason ?? ""}</td>
              <td className="px-3 py-2 align-middle text-right">
                <div className="inline-flex items-center gap-3">
                  <form action={toggleTentativeAction.bind(null, b.id, !b.is_tentative)}>
                    <button type="submit" className="text-sm opacity-70 hover:underline hover:opacity-100">
                      {b.is_tentative ? "Mark as firm" : "Switch to maybe"}
                    </button>
                  </form>
                  <form action={removeAction.bind(null, b.id)}>
                    <button type="submit" className="text-sm text-red-600 hover:underline">
                      Remove
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
