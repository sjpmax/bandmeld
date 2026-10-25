import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient, requireUserId } from "@/utils/supabase/server";
import { parseStagePlot } from "@/types/stage-plot";
import { BandSubNav } from "@/components/bands/band-subnav";
import { StagePlotMobileNudge } from "@/components/stage-plot/mobile-nudge";
import { StagePlotEditor } from "@/components/stage-plot/editor";

export const metadata: Metadata = { title: "Stage plot" };

export default async function StagePlotEditorPage({
  params,
}: {
  params: Promise<{ bandId: string }>;
}) {
  const { bandId } = await params;
  const userId = await requireUserId(`/dashboard/bands/${bandId}/stage-plot`);
  const supabase = await createClient();

  const [{ data: band, error: bandErr }, { data: members, error: membersErr }] =
    await Promise.all([
      supabase.from("bands").select("*").eq("id", bandId).maybeSingle(),
      supabase
        .from("band_members")
        .select("id, profile_id, role_in_band, is_admin")
        .eq("band_id", bandId),
    ]);

  if (bandErr) throw bandErr;
  if (!band) notFound();
  if (membersErr) throw membersErr;

  const me = members?.find((m) => m.profile_id === userId);
  const viewerIsAdmin = me?.is_admin === true;

  const profileIds = members?.map((m) => m.profile_id) ?? [];
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", profileIds)
    : { data: [] };
  const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name]) ?? []);

  const roster = (members ?? []).map((m) => ({
    member_id: m.profile_id,
    name: profileMap.get(m.profile_id) ?? "Member",
    role: m.role_in_band ?? "",
  }));

  const plot = parseStagePlot(band.stage_plot);

  return (
    <div className="flex flex-col gap-6">
      <BandSubNav
        bandId={band.id}
        bandName={band.name}
        slug={band.slug}
        logoUrl={band.logo_url}
        activeTab="stage-plot"
      />

      {!viewerIsAdmin && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          You&apos;re a member of this band but not an admin. The stage plot is admin-only.
        </p>
      )}

      {viewerIsAdmin && (
        <>
          {/* How-to card — shown on tablet/desktop where the editor is usable */}
          <div className="hidden rounded-xl border border-black/10 bg-black/[0.02] p-4 text-sm leading-relaxed md:block dark:border-white/10 dark:bg-white/[0.03]">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-60">
              How this works
            </p>
            <p>
              Drag items from the <strong>Gear</strong> or <strong>Roster</strong> tray onto the stage.
              The <strong>Crowd</strong> label marks where the audience will be — place performers near it, backline toward the back.
              Dropping a mic or DI box offers to add a prefilled row to the <strong>Input list</strong> on the right (accept or dismiss).
              Use <strong>+ Guest performer</strong> for sit-ins who aren&apos;t in your roster.
              Click an item to select it, then drag to move or press <kbd className="rounded border border-current/30 px-1 text-xs">Delete</kbd> to remove.
              Changes save automatically.
              The public version lives on your EPK with a <strong>Printable version</strong> link for venues.
            </p>
          </div>

          {/* Mobile nudge */}
          <div className="md:hidden">
            <StagePlotMobileNudge bandSlug={band.slug} />
          </div>
          {/* Editor */}
          <div className="hidden md:block">
            <StagePlotEditor bandId={band.id} roster={roster} initialPlot={plot} />
          </div>
        </>
      )}
    </div>
  );
}
