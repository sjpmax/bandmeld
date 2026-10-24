/**
 * Centralised env access so a missing key fails loudly with a clear message
 * instead of an opaque "fetch failed" deep inside the Supabase client.
 *
 * NEXT_PUBLIC_* values must be referenced literally (not via process.env[name])
 * so Next.js can inline them into the browser bundle.
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local (see .env.example).",
    );
  }

  return { url, key };
}

/**
 * Google OAuth client credentials, used server-side to refresh an expired
 * provider_token against Google's token endpoint. Same values pasted into
 * Supabase dashboard → Auth → Providers → Google.
 */
export function getGoogleOAuthEnv() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing Google OAuth env vars. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local.",
    );
  }

  return { clientId, clientSecret };
}
