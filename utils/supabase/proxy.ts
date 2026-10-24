import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database.types";
import { getSupabaseEnv } from "./env";

/** Routes that require a signed-in user. Everything else (incl. /bands/[slug]) is public. */
const PROTECTED_PREFIXES = ["/dashboard"];
/** Routes a signed-in user shouldn't see. */
const AUTH_ONLY_FOR_GUESTS = ["/login", "/signup"];

/**
 * Refreshes the Supabase auth session on every matched request and
 * writes the refreshed cookies to both the request (for Server Components
 * rendering this request) and the response (for the browser).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = getSupabaseEnv();

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: no code between createServerClient and getClaims().
  // getClaims() is what triggers the token refresh.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;

  if (!isSignedIn && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
    return redirectWithCookies(loginUrl, response);
  }

  if (isSignedIn && AUTH_ONLY_FOR_GUESTS.includes(pathname)) {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = "/dashboard";
    dashUrl.search = "";
    return redirectWithCookies(dashUrl, response);
  }

  // Return the response object as-is so refreshed cookies reach the browser.
  return response;
}

/** Redirects while carrying over any refreshed auth cookies. */
function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
