-- =============================================================================
-- MIGRATION 8:
--   1. Fix create_band_invite — qualify gen_random_bytes with its schema.
--      The function uses SET search_path = '', so unqualified pgcrypto
--      functions aren't resolved (pgcrypto lives in `extensions`).
--   2. Add home_city_lat / home_city_lng on bands so a geocoded city
--      can store coords for later proximity queries (Bill Builder).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_band_invite(
  p_band_id      UUID,
  p_email        TEXT,
  p_role_in_band TEXT DEFAULT 'Member'
)
RETURNS TEXT
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

  v_token := encode(extensions.gen_random_bytes(18), 'hex');

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

ALTER TABLE public.bands
  ADD COLUMN IF NOT EXISTS home_city_lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS home_city_lng NUMERIC(10, 7);
