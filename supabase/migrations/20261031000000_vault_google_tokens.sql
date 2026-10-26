-- =============================================================================
-- MIGRATION 13: Encrypt Google OAuth tokens via Supabase Vault
--
-- Replaces the plaintext access_token / refresh_token columns on
-- google_calendar_connections with Vault secrets, one per user, named
-- 'google_tokens:<profile_uuid>'. The secret payload is a JSON object:
--     { "access_token": "...", "refresh_token": "..." }
--
-- Three SECURITY DEFINER RPCs mediate access. All three require a signed-in
-- user; they derive the secret name from auth.uid() so no caller can read
-- another user's secret.
--
--   public.set_google_tokens(p_access_token TEXT, p_refresh_token TEXT)
--   public.get_google_tokens()  → (access_token TEXT, refresh_token TEXT)
--   public.delete_google_tokens()
--
-- The google_calendar_connections row stays — it still holds the non-secret
-- metadata (google_sub, scope, expires_at, last_synced_at) and the owning
-- RLS policy. Only the tokens move.
--
-- Any existing plaintext tokens are copied into the Vault before the columns
-- drop, so the migration is lossless.
-- =============================================================================

-- 0. Make sure the Supabase Vault extension exists. Hosted Supabase has it
--    pre-enabled; self-hosted / ephemeral test projects may not, so guard.
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- 1. Copy existing plaintext tokens into Vault.
--    No-op on a fresh database. Safe to re-run — vault.create_secret raises
--    on duplicate names, so we check first and skip. Rows where access_token
--    is NULL (shouldn't exist, column was NOT NULL, but defence) are filtered
--    out so Vault doesn't end up holding a `{"access_token": null}` blob.
DO $$
DECLARE
  r RECORD;
  v_secret_name TEXT;
  v_payload TEXT;
  v_existing UUID;
BEGIN
  FOR r IN
    SELECT profile_id, access_token, refresh_token
    FROM public.google_calendar_connections
    WHERE access_token IS NOT NULL
  LOOP
    v_secret_name := 'google_tokens:' || r.profile_id::text;
    v_payload := jsonb_build_object(
      'access_token', r.access_token,
      'refresh_token', r.refresh_token
    )::text;

    SELECT id INTO v_existing FROM vault.secrets WHERE name = v_secret_name;
    IF v_existing IS NOT NULL THEN
      PERFORM vault.update_secret(v_existing, v_payload, v_secret_name, 'Google Calendar OAuth tokens');
    ELSE
      PERFORM vault.create_secret(v_payload, v_secret_name, 'Google Calendar OAuth tokens');
    END IF;
  END LOOP;
END $$;

-- 2. Drop the plaintext columns now that the data is in Vault.
ALTER TABLE public.google_calendar_connections
  DROP COLUMN IF EXISTS access_token,
  DROP COLUMN IF EXISTS refresh_token;

-- 3. Setter — upsert the signed-in user's token secret.
CREATE OR REPLACE FUNCTION public.set_google_tokens(
  p_access_token TEXT,
  p_refresh_token TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id UUID := auth.uid();
  v_secret_name TEXT;
  v_existing_id UUID;
  v_payload TEXT;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in' USING ERRCODE = '42501';
  END IF;

  v_secret_name := 'google_tokens:' || v_profile_id::text;
  v_payload := jsonb_build_object(
    'access_token', p_access_token,
    'refresh_token', p_refresh_token
  )::text;

  -- Serialize concurrent OAuth callbacks for the same user so the
  -- SELECT-then-INSERT/UPDATE below is effectively atomic. Transaction-
  -- scoped lock; auto-released on commit or rollback.
  PERFORM pg_advisory_xact_lock(hashtext(v_secret_name));

  SELECT id INTO v_existing_id FROM vault.secrets WHERE name = v_secret_name;

  IF v_existing_id IS NOT NULL THEN
    PERFORM vault.update_secret(v_existing_id, v_payload, v_secret_name, 'Google Calendar OAuth tokens');
  ELSE
    BEGIN
      PERFORM vault.create_secret(v_payload, v_secret_name, 'Google Calendar OAuth tokens');
    EXCEPTION WHEN unique_violation THEN
      -- Lost the race with another transaction that already created the
      -- secret under this name; update it instead.
      SELECT id INTO v_existing_id FROM vault.secrets WHERE name = v_secret_name;
      PERFORM vault.update_secret(v_existing_id, v_payload, v_secret_name, 'Google Calendar OAuth tokens');
    END;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_google_tokens(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_google_tokens(TEXT, TEXT) TO authenticated;

-- 4. Getter — return the signed-in user's tokens (or no rows if none).
CREATE OR REPLACE FUNCTION public.get_google_tokens()
RETURNS TABLE(access_token TEXT, refresh_token TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id UUID := auth.uid();
  v_secret_name TEXT;
  v_payload JSONB;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in' USING ERRCODE = '42501';
  END IF;

  v_secret_name := 'google_tokens:' || v_profile_id::text;

  SELECT decrypted_secret::jsonb INTO v_payload
  FROM vault.decrypted_secrets
  WHERE name = v_secret_name;

  IF v_payload IS NULL THEN
    RETURN;
  END IF;

  access_token := v_payload->>'access_token';
  refresh_token := v_payload->>'refresh_token';
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_google_tokens() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_google_tokens() TO authenticated;

-- 5. Deleter — wipe the signed-in user's token secret.
CREATE OR REPLACE FUNCTION public.delete_google_tokens()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id UUID := auth.uid();
  v_secret_name TEXT;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in' USING ERRCODE = '42501';
  END IF;

  v_secret_name := 'google_tokens:' || v_profile_id::text;
  DELETE FROM vault.secrets WHERE name = v_secret_name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_google_tokens() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_google_tokens() TO authenticated;
