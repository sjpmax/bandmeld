import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = { title: "Explore bands" };
export const dynamic = "force-dynamic";

/**
 * Minimal public band directory. No filters, no distance, no genre match.
 * Full discovery (match on your home city + genres, random band button)
 * ships next session once the profile foundation is in place.
 */
export default async function ExplorePage() {
  const supabase = await createClient();
  const { data: bands, error } = await supabase
    .from("bands")
    .select("id, name, slug, home_city, genres, logo_url, is_fake")
    .order("is_fake", { ascending: true }) // real bands first
    .order("name", { ascending: true });

  if (error) throw error;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <header>
        <h1 className="text-3xl font-bold">Explore bands</h1>
        <p className="mt-1 opacity-70">
          Every public BandSnap profile. &quot;Local bands in your genre&quot; filtering is coming
          soon.
        </p>
      </header>

      {!bands || bands.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/20 p-6 text-center opacity-80 dark:border-white/20">
          No bands yet.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bands.map((b) => (
            <li key={b.id}>
              <Link
                href={`/bands/${b.slug}`}
                className="flex h-full gap-3 rounded-xl border border-black/10 p-4 hover:border-current dark:border-white/10"
              >
                {b.logo_url ? (
                  <img
                    src={b.logo_url}
                    alt={`${b.name} logo`}
                    className="h-14 w-14 shrink-0 rounded-md border border-black/10 bg-paper object-contain p-1 dark:border-white/10"
                  />
                ) : (
                  <div
                    aria-hidden
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-dashed border-black/20 text-xs opacity-50 dark:border-white/20"
                  >
                    Logo
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    <span className="truncate">{b.name}</span>
                    {b.is_fake && (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold uppercase text-amber-700 dark:text-amber-300">
                        Demo
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm opacity-70">{b.home_city}</p>
                  {b.genres.length > 0 && (
                    <p className="mt-1 truncate text-xs opacity-60">{b.genres.join(" · ")}</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
