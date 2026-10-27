"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createPollAction, type CreatePollResult } from "@/app/dashboard/bands/[bandId]/polls/new/actions";

type Row = { id: string; date: string };

function freshId() {
  return Math.random().toString(36).slice(2);
}

export function CreatePollForm({ bandId }: { bandId: string }) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<Row[]>([{ id: freshId(), date: "" }]);
  const [isPending, startTransition] = useTransition();

  const addRow = () => setRows((r) => [...r, { id: freshId(), date: "" }]);
  const removeRow = (id: string) =>
    setRows((r) => (r.length > 1 ? r.filter((row) => row.id !== id) : r));
  const updateRow = (id: string, date: string) =>
    setRows((r) => r.map((row) => (row.id === id ? { ...row, date } : row)));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dates = Array.from(new Set(rows.map((r) => r.date.trim()).filter(Boolean)));
    if (dates.length === 0) {
      toast.error("Add at least one date.");
      return;
    }
    if (dates.length > 10) {
      toast.error("A poll can have at most 10 dates.");
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
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-2">
            <input
              type="date"
              required
              value={row.date}
              onChange={(e) => updateRow(row.id, e.target.value)}
              className="flex-1 rounded-xl border border-black/15 bg-white px-3 py-2 dark:border-white/15 dark:bg-white/5"
            />
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              className="rounded-full border border-black/15 px-3 py-1 text-sm dark:border-white/15"
              disabled={rows.length === 1}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addRow}
          className="self-start rounded-full border border-black/15 px-3 py-1 text-sm dark:border-white/15"
        >
          + Add date
        </button>
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
