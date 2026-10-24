"use client";

import { useEffect, useRef, useState } from "react";
import { searchCities, type CitySuggestion } from "@/lib/geocode";

/**
 * Debounced city autocomplete backed by Nominatim. Writes three form
 * fields: `home_city` (display name) plus optional hidden `home_city_lat`
 * and `home_city_lng` populated when the user picks a suggestion.
 *
 * The input remains freely editable — users can type a city name we
 * don't geocode and the lat/lng stay empty.
 */
export function HomeCityInput({
  defaultCity,
  defaultLat,
  defaultLng,
  required,
  inputClassName,
}: {
  defaultCity?: string | null;
  defaultLat?: number | null;
  defaultLng?: number | null;
  required?: boolean;
  inputClassName?: string;
}) {
  const [query, setQuery] = useState(defaultCity ?? "");
  const [lat, setLat] = useState<string>(defaultLat?.toString() ?? "");
  const [lng, setLng] = useState<string>(defaultLng?.toString() ?? "");
  const [results, setResults] = useState<CitySuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const latestQuery = useRef("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounced search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    if (q === defaultCity && lat) return; // seeded value — don't re-query
    latestQuery.current = q;
    const t = setTimeout(async () => {
      setPending(true);
      try {
        const r = await searchCities(q);
        // Guard against stale updates.
        if (latestQuery.current === q) setResults(r);
      } finally {
        setPending(false);
      }
    }, 350);
    return () => clearTimeout(t);
    // Intentionally omit defaultCity/lat — those are only read once at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Close on outside click.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function pick(c: CitySuggestion) {
    setQuery(c.shortLabel);
    setLat(c.lat.toString());
    setLng(c.lng.toString());
    setOpen(false);
  }

  const fallback =
    "w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-base text-ink dark:border-white/20 dark:bg-white/5 dark:text-inherit";
  const className = inputClassName ?? fallback;

  return (
    <div ref={wrapperRef} className="relative">
      <input
        name="home_city"
        type="text"
        required={required}
        maxLength={100}
        value={query}
        placeholder="Start typing a city…"
        onChange={(e) => {
          setQuery(e.target.value);
          // User typed — invalidate any previously-selected coords.
          setLat("");
          setLng("");
          setOpen(true);
        }}
        onFocus={() => results.length > 0 && setOpen(true)}
        className={className}
        autoComplete="off"
      />
      <input type="hidden" name="home_city_lat" value={lat} />
      <input type="hidden" name="home_city_lng" value={lng} />
      {open && (pending || results.length > 0) && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-black/15 bg-white shadow-lg dark:border-white/20 dark:bg-neutral-900">
          {pending && results.length === 0 && (
            <li className="px-3 py-2 text-sm opacity-60">Searching…</li>
          )}
          {results.map((r) => (
            <li key={r.label}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()} // keep focus
                onClick={() => pick(r)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
              >
                <span className="font-medium">{r.shortLabel}</span>
                <span className="block text-xs opacity-60">{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {lat && lng && (
        <span className="mt-1 inline-block text-xs opacity-60">📍 geocoded</span>
      )}
    </div>
  );
}
