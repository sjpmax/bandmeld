"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { BandOpenDate, GigStatus } from "@/types";
import {
  clearBandDateAction,
  setBandDateStatusAction,
  syncBandAvailabilityAction,
} from "@/app/dashboard/bands/[bandId]/availability/actions";

type Props = {
  bandId: string;
  openDates: BandOpenDate[];
  viewerIsAdmin: boolean;
};

const STATUS_CONFIG: Record<
  GigStatus,
  { label: string; badge: string; dot: string; description: string }
> = {
  actively_seeking: {
    label: "Seeking Gig",
    badge:
      "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30",
    dot: "bg-emerald-500",
    description: "All members free. Visible on public EPK as open for booking.",
  },
  penciled_in: {
    label: "Hold",
    badge:
      "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30",
    dot: "bg-amber-500",
    description: "Date penciled in or held with a venue / promoter.",
  },
  booked: {
    label: "Booked Show",
    badge: "bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/30",
    dot: "bg-blue-500",
    description: "Confirmed show on this date.",
  },
  unavailable: {
    label: "Blocked",
    badge: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
    dot: "bg-zinc-400",
    description: "Band unavailable or taking off on this date.",
  },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toIsoString(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function BandCalendar({ bandId, openDates, viewerIsAdmin }: Props) {
  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => toIsoString(today), [today]);

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-indexed

  const [selectedDateIso, setSelectedDateIso] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<GigStatus>("actively_seeking");
  const [selectedNotes, setSelectedNotes] = useState<string>("");

  const [isSyncing, startSyncTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();

  // Map dates for O(1) lookup
  const dateMap = useMemo(() => {
    const map = new Map<string, BandOpenDate>();
    for (const d of openDates) {
      map.set(d.target_date, d);
    }
    return map;
  }, [openDates]);

  // Calendar month math
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun
  const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const monthLabel = firstDayOfMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  function handlePrevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function handleNextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  function handleToday() {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  }

  function handleSelectDate(iso: string) {
    setSelectedDateIso(iso);
    const existing = dateMap.get(iso);
    if (existing) {
      setSelectedStatus(existing.status ?? "actively_seeking");
      setSelectedNotes(existing.notes ?? "");
    } else {
      setSelectedStatus("actively_seeking");
      setSelectedNotes("");
    }
  }

  function handleSyncAvailability() {
    startSyncTransition(async () => {
      const res = await syncBandAvailabilityAction(bandId);
      if (res.ok) {
        toast.success(res.message);
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleSaveStatus() {
    if (!selectedDateIso) return;
    startSaveTransition(async () => {
      const res = await setBandDateStatusAction(
        bandId,
        selectedDateIso,
        selectedStatus,
        selectedNotes,
      );
      if (res.ok) {
        toast.success(res.message);
        setSelectedDateIso(null);
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleClearDate() {
    if (!selectedDateIso) return;
    startSaveTransition(async () => {
      const res = await clearBandDateAction(bandId, selectedDateIso);
      if (res.ok) {
        toast.success(res.message);
        setSelectedDateIso(null);
      } else {
        toast.error(res.error);
      }
    });
  }

  const selectedEntry = selectedDateIso ? dateMap.get(selectedDateIso) : null;
  const humanSelectedDate = selectedDateIso
    ? new Date(`${selectedDateIso}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <div className="flex flex-col gap-6">
      {/* Top action and sync bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.02]">
        <div>
          <h2 className="text-base font-semibold">Consolidated Schedule Sync</h2>
          <p className="text-xs opacity-70">
            Overlays all members&apos; unavailabilities across the next 366 days.
          </p>
        </div>

        {viewerIsAdmin ? (
          <button
            type="button"
            onClick={handleSyncAvailability}
            disabled={isSyncing}
            className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSyncing ? (
              <>
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Syncing...
              </>
            ) : (
              <>🔄 Sync with Member Calendars</>
            )}
          </button>
        ) : (
          <span className="text-xs opacity-60">Admin required to sync</span>
        )}
      </div>

      {/* Legend & Month Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Month controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Previous month"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
          >
            ←
          </button>
          <span className="min-w-44 text-center font-bold text-lg">{monthLabel}</span>
          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Next month"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
          >
            →
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="ml-2 rounded-lg border border-black/15 px-3 py-1.5 text-xs font-medium hover:border-current dark:border-white/20"
          >
            Today
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span>Seeking Gig</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span>Hold</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            <span>Booked</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-400" />
            <span>Blocked</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-xl border border-black/10 overflow-hidden bg-white/40 dark:border-white/10 dark:bg-white/[0.02]">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-black/10 bg-black/[0.03] text-center text-xs font-semibold py-2.5 dark:border-white/10 dark:bg-white/[0.04]">
          {WEEKDAYS.map((day) => (
            <div key={day} className="opacity-70">
              {day}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 auto-rows-fr">
          {/* Empty cells before month starts */}
          {Array.from({ length: startingDayOfWeek }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="min-h-24 border-b border-r border-black/5 bg-black/[0.01] dark:border-white/5 dark:bg-white/[0.01]"
            />
          ))}

          {/* Days in month */}
          {Array.from({ length: totalDaysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const pad = (n: number) => String(n).padStart(2, "0");
            const dateIso = `${currentYear}-${pad(currentMonth + 1)}-${pad(dayNum)}`;
            const isToday = dateIso === todayIso;
            const isPast = dateIso < todayIso;
            const entry = dateMap.get(dateIso);
            const statusConfig = entry?.status ? STATUS_CONFIG[entry.status] : null;

            return (
              <button
                key={dateIso}
                type="button"
                onClick={() => handleSelectDate(dateIso)}
                className={`relative flex min-h-24 flex-col justify-between p-2 text-left border-b border-r border-black/10 transition-colors dark:border-white/10 ${
                  isToday ? "bg-accent/5 font-semibold" : ""
                } ${isPast ? "opacity-50" : "hover:bg-black/5 dark:hover:bg-white/5"} ${
                  selectedDateIso === dateIso
                    ? "ring-2 ring-accent ring-inset z-1"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      isToday
                        ? "bg-accent text-white font-bold"
                        : "opacity-80"
                    }`}
                  >
                    {dayNum}
                  </span>
                  {statusConfig && (
                    <span
                      className={`h-2 w-2 rounded-full ${statusConfig.dot}`}
                      title={statusConfig.label}
                    />
                  )}
                </div>

                {statusConfig ? (
                  <div className="mt-1 flex flex-col gap-0.5">
                    <span
                      className={`truncate rounded px-1.5 py-0.5 text-[10px] font-semibold border ${statusConfig.badge}`}
                    >
                      {statusConfig.label}
                    </span>
                    {entry?.notes && (
                      <span className="truncate text-[10px] opacity-70">
                        {entry.notes}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="h-4" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Date Edit Modal / Drawer */}
      {selectedDateIso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-black/15 bg-paper p-6 shadow-2xl dark:border-white/20 dark:bg-[#1a1a1a]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold">{humanSelectedDate}</h3>
                <p className="text-xs opacity-60">{selectedDateIso}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDateIso(null)}
                className="rounded-full p-1 opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>

            {viewerIsAdmin ? (
              <div className="mt-5 flex flex-col gap-4">
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Date Status
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {(Object.keys(STATUS_CONFIG) as GigStatus[]).map((status) => {
                      const cfg = STATUS_CONFIG[status];
                      const isChecked = selectedStatus === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setSelectedStatus(status)}
                          className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs transition-colors ${
                            isChecked
                              ? "border-accent bg-accent/10 font-bold"
                              : "border-black/10 hover:border-black/25 dark:border-white/10 dark:hover:border-white/25"
                          }`}
                        >
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cfg.dot}`} />
                          <span className="truncate">{cfg.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-xs opacity-60">
                    {STATUS_CONFIG[selectedStatus]?.description}
                  </p>
                </label>

                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Notes (optional)
                  <input
                    type="text"
                    value={selectedNotes}
                    onChange={(e) => setSelectedNotes(e.target.value)}
                    placeholder="e.g. Hold for The Velvet Room w/ Co-acts"
                    maxLength={250}
                    className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-ink dark:border-white/20 dark:bg-white/5 dark:text-inherit"
                  />
                  <span className="text-[10px] opacity-50">
                    Visible to bandmates and displayed on your calendar.
                  </span>
                </label>

                <div className="mt-2 flex items-center justify-between gap-3 border-t border-black/10 pt-4 dark:border-white/10">
                  {selectedEntry ? (
                    <button
                      type="button"
                      onClick={handleClearDate}
                      disabled={isSaving}
                      className="text-xs text-red-600 underline hover:no-underline disabled:opacity-50"
                    >
                      Clear Date
                    </button>
                  ) : (
                    <span />
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDateIso(null)}
                      className="rounded-full border border-black/15 px-3 py-1.5 text-xs font-medium hover:border-current dark:border-white/20"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveStatus}
                      disabled={isSaving}
                      className="rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {isSaving ? "Saving..." : "Save Status"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                <div className="rounded-xl border border-black/10 p-3 text-sm dark:border-white/10">
                  <p className="font-semibold">
                    Status:{" "}
                    {selectedEntry?.status
                      ? STATUS_CONFIG[selectedEntry.status]?.label
                      : "Unscheduled"}
                  </p>
                  {selectedEntry?.notes && (
                    <p className="mt-1 opacity-70 text-xs">Note: {selectedEntry.notes}</p>
                  )}
                </div>
                <p className="text-xs opacity-60">
                  Only band admins can change status or sync the master calendar.
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedDateIso(null)}
                  className="mt-2 rounded-full border border-black/15 px-4 py-1.5 text-xs font-medium self-end"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

