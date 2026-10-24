"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { revokeInvite } from "@/app/dashboard/bands/actions";

export function InviteRowRevoke({ inviteId, bandId }: { inviteId: string; bandId: string }) {
  const [pending, start] = useTransition();
  function go() {
    if (!confirm("Revoke this invite link?")) return;
    start(async () => {
      try {
        await revokeInvite(inviteId, bandId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed.");
      }
    });
  }
  return (
    <button
      type="button"
      onClick={go}
      disabled={pending}
      className="text-sm text-red-600 hover:underline disabled:opacity-50"
    >
      Revoke
    </button>
  );
}
