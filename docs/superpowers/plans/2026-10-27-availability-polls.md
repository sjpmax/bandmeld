# Availability Polls (email-delivered) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a band admin pick N candidate dates, hit "Ask the band," and have each member receive a one-time tokenized email link that opens a no-login page with yes/no radios per date. Admin sees a results grid and can close the poll.

**Architecture:** Four new Postgres tables (`polls`, `poll_dates`, `poll_invites`, `poll_responses`) following the existing invite pattern: no direct `INSERT`/`UPDATE`/`DELETE` RLS, all mutations through `SECURITY DEFINER` RPCs; `SELECT` only for band admins. Member access is purely token-based through two unauthenticated RPCs (`preview_poll_by_token`, `submit_poll_response`), mirroring `preview_band_invite` / `accept_band_invite`. Tokens are **reusable until the poll closes** — a member can revisit the link and change their answer. The admin's "Ask the band" server action creates the poll + per-member tokens in one RPC, then sends per-recipient emails via Resend's HTTP API (fetch; no SDK). Email failures are logged per-recipient and surfaced on the results page so the admin can resend or copy a link manually.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind 4, Supabase (via `@supabase/ssr`), TypeScript strict, Zod (already installed), sonner (already installed) for toasts, Resend (HTTP API only, no new npm dep).

**File inventory (what each task touches):**

| File | Role |
| :--- | :--- |
| `supabase/migrations/20261102000000_availability_polls.sql` | tables, indexes, RLS, RPCs |
| `types/database.types.ts` | regenerated after migration |
| `utils/email/resend.ts` | thin `sendEmail(to, subject, html, text)` wrapper over Resend's REST API |
| `utils/email/templates/poll-invite.ts` | HTML + text builder for the poll invitation |
| `utils/supabase/env.ts` | add `RESEND_API_KEY` and `EMAIL_FROM` to the env getter |
| `.env.example` | document the two new vars |
| `components/polls/create-poll-form.tsx` | client form: title/note, dynamic date rows, submit |
| `components/polls/poll-response-form.tsx` | client form the member fills in on the token page |
| `components/polls/poll-results-table.tsx` | member × date grid shown to admin |
| `components/polls/close-poll-button.tsx` | admin-only close action with confirm |
| `components/bands/band-subnav.tsx` | add a "Polls" tab |
| `app/dashboard/bands/[bandId]/polls/page.tsx` | list open + recent closed polls |
| `app/dashboard/bands/[bandId]/polls/new/page.tsx` | admin create-poll screen |
| `app/dashboard/bands/[bandId]/polls/new/actions.ts` | `createPollAction` — RPC + emails |
| `app/dashboard/bands/[bandId]/polls/[pollId]/page.tsx` | results grid + close button |
| `app/dashboard/bands/[bandId]/polls/[pollId]/actions.ts` | `closePollAction` |
| `app/poll/[token]/page.tsx` | unauthenticated response page |
| `app/poll/[token]/actions.ts` | `submitPollResponseAction` |

Project norm: no test framework yet. Verification = `npm run typecheck` + manual dev-server checks (`npm run dev`, listening on `http://localhost:3001`). Each task ends with a commit.

---

## Task 0: Prerequisite — clean working tree

**Files:** none created — this is a workspace hygiene check.

The repo currently has an uncommitted modification to `supabase/migrations/20261030000000_preferred_gig_days.sql`. That edit is unrelated to this plan; its state will interfere with running `supabase db push` for the new migration.

- [ ] **Step 1: Inspect the uncommitted change**

```bash
git status
git diff supabase/migrations/20261030000000_preferred_gig_days.sql
```

Decide with the human whether to commit the edit, stash it (`git stash push -u -- supabase/migrations/20261030000000_preferred_gig_days.sql`), or revert it. **Do not** proceed until the working tree is clean of unrelated migration edits.

- [ ] **Step 2: Confirm clean**

```bash
git status
```

Expected: nothing to commit, or only files this plan is about to touch.

No commit of its own.

---

## Task 1: Document and read env vars

**Files:**
- Modify: `.env.example`
- Modify: `utils/supabase/env.ts`

- [ ] **Step 1: Add Resend vars to `.env.example`**

Append:

```
# Resend (transactional email) — required for availability polls
RESEND_API_KEY=
# Must be a verified sender on the Resend domain, e.g. "BandMeld <no-reply@mail.bandmeld.com>"
EMAIL_FROM=
```

- [ ] **Step 2: Extend the env getter**

Open `utils/supabase/env.ts` and find the existing `getSupabaseEnv` function. Add a sibling exported function. If the file currently throws on missing values, follow that same pattern:

```ts
export function getResendEnv(): { apiKey: string; from: string } {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  if (!from) throw new Error("EMAIL_FROM is not set");
  return { apiKey, from };
}
```

