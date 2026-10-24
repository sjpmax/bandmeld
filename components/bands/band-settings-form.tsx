"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateBand } from "@/app/dashboard/bands/actions";
import type { ActionResult, Band } from "@/types";

const initial: ActionResult = { ok: true };

export function BandSettingsForm({ band }: { band: Band }) {
  const [state, formAction, pending] = useActionState(updateBand.bind(null, band.id), initial);

  useEffect(() => {
    if (!state.ok) toast.error(state.error);
    else if (state.message) toast.success(state.message);
  }, [state]);

  const input =
    "w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-base text-ink dark:border-white/20 dark:bg-white/5 dark:text-inherit";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Band name
        <input name="name" required maxLength={80} defaultValue={band.name} className={input} />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Home city
        <input
          name="home_city"
          required
          maxLength={60}
          defaultValue={band.home_city}
          className={input}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Genres (comma separated, up to 6)
        <input
          name="genres"
          maxLength={200}
          defaultValue={band.genres.join(", ")}
          className={input}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Short bio
        <textarea
          name="bio"
          rows={4}
          maxLength={1200}
          defaultValue={band.bio ?? ""}
          className={input + " min-h-[6rem] resize-y"}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Spotify URL
          <input
            name="spotify_url"
            type="url"
            maxLength={300}
            defaultValue={band.spotify_url ?? ""}
            placeholder="https://open.spotify.com/artist/…"
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Apple Music URL
          <input
            name="apple_music_url"
            type="url"
            maxLength={300}
            defaultValue={band.apple_music_url ?? ""}
            placeholder="https://music.apple.com/…"
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          YouTube URL
          <input
            name="youtube_url"
            type="url"
            maxLength={300}
            defaultValue={band.youtube_url ?? ""}
            placeholder="https://youtube.com/…"
            className={input}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium sm:max-w-xs">
        Average local draw
        <input
          name="avg_local_draw"
          type="number"
          min={0}
          max={100000}
          defaultValue={band.avg_local_draw ?? 0}
          className={input}
        />
        <span className="text-xs opacity-60">
          Honest estimate for a hometown show — venues will see this on your pitch package.
        </span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-accent px-5 py-2.5 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save band"}
      </button>
    </form>
  );
}
