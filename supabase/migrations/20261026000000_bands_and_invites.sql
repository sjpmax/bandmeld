-- =============================================================================
-- MIGRATION 5: Band settings extras, invites, roster management guards
--
-- 1. Extend bands with apple_music_url and epk_pdf_url (free tier = user
--    uploads their own EPK PDF; builder is coming-soon / premium).
-- 2. band_invites table + email-locked one-time-use flow via SECURITY DEFINER
--    RPCs. Admins create invites, recipients preview + accept by token.
-- 3. Last-admin guard: can't delete or demote a band's only admin.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Extra band columns
-- -----------------------------------------------------------------------------
ALTER TABLE public.bands
  ADD COLUMN IF NOT EXISTS apple_music_url TEXT,
  ADD COLUMN IF NOT EXISTS epk_pdf_url     TEXT;

-- -----------------------------------------------------------------------------
-- 2. band_invites — one row per outstanding invite
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.band_invites (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  band_id       UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,              -- lowercased on insert
  token         TEXT NOT NULL UNIQUE,       -- URL-safe hex, 36 chars
  role_in_band  TEXT NOT NULL DEFAULT 'Member',
  invited_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  accepted_at   TIMESTAMPTZ,
  accepted_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS band_invites_band_id_idx ON public.band_invites (band_id);
CREATE INDEX IF NOT EXISTS band_invites_email_idx   ON public.band_invites (email);

ALTER TABLE public.band_invites ENABLE ROW LEVEL SECURITY;

-- Admins can see pending invites for their band.
-- (The accept flow uses a SECURITY DEFINER RPC for token-based reads,
-- so recipients never need to query this table directly.)
CREATE POLICY "Band admins read invites" ON public.band_invites
  FOR SELECT TO authenticated
  USING (public.is_band_admin(band_id));

-- No direct INSERT/UPDATE/DELETE policies — all mutations go through
-- SECURITY DEFINER RPCs below.

-- -----------------------------------------------------------------------------
-- 3. create_band_invite RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_band_invite(
  p_band_id      UUID,
  p_email        TEXT,
  p_role_in_band TEXT DEFAULT 'Member'
)
RETURNS TEXT  -- the generated token
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token TEXT;
  v_email TEXT;
BEGIN
  IF NOT public.is_band_admin(p_band_id) THEN
    RAISE EXCEPTION 'Only band admins can invite members' USING ERRCODE = '42501';
  END IF;

  v_email := LOWER(TRIM(COALESCE(p_email, '')));
  IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'A valid email address is required' USING ERRCODE = '22023';
  END IF;

  v_token := encode(gen_random_bytes(18), 'hex');

  INSERT INTO public.band_invites (band_id, email, token, invited_by, role_in_band)
  VALUES (
    p_band_id,
    v_email,
    v_token,
    (SELECT auth.uid()),
    COALESCE(NULLIF(TRIM(p_role_in_band), ''), 'Member')
  );

  RETURN v_token;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_band_invite(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_band_invite(UUID, TEXT, TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. preview_band_invite — minimal public read for the accept page
-- Returns band name + whether invite is still valid + the expected email.
-- Never exposes the invited_by profile or other invites.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.preview_band_invite(p_token TEXT)
RETURNS TABLE (
  band_id        UUID,
  band_name      TEXT,
  band_slug      TEXT,
  email          TEXT,
  role_in_band   TEXT,
  is_valid       BOOLEAN,
  reason         TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inv public.band_invites%ROWTYPE;
  v_band public.bands%ROWTYPE;
BEGIN
  SELECT * INTO v_inv FROM public.band_invites WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, FALSE, 'not_found'::TEXT;
    RETURN;
  END IF;

  SELECT * INTO v_band FROM public.bands WHERE id = v_inv.band_id;

  IF v_inv.accepted_at IS NOT NULL THEN
    RETURN QUERY SELECT v_band.id, v_band.name, v_band.slug, v_inv.email, v_inv.role_in_band, FALSE, 'already_used'::TEXT;
    RETURN;
  END IF;
  IF v_inv.expires_at < NOW() THEN
    RETURN QUERY SELECT v_band.id, v_band.name, v_band.slug, v_inv.email, v_inv.role_in_band, FALSE, 'expired'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_band.id, v_band.name, v_band.slug, v_inv.email, v_inv.role_in_band, TRUE, NULL::TEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.preview_band_invite(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.preview_band_invite(TEXT) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. accept_band_invite RPC — email-locked, one-time-use
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_band_invite(p_token TEXT)
RETURNS UUID  -- band_id joined
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid    UUID := (SELECT auth.uid());
  v_email  TEXT;
  v_inv    public.band_invites%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to accept this invite' USING ERRCODE = '28000';
  END IF;

  -- Lock the row for the duration of the update.
  SELECT * INTO v_inv FROM public.band_invites WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found' USING ERRCODE = '22023';
  END IF;
  IF v_inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This invite was already used' USING ERRCODE = '22023';
  END IF;
  IF v_inv.expires_at < NOW() THEN
    RAISE EXCEPTION 'This invite expired' USING ERRCODE = '22023';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  IF LOWER(TRIM(COALESCE(v_email, ''))) <> v_inv.email THEN
    RAISE EXCEPTION 'This invite was sent to a different email than you''re signed in with' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.band_members (band_id, profile_id, role_in_band, is_admin)
  VALUES (v_inv.band_id, v_uid, v_inv.role_in_band, FALSE)
  ON CONFLICT (band_id, profile_id) DO NOTHING;

  UPDATE public.band_invites
     SET accepted_at = NOW(), accepted_by = v_uid
   WHERE id = v_inv.id;

  RETURN v_inv.band_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_band_invite(TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.accept_band_invite(TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. revoke_band_invite RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_band_invite(p_invite_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_band_id UUID;
BEGIN
  SELECT band_id INTO v_band_id FROM public.band_invites WHERE id = p_invite_id;
  IF v_band_id IS NULL THEN RETURN; END IF;
  IF NOT public.is_band_admin(v_band_id) THEN
    RAISE EXCEPTION 'Only band admins can revoke invites' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.band_invites WHERE id = p_invite_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revoke_band_invite(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.revoke_band_invite(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. Last-admin guard — can't delete or demote the sole admin.
-- Admins must promote another member before leaving/demoting themselves.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_last_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_other_admins INT;
BEGIN
  IF TG_OP = 'DELETE' AND OLD.is_admin THEN
    SELECT COUNT(*) INTO v_other_admins
      FROM public.band_members
     WHERE band_id = OLD.band_id AND is_admin = TRUE AND id <> OLD.id;
    IF v_other_admins = 0 THEN
      RAISE EXCEPTION 'Promote another admin before leaving/removing the last one'
        USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND OLD.is_admin AND NOT COALESCE(NEW.is_admin, FALSE) THEN
    SELECT COUNT(*) INTO v_other_admins
      FROM public.band_members
     WHERE band_id = OLD.band_id AND is_admin = TRUE AND id <> OLD.id;
    IF v_other_admins = 0 THEN
      RAISE EXCEPTION 'Promote another admin before demoting the last one'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS band_members_last_admin_guard ON public.band_members;
CREATE TRIGGER band_members_last_admin_guard
  BEFORE DELETE OR UPDATE OF is_admin ON public.band_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_last_admin();
