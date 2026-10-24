-- =============================================================================
-- MIGRATION 10: set_member_role RPC
--
-- Admins can rename any member's role_in_band; members can rename their own.
-- SECURITY DEFINER so we don't have to add a self-update RLS policy (which
-- would also open the door to self-promoting is_admin unless we added a
-- column-constraint trigger).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_member_role(
  p_band_id      UUID,
  p_profile_id   UUID,
  p_role_in_band TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid    UUID := (SELECT auth.uid());
  v_clean  TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first' USING ERRCODE = '28000';
  END IF;

  -- Allow if the caller is admin of this band OR editing their own membership.
  IF NOT public.is_band_admin(p_band_id) AND v_uid <> p_profile_id THEN
    RAISE EXCEPTION 'Only band admins or the member themselves can change a role'
      USING ERRCODE = '42501';
  END IF;

  v_clean := COALESCE(NULLIF(TRIM(p_role_in_band), ''), 'Member');

  UPDATE public.band_members
     SET role_in_band = LEFT(v_clean, 60)
   WHERE band_id = p_band_id AND profile_id = p_profile_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_member_role(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_member_role(UUID, UUID, TEXT) TO authenticated;
