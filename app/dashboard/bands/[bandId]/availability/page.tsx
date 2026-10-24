import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, requireUserId } from "@/utils/supabase/server";
import { BandSubNav } from "@/components/bands/band-subnav";
import { BandCalendar } from "@/components/bands/band-calendar";

export const metadata: Metadata = { title: "Band availability" };

type Props = {
  params: Promise<{ bandId: string }>;
};

export default async function BandAvailabilityPage({ params }: Props) {
  const { bandId } = await params;
  const userId = await requireUserId(`/dashboard/bands/${bandId}/availability`);
  const supabase = await createClient();

  const [
    { data: band, error: bandErr },
    { data: members, error: membersErr },
    { data: openDates, error: datesErr },
  ] = await Promise.all([
    supabase
      .from("bands")
      .select("id, name, slug, logo_url")
      .eq("id", bandId)
      .maybeSingle(),
    supabase
      .from("band_members")
      .select("id, profile_id, role_in_band, is_admin, is_required_for_gigs")
      .eq("band_id", bandId),
    supabase
      .from("band_open_dates")
      .select("id, band_id, target_date, status, notes, created_at")
      .eq("band_id", bandId)
      .order("target_date", { ascending: true }),
  ]);

  if (bandErr) throw bandErr;
  if (!band) notFound();
  if (membersErr) throw membersErr;
  if (datesErr) throw datesErr;

  const me = members?.find((m) => m.profile_id === userId);
  const viewerIsAdmin = me?.is_admin === true;

  // Profiles of members to show who contributes to the schedule
  const profileIds = members?.map((m) => m.profile_id) ?? [];
  const { data: profiles } = profileIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", profileIds)
    : { data: [] };
  const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name]) ?? []);

  const todayIso = new Date().toISOString().slice(0, 10);
  const upcomingDates = (openDates ?? []).filter((d) => d.target_date >= todayIso);

  const seekingCount = upcomingDates.filter((d) => d.status === "actively_seeking").length;
  const conflictsCount = upcomingDates.filter((d) => d.status === "unavailable").length;
  const holdsCount = upcomingDates.filter((d) => d.status === "penciled_in").length;
  const bookedCount = upcomingDates.filter((d) => d.status === "booked").length;

  // Confirmed and hold gigs for the quick list
  const priorityGigs = upcomingDates.filter(
    (d) => d.status === "penciled_in" || d.status === "booked",
  );

  const dateFmt = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="flex flex-col gap-8">
      <BandSubNav
        bandId={band.id}
        bandName={band.name}
        slug={band.slug}
        logoUrl={band.logo_url}
        activeTab="availability"
      />

      {/* Roster overview strip */}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 bg-black/[0.015] p-3 text-xs dark:border-white/10 dark:bg-white/[0.015]">
        <div className="flex flex-wrap items-center gap-1.5 opacity-80">
          <span className="font-semibold">Lineup Requirements:</span>
          {members && members.length > 0 ? (
            members.map((m, idx) => (
              <span key={m.id} className="inline-flex items-center gap-1">
                <span>{profileMap.get(m.profile_id) ?? "Member"}</span>
                {m.role_in_band && <span className="opacity-70">({m.role_in_band})</span>}
                <span
                  className={`rounded px-1.5 py-0.2 text-[10px] font-semibold border ${
                    m.is_required_for_gigs ?? true
                      ? "bg-emerald-500/10 text-emerald-800 border-emerald-500/20 dark:text-emerald-300"
                      : "bg-amber-500/10 text-amber-800 border-amber-500/20 dark:text-amber-300"
                  }`}
                >
                  {m.is_required_for_gigs ?? true ? "Mandatory" : "Optional"}
                </span>
                {idx < members.length - 1 ? " · " : ""}
              </span>
            ))
          ) : (
            <span>No members</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {viewerIsAdmin && (
            <Link
              href={`/dashboard/bands/${band.id}`}
              className="underline hover:no-underline font-medium text-accent"
            >
              Configure mandatory lineup in Settings →
            </Link>
          )}
          <Link
            href={`/dashboard/availability`}
            className="underline hover:no-underline opacity-70 hover:opacity-100"
          >
            My availability →
          </Link>
        </div>
      </section>

      {/* Metrics Bar */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-black/10 p-3.5 dark:border-white/10">
          <p className="text-xs opacity-60">Actively Seeking</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {seekingCount}
          </p>
          <p className="text-[10px] opacity-60">Open show dates</p>
        </div>

        <div className="rounded-xl border border-black/10 p-3.5 dark:border-white/10">
          <p className="text-xs opacity-60">Lineup Conflicts</p>
          <p className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">
            {conflictsCount}
          </p>
          <p className="text-[10px] opacity-60">Blocked by mandatory members</p>
        </div>

        <div className="rounded-xl border border-black/10 p-3.5 dark:border-white/10">
          <p className="text-xs opacity-60">Penciled In / Holds</p>
          <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {holdsCount}
          </p>
          <p className="text-[10px] opacity-60">Pending negotiations</p>
        </div>

        <div className="rounded-xl border border-black/10 p-3.5 dark:border-white/10">
          <p className="text-xs opacity-60">Confirmed Shows</p>
          <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
            {bookedCount}
          </p>
          <p className="text-[10px] opacity-60">Booked gigs</p>
        </div>
      </section>

      {/* Interactive Month Calendar */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold">Master Band Calendar</h2>
            <p className="text-xs opacity-70">
              Click any date to view details, place holds, or mark confirmed gigs.
            </p>
          </div>
        </div>

        <BandCalendar
          bandId={band.id}
          openDates={openDates ?? []}
          viewerIsAdmin={viewerIsAdmin}
        />
      </section>

      {/* Upcoming confirmed & held shows */}
      <section className="flex flex-col gap-3 rounded-xl border border-black/10 p-4 dark:border-white/10">
        <h3 className="text-base font-semibold">Upcoming Holds & Shows ({priorityGigs.length})</h3>
        {priorityGigs.length === 0 ? (
          <p className="text-xs opacity-60 py-2">
            No holds or booked shows scheduled yet. Sync member calendars or click a date to add a
            hold.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {priorityGigs.map((g) => (
              <li
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/5 bg-black/[0.02] p-3 text-sm dark:border-white/5 dark:bg-white/[0.02]"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      g.status === "booked"
                        ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                        : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                    }`}
                  >
                    {g.status === "booked" ? "Booked Show" : "Hold"}
                  </span>
                  <span className="font-medium">
                    {dateFmt.format(new Date(`${g.target_date}T00:00:00Z`))}
                  </span>
                </div>
                {g.notes && <span className="text-xs opacity-70 italic">{g.notes}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
