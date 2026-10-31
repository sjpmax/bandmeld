"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export async function closePollAction(bandId: string, pollId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_poll", { p_poll_id: pollId });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/bands/${bandId}/polls`);
  revalidatePath(`/dashboard/bands/${bandId}/polls/${pollId}`);
  revalidatePath(`/dashboard/bands/${bandId}/availability`);
  revalidatePath(`/dashboard/availability`);
  return { ok: true };
}

export async function deletePollAction(bandId: string, pollId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_poll", { p_poll_id: pollId });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/bands/${bandId}/polls`);
  return { ok: true };
}
