-- =============================================================================
-- MIGRATION 3: Google Calendar OAuth connections
-- Stores the provider_token / provider_refresh_token Supabase hands back after
-- a linkIdentity flow, so we can call the Google Calendar API on behalf of a
-- user later (manual re-sync, future cron). One row per user.
--
-- Follow-up: these tokens are stored in plaintext. For production, encrypt at
-- rest with pgsodium / Supabase Vault. RLS already keeps other users out.
-- =============================================================================

CREATE TABLE public.google_calendar_connections (
  profile_id       UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  google_sub       TEXT NOT NULL,            -- Google's stable user id for this identity
  access_token     TEXT NOT NULL,
  refresh_token    TEXT,                     -- only given on first-time consent (prompt=consent)
  expires_at       TIMESTAMPTZ NOT NULL,
  scope            TEXT NOT NULL,
  last_synced_at   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

-- Owner-only, including SELECT: tokens never leave the user's own session.
CREATE POLICY "Users manage their own google connection" ON public.google_calendar_connections
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = profile_id)
  WITH CHECK ((SELECT auth.uid()) = profile_id);

CREATE TRIGGER update_google_calendar_connections_modtime
  BEFORE UPDATE ON public.google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
