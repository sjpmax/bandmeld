import type { Metadata } from "next";
import Link from "next/link";
import { createClient, getUserId } from "@/utils/supabase/server";
import { acceptInviteAction } from "./actions";

export const metadata: Metadata = { title: "Band invite" };
export const dynamic = "force-dynamic";

type Preview = {
  band_id: string | null;
  band_name: string | null;
  band_slug: string | null;
  email: string | null;
  role_in_band: string | null;
  is_valid: boolean;
  reason: string | null;
};

const REASON_COPY: Record<string, string> = {
  not_found: "This invite link doesn't exist. Double-check it with whoever sent it.",
  already_used: "This invite was already used. Ask the admin for a new one.",
  expired: "This invite expired. Ask the admin to generate a fresh link.",
};

export default async function AcceptInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ accept_error?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: previews } = await supabase.rpc("preview_band_invite", { p_token: token });
  const preview = (previews?.[0] ?? null) as Preview | null;
  const userId = await getUserId();

  // Figure out if the signed-in user matches the invite email.
  let signedInEmail: string | null = null;
  if (userId && preview?.is_valid) {
    const { data: claims } = await supabase.auth.getClaims();
    signedInEmail = (claims?.claims?.email as string | undefined)?.toLowerCase() ?? null;
  }
  const emailMatches =
    preview?.is_valid && signedInEmail && signedInEmail === preview.email?.toLowerCase();

  const inviteEmail = preview?.email ?? "";

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
      <header>
        <p className="text-sm opacity-60">You&apos;ve been invited</p>
        <h1 className="text-3xl font-bold">
          {preview?.band_name ? `Join ${preview.band_name}` : "Band invite"}
        </h1>
        {preview?.band_slug && (
          <p className="mt-1 text-sm opacity-70">
            <Link href={`/bands/${preview.band_slug}`} className="underline">
              See their public EPK ↗
            </Link>
          </p>
        )}
      </header>

      {!preview || !preview.is_valid ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
          {REASON_COPY[preview?.reason ?? "not_found"] ?? "This invite isn't valid."}
        </p>
      ) : (
        <>
          <section className="flex flex-col gap-3 rounded-xl border border-black/10 p-4 dark:border-white/10">
            <p>
              Role: <span className="font-semibold">{preview.role_in_band}</span>
            </p>
            <p className="text-sm">
              This invite is locked to{" "}
              <span className="font-semibold">{preview.email}</span>. Sign in with that email to
              accept.
            </p>
          </section>

          {sp.accept_error && (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm">
              {sp.accept_error}
            </p>
          )}

          {userId ? (
            emailMatches ? (
              <form action={acceptInviteAction.bind(null, token)}>
                <button
                  type="submit"
                  className="w-full rounded-full bg-accent px-5 py-3 font-medium text-white"
                >
                  Join {preview.band_name}
                </button>
              </form>
            ) : (
              <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                You&apos;re signed in as {signedInEmail ?? "someone else"}, but this invite is for{" "}
                <strong>{preview.email}</strong>. Sign out from the dashboard header and sign in
                with the right email to accept.
              </p>
            )
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm opacity-80">
                Create your account (or sign in) with <strong>{inviteEmail}</strong> and come back to
                this page to accept.
              </p>
              <div className="flex gap-3">
                <Link
                  href={`/signup?next=${encodeURIComponent(`/invite/${token}`)}`}
                  className="flex-1 rounded-full bg-accent px-5 py-2.5 text-center font-medium text-white"
                >
                  Sign up
                </Link>
                <Link
                  href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
                  className="flex-1 rounded-full border border-black/15 bg-white px-5 py-2.5 text-center font-medium text-ink dark:border-white/20 dark:bg-white/5 dark:text-inherit"
                >
                  Sign in
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
