"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { sendEmail } from "@/utils/email/resend";
import { buildPollInviteEmail } from "@/utils/email/templates/poll-invite";

export type CreatePollArgs = {
  bandId: string;
  dates: string[];      // yyyy-mm-dd
  title: string | null;
  note: string | null;
};

export type CreatePollResult =
  | { ok: true; pollId: string; total: number; sent: number }
  | { ok: false; error: string };

type CreatePollRow = {
  poll_id: string;
  profile_id: string;
  full_name: string | null;
  email: string | null;
  token: string;
};

async function getBaseUrl(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) throw new Error("Could not determine base URL for poll links");
  return `${proto}://${host}`;
}

export async function createPollAction(args: CreatePollArgs): Promise<CreatePollResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_poll", {
    p_band_id: args.bandId,
    p_dates: args.dates,
    p_title: args.title ?? undefined,
    p_note: args.note ?? undefined,
    p_closes_at: undefined,
  });

  if (error) return { ok: false, error: error.message };
  const rows = (data ?? []) as CreatePollRow[];
  const firstRow = rows[0];
  if (!firstRow) {
    return { ok: false, error: "Poll was created but no band members were found to notify." };
  }

  const pollId = firstRow.poll_id;

  // Band + dates for the email body — one more read (we don't echo them from the RPC
  // to keep its return shape per-invite).
  const [{ data: band }, { data: dates }, { data: invites }] = await Promise.all([
    supabase.from("bands").select("name").eq("id", args.bandId).maybeSingle(),
    supabase
      .from("poll_dates")
      .select("target_date, position")
      .eq("poll_id", pollId)
      .order("position", { ascending: true }),
    supabase.from("poll_invites").select("id, profile_id").eq("poll_id", pollId),
  ]);

  if (!band) return { ok: false, error: "Band not found" };
  const inviteIdByProfile = new Map<string, string>(
    (invites ?? []).map((i) => [i.profile_id, i.id]),
  );
  const dateStrings = (dates ?? []).map((d) => d.target_date);
  const closesAtIso = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
  const base = await getBaseUrl();

  let sent = 0;
  for (const row of rows) {
    const inviteId = inviteIdByProfile.get(row.profile_id);
    if (!inviteId) continue;
    if (!row.email) {
      await supabase.rpc("mark_poll_invite_email", {
        p_invite_id: inviteId,
        p_ok: false,
        p_error: "no email on account",
      });
      continue;
    }
    const email = buildPollInviteEmail({
      bandName: band.name,
      memberName: row.full_name ?? "there",
      pollTitle: args.title,
      note: args.note,
      dates: dateStrings,
      linkUrl: `${base}/poll/${row.token}`,
      closesAt: closesAtIso,
    });

    const result = await sendEmail({
      to: row.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    await supabase.rpc("mark_poll_invite_email", {
      p_invite_id: inviteId,
      p_ok: result.ok,
      p_error: result.ok ? undefined : `${result.status}: ${result.error}`.slice(0, 500),
    });

    if (result.ok) sent++;
  }

  revalidatePath(`/dashboard/bands/${args.bandId}/polls`);
  revalidatePath(`/dashboard/bands/${args.bandId}/polls/${pollId}`);

  return { ok: true, pollId, total: rows.length, sent };
}
