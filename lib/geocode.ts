"use server";

/**
 * City search via OpenStreetMap Nominatim.
 *
 * Nominatim is free and keyless, but requires:
 *   - A descriptive User-Agent that identifies the app.
 *   - Max 1 req/sec from a single source.
 *   - Caching results server-side when possible.
 *
 * We proxy the call through a server action so the UA header is set, the
 * key stays off the browser (none needed), and Next.js can cache the
 * same query for 24h.
 */

export type CitySuggestion = {
  /** Human-readable label, e.g. "Phoenix, Arizona, United States". */
  label: string;
  /** Short label without country, e.g. "Phoenix, Arizona". */
  shortLabel: string;
  lat: number;
  lng: number;
};

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
  addresstype?: string;
  type?: string;
  class?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    region?: string;
    country?: string;
    country_code?: string;
  };
};

const CITY_TYPES = new Set([
  "city",
  "town",
  "village",
  "municipality",
  "hamlet",
  "administrative",
]);

function formatCity(r: NominatimResult): CitySuggestion | null {
  const a = r.address ?? {};
  const name = a.city ?? a.town ?? a.village ?? a.municipality;
  if (!name) return null;
  const region = a.state ?? a.region ?? a.county ?? "";
  const country = a.country ?? "";
  const shortLabel = [name, region].filter(Boolean).join(", ");
  const label = [name, region, country].filter(Boolean).join(", ");
  const lat = Number.parseFloat(r.lat);
  const lng = Number.parseFloat(r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { label, shortLabel, lat, lng };
}

export async function searchCities(query: string): Promise<CitySuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({
      q,
      format: "jsonv2",
      addressdetails: "1",
      limit: "6",
      // Bias toward city-like results.
      featuretype: "city",
    }).toString();

  const res = await fetch(url, {
    headers: {
      // Nominatim's usage policy requires a descriptive UA.
      "User-Agent": "BandSnap/0.1 (https://bandsnap.vercel.app)",
      "Accept-Language": "en",
    },
    // Cache for 24h — same query won't hit Nominatim again for a day.
    next: { revalidate: 86_400 },
  });

  if (!res.ok) return [];

  const results = (await res.json()) as NominatimResult[];
  const cities: CitySuggestion[] = [];
  for (const r of results) {
    const t = r.addresstype ?? r.type ?? r.class ?? "";
    if (!CITY_TYPES.has(t) && !r.address?.city && !r.address?.town && !r.address?.village)
      continue;
    const c = formatCity(r);
    if (c) cities.push(c);
  }
  // Dedupe by label, keep order.
  const seen = new Set<string>();
  return cities.filter((c) => (seen.has(c.label) ? false : (seen.add(c.label), true)));
}
