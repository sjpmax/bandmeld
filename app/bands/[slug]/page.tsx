import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicEpk } from "@/lib/epk";
import { toAppleMusicEmbed, toSpotifyEmbed, toYouTubeEmbed } from "@/lib/embeds";
import { EpkOpenDates } from "@/components/epk/epk-open-dates";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const band = await getPublicEpk(slug);
  if (!band) return { title: "Band not found" };
  return {
    title: band.name,
    description: band.bio?.slice(0, 160) ?? `${band.name} — ${band.home_city}`,
    openGraph: band.press_photo_url ? { images: [band.press_photo_url] } : undefined,
  };
}

// Skeleton EPK — full design is a later task. Shows the data contract.
export default async function BandEpkPage({ params }: Props) {
  const { slug } = await params;
  const band = await getPublicEpk(slug);
  if (!band) notFound();

  const spotify = toSpotifyEmbed(band.spotify_url);
  const appleMusic = toAppleMusicEmbed(band.apple_music_url);
  const youtube = toYouTubeEmbed(band.youtube_url);
  const dateFmt = new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
  });

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-10">
      {band.is_fake && (
        <aside className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          <strong>DEMO band</strong> — seeded data for testing BandSnap. Not a real act.
        </aside>
      )}

      <header className="flex flex-col items-start gap-4">
        {band.logo_url && (
          <img
            src={band.logo_url}
            alt={`${band.name} logo`}
            className="h-24 w-24 rounded-xl border border-black/10 bg-paper object-contain p-2 dark:border-white/10 sm:h-32 sm:w-32"
          />
        )}
        <div className="flex flex-col gap-2">
          <h1 className="flex flex-wrap items-center gap-3 text-4xl font-bold tracking-tight sm:text-5xl">
            {band.name}
            {band.is_fake && (
              <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Demo
              </span>
            )}
          </h1>
          <p className="opacity-70">
            {band.home_city}
            {band.genres.length > 0 && ` · ${band.genres.join(", ")}`}
          </p>
        </div>
      </header>

      {band.bio && <p className="whitespace-pre-line text-lg leading-relaxed">{band.bio}</p>}

      {(spotify || appleMusic || youtube) && (
        <section className="flex flex-col gap-4">
          {spotify && (
            <iframe src={spotify} title={`${band.name} on Spotify`} loading="lazy" height={352}
              allow="encrypted-media" className="w-full rounded-xl border-0" />
          )}
          {appleMusic && (
            <iframe src={appleMusic} title={`${band.name} on Apple Music`} loading="lazy" height={450}
              allow="autoplay *; encrypted-media *;" className="w-full rounded-xl border-0" />
          )}
          {youtube && (
            <iframe src={youtube} title={`${band.name} on YouTube`} loading="lazy" allowFullScreen
              allow="encrypted-media; picture-in-picture" className="aspect-video w-full rounded-xl border-0" />
          )}
        </section>
      )}

      <EpkOpenDates openDates={band.open_dates ?? []} bandName={band.name} />

      {(band.spotify_url ||
        band.apple_music_url ||
        band.youtube_url ||
        band.instagram_url ||
        band.linktree_url) && (
        <section className="flex flex-wrap gap-2">
          {band.spotify_url && (
            <a
              href={band.spotify_url}
              target="_blank"
              rel="noopener"
              className="rounded-full border border-current/30 px-3 py-1 text-sm hover:border-current"
            >
              Spotify ↗
            </a>
          )}
          {band.apple_music_url && (
            <a
              href={band.apple_music_url}
              target="_blank"
              rel="noopener"
              className="rounded-full border border-current/30 px-3 py-1 text-sm hover:border-current"
            >
              Apple Music ↗
            </a>
          )}
          {band.youtube_url && (
            <a
              href={band.youtube_url}
              target="_blank"
              rel="noopener"
              className="rounded-full border border-current/30 px-3 py-1 text-sm hover:border-current"
            >
              YouTube ↗
            </a>
          )}
          {band.instagram_url && (
            <a
              href={band.instagram_url}
              target="_blank"
              rel="noopener"
              className="rounded-full border border-current/30 px-3 py-1 text-sm hover:border-current"
            >
              Instagram ↗
            </a>
          )}
          {band.linktree_url && (
            <a
              href={band.linktree_url}
              target="_blank"
              rel="noopener"
              className="rounded-full border border-current/30 px-3 py-1 text-sm hover:border-current"
            >
              All links ↗
            </a>
          )}
        </section>
      )}

      {(band.press_photo_url || band.tech_rider_url || band.epk_pdf_url) && (
        <section className="flex flex-wrap gap-3">
          {band.press_photo_url && (
            <a href={band.press_photo_url} download className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white">
              Download press photo
            </a>
          )}
          {band.epk_pdf_url && (
            <a href={band.epk_pdf_url} target="_blank" rel="noopener" className="rounded-full border border-current px-4 py-2 text-sm font-medium">
              EPK (PDF)
            </a>
          )}
          {band.tech_rider_url && (
            <a href={band.tech_rider_url} target="_blank" rel="noopener" className="rounded-full border border-current px-4 py-2 text-sm font-medium">
              Tech rider
            </a>
          )}
        </section>
      )}
    </main>
  );
}
