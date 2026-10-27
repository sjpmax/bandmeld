"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export async function closePollAction(bandId: string, pollId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_poll", { p_poll_id: pollId });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/dashboard/bands/${bandId}/polls`);
  revalidatePath(`/dashboard/bands/${bandId}/polls/${pollId}`);
  return { ok: true };
}
