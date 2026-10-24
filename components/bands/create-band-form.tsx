"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { createBand } from "@/app/dashboard/bands/actions";
import type { ActionResult } from "@/types";

const initial: ActionResult<string> = { ok: true };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function CreateBandForm({ siteOrigin }: { siteOrigin: string }) {
  const [state, formAction, pending] = useActionState(createBand, initial);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

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
          <span className="text-sm opacity-60">{siteOrigin}/bands/</span>
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
        <input name="home_city" required maxLength={60} className={input} placeholder="Phoenix, AZ" />
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
