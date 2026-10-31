"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createPollAction, type CreatePollResult } from "@/app/dashboard/bands/[bandId]/polls/new/actions";
import { MonthDatePicker } from "@/components/polls/month-date-picker";

const MAX_DATES = 10;

export function CreatePollForm({ bandId }: { bandId: string }) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (dates.length === 0) {
      toast.error("Pick at least one date.");
      return;
    }
    if (dates.length > MAX_DATES) {
      toast.error(`A poll can have at most ${MAX_DATES} dates.`);
      return;
    }
    startTransition(async () => {
      const result: CreatePollResult = await createPollAction({
        bandId,
        dates,
        title: title.trim() || null,
        note: note.trim() || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Sent ${result.sent}/${result.total} emails`);
      window.location.assign(`/dashboard/bands/${bandId}/polls/${result.pollId}`);
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Title (optional)</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. 3 dates from The Other Band"
          maxLength={120}
          className="rounded-xl border border-black/15 bg-white px-3 py-2 dark:border-white/15 dark:bg-white/5"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Note to the band (optional)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          className="rounded-xl border border-black/15 bg-white px-3 py-2 dark:border-white/15 dark:bg-white/5"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Dates</span>
        <p className="text-xs opacity-70">
          Tap days to add them. Tap a weekday chip (Sun, Mon…) to toggle every one of those days in the month.
        </p>
        <MonthDatePicker value={dates} onChange={setDates} max={MAX_DATES} />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-accent px-5 py-3 font-medium text-white disabled:opacity-60"
      >
        {isPending ? "Sending…" : "Ask the band"}
      </button>
    </form>
  );
}
