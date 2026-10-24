"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, getUserId } from "@/utils/supabase/server";

/**
 * Accepts a band invite. Caller must be signed in with the email the invite
 * was addressed to — the RPC enforces this with a clear error, which we
 * surface as a query param on the invite page.
 */
export async function acceptInviteAction(token: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  const supabase = await createClient();
  const { data: bandId, error } = await supabase.rpc("accept_band_invite", { p_token: token });
  if (error) {
    redirect(`/invite/${token}?accept_error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/bands/${bandId as string}`);
}
