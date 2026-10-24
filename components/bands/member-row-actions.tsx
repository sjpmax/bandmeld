"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  leaveBand,
  removeMember,
  setMemberAdmin,
} from "@/app/dashboard/bands/actions";

/**
 * Inline actions row for a member. Actions are void-returning server
 * actions that throw on the trigger error (e.g. last-admin guard); we
 * surface those as toasts.
 */
export function MemberRowActions({
  memberId,
  bandId,
  isAdmin,
  isSelf,
  viewerIsAdmin,
}: {
  memberId: string;
  bandId: string;
  isAdmin: boolean;
  isSelf: boolean;
  viewerIsAdmin: boolean;
}) {
  const [pending, start] = useTransition();

  function wrap(fn: () => Promise<void>, confirmMsg?: string) {
    return () => {
      if (confirmMsg && !confirm(confirmMsg)) return;
      start(async () => {
        try {
          await fn();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Something went wrong.";
          toast.error(msg);
        }
      });
    };
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {viewerIsAdmin && !isSelf && (
        <button
          type="button"
          onClick={wrap(() => setMemberAdmin(memberId, bandId, !isAdmin))}
          disabled={pending}
          className="opacity-70 hover:underline hover:opacity-100 disabled:opacity-50"
        >
          {isAdmin ? "Demote to member" : "Make admin"}
        </button>
      )}
      {viewerIsAdmin && !isSelf && (
        <button
          type="button"
          onClick={wrap(
            () => removeMember(memberId, bandId),
            "Remove this member from the band?",
          )}
          disabled={pending}
          className="text-red-600 hover:underline disabled:opacity-50"
        >
          Remove
        </button>
      )}
      {isSelf && (
        <button
          type="button"
          onClick={wrap(
            () => leaveBand(memberId, bandId),
            "Leave this band? You'll lose access to its calendar and settings.",
          )}
          disabled={pending}
          className="text-red-600 hover:underline disabled:opacity-50"
        >
          Leave band
        </button>
      )}
    </div>
  );
}
