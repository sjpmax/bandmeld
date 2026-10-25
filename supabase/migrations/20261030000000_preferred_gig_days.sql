-- =============================================================================
-- MIGRATION 12: Preferred Gig Days & Curated Open Dates
--
-- 1. Adds `preferred_gig_days INT[] NOT NULL DEFAULT '{5, 6}'` to `bands`.
--    0 = Sunday, 1 = Monday ... 5 = Friday, 6 = Saturday (matching Postgres DOW & JS getDay).
--    Default is [5, 6] (Friday & Saturday) so bands aren't broadcasting random
--    weekdays unless they explicitly opt into them.
--
-- 2. Provides `set_band_preferred_gig_days` RPC for admin management.
--
-- 3. Updates `sync_band_open_dates` so:
--    - Cleans up existing actively_seeking dates that fall on non-preferred days.
--    - Only generates actively_seeking dates and conflict alerts for the
--      band's chosen target gig days.
--    - Preserves existing manual penciled_in and booked gigs on any day.
-- =============================================================================

-- 1. Add column to bands
ALTER TABLE public.bands
  ADD COLUMN IF NOT EXISTS preferred_gig_days INT[] NOT NULL DEFAULT '{5, 6}';

UPDATE public.bands
  SET preferred_gig_days = '{5, 6}'
  WHERE preferred_gig_days IS NULL;

