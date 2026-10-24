import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";
import { getSupabaseEnv } from "./env";

/**
 * Supabase client for Client Components ("use client").
 *
 * Use for interactive features only: calendar date pickers, uploads,
 * realtime, optimistic UI. Initial page data should be fetched in
 * Server Components via `utils/supabase/server.ts`.
 *
 * createBrowserClient memoises a single instance per browser tab,
 * so calling this inside components is cheap.
 */
export function createClient() {
  const { url, key } = getSupabaseEnv();
  return createBrowserClient<Database>(url, key);
}
