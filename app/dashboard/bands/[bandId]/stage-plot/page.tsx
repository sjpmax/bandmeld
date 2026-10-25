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
