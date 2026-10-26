/**
 * Thin wrappers over the Vault-backed RPCs that store Google OAuth tokens.
 *
 * The RPCs (`set_google_tokens` / `get_google_tokens` / `delete_google_tokens`)
 * are SECURITY DEFINER and derive the owning user from `auth.uid()` — they
 * can't be used to read or write another user's secret.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { GoogleTokens } from "./google-calendar";

type DbClient = SupabaseClient<Database>;

/** Returns the signed-in user's tokens, or null when disconnected. */
export async function loadGoogleTokens(supabase: DbClient): Promise<GoogleTokens | null> {
  const { data, error } = await supabase.rpc("get_google_tokens");
  if (error) throw new Error(`get_google_tokens: ${error.message}`);
  const row = data?.[0];
  if (!row) return null;
  return {
    access_token: row.access_token,
    refresh_token: row.refresh_token || null,
  };
}

/** Writes (upserts) the signed-in user's tokens. */
export async function storeGoogleTokens(
  supabase: DbClient,
  tokens: GoogleTokens,
): Promise<void> {
  const { error } = await supabase.rpc("set_google_tokens", {
    p_access_token: tokens.access_token,
    p_refresh_token: tokens.refresh_token ?? "",
  });
  if (error) throw new Error(`set_google_tokens: ${error.message}`);
}

/** Clears the signed-in user's tokens (used by disconnect). */
export async function clearGoogleTokens(supabase: DbClient): Promise<void> {
  const { error } = await supabase.rpc("delete_google_tokens");
  if (error) throw new Error(`delete_google_tokens: ${error.message}`);
}
