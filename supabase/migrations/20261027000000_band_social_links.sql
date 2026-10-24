-- =============================================================================
-- MIGRATION 7: Instagram + Linktree band social links
-- =============================================================================

ALTER TABLE public.bands
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS linktree_url  TEXT;
