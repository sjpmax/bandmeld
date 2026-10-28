-- pgcrypto is installed in the extensions schema, which is not on the
-- search_path for this SECURITY DEFINER function.
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

  FOREACH v_date IN ARRAY p_dates LOOP
    INSERT INTO public.poll_dates (poll_id, target_date, position)
    VALUES (v_poll_id, v_date, v_pos);
    v_pos := v_pos + 1;
  END LOOP;

  INSERT INTO public.poll_invites (poll_id, profile_id, token)
  SELECT v_poll_id, bm.profile_id, encode(extensions.gen_random_bytes(18), 'hex')
    FROM public.band_members bm
   WHERE bm.band_id = p_band_id;

  RETURN QUERY
    SELECT v_poll_id, pi.profile_id, pr.full_name, u.email::TEXT, pi.token
      FROM public.poll_invites pi
      JOIN public.profiles pr ON pr.id = pi.profile_id
      JOIN auth.users    u  ON u.id  = pi.profile_id
     WHERE pi.poll_id = v_poll_id
     ORDER BY pr.full_name;
END;
$$;
