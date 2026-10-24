"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setMemberRequiredForGigs } from "@/app/dashboard/bands/actions";

type Props = {
  bandId: string;
  profileId: string;
  isRequired: boolean;
  canEdit: boolean;
};

export function MemberLineupToggle({ bandId, profileId, isRequired, canEdit }: Props) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (!canEdit || pending) return;
    const next = !isRequired;
    startTransition(async () => {
      try {
        await setMemberRequiredForGigs(bandId, profileId, next);
        toast.success(
          next
            ? "Marked as mandatory: band cannot gig if unavailable."
            : "Marked as optional: band can still gig if unavailable.",
        );
      } catch (err) {
        toast.error((err as Error).message);
      }
    });
  }

  if (!canEdit) {
    return (
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium border ${
          isRequired
            ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300"
            : "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300"
        }`}
      >
        {isRequired ? "Core Lineup" : "Optional for gigs"}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={
        isRequired
          ? "Click to make optional: Band can still play shows if this member is busy."
          : "Click to make mandatory: Band will be marked blocked if this member is busy."
      }
      className={`group flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border transition-all ${
        isRequired
          ? "bg-emerald-500/15 text-emerald-800 border-emerald-500/30 hover:bg-emerald-500/25 dark:text-emerald-300"
          : "bg-amber-500/15 text-amber-800 border-amber-500/30 hover:bg-amber-500/25 dark:text-amber-300"
      } disabled:opacity-50`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isRequired ? "bg-emerald-500" : "bg-amber-500"}`}
      />
      <span>{isRequired ? "Mandatory for shows" : "Optional for shows"}</span>
      {pending && (
        <span className="inline-block h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />
      )}
    </button>
  );
}
