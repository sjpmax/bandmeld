"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { GOOGLE_CALENDAR_SCOPE } from "@/lib/google-calendar";

export function GoogleConnectButton({ label }: { label: string }) {
  const [pending, setPending] = useState(false);

  async function connect() {
    setPending(true);
    const supabase = createClient();

    // If a prior incomplete disconnect left the Google identity linked at the
    // auth level, linkIdentity below would fail with `identity_already_exists`.
    // Clear it first.
    const { data: idents } = await supabase.auth.getUserIdentities();
    const stale = idents?.identities?.find((i) => i.provider === "google");
    if (stale) {
      const { error: unlinkErr } = await supabase.auth.unlinkIdentity(stale);
      if (unlinkErr) {
        toast.error(`Couldn't reset existing Google link: ${unlinkErr.message}`);
        setPending(false);
        return;
      }
    }

    const { data, error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: {
        scopes: GOOGLE_CALENDAR_SCOPE,
        redirectTo: `${location.origin}/auth/google/callback?next=/dashboard/availability/import`,
        // access_type=offline + prompt=consent is what gets us a refresh_token.
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) {
      toast.error(error.message);
      setPending(false);
      return;
    }
    // linkIdentity usually auto-redirects, but fall through just in case.
    if (data?.url) window.location.href = data.url;
  }

  return (
    <button
      type="button"
      onClick={connect}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm hover:bg-black/5 disabled:opacity-60 dark:border-white/20 dark:bg-white/5 dark:text-inherit dark:hover:bg-white/10"
    >
      {pending ? "Redirecting…" : label}
    </button>
  );
}
