"use client";

import { useState } from "react";
import { parseIcsToReviewPayload } from "@/lib/ics";
import { applyIcsImport } from "@/app/dashboard/availability/actions";
import { ImportReview } from "./import-review";
import type { ReviewPayload } from "@/types/calendar-import";

export function IcsUploader() {
  const [payload, setPayload] = useState<ReviewPayload | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = parseIcsToReviewPayload(text);
      setPayload(parsed);
    } catch (err) {
      setPayload(null);
      setError(
        err instanceof Error
          ? `Couldn't parse that .ics file — ${err.message}`
          : "Couldn't parse that .ics file.",
      );
    }
  }

  function reset() {
    setPayload(null);
    setFileName(null);
    setError(null);
  }

  if (payload) {
    const total =
      payload.oneOffs.length +
      payload.recurringSeries.reduce((n, s) => n + s.instances.length, 0);
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 p-3 text-sm dark:border-white/10">
          <span>
            Parsed <span className="font-semibold">{fileName}</span> — {total} busy
            event{total === 1 ? "" : "s"} in the next 12 months.
            {payload.missed.length > 0 &&
              ` ${payload.missed.length} more tucked under "Did I miss one?"`}
            {payload.skippedCount > 0 &&
              ` Dropped ${payload.skippedCount} (cancelled or malformed).`}
          </span>
          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-black/15 px-3 py-1 text-xs hover:border-current dark:border-white/20"
          >
            Choose different file
          </button>
        </div>
        {total === 0 ? (
          <p className="rounded-xl border border-dashed border-black/20 p-6 text-center opacity-80 dark:border-white/20">
            Nothing to import — the file has no busy events in the next 12 months.
          </p>
        ) : (
          <ImportReview payload={payload} applyAction={applyIcsImport} applyLabel="Import" />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black/20 bg-black/[0.02] p-8 text-center hover:border-current dark:border-white/20 dark:bg-white/[0.03]">
        <span className="text-sm font-medium">Drop or select an .ics file</span>
        <span className="text-xs opacity-70">
          Export from Apple Calendar: File → Export → Export… or share a calendar as .ics
        </span>
        <input
          type="file"
          accept=".ics,text/calendar"
          onChange={onFile}
          className="sr-only"
        />
      </label>
      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm">{error}</p>
      )}
    </div>
  );
}
