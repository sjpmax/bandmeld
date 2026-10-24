import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicEpk } from "@/lib/epk";
import { toAppleMusicEmbed, toSpotifyEmbed, toYouTubeEmbed } from "@/lib/embeds";

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
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{band.name}</h1>
        <p className="opacity-70">
          {band.home_city}
          {band.genres.length > 0 && ` · ${band.genres.join(", ")}`}
        </p>
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

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Open dates</h2>
        {band.open_dates.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {band.open_dates.map((d) => (
              <li key={d.target_date} className="rounded-full border border-current/20 px-3 py-1 text-sm">
                {dateFmt.format(new Date(`${d.target_date}T00:00:00Z`))}
                {d.status === "penciled_in" && <span className="opacity-60"> · hold</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="opacity-70">No open dates posted right now.</p>
        )}
      </section>

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
