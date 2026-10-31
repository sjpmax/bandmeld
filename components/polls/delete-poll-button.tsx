"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { deletePollAction } from "@/app/dashboard/bands/[bandId]/polls/[pollId]/actions";

export function DeletePollButton({ bandId, pollId }: { bandId: string; pollId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Delete this poll permanently? Members' responses will be lost. (If the poll was already closed, the unavailability entries it added to the calendar stay.)")) return;
        startTransition(async () => {
          const result = await deletePollAction(bandId, pollId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Poll deleted.");
          router.push(`/dashboard/bands/${bandId}/polls`);
        });
      }}
      className="rounded-full border border-red-500/50 px-3 py-1 text-sm text-red-600 disabled:opacity-60 dark:border-red-400/50 dark:text-red-400"
    >
      {isPending ? "Deleting…" : "Delete poll"}
    </button>
  );
}
