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