If the file currently returns `null`-on-missing instead of throwing, mirror that style — the goal is one import-time crash locally when a dev forgets to set them, deferred to call time if that's the house style.

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add .env.example utils/supabase/env.ts
git commit -m "feat(polls): add RESEND_API_KEY + EMAIL_FROM env plumbing"
```

---

## Task 2: Email sender utility

**Files:**
- Create: `utils/email/resend.ts`

Thin wrapper over Resend's `POST /emails`. No SDK (keeps dep tree small; the API is one endpoint).

- [ ] **Step 1: Write the sender**

```ts
// utils/email/resend.ts
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
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add utils/email/resend.ts
git commit -m "feat(polls): add Resend HTTP sendEmail wrapper"
```

---

## Task 3: Poll invitation email template

**Files:**
- Create: `utils/email/templates/poll-invite.ts`

Pure function — returns `{ subject, html, text }`. No I/O. Date formatting uses `en-US` with month/day/year to match [app/dashboard/bands/[bandId]/page.tsx](app/dashboard/bands/[bandId]/page.tsx)'s existing format.

- [ ] **Step 1: Write the template builder**

```ts
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
  const title = args.pollTitle?.trim() || `Availability check for ${args.bandName}`;
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
    `<h1 style="font-size:20px;margin:0 0 12px;">${escapeHtml(title)}</h1>` +
    `<p>Hi ${escapeHtml(args.memberName)},</p>` +
    `<p><strong>${escapeHtml(args.bandName)}</strong> is checking availability for these dates:</p>` +
    `<ul>${htmlDates}</ul>` +
    (args.note
      ? `<p style="padding:12px;background:#f4f4f5;border-radius:8px;"><em>${escapeHtml(args.note)}</em></p>`
      : "") +
    `<p style="margin:24px 0;"><a href="${args.linkUrl}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;border-radius:999px;text-decoration:none;font-weight:600;">Answer the poll</a></p>` +
    `<p style="color:#555;font-size:14px;">${escapeHtml(closesLine)} You can revisit the link and change your answer any time before it closes.</p>` +
    `</body></html>`;

  return { subject: title, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add utils/email/templates/poll-invite.ts
git commit -m "feat(polls): add poll-invite email template"
```

---

## Task 4: Migration — tables + indexes + RLS

**Files:**
- Create: `supabase/migrations/20261102000000_availability_polls.sql`

Four tables, no RLS mutation policies (mutations go through RPCs added in Task 5–7). SELECT policies let band admins read polls/invites/responses for their own band. Members do **not** need SELECT — their path is RPC-via-token.

- [ ] **Step 1: Write the schema portion**

```sql
-- =============================================================================
-- MIGRATION: Availability polls (email-delivered, token-authenticated responses)
--
-- Tables: polls, poll_dates, poll_invites, poll_responses.
-- Access model:
--   • Admins see their band's polls + invites + responses via SELECT policies.
--   • Members never query these tables directly — they come in with a token
--     and the SECURITY DEFINER RPCs preview_poll_by_token / submit_poll_response
--     handle preview and upsert.
--   • All mutations (create, submit, close) go through RPCs.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. polls — one row per availability check
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.polls (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  band_id     UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  title       TEXT,
  note        TEXT,
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closes_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  closed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS polls_band_id_idx ON public.polls (band_id);

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Band admins read polls" ON public.polls
  FOR SELECT TO authenticated
  USING (public.is_band_admin(band_id));

-- -----------------------------------------------------------------------------
-- 2. poll_dates — the candidate dates for a poll
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.poll_dates (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  poll_id      UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  target_date  DATE NOT NULL,
  position     INT  NOT NULL DEFAULT 0,
  UNIQUE (poll_id, target_date)
);

CREATE INDEX IF NOT EXISTS poll_dates_poll_id_idx ON public.poll_dates (poll_id);

ALTER TABLE public.poll_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Band admins read poll_dates" ON public.poll_dates
  FOR SELECT TO authenticated
  USING (public.is_band_admin((SELECT band_id FROM public.polls WHERE id = poll_id)));

-- -----------------------------------------------------------------------------
-- 3. poll_invites — one row per (poll × band member), carrying the token
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.poll_invites (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  poll_id         UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  profile_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_viewed_at  TIMESTAMPTZ,
  email_sent_at   TIMESTAMPTZ,          -- stamped by the server action on success
  email_error     TEXT,                 -- last-seen send failure, cleared on success
  UNIQUE (poll_id, profile_id)
);

CREATE INDEX IF NOT EXISTS poll_invites_poll_id_idx ON public.poll_invites (poll_id);

ALTER TABLE public.poll_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Band admins read poll_invites" ON public.poll_invites
  FOR SELECT TO authenticated
  USING (public.is_band_admin((SELECT band_id FROM public.polls WHERE id = poll_id)));

-- -----------------------------------------------------------------------------
-- 4. poll_responses — one row per (invite × date), upserted on submit
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.poll_responses (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  poll_invite_id  UUID NOT NULL REFERENCES public.poll_invites(id) ON DELETE CASCADE,
  poll_date_id    UUID NOT NULL REFERENCES public.poll_dates(id)   ON DELETE CASCADE,
  answer          BOOLEAN NOT NULL,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (poll_invite_id, poll_date_id)
);

CREATE INDEX IF NOT EXISTS poll_responses_invite_idx ON public.poll_responses (poll_invite_id);
CREATE INDEX IF NOT EXISTS poll_responses_date_idx   ON public.poll_responses (poll_date_id);

ALTER TABLE public.poll_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Band admins read poll_responses" ON public.poll_responses
  FOR SELECT TO authenticated
  USING (
    public.is_band_admin(
      (SELECT p.band_id FROM public.polls p
         JOIN public.poll_invites pi ON pi.poll_id = p.id
        WHERE pi.id = poll_invite_id)
    )
  );
```

- [ ] **Step 2: Verify SQL parses locally (optional dry-run)**

If you have a local Supabase stack running, apply the pending migration:

```bash
npx supabase db push
```

If you don't have one running yet, defer this to Task 8's push and keep writing SQL. Expected on push: `Applied migration 20261102000000` and no errors.

- [ ] **Step 3: Commit (schema only, RPCs next)**

```bash
git add supabase/migrations/20261102000000_availability_polls.sql
git commit -m "feat(polls): add polls/poll_dates/poll_invites/poll_responses tables + RLS"
```

---

## Task 5: Migration — `create_poll` RPC

Append to the same migration file. This RPC is the one and only path to create a poll. It validates admin, inserts the poll + dates + one invite per band member, and returns the per-member list the server action needs to send emails.

**Files:**
- Modify: `supabase/migrations/20261102000000_availability_polls.sql`

- [ ] **Step 1: Append the RPC**

```sql
-- -----------------------------------------------------------------------------
-- 5. create_poll — admin creates a poll; returns the data needed to send emails.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_poll(
  p_band_id   UUID,
  p_dates     DATE[],
  p_title     TEXT DEFAULT NULL,
  p_note      TEXT DEFAULT NULL,
  p_closes_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  poll_id      UUID,
  profile_id   UUID,
  full_name    TEXT,
  email        TEXT,
  token        TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_poll_id UUID;
  v_title   TEXT;
  v_note    TEXT;
  v_closes  TIMESTAMPTZ;
  v_date    DATE;
  v_pos     INT := 0;
BEGIN
  IF NOT public.is_band_admin(p_band_id) THEN
    RAISE EXCEPTION 'Only band admins can create polls' USING ERRCODE = '42501';
  END IF;

  IF p_dates IS NULL OR array_length(p_dates, 1) IS NULL THEN
    RAISE EXCEPTION 'At least one date is required' USING ERRCODE = '22023';
  END IF;
  IF array_length(p_dates, 1) > 10 THEN
    RAISE EXCEPTION 'A poll can have at most 10 dates' USING ERRCODE = '22023';
  END IF;

  v_title  := NULLIF(TRIM(COALESCE(p_title, '')), '');
  v_note   := NULLIF(TRIM(COALESCE(p_note,  '')), '');
  v_closes := COALESCE(p_closes_at, NOW() + INTERVAL '14 days');

  INSERT INTO public.polls (band_id, title, note, created_by, closes_at)
  VALUES (p_band_id, v_title, v_note, (SELECT auth.uid()), v_closes)
  RETURNING id INTO v_poll_id;

  -- Insert dates in the order the admin supplied; dedupe at the DB level
  -- via the UNIQUE (poll_id, target_date) constraint — duplicates error.
  FOREACH v_date IN ARRAY p_dates LOOP
    INSERT INTO public.poll_dates (poll_id, target_date, position)
    VALUES (v_poll_id, v_date, v_pos);
    v_pos := v_pos + 1;
  END LOOP;

  -- One invite per current band member (admins included).
  INSERT INTO public.poll_invites (poll_id, profile_id, token)
  SELECT v_poll_id, bm.profile_id, encode(gen_random_bytes(18), 'hex')
    FROM public.band_members bm
   WHERE bm.band_id = p_band_id;

  -- Hand back everything the server action needs to send email.
  RETURN QUERY
    SELECT v_poll_id, pi.profile_id, pr.full_name, u.email, pi.token
      FROM public.poll_invites pi
      JOIN public.profiles pr ON pr.id = pi.profile_id
      JOIN auth.users    u  ON u.id  = pi.profile_id
     WHERE pi.poll_id = v_poll_id
     ORDER BY pr.full_name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_poll(UUID, DATE[], TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_poll(UUID, DATE[], TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20261102000000_availability_polls.sql
git commit -m "feat(polls): add create_poll RPC"
```

---

## Task 6: Migration — `preview_poll_by_token` + `submit_poll_response` RPCs

The unauthenticated path, mirroring `preview_band_invite` / `accept_band_invite`.

**Files:**
- Modify: `supabase/migrations/20261102000000_availability_polls.sql`

- [ ] **Step 1: Append the preview RPC**

```sql
-- -----------------------------------------------------------------------------
-- 6. preview_poll_by_token — public read for the response page
--    Returns status ('ok' | 'not_found' | 'closed'), poll + dates +
--    member name + any existing answers (so the UI pre-fills).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.preview_poll_by_token(p_token TEXT)
RETURNS TABLE (
  status         TEXT,
  poll_id        UUID,
  band_name      TEXT,
  title          TEXT,
  note           TEXT,
  closes_at      TIMESTAMPTZ,
  closed_at      TIMESTAMPTZ,
  member_name    TEXT,
  dates          JSONB,          -- [{id, target_date, position}, ...] ordered by position
  answers        JSONB           -- {poll_date_id: boolean, ...}
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invite  public.poll_invites%ROWTYPE;
  v_poll    public.polls%ROWTYPE;
  v_band    public.bands%ROWTYPE;
  v_name    TEXT;
  v_dates   JSONB;
  v_answers JSONB;
BEGIN
  SELECT * INTO v_invite FROM public.poll_invites WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT,
                        NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, NULL::TEXT, NULL::JSONB, NULL::JSONB;
    RETURN;
  END IF;

  SELECT * INTO v_poll FROM public.polls WHERE id = v_invite.poll_id;
  SELECT * INTO v_band FROM public.bands WHERE id = v_poll.band_id;
  SELECT full_name INTO v_name FROM public.profiles WHERE id = v_invite.profile_id;

  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('id', pd.id, 'target_date', pd.target_date, 'position', pd.position)
              ORDER BY pd.position, pd.target_date),
    '[]'::jsonb)
    INTO v_dates
    FROM public.poll_dates pd
   WHERE pd.poll_id = v_poll.id;

  SELECT COALESCE(
    jsonb_object_agg(pr.poll_date_id::text, pr.answer),
    '{}'::jsonb)
    INTO v_answers
    FROM public.poll_responses pr
   WHERE pr.poll_invite_id = v_invite.id;

  -- Non-fatal: stamp last_viewed_at. (SECURITY DEFINER, so RLS doesn't block.)
  UPDATE public.poll_invites SET last_viewed_at = NOW() WHERE id = v_invite.id;

  RETURN QUERY SELECT
    CASE
      WHEN v_poll.closed_at IS NOT NULL THEN 'closed'
      WHEN v_poll.closes_at < NOW()     THEN 'closed'
      ELSE 'ok'
    END::TEXT,
    v_poll.id,
    v_band.name,
    v_poll.title,
    v_poll.note,
    v_poll.closes_at,
    v_poll.closed_at,
    v_name,
    v_dates,
    v_answers;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.preview_poll_by_token(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.preview_poll_by_token(TEXT) TO anon, authenticated;
```

- [ ] **Step 2: Append the submit RPC**

```sql
-- -----------------------------------------------------------------------------
-- 7. submit_poll_response — public write via token. Upserts answers.
--    p_answers is JSON: [{"poll_date_id": "<uuid>", "answer": true}, ...]
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_poll_response(
  p_token   TEXT,
  p_answers JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invite_id UUID;
  v_poll_id   UUID;
  v_closed    BOOLEAN;
  v_answer    JSONB;
  v_date_id   UUID;
  v_val       BOOLEAN;
BEGIN
  SELECT id, poll_id INTO v_invite_id, v_poll_id
    FROM public.poll_invites WHERE token = p_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Poll link not found' USING ERRCODE = '22023';
  END IF;

  SELECT (closed_at IS NOT NULL OR closes_at < NOW())
    INTO v_closed FROM public.polls WHERE id = v_poll_id;
  IF v_closed THEN
    RAISE EXCEPTION 'This poll has closed' USING ERRCODE = '22023';
  END IF;

  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'array' THEN
    RAISE EXCEPTION 'answers must be a JSON array' USING ERRCODE = '22023';
  END IF;

  FOR v_answer IN SELECT * FROM jsonb_array_elements(p_answers) LOOP
    v_date_id := (v_answer->>'poll_date_id')::UUID;
    v_val     := (v_answer->>'answer')::BOOLEAN;

    -- Guard: the poll_date must belong to this invite's poll.
    IF NOT EXISTS (
      SELECT 1 FROM public.poll_dates
       WHERE id = v_date_id AND poll_id = v_poll_id
    ) THEN
      RAISE EXCEPTION 'poll_date_id does not belong to this poll' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.poll_responses (poll_invite_id, poll_date_id, answer)
    VALUES (v_invite_id, v_date_id, v_val)
    ON CONFLICT (poll_invite_id, poll_date_id)
    DO UPDATE SET answer = EXCLUDED.answer, submitted_at = NOW();
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_poll_response(TEXT, JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submit_poll_response(TEXT, JSONB) TO anon, authenticated;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20261102000000_availability_polls.sql
git commit -m "feat(polls): add preview_poll_by_token + submit_poll_response RPCs"
```

---

## Task 7: Migration — `close_poll` + `mark_poll_invite_email` RPCs

**Files:**
- Modify: `supabase/migrations/20261102000000_availability_polls.sql`

- [ ] **Step 1: Append `close_poll`**

```sql
-- -----------------------------------------------------------------------------
-- 8. close_poll — admin ends a poll early.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_poll(p_poll_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_band_id UUID;
BEGIN
  SELECT band_id INTO v_band_id FROM public.polls WHERE id = p_poll_id;
  IF v_band_id IS NULL THEN
    RAISE EXCEPTION 'Poll not found' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_band_admin(v_band_id) THEN
    RAISE EXCEPTION 'Only band admins can close polls' USING ERRCODE = '42501';
  END IF;

  UPDATE public.polls SET closed_at = NOW() WHERE id = p_poll_id AND closed_at IS NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.close_poll(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.close_poll(UUID) TO authenticated;
```

- [ ] **Step 2: Append `mark_poll_invite_email`**

This lets the server action record per-recipient send status without granting write access to `poll_invites`.

```sql
-- -----------------------------------------------------------------------------
-- 9. mark_poll_invite_email — stamp email_sent_at / email_error after send.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_poll_invite_email(
  p_invite_id UUID,
  p_ok        BOOLEAN,
  p_error     TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_band_id UUID;
BEGIN
  SELECT p.band_id INTO v_band_id
    FROM public.poll_invites pi
    JOIN public.polls p ON p.id = pi.poll_id
   WHERE pi.id = p_invite_id;
  IF v_band_id IS NULL THEN RETURN; END IF;
  IF NOT public.is_band_admin(v_band_id) THEN
    RAISE EXCEPTION 'Only band admins can mark invite email status' USING ERRCODE = '42501';
  END IF;

  UPDATE public.poll_invites
     SET email_sent_at = CASE WHEN p_ok THEN NOW() ELSE email_sent_at END,
         email_error   = CASE WHEN p_ok THEN NULL  ELSE p_error      END
   WHERE id = p_invite_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_poll_invite_email(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.mark_poll_invite_email(UUID, BOOLEAN, TEXT) TO authenticated;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20261102000000_availability_polls.sql
git commit -m "feat(polls): add close_poll + mark_poll_invite_email RPCs"
```

---

## Task 8: Apply migration + regenerate types

**Files:**
- Modify: `types/database.types.ts` (regenerated)

- [ ] **Step 1: Push the migration**

```bash
npm run db:push
```

Expected: output ends with `Applied migration 20261102000000`. If an unrelated migration (e.g. the `preferred_gig_days` one from Task 0) blocks the push, resolve before continuing.

- [ ] **Step 2: Regenerate the TS types**

```bash
npm run db:types
```

Expected: `types/database.types.ts` now contains `polls`, `poll_dates`, `poll_invites`, `poll_responses` rows and the four new RPC signatures.

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add types/database.types.ts
git commit -m "chore(polls): regenerate database types for polls tables + RPCs"
```

---

## Task 9: Admin create-poll form (client component)

**Files:**
- Create: `components/polls/create-poll-form.tsx`

Dynamic list of date rows (add/remove). Minimal styling matching the existing `InviteMemberForm` pattern. Submits as a plain POST into the server action we'll write in Task 10.

- [ ] **Step 1: Write the client component**

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createPollAction, type CreatePollResult } from "@/app/dashboard/bands/[bandId]/polls/new/actions";

type Row = { id: string; date: string };

function freshId() {
  return Math.random().toString(36).slice(2);
}

export function CreatePollForm({ bandId }: { bandId: string }) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<Row[]>([{ id: freshId(), date: "" }]);
  const [isPending, startTransition] = useTransition();

  const addRow = () => setRows((r) => [...r, { id: freshId(), date: "" }]);
  const removeRow = (id: string) =>
    setRows((r) => (r.length > 1 ? r.filter((row) => row.id !== id) : r));
  const updateRow = (id: string, date: string) =>
    setRows((r) => r.map((row) => (row.id === id ? { ...row, date } : row)));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dates = Array.from(new Set(rows.map((r) => r.date.trim()).filter(Boolean)));
    if (dates.length === 0) {
      toast.error("Add at least one date.");
      return;
    }
    if (dates.length > 10) {
      toast.error("A poll can have at most 10 dates.");
      return;
    }
    startTransition(async () => {
      const result: CreatePollResult = await createPollAction({
        bandId,
        dates,
        title: title.trim() || null,
        note: note.trim() || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Sent ${result.sent}/${result.total} emails`);
      window.location.assign(`/dashboard/bands/${bandId}/polls/${result.pollId}`);
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Title (optional)</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. 3 dates from The Other Band"
          maxLength={120}
          className="rounded-xl border border-black/15 bg-white px-3 py-2 dark:border-white/15 dark:bg-white/5"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Note to the band (optional)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          className="rounded-xl border border-black/15 bg-white px-3 py-2 dark:border-white/15 dark:bg-white/5"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Dates</span>
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-2">
            <input
              type="date"
              required
              value={row.date}
              onChange={(e) => updateRow(row.id, e.target.value)}
              className="flex-1 rounded-xl border border-black/15 bg-white px-3 py-2 dark:border-white/15 dark:bg-white/5"
            />
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              className="rounded-full border border-black/15 px-3 py-1 text-sm dark:border-white/15"
              disabled={rows.length === 1}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addRow}
          className="self-start rounded-full border border-black/15 px-3 py-1 text-sm dark:border-white/15"
        >
          + Add date
        </button>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-accent px-5 py-3 font-medium text-white disabled:opacity-60"
      >
        {isPending ? "Sending…" : "Ask the band"}
      </button>
    </form>
  );
}
```

Note: `createPollAction` and `CreatePollResult` don't exist yet — the file will fail typecheck. That's fine; Task 10 adds them. Commit now to keep tasks atomic — the chain of unit-work will reach typecheck green at end of Task 10.

- [ ] **Step 2: Commit (interim — typecheck will fail until Task 10)**

```bash
git add components/polls/create-poll-form.tsx
git commit -m "feat(polls): add CreatePollForm client component"
```

---

## Task 10: `createPollAction` server action

**Files:**
- Create: `app/dashboard/bands/[bandId]/polls/new/actions.ts`

Calls `create_poll`, fans out emails via `sendEmail`, calls `mark_poll_invite_email` per recipient to record status.

- [ ] **Step 1: Write the action**

```ts
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
    p_title: args.title,
    p_note: args.note,
    p_closes_at: null,
  });

  if (error) return { ok: false, error: error.message };
  const rows = (data ?? []) as CreatePollRow[];
  if (rows.length === 0) {
    return { ok: false, error: "Poll was created but no band members were found to notify." };
  }

  const pollId = rows[0].poll_id;

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
      p_error: result.ok ? null : `${result.status}: ${result.error}`.slice(0, 500),
    });

    if (result.ok) sent++;
  }

  revalidatePath(`/dashboard/bands/${args.bandId}/polls`);
  revalidatePath(`/dashboard/bands/${args.bandId}/polls/${pollId}`);

  return { ok: true, pollId, total: rows.length, sent };
}
```

- [ ] **Step 2: Verify typecheck is now green**

```bash
npm run typecheck
```

Expected: exits 0. (If a `createPollAction` type still mismatches `CreatePollForm`'s import, reconcile the shape before moving on.)

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/bands/[bandId]/polls/new/actions.ts
git commit -m "feat(polls): add createPollAction (RPC + email fanout)"
```

---

## Task 11: Admin create-poll page (server component)

**Files:**
- Create: `app/dashboard/bands/[bandId]/polls/new/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient, requireUserId } from "@/utils/supabase/server";
import { CreatePollForm } from "@/components/polls/create-poll-form";

export const metadata: Metadata = { title: "Ask the band" };

export default async function NewPollPage({
  params,
}: {
  params: Promise<{ bandId: string }>;
}) {
  const { bandId } = await params;
  await requireUserId(`/dashboard/bands/${bandId}/polls/new`);
  const supabase = await createClient();

  const { data: band } = await supabase
    .from("bands")
    .select("id, name")
    .eq("id", bandId)
    .maybeSingle();
  if (!band) notFound();

  // Admin-only. Non-admins land back on the band page.
  const { data: isAdmin } = await supabase.rpc("is_band_admin", { p_band_id: bandId });
  if (!isAdmin) redirect(`/dashboard/bands/${bandId}`);

  return (
    <main className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link href={`/dashboard/bands/${bandId}/polls`} className="text-sm opacity-70 underline">
          ← Back to polls
        </Link>
        <h1 className="text-2xl font-bold">Ask the band about dates</h1>
        <p className="text-sm opacity-70">
          Each member gets a one-time link in their email with yes/no radios per date. No login required.
        </p>
      </header>

      <CreatePollForm bandId={band.id} />
    </main>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/bands/[bandId]/polls/new/page.tsx
git commit -m "feat(polls): add admin create-poll page"
```

---

## Task 12: Member response form (client component)

**Files:**
- Create: `components/polls/poll-response-form.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { submitPollResponseAction } from "@/app/poll/[token]/actions";

type DateRow = { id: string; target_date: string; position: number };

export function PollResponseForm({
  token,
  dates,
  initialAnswers,
}: {
  token: string;
  dates: DateRow[];
  initialAnswers: Record<string, boolean>;
}) {
  const [answers, setAnswers] = useState<Record<string, boolean | null>>(() =>
    Object.fromEntries(dates.map((d) => [d.id, initialAnswers[d.id] ?? null])),
  );
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const dateFmt = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const unanswered = dates.filter((d) => answers[d.id] === null);
    if (unanswered.length > 0) {
      toast.error("Please answer every date.");
      return;
    }
    const payload = dates.map((d) => ({ poll_date_id: d.id, answer: answers[d.id] as boolean }));
    startTransition(async () => {
      const result = await submitPollResponseAction({ token, answers: payload });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDone(true);
    });
  };

  if (done) {
    return (
      <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-4 text-sm">
        Thanks — your answers are saved. You can close this tab. If you need to change
        anything, just revisit this link before the poll closes.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {dates.map((d) => (
          <li
            key={d.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 p-3 dark:border-white/10"
          >
            <span className="font-medium">
              {dateFmt.format(new Date(`${d.target_date}T12:00:00Z`))}
            </span>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name={`r-${d.id}`}
                  checked={answers[d.id] === true}
                  onChange={() => setAnswers((a) => ({ ...a, [d.id]: true }))}
                />
                Yes
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name={`r-${d.id}`}
                  checked={answers[d.id] === false}
                  onChange={() => setAnswers((a) => ({ ...a, [d.id]: false }))}
                />
                No
              </label>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-accent px-5 py-3 font-medium text-white disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Submit"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/polls/poll-response-form.tsx
git commit -m "feat(polls): add PollResponseForm client component"
```

Typecheck will still complain about the missing action import — fixed by Task 13.

---

## Task 13: Member response action + page

**Files:**
- Create: `app/poll/[token]/actions.ts`
- Create: `app/poll/[token]/page.tsx`

- [ ] **Step 1: Write the action**

```ts
// app/poll/[token]/actions.ts
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
```

- [ ] **Step 2: Write the page**

```tsx
// app/poll/[token]/page.tsx
import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { PollResponseForm } from "@/components/polls/poll-response-form";

export const metadata: Metadata = { title: "Band availability check" };
export const dynamic = "force-dynamic";

type Preview = {
  status: "ok" | "closed" | "not_found";
  poll_id: string | null;
  band_name: string | null;
  title: string | null;
  note: string | null;
  closes_at: string | null;
  closed_at: string | null;
  member_name: string | null;
  dates: Array<{ id: string; target_date: string; position: number }> | null;
  answers: Record<string, boolean> | null;
};

export default async function PollTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("preview_poll_by_token", { p_token: token });
  const preview = (data?.[0] ?? null) as Preview | null;

  if (!preview || preview.status === "not_found") {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-16">
        <h1 className="text-2xl font-bold">Link not found</h1>
        <p className="text-sm opacity-70">
          This availability check link doesn&apos;t exist. Ask the band leader for a new one.
        </p>
      </main>
    );
  }

  const title = preview.title ?? `Availability check for ${preview.band_name}`;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <p className="text-sm opacity-60">
          Hi {preview.member_name ?? "there"} — this link is just for you.
        </p>
        <h1 className="text-2xl font-bold">{title}</h1>
        {preview.note && (
          <p className="mt-2 rounded-xl bg-black/5 p-3 text-sm italic dark:bg-white/5">
            {preview.note}
          </p>
        )}
      </header>

      {preview.status === "closed" ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          This poll has closed. Reach out to the band leader if you need to update your answer.
        </div>
      ) : (
        <PollResponseForm
          token={token}
          dates={preview.dates ?? []}
          initialAnswers={preview.answers ?? {}}
        />
      )}
    </main>
  );
}
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: exits 0 (the Task 12 orphan import now resolves).

- [ ] **Step 4: Commit**

```bash
git add app/poll/[token]/actions.ts app/poll/[token]/page.tsx
git commit -m "feat(polls): add member response page + submit action"
```

---

## Task 14: Admin results table + close button

**Files:**
- Create: `components/polls/poll-results-table.tsx`
- Create: `components/polls/close-poll-button.tsx`
- Create: `app/dashboard/bands/[bandId]/polls/[pollId]/page.tsx`
- Create: `app/dashboard/bands/[bandId]/polls/[pollId]/actions.ts`

- [ ] **Step 1: Write the close action**

```ts
// app/dashboard/bands/[bandId]/polls/[pollId]/actions.ts
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
```

- [ ] **Step 2: Write the close button (client)**

```tsx
// components/polls/close-poll-button.tsx
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { closePollAction } from "@/app/dashboard/bands/[bandId]/polls/[pollId]/actions";

export function ClosePollButton({ bandId, pollId }: { bandId: string; pollId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Close this poll? Members won't be able to change their answers.")) return;
        startTransition(async () => {
          const result = await closePollAction(bandId, pollId);
          if (!result.ok) toast.error(result.error);
          else toast.success("Poll closed.");
        });
      }}
      className="rounded-full border border-black/15 px-3 py-1 text-sm disabled:opacity-60 dark:border-white/15"
    >
      {isPending ? "Closing…" : "Close poll"}
    </button>
  );
}
```

- [ ] **Step 3: Write the results table (server component — pure render)**

```tsx
// components/polls/poll-results-table.tsx

export type ResultsCell = "yes" | "no" | "pending";

export type ResultsMember = {
  profileId: string;
  fullName: string;
  cells: Record<string, ResultsCell>; // keyed by poll_date_id
  emailStatus: "sent" | "pending" | "error";
  emailError: string | null;
};

export type ResultsDate = { id: string; targetDate: string };

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

export function PollResultsTable({
  dates,
  members,
}: {
  dates: ResultsDate[];
  members: ResultsMember[];
}) {
  const tally = (dateId: string) => {
    let yes = 0;
    let no = 0;
    let pending = 0;
    for (const m of members) {
      const c = m.cells[dateId] ?? "pending";
      if (c === "yes") yes++;
      else if (c === "no") no++;
      else pending++;
    }
    return { yes, no, pending };
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b border-black/10 p-2 text-left dark:border-white/10">
              Member
            </th>
            {dates.map((d) => (
              <th
                key={d.id}
                className="border-b border-black/10 p-2 text-center dark:border-white/10"
              >
                <div>{dateFmt.format(new Date(`${d.targetDate}T12:00:00Z`))}</div>
                <div className="text-xs font-normal opacity-60">
                  {(() => {
                    const t = tally(d.id);
                    return `${t.yes}✓ / ${t.no}✗ / ${t.pending}·`;
                  })()}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.profileId}>
              <td className="border-b border-black/5 p-2 dark:border-white/5">
                <div className="font-medium">{m.fullName}</div>
                <div className="text-xs opacity-60">
                  {m.emailStatus === "sent" && "emailed"}
                  {m.emailStatus === "pending" && "sending…"}
                  {m.emailStatus === "error" && (
                    <span className="text-red-500">email failed: {m.emailError}</span>
                  )}
                </div>
              </td>
              {dates.map((d) => {
                const c = m.cells[d.id] ?? "pending";
                return (
                  <td
                    key={d.id}
                    className="border-b border-black/5 p-2 text-center dark:border-white/5"
                  >
                    {c === "yes" && "✓"}
                    {c === "no" && "✗"}
                    {c === "pending" && <span className="opacity-40">·</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Write the results page**

```tsx
// app/dashboard/bands/[bandId]/polls/[pollId]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient, requireUserId } from "@/utils/supabase/server";
import {
  PollResultsTable,
  type ResultsCell,
  type ResultsMember,
  type ResultsDate,
} from "@/components/polls/poll-results-table";
import { ClosePollButton } from "@/components/polls/close-poll-button";

export const metadata: Metadata = { title: "Poll results" };

export default async function PollResultsPage({
  params,
}: {
  params: Promise<{ bandId: string; pollId: string }>;
}) {
  const { bandId, pollId } = await params;
  await requireUserId(`/dashboard/bands/${bandId}/polls/${pollId}`);
  const supabase = await createClient();

  const { data: isAdmin } = await supabase.rpc("is_band_admin", { p_band_id: bandId });
  if (!isAdmin) redirect(`/dashboard/bands/${bandId}`);

  const [{ data: poll }, { data: dates }, { data: invites }, { data: responses }] =
    await Promise.all([
      supabase.from("polls").select("*").eq("id", pollId).maybeSingle(),
      supabase
        .from("poll_dates")
        .select("id, target_date, position")
        .eq("poll_id", pollId)
        .order("position", { ascending: true }),
      supabase
        .from("poll_invites")
        .select("id, profile_id, email_sent_at, email_error")
        .eq("poll_id", pollId),
      supabase
        .from("poll_responses")
        .select("poll_invite_id, poll_date_id, answer")
        .in(
          "poll_invite_id",
          (
            await supabase.from("poll_invites").select("id").eq("poll_id", pollId)
          ).data?.map((r) => r.id) ?? [],
        ),
    ]);

  if (!poll) notFound();

  const profileIds = (invites ?? []).map((i) => i.profile_id);
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", profileIds)
    : { data: [] };
  const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const dateRows: ResultsDate[] = (dates ?? []).map((d) => ({
    id: d.id,
    targetDate: d.target_date,
  }));

  // Build invite -> {profile, email status} lookup.
  const inviteById = new Map(
    (invites ?? []).map((i) => [i.id, i]),
  );

  // Group responses by invite -> date -> answer.
  const responseByInviteDate = new Map<string, Map<string, boolean>>();
  for (const r of responses ?? []) {
    const inner = responseByInviteDate.get(r.poll_invite_id) ?? new Map<string, boolean>();
    inner.set(r.poll_date_id, r.answer);
    responseByInviteDate.set(r.poll_invite_id, inner);
  }

  const memberRows: ResultsMember[] = (invites ?? [])
    .map((inv) => {
      const inner = responseByInviteDate.get(inv.id) ?? new Map<string, boolean>();
      const cells: Record<string, ResultsCell> = {};
      for (const d of dateRows) {
        if (inner.has(d.id)) cells[d.id] = inner.get(d.id) ? "yes" : "no";
        else cells[d.id] = "pending";
      }
      const emailStatus: ResultsMember["emailStatus"] = inv.email_error
        ? "error"
        : inv.email_sent_at
          ? "sent"
          : "pending";
      return {
        profileId: inv.profile_id,
        fullName: nameMap.get(inv.profile_id) ?? "Member",
        cells,
        emailStatus,
        emailError: inv.email_error ?? null,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const isClosed = poll.closed_at !== null || new Date(poll.closes_at) < new Date();

  return (
    <main className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/dashboard/bands/${bandId}/polls`} className="text-sm opacity-70 underline">
            ← Back to polls
          </Link>
          <h1 className="text-2xl font-bold">
            {poll.title ?? "Availability check"}
          </h1>
          <p className="text-sm opacity-70">
            {isClosed ? "Closed" : "Open"} · closes {new Date(poll.closes_at).toLocaleString()}
          </p>
        </div>
        {!isClosed && <ClosePollButton bandId={bandId} pollId={pollId} />}
      </header>

      {poll.note && (
        <p className="rounded-xl bg-black/5 p-3 text-sm italic dark:bg-white/5">{poll.note}</p>
      )}

      <PollResultsTable dates={dateRows} members={memberRows} />
    </main>
  );
}
```

- [ ] **Step 5: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/bands/[bandId]/polls/[pollId]/page.tsx app/dashboard/bands/[bandId]/polls/[pollId]/actions.ts components/polls/poll-results-table.tsx components/polls/close-poll-button.tsx
git commit -m "feat(polls): add poll results page + close poll flow"
```

---

## Task 15: Polls list page + subnav tab

**Files:**
- Create: `app/dashboard/bands/[bandId]/polls/page.tsx`
- Modify: `components/bands/band-subnav.tsx`

- [ ] **Step 1: Write the list page**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient, requireUserId } from "@/utils/supabase/server";

export const metadata: Metadata = { title: "Polls" };

export default async function PollsListPage({
  params,
}: {
  params: Promise<{ bandId: string }>;
}) {
  const { bandId } = await params;
  await requireUserId(`/dashboard/bands/${bandId}/polls`);
  const supabase = await createClient();

  const { data: band } = await supabase
    .from("bands")
    .select("id, name")
    .eq("id", bandId)
    .maybeSingle();
  if (!band) notFound();

  const { data: isAdmin } = await supabase.rpc("is_band_admin", { p_band_id: bandId });
  if (!isAdmin) redirect(`/dashboard/bands/${bandId}`);

  const { data: polls } = await supabase
    .from("polls")
    .select("id, title, created_at, closes_at, closed_at")
    .eq("band_id", bandId)
    .order("created_at", { ascending: false });

  const dateFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Polls</h1>
        <Link
          href={`/dashboard/bands/${bandId}/polls/new`}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          + Ask the band
        </Link>
      </header>

      {!polls || polls.length === 0 ? (
        <p className="rounded-xl border border-black/10 p-6 text-sm opacity-70 dark:border-white/10">
          No polls yet. Hit <strong>Ask the band</strong> to send one.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {polls.map((p) => {
            const closed = p.closed_at !== null || new Date(p.closes_at) < new Date();
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 p-3 dark:border-white/10"
              >
                <div>
                  <Link
                    href={`/dashboard/bands/${bandId}/polls/${p.id}`}
                    className="font-medium underline"
                  >
                    {p.title ?? "Availability check"}
                  </Link>
                  <p className="text-sm opacity-70">
                    Created {dateFmt.format(new Date(p.created_at))} ·{" "}
                    {closed ? "closed" : `closes ${dateFmt.format(new Date(p.closes_at))}`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Add the "Polls" tab to the band subnav**

Open `components/bands/band-subnav.tsx`. Find the array/list of tabs — follow the existing pattern (there are already "settings", "availability", "stage-plot" tabs). Add a `polls` entry:

```ts
// Alongside the existing tabs:
{ key: "polls", label: "Polls", href: `/dashboard/bands/${bandId}/polls` },
```

Also widen the `activeTab` prop's union type to include `"polls"`. Grep for `activeTab?: ` in that file and the pages that pass it in; add the new value everywhere it's required (likely the three existing sibling pages pass `activeTab="settings" | "availability" | "stage-plot"`).

- [ ] **Step 3: Render the subnav on the polls pages**

In `app/dashboard/bands/[bandId]/polls/page.tsx`, `app/dashboard/bands/[bandId]/polls/new/page.tsx`, and `app/dashboard/bands/[bandId]/polls/[pollId]/page.tsx`, add at the top of the returned JSX (before the existing `<header>` or `<main>` contents):

```tsx
import { BandSubNav } from "@/components/bands/band-subnav";
// …

<BandSubNav
  bandId={band.id}
  bandName={band.name}
  slug={band.slug}
  logoUrl={band.logo_url}
  activeTab="polls"
/>
```

For the pages that currently fetch only `id, name` on `bands`, widen the select to `id, name, slug, logo_url` so the subnav props are available.

- [ ] **Step 4: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/bands/[bandId]/polls/page.tsx components/bands/band-subnav.tsx app/dashboard/bands/[bandId]/polls/new/page.tsx app/dashboard/bands/[bandId]/polls/[pollId]/page.tsx
git commit -m "feat(polls): add polls list page + Polls subnav tab"
```

---

## Task 16: End-to-end manual smoke test

**Files:** none.

- [ ] **Step 1: Confirm env is set**

Ensure `.env.local` has `RESEND_API_KEY` and `EMAIL_FROM` set. `EMAIL_FROM` must be a verified sender on your Resend domain — in Resend's test mode you can only send to the account owner's address, so plan to seed a band with you as the only member for the first run.

- [ ] **Step 2: Start the dev server**

```bash
npm run dev
```

Open `http://localhost:3001/dashboard/bands/<your-band-id>/polls/new`.

- [ ] **Step 3: Create a poll**

- Add 3 dates.
- Add a title ("Smoke test") and a note.
- Hit **Ask the band**.
- Expected: toast "Sent N/N emails"; redirect to `/dashboard/bands/<id>/polls/<pollId>`; the results table shows every member with "emailed" and three pending cells.

- [ ] **Step 4: Open the member link**

Grab the token from the Resend email (or from the `poll_invites` table in Supabase Studio: `SELECT token FROM poll_invites WHERE poll_id = '<pollId>'`) and open `http://localhost:3001/poll/<token>` in a private window (so you're not signed in).

- Expected: the page shows your name, the title, the note, three date rows with Yes/No radios.
- Submit one combination. Expected: green "Thanks" panel.
- Revisit the same link. Expected: your previous answers are pre-filled.
- Change one answer and submit again. Expected: the results page now reflects the change.

- [ ] **Step 5: Close the poll**

Back on `/dashboard/bands/<id>/polls/<pollId>`, click **Close poll**. Confirm the dialog.

- Expected: toast "Poll closed"; the header now says **Closed**; the member page shows the amber "This poll has closed" panel instead of the form.

- [ ] **Step 6: Negative paths**

- Visit `http://localhost:3001/poll/not-a-real-token` — expect the "Link not found" page.
- As a non-admin band member, visit `/dashboard/bands/<id>/polls` — expect a redirect to the band page.

- [ ] **Step 7: No commit**

If anything in Steps 3–6 fails, open an issue (or just note it) and fix before shipping. If everything passes, this plan is done.
