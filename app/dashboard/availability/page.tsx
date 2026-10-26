import type { Metadata } from "next";
import Link from "next/link";
import { createClient, requireUserId } from "@/utils/supabase/server";
import { UnavailabilityForm } from "@/components/availability/unavailability-form";
import { GoogleConnectButton } from "@/components/availability/google-connect-button";
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

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const fmt = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00`));
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
          You didn&apos;t pick any events.
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

      <UnavailabilityForm />

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Upcoming blocks</h2>
        {blocks && blocks.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {blocks.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 p-3 dark:border-white/10"
              >
                <div className="flex-1 min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <span>
                      {b.start_date === b.end_date
                        ? fmt(b.start_date)
                        : `${fmt(b.start_date)} → ${fmt(b.end_date)}`}
                    </span>
                    {b.is_tentative && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                        Maybe
                      </span>
                    )}
                  </p>
                  {b.reason && <p className="text-sm opacity-70">{b.reason}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <form action={setUnavailabilityTentative.bind(null, b.id, !b.is_tentative)}>
                    <button
                      type="submit"
                      className="text-sm opacity-70 hover:underline hover:opacity-100"
                    >
                      {b.is_tentative ? "Mark as firm" : "Switch to maybe"}
                    </button>
                  </form>
                  <form action={removeUnavailability.bind(null, b.id)}>
                    <button type="submit" className="text-sm text-red-600 hover:underline">
                      Remove
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-black/20 p-6 text-center opacity-80 dark:border-white/20">
            No blocked dates. Add a range above or pull from Google Calendar.
          </p>
        )}
      </section>
    </div>
  );
}
