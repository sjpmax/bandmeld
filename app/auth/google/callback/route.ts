import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { GOOGLE_CALENDAR_SCOPE } from "@/lib/google-calendar";
import { loadGoogleTokens, storeGoogleTokens } from "@/lib/google-tokens";

/**
 * OAuth landing route for linking Google Calendar.
 *
 * Flow (started from the browser by `supabase.auth.linkIdentity({ provider: 'google', ... })`):
 *   Google consent → Supabase /auth/v1/callback → HERE
 *
 * We exchange the PKCE code for a session, read `provider_token` /
 * `provider_refresh_token` out of that session, and persist them to
 * `public.google_calendar_connections`. From then on the server can call
 * the Google Calendar API on this user's behalf (refreshing as needed).
 */
function fail(origin: string, reason: string) {
  return NextResponse.redirect(
    new URL(`/dashboard/availability?connect_error=${encodeURIComponent(reason)}`, origin),
  );
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/dashboard/availability/import";
  const next =
    nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/dashboard/availability/import";

  if (!code) return fail(origin, "missing_code");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session || !data.user) {
    return fail(origin, error?.message ?? "exchange_failed");
  }

  const providerToken = data.session.provider_token;
  const providerRefreshToken = data.session.provider_refresh_token ?? null;
  if (!providerToken) return fail(origin, "no_provider_token");

  // Grab Google's stable user id for this identity.
  const googleIdentity = data.user.identities?.find((i) => i.provider === "google");
  const googleSub = (googleIdentity?.identity_data as { sub?: string } | undefined)?.sub;
  if (!googleSub) return fail(origin, "no_google_identity");

  // If this is a re-link, Google may not re-issue a refresh_token.
  // Preserve the one we already have in that case.
  let effectiveRefreshToken = providerRefreshToken;
  if (!effectiveRefreshToken) {
    try {
      const existing = await loadGoogleTokens(supabase);
      effectiveRefreshToken = existing?.refresh_token ?? null;
    } catch {
      // No existing secret — fine, this is a first-time connect.
      effectiveRefreshToken = null;
    }
  }

  // Supabase doesn't expose the provider token's exact expiry; Google access
  // tokens live 3600s. Use 55m to be safe — getValidAccessToken refreshes
  // against the real `expires_in` on first refresh.
  const expiresAt = new Date(Date.now() + 55 * 60 * 1000).toISOString();

  // 1. Upsert non-secret metadata.
  const { error: upsertErr } = await supabase.from("google_calendar_connections").upsert(
    {
      profile_id: data.user.id,
      google_sub: googleSub,
      expires_at: expiresAt,
      scope: GOOGLE_CALENDAR_SCOPE,
    },
    { onConflict: "profile_id" },
  );
  if (upsertErr) return fail(origin, upsertErr.message);

  // 2. Store secret tokens in the Vault.
  try {
    await storeGoogleTokens(supabase, {
      access_token: providerToken,
      refresh_token: effectiveRefreshToken,
    });
  } catch (err) {
    return fail(origin, err instanceof Error ? err.message : "token_store_failed");
  }

  return NextResponse.redirect(new URL(next, origin));
}
