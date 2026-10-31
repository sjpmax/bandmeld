-- =============================================================================
-- MIGRATION: delete_poll + close_poll writes "No" answers to the calendar
--
-- 1. delete_poll(uuid): admin-only hard delete. The schema's ON DELETE CASCADE
--    on poll_dates / poll_invites / poll_responses handles the children.
--
-- 2. close_poll(uuid): previously just stamped closed_at. Now also, inside
--    the same transaction:
--      • Inserts a one-day member_unavailabilities row for every poll_response
--        with answer = FALSE (start_date = end_date = target_date), tagging
--        reason with the poll title. Dedupes against any existing
--        unavailability that already covers the date for that profile.
--      • Runs sync_band_open_dates(band_id) so band_open_dates reflects the
--        new blocks (removes actively_seeking entries that are now conflicted;
--        leaves penciled_in / booked / unavailable alone).
--      • "Yes" answers do nothing — the member is simply available, which is
--        the default state. We never clear existing unavailabilities on their
--        behalf, since those may have been set elsewhere.
--      • Idempotent: a poll already closed is a no-op (won't double-insert).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.delete_poll(p_poll_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_band_id UUID;
BEGIN
  SELECT band_id INTO v_band_id FROM public.polls WHERE id = p_poll_id;
  IF v_band_id IS NULL THEN
    RAISE EXCEPTION 'Poll not found' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_band_admin(v_band_id) THEN
    RAISE EXCEPTION 'Only band admins can delete polls' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.polls WHERE id = p_poll_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_poll(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.delete_poll(UUID) TO authenticated;


CREATE OR REPLACE FUNCTION public.close_poll(p_poll_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_band_id UUID;
  v_title   TEXT;
  v_reason  TEXT;
BEGIN
  SELECT band_id, title INTO v_band_id, v_title
    FROM public.polls WHERE id = p_poll_id;
  IF v_band_id IS NULL THEN
    RAISE EXCEPTION 'Poll not found' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_band_admin(v_band_id) THEN
    RAISE EXCEPTION 'Only band admins can close polls' USING ERRCODE = '42501';
  END IF;

  -- Idempotent — if already closed, don't re-apply answers.
  IF EXISTS (SELECT 1 FROM public.polls WHERE id = p_poll_id AND closed_at IS NOT NULL) THEN
    RETURN;
  END IF;

  UPDATE public.polls SET closed_at = NOW() WHERE id = p_poll_id;

  v_reason := 'From poll' || COALESCE(' "' || v_title || '"', '');

  INSERT INTO public.member_unavailabilities (profile_id, start_date, end_date, reason)
  SELECT pi.profile_id, pd.target_date, pd.target_date, v_reason
    FROM public.poll_responses pr
    JOIN public.poll_invites pi ON pi.id = pr.poll_invite_id
    JOIN public.poll_dates   pd ON pd.id = pr.poll_date_id
   WHERE pi.poll_id = p_poll_id
     AND pr.answer = FALSE
     AND NOT EXISTS (
       SELECT 1 FROM public.member_unavailabilities mu
        WHERE mu.profile_id = pi.profile_id
          AND pd.target_date BETWEEN mu.start_date AND mu.end_date
     );

  PERFORM public.sync_band_open_dates(v_band_id);
END;
$$;
