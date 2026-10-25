"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUserId } from "@/utils/supabase/server";
import { stagePlotSchema } from "@/types/stage-plot";
import type { ActionResult } from "@/types";

/**
 * Persist a stage plot for a band. The action verifies the caller is an
 * admin of the band, Zod-validates the incoming blob, then writes it in
 * a single UPDATE. Idempotent: callers may invoke this on every autosave.
 */
export async function saveStagePlot(
  bandId: string,
  plot: unknown,
): Promise<ActionResult> {
  const userId = await requireUserId(`/dashboard/bands/${bandId}/stage-plot`);
  const supabase = await createClient();

  const { data: member, error: memberErr } = await supabase
    .from("band_members")
    .select("is_admin")
    .eq("band_id", bandId)
    .eq("profile_id", userId)
    .maybeSingle();

  if (memberErr) return { ok: false, error: memberErr.message };
  if (!member || member.is_admin !== true) {
    return { ok: false, error: "Only band admins can edit the stage plot." };
  }

  const parsed = stagePlotSchema.safeParse(plot);
  if (!parsed.success) {
    return { ok: false, error: "The stage plot data looks corrupt. Reload the page." };
  }

  const { error: updateErr } = await supabase
    .from("bands")
    .update({ stage_plot: parsed.data })
    .eq("id", bandId);

  if (updateErr) return { ok: false, error: updateErr.message };

  revalidatePath(`/dashboard/bands/${bandId}/stage-plot`);
  return { ok: true, message: "Saved." };
}
