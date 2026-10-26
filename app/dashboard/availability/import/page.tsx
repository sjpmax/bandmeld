import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, requireUserId } from "@/utils/supabase/server";
import { classifyEvents, getValidAccessToken, listCalendarEvents } from "@/lib/google-calendar";
import { loadGoogleTokens, storeGoogleTokens } from "@/lib/google-tokens";
import { GoogleImportReview } from "@/components/availability/google-import-review";

export const metadata: Metadata = { title: "Import Google Calendar" };
export const dynamic = "force-dynamic";

export default async function GoogleImportPage() {
  const userId = await requireUserId("/dashboard/availability/import");
  const supabase = await createClient();

  const { data: connection, error: connErr } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("profile_id", userId)
    .maybeSingle();
  if (connErr) throw connErr;
  if (!connection) redirect("/dashboard/availability?connect_error=not_connected");

  // Load the current Vault-stored tokens.
  let tokens;
  try {
    tokens = await loadGoogleTokens(supabase);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "token_error";
    redirect(`/dashboard/availability?connect_error=${encodeURIComponent(msg)}`);
  }
  if (!tokens) redirect("/dashboard/availability?connect_error=not_connected");

  // Refresh if close to expiry; persist the new access token in the Vault
  // and the new expires_at on the row.
  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(
      {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: connection.expires_at,
      },
      async (next) => {
        await storeGoogleTokens(supabase, {
          access_token: next.access_token,
          refresh_token: tokens.refresh_token,
        });
        await supabase
          .from("google_calendar_connections")
          .update({ expires_at: next.expires_at })
          .eq("profile_id", userId);
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "token_error";
    redirect(`/dashboard/availability?connect_error=${encodeURIComponent(msg)}`);
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + 366 * 24 * 60 * 60 * 1000);
  let events;
  try {
    events = await listCalendarEvents(accessToken, now, horizon);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "fetch_error";
    redirect(`/dashboard/availability?connect_error=${encodeURIComponent(msg)}`);
  }

  const payload = classifyEvents(events);
  const total =
    payload.oneOffs.length + payload.recurringSeries.reduce((n, s) => n + s.instances.length, 0);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold sm:text-3xl">Review Google Calendar events</h1>
        <p className="opacity-70">
          Pulled {total} busy event{total === 1 ? "" : "s"} from your primary calendar for the next
          12 months.
          {payload.missed.length > 0 && ` ${payload.missed.length} more are tucked under "Did I miss one?"`}
          {payload.skippedCount > 0 && ` Dropped ${payload.skippedCount} (cancelled or malformed).`}
        </p>
        <p className="text-xs opacity-60">
          Imported events become firm blocks. Switch any to &ldquo;maybe&rdquo; from the availability
          page afterward. Your reasons stay private — bandmates only see the dates.
        </p>
        <p className="text-sm">
          <Link href="/dashboard/availability" className="underline opacity-70 hover:opacity-100">
            ← Back to availability
          </Link>
        </p>
      </header>

      {total === 0 ? (
        <p className="rounded-xl border border-dashed border-black/20 p-6 text-center opacity-80 dark:border-white/20">
          Nothing to import — your calendar is clear.
        </p>
      ) : (
        <GoogleImportReview payload={payload} />
      )}
    </div>
  );
}
