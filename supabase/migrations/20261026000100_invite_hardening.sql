-- =============================================================================
-- MIGRATION 6: Hardening pass on migration 5
--
-- Fixes from the code review:
--   1. preview_band_invite leaked the invited email on already-used / expired
--      invites to anon callers. Return band name/slug + reason only; omit the
--      email once the invite is dead.
--   2. accept_band_invite consumed the invite even when the user was already
--      a member, discarding the role change. Now updates role_in_band for
--      existing memberships via ON CONFLICT UPDATE (never touches is_admin).
--   3. enforce_last_admin blocked bands-cascade deletes. Skip the guard when
--      the parent band row is already gone (cascade in progress).
-- =============================================================================

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
  v_inv  public.band_invites%ROWTYPE;
  v_band public.bands%ROWTYPE;
BEGIN
  SELECT * INTO v_inv FROM public.band_invites WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, FALSE, 'not_found'::TEXT;
    RETURN;
  END IF;

  SELECT * INTO v_band FROM public.bands WHERE id = v_inv.band_id;

  IF v_inv.accepted_at IS NOT NULL THEN
    -- Don't leak the invited email after it's been used.
    RETURN QUERY SELECT v_band.id, v_band.name, v_band.slug, NULL::TEXT, NULL::TEXT, FALSE, 'already_used'::TEXT;
    RETURN;
  END IF;
  IF v_inv.expires_at < NOW() THEN
    RETURN QUERY SELECT v_band.id, v_band.name, v_band.slug, NULL::TEXT, NULL::TEXT, FALSE, 'expired'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_band.id, v_band.name, v_band.slug, v_inv.email, v_inv.role_in_band, TRUE, NULL::TEXT;
END;
$$;

-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.accept_band_invite(p_token TEXT)
RETURNS UUID
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

  -- UPSERT so re-inviting an existing member can update their role.
  -- Deliberately never touches is_admin: an admin stays admin.
  INSERT INTO public.band_members (band_id, profile_id, role_in_band, is_admin)
  VALUES (v_inv.band_id, v_uid, v_inv.role_in_band, FALSE)
  ON CONFLICT (band_id, profile_id)
  DO UPDATE SET role_in_band = EXCLUDED.role_in_band;

  UPDATE public.band_invites
     SET accepted_at = NOW(), accepted_by = v_uid
   WHERE id = v_inv.id;

  RETURN v_inv.band_id;
END;
$$;

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
    -- If the parent band is already gone, this DELETE is part of the
    -- bands → band_members CASCADE. Skip the guard.
    IF NOT EXISTS (SELECT 1 FROM public.bands WHERE id = OLD.band_id) THEN
      RETURN OLD;
    END IF;

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
