"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import type { ActionResult, GigStatus } from "@/types";

/**
 * Triggers the availability sync RPC for the band.
 * Aggregates member unavailabilities over the next 366 days and
 * creates actively_seeking dates where all members are free.
 * Leaves penciled_in, booked, and unavailable dates intact.
 */
export async function syncBandAvailabilityAction(
  bandId: string,
): Promise<ActionResult<{ count: number }>> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("sync_band_open_dates", {
    p_band_id: bandId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  // Count active open dates to give friendly feedback
  const { count } = await supabase
    .from("band_open_dates")
    .select("*", { count: "exact", head: true })
    .eq("band_id", bandId)
    .gte("target_date", new Date().toISOString().slice(0, 10));

  // Get band slug to revalidate public EPK
  const { data: band } = await supabase
    .from("bands")
    .select("slug")
    .eq("id", bandId)
    .maybeSingle();

  revalidatePath(`/dashboard/bands/${bandId}/availability`);
  if (band?.slug) {
    revalidatePath(`/bands/${band.slug}`);
  }

  return {
    ok: true,
    message: `Master calendar synced! Found ${count ?? 0} open upcoming date${count === 1 ? "" : "s"}.`,
    data: { count: count ?? 0 },
  };
}

/**
 * Updates the band's preferred gig days (e.g. [5, 6] for Fri/Sat),
 * and immediately triggers a sync to purge non-preferred days.
 */
export async function setBandPreferredGigDaysAction(
  bandId: string,
  days: number[],
): Promise<ActionResult<{ count: number }>> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_band_preferred_gig_days", {
    p_band_id: bandId,
    p_preferred_days: days,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  // Re-sync to immediately apply the filter
  return syncBandAvailabilityAction(bandId);
}

/**
 * Updates or creates a status entry for a specific date on the band's calendar.
 * Admin-only (enforced by RLS on band_open_dates).
 */
export async function setBandDateStatusAction(
  bandId: string,
  targetDate: string,
  status: GigStatus,
  notes: string | null = null,
): Promise<ActionResult> {
  if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return { ok: false, error: "Invalid date format." };
  }

  const supabase = await createClient();

  const trimmedNotes = notes?.trim() ? notes.trim().slice(0, 250) : null;

  // Upsert on (band_id, target_date)
  const { error } = await supabase.from("band_open_dates").upsert(
    {
      band_id: bandId,
      target_date: targetDate,
      status,
      notes: trimmedNotes,
    },
    { onConflict: "band_id,target_date" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  const { data: band } = await supabase
    .from("bands")
    .select("slug")
    .eq("id", bandId)
    .maybeSingle();

  revalidatePath(`/dashboard/bands/${bandId}/availability`);
  if (band?.slug) {
    revalidatePath(`/bands/${band.slug}`);
  }

  return { ok: true, message: `Updated status for ${targetDate}.` };
}

/**
 * Removes a date entry from the band's open dates table.
 * Admin-only (enforced by RLS on band_open_dates).
 */
export async function clearBandDateAction(
  bandId: string,
  targetDate: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("band_open_dates")
    .delete()
    .eq("band_id", bandId)
    .eq("target_date", targetDate);

  if (error) {
    return { ok: false, error: error.message };
  }

  const { data: band } = await supabase
    .from("bands")
    .select("slug")
    .eq("id", bandId)
    .maybeSingle();

  revalidatePath(`/dashboard/bands/${bandId}/availability`);
  if (band?.slug) {
    revalidatePath(`/bands/${band.slug}`);
  }

  return { ok: true, message: `Cleared date entry for ${targetDate}.` };
}

