"use server";

import { createClient } from "@/utils/supabase/server";

export type SubmitArgs = {
  token: string;
  answers: Array<{ poll_date_id: string; answer: boolean }>;
};

export type SubmitResult = { ok: true } | { ok: false; error: string };

export async function submitPollResponseAction(args: SubmitArgs): Promise<SubmitResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_poll_response", {
    p_token: args.token,
    p_answers: args.answers,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
