// One-shot Resend connectivity check. Mirrors the production path in
// utils/email/resend.ts — HTTP, no SDK — so a successful run proves the
// real poll-invite flow will deliver too.
//
// Run from the repo root:
//   node --env-file=.env.local scripts/test-resend.mjs
//   node --env-file=.env.local scripts/test-resend.mjs someone@example.com
//
// Prereqs in .env.local:
//   RESEND_API_KEY=re_...
//   EMAIL_FROM=BandMeld <onboarding@resend.dev>   # or your verified sender

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM;
const to = process.argv[2] ?? "thejperez@gmail.com";

if (!apiKey) {
  console.error("Missing RESEND_API_KEY in .env.local");
  process.exit(1);
}
if (!from) {
  console.error("Missing EMAIL_FROM in .env.local");
  process.exit(1);
}

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from,
    to,
    subject: "Hello World",
    html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
  }),
});

const body = await res.json().catch(() => ({}));
console.log(`HTTP ${res.status}`);
console.log(body);

if (!res.ok) process.exit(1);
