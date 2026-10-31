// utils/email/templates/poll-invite.ts

export type PollInviteTemplateArgs = {
  bandName: string;
  memberName: string;        // recipient's full_name
  pollTitle: string | null;  // may be null — fall back to a default
  note: string | null;       // admin's optional message to the band
  dates: string[];           // ISO date strings yyyy-mm-dd (poll_dates.target_date::text)
  linkUrl: string;           // absolute URL to /poll/<token>
  closesAt: string;          // ISO timestamp
};

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function fmt(iso: string): string {
  // ISO yyyy-mm-dd without TZ — treat as UTC noon to avoid off-by-one.
  return dateFmt.format(new Date(`${iso}T12:00:00Z`));
}

export function buildPollInviteEmail(args: PollInviteTemplateArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const trimmedPollTitle = args.pollTitle?.trim() || null;
  const bodyTitle = trimmedPollTitle ?? `Availability check for ${args.bandName}`;
  const subject = `${args.bandName}: ${trimmedPollTitle ?? "are you available for these dates?"}`;
  const dateLines = args.dates.map((d) => `  • ${fmt(d)}`).join("\n");
  const closesLine = `This link stays open until ${fmt(args.closesAt.slice(0, 10))}.`;

  const text =
    `Hi ${args.memberName},\n\n` +
    `${args.bandName} is checking availability for these dates:\n\n` +
    `${dateLines}\n\n` +
    (args.note ? `From the band:\n${args.note}\n\n` : "") +
    `Answer here (no login required):\n${args.linkUrl}\n\n` +
    `${closesLine}\n` +
    `You can revisit the link and change your answer any time before it closes.\n`;

  const htmlDates = args.dates
    .map((d) => `<li style="margin:4px 0;">${fmt(d)}</li>`)
    .join("");

  const html =
    `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#111;max-width:560px;margin:0 auto;padding:24px;">` +
    `<h1 style="font-size:20px;margin:0 0 12px;">${escapeHtml(bodyTitle)}</h1>` +
    `<p>Hi ${escapeHtml(args.memberName)},</p>` +
    `<p><strong>${escapeHtml(args.bandName)}</strong> is checking availability for these dates:</p>` +
    `<ul>${htmlDates}</ul>` +
    (args.note
      ? `<p style="padding:12px;background:#f4f4f5;border-radius:8px;"><em>${escapeHtml(args.note)}</em></p>`
      : "") +
    `<p style="margin:24px 0;"><a href="${args.linkUrl}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;border-radius:999px;text-decoration:none;font-weight:600;">Answer the poll</a></p>` +
    `<p style="color:#555;font-size:14px;">${escapeHtml(closesLine)} You can revisit the link and change your answer any time before it closes.</p>` +
    `</body></html>`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
