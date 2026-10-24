import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

// TODO: band settings form (bio, links, genres), asset uploads to the
// `band-assets` bucket at `{band_id}/{logo|press|rider}/...`, roster + invites.
export default async function BandSettingsPage({ params }: { params: Promise<{ bandId: string }> }) {
  const { bandId } = await params;
  const supabase = await createClient();

  const { data: band, error } = await supabase.from("bands").select("id, name").eq("id", bandId).maybeSingle();
  if (error) throw error;
  if (!band) notFound();

  return <h1 className="text-2xl font-bold">{band.name}</h1>;
}
