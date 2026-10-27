import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient, requireUserId } from "@/utils/supabase/server";
import { CreatePollForm } from "@/components/polls/create-poll-form";
import { BandSubNav } from "@/components/bands/band-subnav";

export const metadata: Metadata = { title: "Ask the band" };

export default async function NewPollPage({
  params,
}: {
  params: Promise<{ bandId: string }>;
}) {
  const { bandId } = await params;
  await requireUserId(`/dashboard/bands/${bandId}/polls/new`);
  const supabase = await createClient();

  const { data: band } = await supabase
    .from("bands")
    .select("id, name, slug, logo_url")
    .eq("id", bandId)
    .maybeSingle();
  if (!band) notFound();

  // Admin-only. Non-admins land back on the band page.
  const { data: isAdmin } = await supabase.rpc("is_band_admin", { p_band_id: bandId });
  if (!isAdmin) redirect(`/dashboard/bands/${bandId}`);

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
        <header className="flex flex-col gap-1">
          <Link href={`/dashboard/bands/${bandId}/polls`} className="text-sm opacity-70 underline">
            ← Back to polls
          </Link>
          <h1 className="text-2xl font-bold">Ask the band about dates</h1>
          <p className="text-sm opacity-70">
            Each member gets a one-time link in their email with yes/no radios per date. No login required.
          </p>
        </header>

        <CreatePollForm bandId={band.id} />
      </main>
    </div>
  );
}
