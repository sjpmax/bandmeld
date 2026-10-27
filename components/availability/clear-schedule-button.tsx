"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { clearAllUpcomingUnavailabilities } from "@/app/dashboard/availability/actions";

type Props = { count: number };

export function ClearScheduleButton({ count }: Props) {
  const [isPending, startTransition] = useTransition();

  if (count === 0) return null;

  function onClick() {
    const ok = window.confirm(
      `Clear all ${count} upcoming block${count === 1 ? "" : "s"}? This cannot be undone.`,
    );
    if (!ok) return;
    startTransition(async () => {
      const result = await clearAllUpcomingUnavailabilities();
      if (result.ok) {
        toast.success(result.message ?? "Cleared.");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-500/20 disabled:opacity-50 dark:text-red-300"
    >
      {isPending ? "Clearing…" : `Clear schedule (${count})`}
    </button>
  );
}
