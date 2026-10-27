-- =============================================================================
-- MIGRATION: Band EPK — website URL + sound description
--
-- Adds two nullable text columns on `bands`:
--   * website_url       — the band's own site (bandcamp, squarespace, …).
--                         Surfaced as a public chip on the EPK alongside the
--                         existing social links.
--   * sound_description — longer-form free text (several paragraphs) about
--                         what the band sounds like. Rendered as its own
--                         section on the public EPK below the hero.
--
-- Row-level security on `bands` already covers both columns (admin-write,
-- public-read), so no policy changes are needed.
-- =============================================================================

ALTER TABLE public.bands
  ADD COLUMN IF NOT EXISTS website_url       TEXT,
  ADD COLUMN IF NOT EXISTS sound_description TEXT;
