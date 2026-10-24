-- =============================================================================
-- MIGRATION 4: Tentative blocks + reason privacy
--
-- Two user-facing changes:
--   1. Reasons on member_unavailabilities are now private — only the owner
--      can read them. Previously bandmates could too; we're reversing that.
--      The sync RPC runs as SECURITY DEFINER so it still sees all rows.
--   2. `is_tentative` lets a member mark an event as "I'd cancel for a
--      show" — the sync engine ignores tentative blocks, so the band
--      stays actively_seeking on those dates.
-- =============================================================================

-- 1. Privacy — bandmates can no longer read other members' unavailabilities.
--    (The sync engine is SECURITY DEFINER and bypasses RLS, so this is safe.)
DROP POLICY IF EXISTS "Band members can view co-member unavailabilities"
  ON public.member_unavailabilities;

-- 2. Tentative column.
ALTER TABLE public.member_unavailabilities
  ADD COLUMN IF NOT EXISTS is_tentative BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Rewrite the sync RPC so only firm (non-tentative) blocks remove
--    actively_seeking dates. Everything else is identical to migration 2.
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

  -- Remove seeking dates where any member has a FIRM block.
  DELETE FROM public.band_open_dates o
  WHERE o.band_id = p_band_id
    AND o.target_date BETWEEN v_from AND v_to
    AND (o.status IS NULL OR o.status = 'actively_seeking')
    AND EXISTS (
      SELECT 1
      FROM public.band_members bm
      JOIN public.member_unavailabilities mu ON mu.profile_id = bm.profile_id
      WHERE bm.band_id = p_band_id
        AND o.target_date BETWEEN mu.start_date AND mu.end_date
        AND NOT mu.is_tentative
    );

  -- Add every date where no member has a FIRM block.
  INSERT INTO public.band_open_dates (band_id, target_date, status)
  SELECT p_band_id, d::DATE, 'actively_seeking'
  FROM generate_series(v_from, v_to, INTERVAL '1 day') AS d
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.band_members bm
    JOIN public.member_unavailabilities mu ON mu.profile_id = bm.profile_id
    WHERE bm.band_id = p_band_id
      AND d::DATE BETWEEN mu.start_date AND mu.end_date
      AND NOT mu.is_tentative
  )
  ON CONFLICT (band_id, target_date) DO NOTHING;
END;
$$;
