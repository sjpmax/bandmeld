"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { submitPollResponseAction } from "@/app/poll/[token]/actions";

type DateRow = { id: string; target_date: string; position: number };

export function PollResponseForm({
  token,
  dates,
  initialAnswers,
}: {
  token: string;
  dates: DateRow[];
  initialAnswers: Record<string, boolean>;
}) {
  const [answers, setAnswers] = useState<Record<string, boolean | null>>(() =>
    Object.fromEntries(dates.map((d) => [d.id, initialAnswers[d.id] ?? null])),
  );
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const dateFmt = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const unanswered = dates.filter((d) => answers[d.id] === null);
    if (unanswered.length > 0) {
      toast.error("Please answer every date.");
      return;
    }
    const payload = dates.map((d) => ({ poll_date_id: d.id, answer: answers[d.id] as boolean }));
    startTransition(async () => {
      const result = await submitPollResponseAction({ token, answers: payload });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDone(true);
    });
  };

  if (done) {
    return (
      <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-4 text-sm">
        Thanks — your answers are saved. You can close this tab. If you need to change
        anything, just revisit this link before the poll closes.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {dates.map((d) => (
          <li
            key={d.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 p-3 dark:border-white/10"
          >
            <span className="font-medium">
              {dateFmt.format(new Date(`${d.target_date}T12:00:00Z`))}
            </span>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name={`r-${d.id}`}
                  checked={answers[d.id] === true}
                  onChange={() => setAnswers((a) => ({ ...a, [d.id]: true }))}
                />
                Yes
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name={`r-${d.id}`}
                  checked={answers[d.id] === false}
                  onChange={() => setAnswers((a) => ({ ...a, [d.id]: false }))}
                />
                No
              </label>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-accent px-5 py-3 font-medium text-white disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Submit"}
      </button>
    </form>
  );
}
