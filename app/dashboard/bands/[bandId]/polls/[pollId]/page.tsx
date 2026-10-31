import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient, requireUserId } from "@/utils/supabase/server";
import {
  PollResultsTable,
  type ResultsCell,
  type ResultsMember,
  type ResultsDate,
} from "@/components/polls/poll-results-table";
import { ClosePollButton } from "@/components/polls/close-poll-button";
import { DeletePollButton } from "@/components/polls/delete-poll-button";
import { BandSubNav } from "@/components/bands/band-subnav";

export const metadata: Metadata = { title: "Poll results" };

export default async function PollResultsPage({
  params,
}: {
  params: Promise<{ bandId: string; pollId: string }>;
}) {
  const { bandId, pollId } = await params;
  await requireUserId(`/dashboard/bands/${bandId}/polls/${pollId}`);
  const supabase = await createClient();

  const { data: isAdmin } = await supabase.rpc("is_band_admin", { p_band_id: bandId });
  if (!isAdmin) redirect(`/dashboard/bands/${bandId}`);

  const [
    { data: band },
    { data: poll },
    { data: dates },
    { data: invites },
    { data: responses },
  ] = await Promise.all([
    supabase.from("bands").select("id, name, slug, logo_url").eq("id", bandId).maybeSingle(),
    supabase.from("polls").select("*").eq("id", pollId).maybeSingle(),
    supabase
      .from("poll_dates")
      .select("id, target_date, position")
      .eq("poll_id", pollId)
      .order("position", { ascending: true }),
    supabase
      .from("poll_invites")
      .select("id, profile_id, email_sent_at, email_error")
      .eq("poll_id", pollId),
    supabase
      .from("poll_responses")
      .select("poll_invite_id, poll_date_id, answer")
      .in(
        "poll_invite_id",
        (
          await supabase.from("poll_invites").select("id").eq("poll_id", pollId)
        ).data?.map((r) => r.id) ?? [],
      ),
  ]);

  if (!band) notFound();
  if (!poll) notFound();

  const profileIds = (invites ?? []).map((i) => i.profile_id);
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", profileIds)
    : { data: [] };
  const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const dateRows: ResultsDate[] = (dates ?? []).map((d) => ({
    id: d.id,
    targetDate: d.target_date,
  }));

  // Group responses by invite -> date -> answer.
  const responseByInviteDate = new Map<string, Map<string, boolean>>();
  for (const r of responses ?? []) {
    const inner = responseByInviteDate.get(r.poll_invite_id) ?? new Map<string, boolean>();
    inner.set(r.poll_date_id, r.answer);
    responseByInviteDate.set(r.poll_invite_id, inner);
  }

  const memberRows: ResultsMember[] = (invites ?? [])
    .map((inv) => {
      const inner = responseByInviteDate.get(inv.id) ?? new Map<string, boolean>();
      const cells: Record<string, ResultsCell> = {};
      for (const d of dateRows) {
        if (inner.has(d.id)) cells[d.id] = inner.get(d.id) ? "yes" : "no";
        else cells[d.id] = "pending";
      }
      const emailStatus: ResultsMember["emailStatus"] = inv.email_error
        ? "error"
        : inv.email_sent_at
          ? "sent"
          : "pending";
      return {
        profileId: inv.profile_id,
        fullName: nameMap.get(inv.profile_id) ?? "Member",
        cells,
        emailStatus,
        emailError: inv.email_error ?? null,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const isClosed = poll.closed_at !== null || new Date(poll.closes_at) < new Date();

  return (
    <div className="flex flex-col gap-10">
      <BandSubNav
        bandId={band.id}
        bandName={band.name}
        slug={band.slug}
        logoUrl={band.logo_url}
        activeTab="polls"
      />

      <main className="flex flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href={`/dashboard/bands/${bandId}/polls`} className="text-sm opacity-70 underline">
              ← Back to polls
            </Link>
            <h1 className="text-2xl font-bold">
              {poll.title ?? "Availability check"}
            </h1>
            <p className="text-sm opacity-70">
              {isClosed ? "Closed" : "Open"} · closes {new Date(poll.closes_at).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isClosed && <ClosePollButton bandId={bandId} pollId={pollId} />}
            <DeletePollButton bandId={bandId} pollId={pollId} />
          </div>
        </header>

        {poll.note && (
          <p className="rounded-xl bg-black/5 p-3 text-sm italic dark:bg-white/5">{poll.note}</p>
        )}

        <PollResultsTable dates={dateRows} members={memberRows} />
      </main>
    </div>
  );
}
