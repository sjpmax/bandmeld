"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { SLUG_RE, slugify } from "@/lib/slug";
import type { ActionResult } from "@/types";

const BAND_ASSETS_BUCKET = "band-assets";

/** Extract the in-bucket path from a public URL we previously stored. */
function assetPathFromPublicUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = `/${BAND_ASSETS_BUCKET}/`;
  const idx = url.indexOf(marker);
  return idx === -1 ? null : url.slice(idx + marker.length);
}

// -----------------------------------------------------------------------------
// Create a band — calls the create_band RPC which also makes the caller admin.
// -----------------------------------------------------------------------------
export async function createBand(
  _prev: ActionResult<string>,
  formData: FormData,
): Promise<ActionResult<string>> {
  const name = String(formData.get("name") ?? "").trim();
  const slugRaw = String(formData.get("slug") ?? "").trim();
  const homeCity = String(formData.get("home_city") ?? "").trim();
  const genresRaw = String(formData.get("genres") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const founderRole = String(formData.get("founder_role") ?? "").trim().slice(0, 60);

  if (!name) return { ok: false, error: "Band name is required." };
  if (!homeCity) return { ok: false, error: "Home city is required." };

  const slug = (slugRaw || slugify(name)).toLowerCase();
  if (!SLUG_RE.test(slug)) {
    return { ok: false, error: "URL may only contain lowercase letters, numbers, and single dashes." };
  }

  const genres = genresRaw
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean)
    .slice(0, 6);

  const supabase = await createClient();
  const { data: bandId, error } = await supabase.rpc("create_band", {
    p_name: name,
    p_slug: slug,
    p_home_city: homeCity,
    p_genres: genres,
    p_bio: bio ?? "",
    p_founder_role: founderRole,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: `The URL "${slug}" is already taken — pick another.` };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/bands/${bandId as string}`);
}

// -----------------------------------------------------------------------------
// Update band settings (admin-only; RLS enforces).
// -----------------------------------------------------------------------------
export async function updateBand(
  bandId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const homeCity = String(formData.get("home_city") ?? "").trim();
  const homeCityLatRaw = String(formData.get("home_city_lat") ?? "").trim();
  const homeCityLngRaw = String(formData.get("home_city_lng") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const spotifyUrl = String(formData.get("spotify_url") ?? "").trim() || null;
  const youtubeUrl = String(formData.get("youtube_url") ?? "").trim() || null;
  const appleMusicUrl = String(formData.get("apple_music_url") ?? "").trim() || null;
  const instagramUrl = String(formData.get("instagram_url") ?? "").trim() || null;
  const linktreeUrl = String(formData.get("linktree_url") ?? "").trim() || null;
  const genresRaw = String(formData.get("genres") ?? "").trim();
  const avgDrawRaw = String(formData.get("avg_local_draw") ?? "").trim();

  if (!name) return { ok: false, error: "Band name is required." };
  if (!homeCity) return { ok: false, error: "Home city is required." };

  const genres = genresRaw
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean)
    .slice(0, 6);
  const avgLocalDraw = avgDrawRaw === "" ? 0 : Math.max(0, Math.min(100000, Number(avgDrawRaw) || 0));

  // Only persist coords when both are present and sane; otherwise null so
  // typing a different city doesn't leave stale coordinates behind.
  const homeCityLat = homeCityLatRaw ? Number(homeCityLatRaw) : NaN;
  const homeCityLng = homeCityLngRaw ? Number(homeCityLngRaw) : NaN;
  const coordsValid =
    Number.isFinite(homeCityLat) &&
    Number.isFinite(homeCityLng) &&
    homeCityLat >= -90 &&
    homeCityLat <= 90 &&
    homeCityLng >= -180 &&
    homeCityLng <= 180;

  const { error } = await supabase
    .from("bands")
    .update({
      name,
      home_city: homeCity,
      home_city_lat: coordsValid ? homeCityLat : null,
      home_city_lng: coordsValid ? homeCityLng : null,
      bio,
      genres,
      spotify_url: spotifyUrl,
      youtube_url: youtubeUrl,
      apple_music_url: appleMusicUrl,
      instagram_url: instagramUrl,
      linktree_url: linktreeUrl,
      avg_local_draw: avgLocalDraw,
    })
    .eq("id", bandId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/bands/${bandId}`);
  revalidatePath("/dashboard");
  return { ok: true, message: "Band saved." };
}

