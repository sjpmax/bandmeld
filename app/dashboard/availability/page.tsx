import type { Metadata } from "next";
import Link from "next/link";
import { createClient, requireUserId } from "@/utils/supabase/server";
import { UnavailabilityForm } from "@/components/availability/unavailability-form";
import { GoogleConnectButton } from "@/components/availability/google-connect-button";
import { UpcomingBlocks } from "@/components/availability/upcoming-blocks";
import {
  disconnectGoogleCalendar,
  removeUnavailability,
  setUnavailabilityTentative,
} from "./actions";

export const metadata: Metadata = { title: "My availability" };

function todayIso() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const timeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type SearchParams = {
  imported?: string;
  skipped?: string;
  connect_error?: string;
  import_error?: string;
};

export default async function MyAvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const userId = await requireUserId("/dashboard/availability");
  const supabase = await createClient();
  const sp = await searchParams;

  const [{ data: blocks, error: blocksErr }, { data: connection, error: connErr }] =
    await Promise.all([
      supabase
        .from("member_unavailabilities")
        .select("id, start_date, end_date, reason, is_tentative")
        .eq("profile_id", userId)
        .gte("end_date", todayIso())
        .order("start_date", { ascending: true }),
      supabase
        .from("google_calendar_connections")
        .select("last_synced_at")
        .eq("profile_id", userId)
        .maybeSingle(),
    ]);

  if (blocksErr) throw blocksErr;
  if (connErr) throw connErr;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">My availability</h1>
        <p className="mt-1 opacity-70">
          Block the dates you can&apos;t play. Your bands overlay these to find open show dates.
        </p>
      </header>

      {sp.imported && (
        <p className="rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-sm">
          Imported {sp.imported} event{sp.imported === "1" ? "" : "s"} from Google Calendar.
          {sp.skipped && Number(sp.skipped) > 0 && (
            <>
              {" "}Skipped {sp.skipped} already in your blocks.
            </>
          )}
        </p>
      )}
      {sp.connect_error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm">
          Google Calendar connection error: {sp.connect_error}
        </p>
      )}
      {sp.import_error === "all_duplicates" ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Everything you selected was already in your blocks.
          {sp.skipped && ` Skipped ${sp.skipped}.`}
        </p>
      ) : sp.import_error === "nothing_selected" ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm">
          You didn&apos;t block any events — everything was marked Free.
        </p>
      ) : sp.import_error ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm">
          Import error: {sp.import_error}
        </p>
      ) : null}

      <section className="flex flex-col gap-3 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Google Calendar</h2>
            <p className="text-sm opacity-70">
              {connection
                ? connection.last_synced_at
                  ? `Last synced ${timeFmt.format(new Date(connection.last_synced_at))}`
                  : "Connected — not synced yet."
                : "Pull busy events from your Google Calendar to pre-fill your blocks."}
            </p>
          </div>
          <div className="flex gap-2">
            {connection ? (
              <>
                <Link
                  href="/dashboard/availability/import"
                  className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white"
                >
                  Review & import
                </Link>
                <form action={disconnectGoogleCalendar}>
                  <button
                    type="submit"
                    className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-black/5 dark:border-white/20 dark:bg-white/5 dark:text-inherit dark:hover:bg-white/10"
                  >
                    Disconnect
                  </button>
                </form>
              </>
            ) : (
              <GoogleConnectButton label="Connect Google Calendar" />
            )}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Apple Calendar / .ics file</h2>
            <p className="text-sm opacity-70">
              Export from Apple Calendar (or any app that produces .ics) and upload it
              to pre-fill your blocks. Nothing leaves your browser until you confirm.
            </p>
          </div>
          <Link
            href="/dashboard/availability/import/ics"
            className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-black/5 dark:border-white/20 dark:bg-white/5 dark:text-inherit dark:hover:bg-white/10"
          >
            Upload .ics
          </Link>
        </div>
      </section>

      <UnavailabilityForm />

      <UpcomingBlocks
        blocks={blocks ?? []}
        removeAction={removeUnavailability}
        toggleTentativeAction={setUnavailabilityTentative}
      />
    </div>
  );
}
