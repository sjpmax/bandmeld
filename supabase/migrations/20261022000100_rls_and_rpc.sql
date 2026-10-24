-- =============================================================================
-- MIGRATION 2: RLS Policies, create_band() RPC, Availability Engine & Storage
-- (reviewed & corrected — see "FIX:" comments)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. MEMBERSHIP HELPERS
-- FIX: Policies on band_members that SELECT from band_members cause
-- "infinite recursion detected in policy" on EVERY query that touches the
-- table — including other tables' policies that look up membership (bands
-- update, unavailabilities, open dates — even the public EPK read).
-- SECURITY DEFINER helpers read band_members without re-entering RLS.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_band_member(p_band_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.band_members
    WHERE band_id = p_band_id AND profile_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_band_admin(p_band_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.band_members
    WHERE band_id = p_band_id AND profile_id = (SELECT auth.uid()) AND is_admin = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.shares_band_with(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.band_members mine
    JOIN public.band_members theirs ON theirs.band_id = mine.band_id
    WHERE mine.profile_id = (SELECT auth.uid()) AND theirs.profile_id = p_profile_id
  );
$$;

-- -----------------------------------------------------------------------------
-- 1. BAND MEMBERS RLS POLICIES & BAND INSERTION FIX
-- -----------------------------------------------------------------------------

-- Enable viewing members if you belong to the same band
CREATE POLICY "Members can view co-members in their bands" ON public.band_members
  FOR SELECT TO authenticated
  USING (public.is_band_member(band_id));

-- Band admins can manage members
-- FIX: split FOR ALL into explicit commands with WITH CHECK, so an admin of
-- band X can't UPDATE a row to move it into band Y.
CREATE POLICY "Band admins can add band members" ON public.band_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_band_admin(band_id));

CREATE POLICY "Band admins can update band members" ON public.band_members
  FOR UPDATE TO authenticated
  USING (public.is_band_admin(band_id))
  WITH CHECK (public.is_band_admin(band_id));

-- FIX: members could not leave a band on their own.
CREATE POLICY "Admins can remove members, members can leave" ON public.band_members
  FOR DELETE TO authenticated
  USING (public.is_band_admin(band_id) OR profile_id = (SELECT auth.uid()));

-- FIX: migration 1's bands UPDATE policy queries band_members directly and
-- would hit the same recursion. Replace it with the helper.
DROP POLICY IF EXISTS "Band admins can update band profile" ON public.bands;

CREATE POLICY "Band admins can update band profile" ON public.bands
  FOR UPDATE TO authenticated
  USING (public.is_band_admin(id))
  WITH CHECK (public.is_band_admin(id));

CREATE POLICY "Band admins can delete band" ON public.bands
  FOR DELETE TO authenticated
  USING (public.is_band_admin(id));

-- -----------------------------------------------------------------------------
-- 2. SECURE CREATE_BAND() FUNCTION (Solves the Bootstrap / Insert Problem)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_band(
  p_name TEXT,
  p_slug TEXT,
  p_home_city TEXT,
  p_genres TEXT[] DEFAULT '{}',
  p_bio TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''   -- FIX: '' (not public) so nothing can shadow the tables
AS $$
DECLARE
  v_uid UUID := auth.uid();
  new_band_id UUID;
BEGIN
  -- FIX: clear error for signed-out callers (was a NOT NULL violation).
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to create a band' USING ERRCODE = '28000';
  END IF;

  -- FIX: slugs become public URLs (/bands/[slug]); validate them.
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Slug may only contain lowercase letters, numbers and single dashes'
      USING ERRCODE = '22023';
  END IF;

  -- 1. Insert the new band (duplicate slug raises unique_violation 23505)
  INSERT INTO public.bands (name, slug, home_city, genres, bio)
  VALUES (TRIM(p_name), p_slug, TRIM(p_home_city), COALESCE(p_genres, '{}'), p_bio)  -- FIX: NULL genres violated NOT NULL
  RETURNING id INTO new_band_id;

  -- 2. Automatically assign the creator as the first admin
  INSERT INTO public.band_members (band_id, profile_id, role_in_band, is_admin)
  VALUES (new_band_id, v_uid, 'Founder / Admin', TRUE);

  RETURN new_band_id;
END;
$$;

-- FIX: Postgres grants EXECUTE to PUBLIC by default, so GRANT alone still
-- let anon call it. Revoke first.
REVOKE EXECUTE ON FUNCTION public.create_band(TEXT, TEXT, TEXT, TEXT[], TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_band(TEXT, TEXT, TEXT, TEXT[], TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. UPDATED_AT TIMESTAMP TRIGGER & VALIDATION
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''   -- FIX: pinned search_path (Supabase linter warning)
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_bands_modtime
  BEFORE UPDATE ON public.bands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_modtime
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FIX: the section said "& validation" but had none.
ALTER TABLE public.member_unavailabilities
  ADD CONSTRAINT member_unavailabilities_valid_range CHECK (end_date >= start_date);

-- FIX: migration 1's signup trigger is SECURITY DEFINER without a pinned
-- search_path. Same body, hardened; blank names also fall back to 'Musician'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), 'Musician'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- FIX: migration 1 makes every profile (including phone numbers) readable by
-- anonymous visitors. Phase 1 has no public use for profiles, so limit reads
-- to yourself and your bandmates.
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Users can view own and bandmates' profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR public.shares_band_with(id));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- -----------------------------------------------------------------------------
-- 4. BANDMATES AVAILABILITY VISIBILITY & BAND OPEN DATES POLICIES
-- -----------------------------------------------------------------------------

-- Allow bandmates to see each other's unavailabilities so the calendar engine works
-- (Note: bandmates can read the `reason` text.)
CREATE POLICY "Band members can view co-member unavailabilities" ON public.member_unavailabilities
  FOR SELECT TO authenticated
  USING (public.shares_band_with(profile_id));

-- FIX: migration 1's FOR ALL policy has no WITH CHECK; make the owner rule explicit.
DROP POLICY IF EXISTS "Members can view and manage their unavailabilities" ON public.member_unavailabilities;

CREATE POLICY "Members can manage their own unavailabilities" ON public.member_unavailabilities
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = profile_id)
  WITH CHECK ((SELECT auth.uid()) = profile_id);

-- Band open dates RLS
-- FIX: removed duplicate ENABLE RLS + duplicate public SELECT policy
-- (migration 1 already has "Band open dates are viewable by everyone").
-- FIX: FOR ALL also applied to SELECT, which pulled band_members (and its
-- recursion) into anonymous EPK reads. Write-only commands now.
CREATE POLICY "Band admins can add open dates" ON public.band_open_dates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_band_admin(band_id));

CREATE POLICY "Band admins can update open dates" ON public.band_open_dates
  FOR UPDATE TO authenticated
  USING (public.is_band_admin(band_id))
  WITH CHECK (public.is_band_admin(band_id));

CREATE POLICY "Band admins can delete open dates" ON public.band_open_dates
  FOR DELETE TO authenticated
  USING (public.is_band_admin(band_id));

-- FIX: indexes for the membership/date lookups above.
CREATE INDEX IF NOT EXISTS band_members_profile_id_idx ON public.band_members (profile_id);
CREATE INDEX IF NOT EXISTS member_unavailabilities_profile_range_idx
  ON public.member_unavailabilities (profile_id, start_date, end_date);

-- -----------------------------------------------------------------------------
-- 5. AVAILABILITY SYNC ENGINE FUNCTION
-- Calculates dates where all band members are free over the next 366 days,
-- never overwriting 'booked', 'penciled_in' or 'unavailable' dates.
--
-- FIX (critical): SECURITY DEFINER bypasses RLS and EXECUTE was granted to
-- PUBLIC, so anyone — even signed-out visitors — could rewrite any band's
-- calendar. Now admin-only.
-- FIX: day-by-day loop (~1,100 queries per call) replaced with two set-based
-- statements; same behaviour.
-- -----------------------------------------------------------------------------
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

  -- Remove seeking dates where any member is now unavailable
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
    );

  -- Add every date where everyone is free (existing rows are left alone)
  INSERT INTO public.band_open_dates (band_id, target_date, status)
  SELECT p_band_id, d::DATE, 'actively_seeking'
  FROM generate_series(v_from, v_to, INTERVAL '1 day') AS d
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.band_members bm
    JOIN public.member_unavailabilities mu ON mu.profile_id = bm.profile_id
    WHERE bm.band_id = p_band_id
      AND d::DATE BETWEEN mu.start_date AND mu.end_date
  )
  ON CONFLICT (band_id, target_date) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_band_open_dates(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_band_open_dates(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. STORAGE BUCKET & ASSET POLICIES
-- Path convention: band-assets/{band_id}/{logo|press|rider}/{filename}
--
-- FIX: bucket is created here instead of by hand in the dashboard.
-- FIX (critical): write policies only checked "is signed in", so any user
-- could upload to, overwrite or delete any band's assets. Now scoped to
-- admins of the band named by the first folder.
-- FIX: removed the public SELECT policy — a public bucket already serves
-- files by URL, and that policy let anyone LIST every file in the bucket.
-- Admins keep SELECT on their own folder (needed for upsert/overwrite).
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'band-assets', 'band-assets', TRUE, 20971520,  -- 20 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Band admins can view their band assets" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'band-assets'
         AND public.is_band_admin(((storage.foldername(name))[1])::UUID));

CREATE POLICY "Band admins can upload assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'band-assets'
              AND public.is_band_admin(((storage.foldername(name))[1])::UUID));

CREATE POLICY "Band admins can update assets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'band-assets'
         AND public.is_band_admin(((storage.foldername(name))[1])::UUID))
  WITH CHECK (bucket_id = 'band-assets'
              AND public.is_band_admin(((storage.foldername(name))[1])::UUID));

CREATE POLICY "Band admins can delete assets" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'band-assets'
         AND public.is_band_admin(((storage.foldername(name))[1])::UUID));