-- 2. RPC to set preferred gig days
CREATE OR REPLACE FUNCTION public.set_band_preferred_gig_days(
  p_band_id UUID,
  p_preferred_days INT[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_clean_days INT[];
BEGIN
  IF NOT public.is_band_admin(p_band_id) THEN
    RAISE EXCEPTION 'Only band admins can change preferred gig days' USING ERRCODE = '42501';
  END IF;

  -- Filter to valid days [0..6]
  SELECT ARRAY(
    SELECT DISTINCT d
    FROM unnest(p_preferred_days) AS d
    WHERE d BETWEEN 0 AND 6
    ORDER BY d
  ) INTO v_clean_days;

  -- Default to [5, 6] if empty array provided
  IF v_clean_days IS NULL OR cardinality(v_clean_days) = 0 THEN
    v_clean_days := ARRAY[5, 6];
  END IF;

  UPDATE public.bands
  SET preferred_gig_days = v_clean_days
  WHERE id = p_band_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_band_preferred_gig_days(UUID, INT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_band_preferred_gig_days(UUID, INT[]) TO authenticated;

-- 3. Rewrite sync_band_open_dates with preferred gig days filtering
CREATE OR REPLACE FUNCTION public.sync_band_open_dates(p_band_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_from DATE := CURRENT_DATE;
  v_to   DATE := CURRENT_DATE + 366;
  v_gig_days INT[];
BEGIN
  IF NOT public.is_band_admin(p_band_id) THEN
    RAISE EXCEPTION 'Only band admins can sync open dates' USING ERRCODE = '42501';
  END IF;

  -- Load band's preferred gig days (defaulting to [5, 6] if null)
  SELECT COALESCE(preferred_gig_days, ARRAY[5, 6])
  INTO v_gig_days
  FROM public.bands
  WHERE id = p_band_id;

  IF v_gig_days IS NULL OR cardinality(v_gig_days) = 0 THEN
    v_gig_days := ARRAY[5, 6];
  END IF;

  -- Cleanup old auto-generated seeking dates on non-preferred days
  DELETE FROM public.band_open_dates
  WHERE band_id = p_band_id
    AND status = 'actively_seeking'
    AND NOT (EXTRACT(DOW FROM target_date)::INT = ANY(v_gig_days));

  -- Cleanup old auto-generated conflicts on non-preferred days
  DELETE FROM public.band_open_dates
  WHERE band_id = p_band_id
    AND status = 'unavailable'
    AND (notes LIKE 'Conflict: %' OR notes IS NULL)
    AND NOT (EXTRACT(DOW FROM target_date)::INT = ANY(v_gig_days));

  -- Step 1: Upsert conflicts on PREFERRED GIG DAYS where a REQUIRED member has a firm block.
  WITH required_conflicts AS (
    SELECT
      d::DATE AS conflict_date,
      string_agg(
        DISTINCT COALESCE(
          NULLIF(p.full_name, ''),
          NULLIF(bm.role_in_band, ''),
          'Member'
        ),
        ', '
      ) AS conflict_names
    FROM generate_series(v_from, v_to, INTERVAL '1 day') AS d
    JOIN public.band_members bm
      ON bm.band_id = p_band_id
      AND bm.is_required_for_gigs = TRUE
    JOIN public.member_unavailabilities mu
      ON mu.profile_id = bm.profile_id
      AND d::DATE BETWEEN mu.start_date AND mu.end_date
      AND NOT mu.is_tentative
    LEFT JOIN public.profiles p
      ON p.id = bm.profile_id
    WHERE EXTRACT(DOW FROM d)::INT = ANY(v_gig_days)
    GROUP BY d::DATE
  )
  INSERT INTO public.band_open_dates (band_id, target_date, status, notes)
  SELECT
    p_band_id,
    rc.conflict_date,
    'unavailable'::public.gig_status,
    'Conflict: ' || rc.conflict_names || ' unavailable'
  FROM required_conflicts rc
  ON CONFLICT (band_id, target_date)
  DO UPDATE SET
    status = 'unavailable'::public.gig_status,
    notes = EXCLUDED.notes
  WHERE public.band_open_dates.status = 'actively_seeking'
     OR (public.band_open_dates.status = 'unavailable' AND (public.band_open_dates.notes LIKE 'Conflict: %' OR public.band_open_dates.notes IS NULL));

  -- Step 2: Mark dates as 'actively_seeking' on PREFERRED GIG DAYS where ALL REQUIRED members are free.
  WITH free_dates AS (
    SELECT d::DATE AS target_date
    FROM generate_series(v_from, v_to, INTERVAL '1 day') AS d
    WHERE EXTRACT(DOW FROM d)::INT = ANY(v_gig_days)
      AND NOT EXISTS (
        SELECT 1
        FROM public.band_members bm
        JOIN public.member_unavailabilities mu
          ON mu.profile_id = bm.profile_id
        WHERE bm.band_id = p_band_id
          AND bm.is_required_for_gigs = TRUE
          AND d::DATE BETWEEN mu.start_date AND mu.end_date
          AND NOT mu.is_tentative
      )
  ),
  optional_absences AS (
    SELECT
      fd.target_date,
      string_agg(
        DISTINCT COALESCE(
          NULLIF(p.full_name, ''),
          NULLIF(bm.role_in_band, ''),
          'Member'
        ),
        ', '
      ) AS absent_optional
    FROM free_dates fd
    JOIN public.band_members bm
      ON bm.band_id = p_band_id
      AND bm.is_required_for_gigs = FALSE
    JOIN public.member_unavailabilities mu
      ON mu.profile_id = bm.profile_id
      AND fd.target_date BETWEEN mu.start_date AND mu.end_date
      AND NOT mu.is_tentative
    LEFT JOIN public.profiles p
      ON p.id = bm.profile_id
    GROUP BY fd.target_date
  )
  INSERT INTO public.band_open_dates (band_id, target_date, status, notes)
  SELECT
    p_band_id,
    fd.target_date,
    'actively_seeking'::public.gig_status,
    CASE
      WHEN opt.absent_optional IS NOT NULL THEN 'Lineup: ' || opt.absent_optional || ' unavailable (optional)'
      ELSE NULL
    END
  FROM free_dates fd
  LEFT JOIN optional_absences opt ON opt.target_date = fd.target_date
  ON CONFLICT (band_id, target_date)
  DO UPDATE SET
    status = 'actively_seeking'::public.gig_status,
    notes = EXCLUDED.notes
  WHERE (public.band_open_dates.status = 'unavailable' AND (public.band_open_dates.notes LIKE 'Conflict: %' OR public.band_open_dates.notes IS NULL))
     OR (public.band_open_dates.status = 'actively_seeking');
END;
$$;
