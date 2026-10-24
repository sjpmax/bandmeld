"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { createInvite } from "@/app/dashboard/bands/actions";
import type { ActionResult } from "@/types";

type InviteData = { token: string; email: string };
const initial: ActionResult<InviteData> = { ok: true };

export function InviteMemberForm({ bandId }: { bandId: string }) {
  const [state, formAction, pending] = useActionState(
    createInvite.bind(null, bandId),
    initial,
  );
  const [lastInvite, setLastInvite] = useState<InviteData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!state.ok) {
      toast.error(state.error);
      return;
    }
    if (state.message && state.data) {
      setLastInvite(state.data);
      setCopied(false);
      toast.success(state.message);
    }
  }, [state]);

  const link = lastInvite ? `${location.origin}/invite/${lastInvite.token}` : "";

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the link and copy manually.");
    }
  }

  const input =
    "w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-base text-ink dark:border-white/20 dark:bg-white/5 dark:text-inherit";

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
          Email
          <input
            name="email"
            type="email"
            required
            placeholder="bandmate@example.com"
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium sm:w-48">
          Role in band
          <input name="role_in_band" placeholder="Member" maxLength={60} className={input} />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60 sm:self-end"
        >
          {pending ? "Generating…" : "Create invite link"}
        </button>
      </form>

      {lastInvite && (
        <div className="rounded-xl border border-accent/40 bg-accent/5 p-3">
          <p className="text-sm">
            Link for <span className="font-semibold">{lastInvite.email}</span> — valid 14 days,
            works once. The recipient must sign in with this email.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-black/5 px-2 py-1 text-xs dark:bg-white/10">
              {link}
            </code>
            <button
              type="button"
              onClick={copy}
              className="rounded-full border border-black/15 bg-white px-3 py-1 text-xs font-medium hover:bg-black/5 dark:border-white/20 dark:bg-white/5 dark:hover:bg-white/10"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
