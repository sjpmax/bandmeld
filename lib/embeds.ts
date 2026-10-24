/**
 * Convert user-pasted share links into embeddable iframe URLs.
 * Returns null for anything unrecognised so the UI can fall back to a plain link
 * (and so we never iframe an arbitrary domain).
 */

export function toSpotifyEmbed(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname !== "open.spotify.com") return null;
    // /intl-xx/artist/ID → /artist/ID
    const parts = u.pathname.split("/").filter(Boolean).filter((p) => !p.startsWith("intl-"));
    const [type, id] = parts;
    if (!type || !id || !["artist", "album", "track", "playlist"].includes(type)) return null;
    return `https://open.spotify.com/embed/${type}/${id}`;
  } catch {
    return null;
  }
}

export function toAppleMusicEmbed(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname !== "music.apple.com") return null;
    // Apple's embed is served from embed.music.apple.com with the same path.
    return `https://embed.music.apple.com${u.pathname}${u.search}`;
  } catch {
    return null;
  }
}

export function toYouTubeEmbed(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1);
    else if (host === "youtube.com") {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else if (/^\/(embed|shorts|live)\//.test(u.pathname)) id = u.pathname.split("/")[2] ?? null;
    }
    return id && /^[\w-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch {
    return null;
  }
}
