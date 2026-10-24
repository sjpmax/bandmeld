import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import { PUBLIC_BOOKABLE_STATUSES, type PublicEpk } from "@/types";

/**
 * Loads a band's public EPK by slug. Wrapped in React `cache` so
 * generateMetadata() and the page share one query per request.
 * Returns null when no band has that slug (→ notFound()); throws on
 * network/DB errors (→ error.tsx).
 */
export const getPublicEpk = cache(async (slug: string): Promise<PublicEpk | null> => {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("bands")
    .select("*, open_dates:band_open_dates (target_date, status)")
    .eq("slug", slug)
    .gte("open_dates.target_date", today)
    .in("open_dates.status", PUBLIC_BOOKABLE_STATUSES)
    .order("target_date", { referencedTable: "open_dates", ascending: true })
    .limit(60, { referencedTable: "open_dates" })
    .maybeSingle();

  if (error) throw new Error(`Failed to load EPK: ${error.message}`);
  return data;
});
