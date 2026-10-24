-- =============================================================================
-- MIGRATION 11: is_fake flag on bands + seed a handful of demo bands.
--
-- Fake bands have no owners/members (nobody can edit them from the app).
-- They exist to populate discovery pages and give the EPK something to
-- look at during dev. Rendered with a prominent "DEMO" badge so no one
-- confuses them for real acts.
-- =============================================================================

ALTER TABLE public.bands
  ADD COLUMN IF NOT EXISTS is_fake BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS bands_is_fake_idx ON public.bands (is_fake);

-- Seed. Inserts bypass RLS because migrations run as superuser.
WITH inserted AS (
  INSERT INTO public.bands (
    name, slug, home_city, home_city_lat, home_city_lng,
    genres, bio, is_fake, avg_local_draw
  )
  VALUES
    (
      'The Beets', 'the-beets',
      'Bluffington, Wisconsin', 43.3833, -89.7667,
      ARRAY['alt-rock', 'indie rock'],
      'Doug''s favorite band. Loud, strange, and committed to Killer Tofu.',
      TRUE, 180
    ),
    (
      'CB4', 'cb4',
      'Compton, CA', 33.8958, -118.2201,
      ARRAY['hip-hop', 'rap', 'comedy'],
      'Three friends who tried to be gangsta rappers. Full backing band on tour.',
      TRUE, 220
    ),
    (
      'Prairie Static', 'prairie-static',
      'Nashville, TN', 36.1627, -86.7816,
      ARRAY['country', 'alt-country'],
      'Dusty country-rock, pedal steel and reverb. We bring our own sound guy.',
      TRUE, 95
    ),
    (
      'Blue Line Betrayal', 'blue-line-betrayal',
      'Philadelphia, PA', 39.9526, -75.1652,
      ARRAY['punk', 'hardcore'],
      'Short songs. Loud songs. Beer in the green room is non-negotiable.',
      TRUE, 140
    ),
    (
      'The Garage Dads', 'the-garage-dads',
      'Austin, TX', 30.2672, -97.7431,
      ARRAY['rock', 'garage rock', 'dad rock'],
      'Day jobs by day, Marshall stacks by Saturday. We play short sets.',
      TRUE, 110
    ),
    (
      'Night Shift Choir', 'night-shift-choir',
      'Portland, OR', 45.5152, -122.6784,
      ARRAY['indie', 'folk', 'chamber pop'],
      'Four-part harmonies and bowed upright bass. Quietest band in the room.',
      TRUE, 75
    )
  ON CONFLICT (slug) DO NOTHING
  RETURNING id
)
INSERT INTO public.band_open_dates (band_id, target_date, status)
SELECT
  i.id,
  d::DATE,
  'actively_seeking'
FROM inserted i,
     generate_series(CURRENT_DATE, CURRENT_DATE + 60, INTERVAL '1 day') d
ON CONFLICT (band_id, target_date) DO NOTHING;
