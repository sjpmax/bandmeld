-- =============================================================================
-- MIGRATION 11: Mandatory vs Optional Band Members & Calendar Conflict Detection
--
-- 1. Adds `is_required_for_gigs` to `band_members` (default TRUE).
--    If false, the band can still play shows when this member is unavailable
--    (e.g., auxiliary keys, 2nd rhythm guitar, backup vocals).
--
-- 2. Rewrites `sync_band_open_dates`:
--    - When a REQUIRED member has a firm block, marks the date as 'unavailable'
--      in band_open_dates with a clear note (e.g. "Conflict: Drums unavailable").
--    - When all REQUIRED members are free, marks the date as 'actively_seeking'.
--      If an OPTIONAL member is unavailable, keeps it seeking but notes the
--      lineup adjustment.
--    - When an existing conflict clears, flips 'unavailable' back to 'actively_seeking'.
--    - Never overwrites manually set 'penciled_in' or 'booked' dates.
--
-- 3. Provides `set_member_required_for_gigs` RPC for admin roster management.
-- =============================================================================

-- 1. Add is_required_for_gigs column
ALTER TABLE public.band_members
  ADD COLUMN IF NOT EXISTS is_required_for_gigs BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. RPC to toggle member lineup requirement
CREATE OR REPLACE FUNCTION public.set_member_required_for_gigs(
  p_band_id UUID,
  p_profile_id UUID,
  p_is_required BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_band_admin(p_band_id) THEN
    RAISE EXCEPTION 'Only band admins can change member lineup requirements' USING ERRCODE = '42501';
  END IF;

  UPDATE public.band_members
  SET is_required_for_gigs = p_is_required
  WHERE band_id = p_band_id AND profile_id = p_profile_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_member_required_for_gigs(UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_member_required_for_gigs(UUID, UUID, BOOLEAN) TO authenticated;

-- 3. Rewrite sync_band_open_dates to flag conflicts in red (unavailable)
CREATE OR REPLACE FUNCTION public.sync_band_open_dates(p_band_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_from DATE := CURRENT_DATE;
  v_to   DATE := CURRENT_DATE + 366;
BEGIN
  IF NOT public.is_band_admin(p_band_id) THEN
    RAISE EXCEPTION 'Only band admins can sync open dates' USING ERRCODE = '42501';
  END IF;

  -- Step 1: Upsert conflicts where at least one REQUIRED member has a firm block.
  -- Sets status = 'unavailable' and records who is out.
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

  -- Step 2: Mark dates as 'actively_seeking' where ALL REQUIRED members are free.
  -- Notes any optional members who are away.
  WITH free_dates AS (
    SELECT d::DATE AS target_date
    FROM generate_series(v_from, v_to, INTERVAL '1 day') AS d
    WHERE NOT EXISTS (
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
