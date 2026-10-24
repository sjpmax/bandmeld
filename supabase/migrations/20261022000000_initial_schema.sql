-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS
CREATE TYPE user_role AS ENUM ('band_leader', 'band_member', 'venue_manager', 'creative');
CREATE TYPE gig_status AS ENUM ('actively_seeking', 'penciled_in', 'booked', 'unavailable');

-- 2. PROFILES (Extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BANDS
CREATE TABLE public.bands (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  bio TEXT,
  home_city TEXT NOT NULL,
  genres TEXT[] NOT NULL DEFAULT '{}',
  logo_url TEXT,
  press_photo_url TEXT,
  tech_rider_url TEXT,
  spotify_url TEXT,
  youtube_url TEXT,
  avg_local_draw INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BAND MEMBERS (Junction Table)
CREATE TABLE public.band_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role_in_band TEXT DEFAULT 'Member', -- e.g. "Drums", "Vocals"
  is_admin BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(band_id, profile_id)
);

-- 5. MEMBER UNAVAILABILITIES (Individual Member Calendars)
CREATE TABLE public.member_unavailabilities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. BAND OPEN DATES (Consolidated Master Availability)
CREATE TABLE public.band_open_dates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  band_id UUID REFERENCES public.bands(id) ON DELETE CASCADE NOT NULL,
  target_date DATE NOT NULL,
  status gig_status DEFAULT 'actively_seeking',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(band_id, target_date)
);

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_unavailabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_open_dates ENABLE ROW LEVEL SECURITY;

-- Public Access Policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Bands are viewable by everyone" ON public.bands FOR SELECT USING (true);
CREATE POLICY "Band open dates are viewable by everyone" ON public.band_open_dates FOR SELECT USING (true);

-- Authenticated User Policies
CREATE POLICY "Users can update own profile" ON public.profiles 
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Band admins can update band profile" ON public.bands 
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.band_members 
      WHERE band_id = public.bands.id 
        AND profile_id = auth.uid() 
        AND is_admin = true
    )
  );

CREATE POLICY "Members can view and manage their unavailabilities" ON public.member_unavailabilities
  FOR ALL USING (auth.uid() = profile_id);

-- -----------------------------------------------------------------------------
-- AUTOMATIC PROFILE CREATION TRIGGER
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Musician'),
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();