// -----------------------------------------------------------------------------
// Save an asset's public URL onto the band row after a client-side upload.
// Kind maps to the column: logo / press / rider / epk.
// -----------------------------------------------------------------------------
type AssetKind = "logo" | "press" | "rider" | "epk";
const COLUMN_FOR: Record<AssetKind, "logo_url" | "press_photo_url" | "tech_rider_url" | "epk_pdf_url"> = {
  logo: "logo_url",
  press: "press_photo_url",
  rider: "tech_rider_url",
  epk: "epk_pdf_url",
};

export async function setBandAssetUrl(
  bandId: string,
  kind: AssetKind,
  publicUrl: string | null,
): Promise<ActionResult> {
  const supabase = await createClient();
  const column = COLUMN_FOR[kind];

  // Fetch the previously-stored URL for this column so we can delete the
  // underlying storage object after the DB update succeeds — otherwise
  // "removed" assets stay publicly fetchable forever.
  const { data: current } = await supabase
    .from("bands")
    .select("logo_url, press_photo_url, tech_rider_url, epk_pdf_url")
    .eq("id", bandId)
    .maybeSingle();
  const prevPath = assetPathFromPublicUrl(current ? current[column] : null);
  const nextPath = assetPathFromPublicUrl(publicUrl);

  // Explicit shape per column so Supabase's generated types stay happy.
  const patch =
    kind === "logo"
      ? { logo_url: publicUrl }
      : kind === "press"
        ? { press_photo_url: publicUrl }
        : kind === "rider"
          ? { tech_rider_url: publicUrl }
          : { epk_pdf_url: publicUrl };

  const { error } = await supabase.from("bands").update(patch).eq("id", bandId);
  if (error) return { ok: false, error: error.message };

  // Best-effort cleanup. Don't fail the action if storage delete errors —
  // the row is already updated.
  if (prevPath && prevPath !== nextPath) {
    await supabase.storage.from(BAND_ASSETS_BUCKET).remove([prevPath]);
  }

  revalidatePath(`/dashboard/bands/${bandId}`);
  return { ok: true, message: publicUrl ? "Uploaded." : "Removed." };
}

// -----------------------------------------------------------------------------
// Invites
// -----------------------------------------------------------------------------
export async function createInvite(
  bandId: string,
  _prev: ActionResult<{ token: string; email: string }>,
  formData: FormData,
): Promise<ActionResult<{ token: string; email: string }>> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const roleInBand = String(formData.get("role_in_band") ?? "").trim() || "Member";

  if (!email) return { ok: false, error: "Email is required." };

  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("create_band_invite", {
    p_band_id: bandId,
    p_email: email,
    p_role_in_band: roleInBand,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/bands/${bandId}`);
  return { ok: true, message: "Invite created.", data: { token: token as string, email } };
}

export async function revokeInvite(inviteId: string, bandId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("revoke_band_invite", { p_invite_id: inviteId });
  revalidatePath(`/dashboard/bands/${bandId}`);
}

// -----------------------------------------------------------------------------
// Member management
// -----------------------------------------------------------------------------
export async function setMemberAdmin(
  memberId: string,
  bandId: string,
  nextAdmin: boolean,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("band_members")
    .update({ is_admin: nextAdmin })
    .eq("id", memberId);
  // Trigger raises if this would strip the last admin — error bubbles up to
  // the error overlay. Silent success otherwise.
  if (error) throw error;
  revalidatePath(`/dashboard/bands/${bandId}`);
}

export async function removeMember(memberId: string, bandId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("band_members").delete().eq("id", memberId);
  if (error) throw error;
  revalidatePath(`/dashboard/bands/${bandId}`);
}

export async function leaveBand(memberId: string, bandId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("band_members").delete().eq("id", memberId);
  if (error) throw error;
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
