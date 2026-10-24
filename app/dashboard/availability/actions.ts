"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type { ActionResult } from "@/types";
import type { ReviewableEvent } from "@/lib/google-calendar";

export async function addUnavailability(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const reasonRaw = String(formData.get("reason") ?? "").trim();
  const reason = reasonRaw.length > 0 ? reasonRaw.slice(0, 120) : null;

  if (!startDate || !endDate) {
    return { ok: false, error: "Start and end dates are required." };
  }
  // ISO YYYY-MM-DD strings compare correctly as text.
  if (endDate < startDate) {
    return { ok: false, error: "End date must be on or after start date." };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const profileId = claims?.claims?.sub;
  if (!profileId) return { ok: false, error: "You're signed out." };

  const { error } = await supabase.from("member_unavailabilities").insert({
    profile_id: profileId,
    start_date: startDate,
    end_date: endDate,
    reason,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/availability");
  return { ok: true, message: "Dates blocked." };
}

export async function removeUnavailability(id: string): Promise<void> {
  const supabase = await createClient();
  // RLS enforces profile_id = auth.uid(); nothing happens if someone else's id is passed.
  await supabase.from("member_unavailabilities").delete().eq("id", id);
  revalidatePath("/dashboard/availability");
}

// ---------------------------------------------------------------------------
// Google Calendar import
// ---------------------------------------------------------------------------

export async function disconnectGoogleCalendar(): Promise<void> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const profileId = claims?.claims?.sub;
  if (!profileId) return;
  await supabase.from("google_calendar_connections").delete().eq("profile_id", profileId);
  revalidatePath("/dashboard/availability");
}

/**
 * Applies the user's import selection.
 *
 * The review form submits two things:
 *   - `payload`  — JSON array of ReviewableEvent (every event we showed).
 *   - `selected` — one entry per checked box; the Google event id.
 *
 * We intersect, build member_unavailabilities rows (reason = event summary),
 * and insert in one batch. RLS enforces profile_id = auth.uid() per row.
 */
export async function applyGoogleImport(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const profileId = claims?.claims?.sub;
  if (!profileId) redirect("/login?next=/dashboard/availability");

  const payloadRaw = String(formData.get("payload") ?? "");
  const selectedIds = new Set(formData.getAll("selected").map((v) => String(v)));

  let events: ReviewableEvent[];
  try {
    events = JSON.parse(payloadRaw) as ReviewableEvent[];
  } catch {
    redirect("/dashboard/availability?import_error=bad_payload");
  }

  const rows = events
    .filter((e) => selectedIds.has(e.id))
    .map((e) => ({
      profile_id: profileId,
      start_date: e.startDate,
      end_date: e.endDate,
      reason: e.summary.slice(0, 120),
    }));

  if (rows.length === 0) {
    redirect("/dashboard/availability?import_error=nothing_selected");
  }

  const { error } = await supabase.from("member_unavailabilities").insert(rows);
  if (error) {
    redirect(`/dashboard/availability?import_error=${encodeURIComponent(error.message)}`);
  }

  await supabase
    .from("google_calendar_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("profile_id", profileId);

  revalidatePath("/dashboard/availability");
  redirect(`/dashboard/availability?imported=${rows.length}`);
}
