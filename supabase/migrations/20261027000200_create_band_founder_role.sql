-- =============================================================================
-- MIGRATION 9: let the founder pick their role_in_band on band creation.
-- Previously create_band hardcoded "Founder / Admin", which conflated role
-- with permission (is_admin already renders as its own badge). Now the
-- founder can type an instrument / role; empty falls back to just "Founder".
-- =============================================================================

-- DROP + CREATE because the function signature changes.
DROP FUNCTION IF EXISTS public.create_band(TEXT, TEXT, TEXT, TEXT[], TEXT);

CREATE OR REPLACE FUNCTION public.create_band(
  p_name          TEXT,
  p_slug          TEXT,
  p_home_city     TEXT,
  p_genres        TEXT[] DEFAULT '{}',
  p_bio           TEXT   DEFAULT NULL,
  p_founder_role  TEXT   DEFAULT 'Founder'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid       UUID := (SELECT auth.uid());
  new_band_id UUID;
  v_role      TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to create a band' USING ERRCODE = '28000';
  END IF;

  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Slug may only contain lowercase letters, numbers and single dashes'
      USING ERRCODE = '22023';
  END IF;

  v_role := COALESCE(NULLIF(TRIM(p_founder_role), ''), 'Founder');

  INSERT INTO public.bands (name, slug, home_city, genres, bio)
  VALUES (TRIM(p_name), p_slug, TRIM(p_home_city), COALESCE(p_genres, '{}'), p_bio)
  RETURNING id INTO new_band_id;

  INSERT INTO public.band_members (band_id, profile_id, role_in_band, is_admin)
  VALUES (new_band_id, v_uid, v_role, TRUE);

  RETURN new_band_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_band(TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_band(TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT) TO authenticated;
