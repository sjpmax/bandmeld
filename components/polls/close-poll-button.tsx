"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { closePollAction } from "@/app/dashboard/bands/[bandId]/polls/[pollId]/actions";

export function ClosePollButton({ bandId, pollId }: { bandId: string; pollId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Close this poll? Members won't be able to change their answers.")) return;
        startTransition(async () => {
          const result = await closePollAction(bandId, pollId);
          if (!result.ok) toast.error(result.error);
          else toast.success("Poll closed.");
        });
      }}
      className="rounded-full border border-black/15 px-3 py-1 text-sm disabled:opacity-60 dark:border-white/15"
    >
      {isPending ? "Closing…" : "Close poll"}
    </button>
  );
}
