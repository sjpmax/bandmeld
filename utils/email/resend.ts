import { getResendEnv } from "@/utils/supabase/env";

export type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; status: number; error: string };

/**
 * Sends one email via Resend's HTTP API.
 * Never throws — callers that fan out to many recipients should keep going
 * on individual failures and surface them to the admin.
 */
export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const { apiKey, from } = getResendEnv();
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      return { ok: false, status: res.status, error: body.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, id: body.id ?? "" };
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : "fetch failed" };
  }
}
