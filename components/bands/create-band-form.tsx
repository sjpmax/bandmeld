"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { createBand } from "@/app/dashboard/bands/actions";
import { slugify } from "@/lib/slug";
import { HomeCityInput } from "@/components/bands/home-city-input";
import type { ActionResult } from "@/types";

const initial: ActionResult<string> = { ok: true };

export function CreateBandForm() {
  const [state, formAction, pending] = useActionState(createBand, initial);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  // Preview the real browser origin — don't trust NEXT_PUBLIC_SITE_URL,
  // which can be misconfigured in Vercel and show "localhost" in prod.
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!state.ok) toast.error(state.error);
  }, [state]);

  const previewSlug = slugEdited ? slug : slugify(name) || "your-band";

  const input =
    "w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-base text-ink dark:border-white/20 dark:bg-white/5 dark:text-inherit";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Band name
        <input
          name="name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={input}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Public URL
        <div className="flex items-center gap-2">
          <span className="text-sm opacity-60">{origin || "…"}/bands/</span>
          <input
            name="slug"
            placeholder={slugify(name) || "your-band"}
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugEdited(true);
            }}
            pattern="^[a-z0-9]+(-[a-z0-9]+)*$"
            maxLength={60}
            className={input}
          />
        </div>
        <span className="text-xs opacity-60">
          Will be <code>{previewSlug}</code>. Lowercase letters, numbers, and single dashes only.
        </span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Home city
        <HomeCityInput required inputClassName={input} />
        <span className="text-xs opacity-60">
          Pick from the dropdown so we can match you with bands and venues nearby.
        </span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Your role in the band
        <input
          name="founder_role"
          maxLength={60}
          list="founder-role-suggestions"
          className={input}
          placeholder="Lead vocals, Guitar, Bass, Drums…"
        />
        <datalist id="founder-role-suggestions">
          <option value="Lead vocals" />
          <option value="Backing vocals" />
          <option value="Guitar" />
          <option value="Lead guitar" />
          <option value="Rhythm guitar" />
          <option value="Bass" />
          <option value="Drums" />
          <option value="Keys" />
          <option value="Synth" />
          <option value="Band leader" />
          <option value="Manager" />
        </datalist>
        <span className="text-xs opacity-60">
          Admin permissions are a separate badge — this is just what you play.
        </span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Genres (comma separated, up to 6)
        <input name="genres" maxLength={200} className={input} placeholder="indie, punk, surf rock" />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Short bio (optional)
        <textarea
          name="bio"
          rows={4}
          maxLength={1200}
          className={input + " min-h-[6rem] resize-y"}
          placeholder="Who are you and what do you sound like?"
        />
      </label>

      <button
        type="submit"
        disabled={pending || !name}
        className="self-start rounded-full bg-accent px-5 py-2.5 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create band"}
      </button>
      <p className="text-xs opacity-60">
        You&apos;ll be the first admin. You can invite bandmates and upload assets on the next
        screen.
      </p>
    </form>
  );
}
