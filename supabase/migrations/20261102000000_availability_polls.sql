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
  -- Cast u.email::TEXT because auth.users.email is varchar(255) and the
  -- RETURN TABLE declares email TEXT; PL/pgSQL RETURN QUERY is strict.
  RETURN QUERY
    SELECT v_poll_id, pi.profile_id, pr.full_name, u.email::TEXT, pi.token
      FROM public.poll_invites pi
      JOIN public.profiles pr ON pr.id = pi.profile_id
      JOIN auth.users    u  ON u.id  = pi.profile_id
     WHERE pi.poll_id = v_poll_id
     ORDER BY pr.full_name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_poll(UUID, DATE[], TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_poll(UUID, DATE[], TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
