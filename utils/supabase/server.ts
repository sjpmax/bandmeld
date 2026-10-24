import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Database } from "@/types/database.types";
import { getSupabaseEnv } from "./env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Create a new client per request — never store it in a module-level
 * variable (that would leak one user's session into another's request).
 * Queries run as the signed-in user, so RLS applies exactly as in the browser.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = getSupabaseEnv();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Safe to ignore: proxy.ts refreshes the session on every request.
        }
      },
    },
  });
}

/**
 * Returns the signed-in user's id (auth.uid()) or null.
 * Uses getClaims(), which verifies the JWT signature — never trust
 * getSession() on the server.
 */
export async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub;
}

/**
 * For pages/actions that require a signed-in user. Redirects to /login
 * (preserving where they were headed) instead of letting RLS silently
 * return empty results.
 */
export async function requireUserId(next?: string): Promise<string> {
  const userId = await getUserId();
  if (!userId) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  return userId;
}
