# Nav, import-review polish, and EPK content additions

**Date:** 2026-10-27
**Branch:** `feat/nav-import-review-epk`
**Scope:** one combined PR touching three independent subsystems that the user bundled together.

## Why

Three threads from one session:

1. The signed-in top nav disappears on `/explore`, because `app/explore/page.tsx` lives outside the `app/dashboard` layout. Users lose their way to go back.
2. There is no nav link to the user's own bands. Today, "My bands" is only reachable by clicking the BandMeld logo back to `/dashboard`.
3. The Google Calendar import review page tucks the "Did I miss one?" section at the bottom behind a collapsed expander, and the list of events only has one presentation (card list). Users miss events they wanted to rescue, and some would prefer a denser table on long calendars.
4. The EPK is missing a plain website URL field and a free-text "sound description" paragraph. Bands don't know what to write, so a few hint prompts should sit next to the form.

## Non-goals

- Reskinning the public `/bands/[slug]` EPK layout. The new fields plug into the existing layout; redesign is a separate task.
- A full bands index page at `/dashboard/bands`. The existing `/dashboard` already lists the viewer's bands, so "My bands" points there.
- Nav chrome on anonymous visits to the public EPK (`/bands/[slug]`). That page stays layout-less so public visitors see the band, not the app.
- Server-side persistence of the import-review view preference. localStorage is fine; this is a per-browser convenience.

---

## A. Shared app header + "My bands" link + nav on Explore

### Goal

The signed-in top nav renders on both `/dashboard/**` and `/explore`. "My bands" is one of its links.

### Design

Extract the header currently inlined in `app/dashboard/layout.tsx` into a new client-safe server component:

- **File:** `components/nav/app-header.tsx`
- **Props:** `{ authed: boolean; bandCount: number; buildTag: string }`. `bandCount` is ignored when `authed` is false.
- **Rendered items when `authed`:** Logo · `Explore` · `My band` / `My bands` → `/dashboard` · `My availability` → `/dashboard/availability` · `<ThemeToggle />` · `Sign out` (form posts to `signOut`). The "My band(s)" label is singular when `bandCount === 1` and plural otherwise (including `0`, which reads naturally as "My bands" leading to the dashboard where the empty state prompts creating one).
- **Rendered items when not `authed`:** Logo · `Explore` · `<ThemeToggle />` · `Log in` → `/login`.
- Keep the sticky positioning, max-width container, and backdrop blur from the current dashboard layout.

Then:

- **`app/dashboard/layout.tsx`** replaces its inline `<header>` with `<AppHeader authed bandCount={bandCount} buildTag={buildTag()} />`. `requireUserId` call stays; dashboard pages still auth-gate. Alongside the existing user check it issues one count query:
  ```ts
  const { count } = await supabase
    .from("band_members")
    .select("band_id", { count: "exact", head: true })
    .eq("profile_id", userId);
  const bandCount = count ?? 0;
  ```
- **New file `app/explore/layout.tsx`** (server component):
  - Calls `createClient().auth.getClaims()` to learn whether the viewer is signed in (does NOT redirect — Explore is public).
  - When signed in, runs the same `band_members` count query as the dashboard layout. When signed out, passes `bandCount: 0` (ignored by the header).
  - Renders `<AppHeader authed={!!userId} bandCount={bandCount} buildTag={buildTag()} />` and wraps `{children}` in a `<main>` matching the dashboard layout's structure.
  - `buildTag()` is lifted to a small helper (`lib/build-tag.ts`) so the two layouts share one implementation.
- **`app/explore/page.tsx`** drops its own outer `<main className="mx-auto …">` (the layout now owns the shell) and renders only its header + grid as children.

### Not changing

- Login / signup pages: no header. Still full-bleed as today.
- Public `/bands/[slug]`: no header. Public artifact.
- Root `/` landing page: no header; it is its own marketing shell.

### Testing

- Hit `/explore` signed-in → nav visible with the "My band(s)" link that goes to `/dashboard`.
- With exactly one band membership, the link reads "My band" (singular). With zero or two-plus, it reads "My bands".
- Hit `/explore` signed-out → nav visible with "Log in" link; no "Sign out" button.
- Hit `/dashboard` → unchanged visually.
- Hit `/bands/<any-slug>` as a signed-in user → still no nav (anonymous-equivalent experience preserved).

---

## B. Import review page polish

### Goal

The missed-events block is impossible to miss, and users can switch all event sections to a dense table for long calendars. The view choice persists per browser.

### Design

Changes to `components/availability/import-review.tsx` only. No new files.

#### B1. Missed-events section moves to the top, auto-expanded

- Re-order the sections: `missed` first, then `oneOffs`, then `recurringSeries`.
- The missed block keeps the dashed-amber border look (still a flag) but loses its `showMissed` toggle. Delete the state, delete the Hide/Show button.
- Rename the section header from "Did I miss one?" to **"Google marked these as free — any you can't play?"** and keep the sub-copy that explains why these were filtered out.
- Preselect behaviour is unchanged — these events start unchecked, same as today.
- When `payload.missed.length === 0`, don't render the section at all (same as today).

#### B2. List / table toggle

- Add a `useState<"list" | "table">` initialized from `localStorage` under key `bandmeld:import-view`. The initializer runs inside `useState(() => { … })` with try/catch so a locked-down browser falls back to `"list"` without throwing.
- `useEffect` writes the chosen value back to localStorage whenever it changes, also wrapped in try/catch.
- A segmented control sits in a new toolbar row above the first section:
  ```
  [ ≡ List ] [ ▦ Table ]
  ```
  Buttons are `aria-pressed`. The toolbar also holds the three section-count summaries ("1 missed · 4 one-offs · 2 series") so it is one dense header row.
- **List mode** renders each event section as it does today (card rows with a left-aligned checkbox).
- **Table mode** renders each event section's rows as a `<table>`:
  ```
  ┌───┬────────────────┬─────┬─────────────────┐
  │   │ Date           │ Day │ Event           │
  ├───┼────────────────┼─────┼─────────────────┤
  │ ✓ │ Fri, Nov 7     │ Fri │ Dentist         │
  └───┴────────────────┴─────┴─────────────────┘
  ```
  - The checkbox stays the primary interaction.
  - Multi-day events get a `· N days` suffix in the Event column.
  - Recurring **series headers** (summary, N instances, Hide/Instances button) stay as cards even in table mode — only the leaf instance rows inside an expanded series switch to the table layout. This keeps the series-level "pick all" checkbox obvious.
- Factor the two render shapes into local components inside the file: `<EventListRows events />` and `<EventTableRows events />`. Both take the same props and the toggle picks which one to use. This avoids branching every section's JSX inline.

### Testing

- With `payload.missed.length > 0`, the missed section is the first thing on the review page and renders its full list (no Hide button).
- Flip to Table — all three sections switch to table rendering.
- Reload the page — the view preference is remembered.
- Submit in each mode — the hidden `payload` input and `selected` checkboxes still produce the same FormData as today (`applyGoogleImport` is untouched).

---

## C. EPK: website URL + sound description + writing tips

### Goal

Admins can paste a band website URL and write a free-text sound description, with a collapsible panel of writing prompts sitting next to the form.

### Design

#### C1. Schema migration

- **File:** `supabase/migrations/20261101000200_band_website_and_sound.sql` (timestamp sits after `20261101000100_vault_google_tokens.sql` from the sibling PR, so the two don't collide even if both merge in close succession).
- Contents:
  ```sql
  ALTER TABLE public.bands
    ADD COLUMN IF NOT EXISTS website_url       TEXT,
    ADD COLUMN IF NOT EXISTS sound_description TEXT;
  ```
- No RLS or trigger changes needed — existing `bands` row-level policies cover both columns.

#### C2. Types + data access

- `types/database.types.ts`: add `website_url: string | null` and `sound_description: string | null` to the Row / Insert / Update shapes of the `bands` table. Hand-edit (no regen needed in this PR; a follow-up `supabase gen types` can replace it).
- `types/index.ts` (or wherever `Band` is centralized): if there is a hand-maintained type that mirrors the DB row, extend it too.
- `lib/epk.ts`: `getPublicEpk` already does `select *` (verify) — if not, add the two columns to the explicit select.

#### C3. Band settings form

Changes to `components/bands/band-settings-form.tsx`:

- Add a **Website URL** text input (`type="url"`, `name="website_url"`, placeholder `https://`) in the social-links group — right below Linktree.
- Add a **Sound** textarea (`name="sound_description"`, 6 rows, `maxLength` 2000) directly below the existing `Bio` field.
- At the top of the form (above `Band name`), add a `<details>` block titled **"Writing tips for your EPK"**:
  ```
  <details className="rounded-xl border …">
    <summary>Writing tips for your EPK</summary>
    <ul>
      <li>Lead with the <em>feel</em>. "Dirty garage rock" beats "we play rock music."</li>
      <li>Name two or three touchstones ("…for fans of X and Y").</li>
      <li>What's the live show like — loud, intimate, dancey, spectacle?</li>
      <li>Who's in the band and what instruments?</li>
      <li>One memorable line a booker could paste into a flyer.</li>
    </ul>
  </details>
  ```
  Uses native `<details>` so it works with no JS and prints sensibly.
- The server action `updateBand` already reads whatever the form submits via `formData.get(name)`. Confirm it writes any field that was changed, and that it passes `website_url` and `sound_description` through to the `bands` update. If it uses an allow-list, add the two field names there.

#### C4. Public EPK rendering

Changes to `app/bands/[slug]/page.tsx`:

- Add a **Sound** section between the hero and the music embeds, only when `band.sound_description` is present:
  ```
  <section className="flex flex-col gap-2">
    <h2 className="text-xl font-semibold tracking-tight">Sound</h2>
    <p className="whitespace-pre-line text-base leading-relaxed opacity-90">
      {band.sound_description}
    </p>
  </section>
  ```
- In the existing social-links row, add a Website chip when `band.website_url` is present:
  ```
  {band.website_url && (
    <a href={band.website_url} target="_blank" rel="noopener" className="…">
      Website ↗
    </a>
  )}
  ```
  Chip sits first in the row (website is the most-canonical link).

### Testing

- Band admin edits `Sound`, submits, sees it on the public EPK.
- Band admin pastes `https://example.com` as Website, submits, sees a `Website ↗` chip linking out.
- Writing-tips panel opens on click, closed by default. Still readable with JS disabled (it is a `<details>`).
- Supabase prod migration applies cleanly after the vault-migration PR has merged (no timestamp collision).

---

## Rollout order

1. Merge the pending `fix/vault-migration-timestamp` PR first so the next migration we add doesn't risk sharing a version prefix with `20261031000000_vault_google_tokens.sql`.
2. Open this PR against master. The DB migration will apply via `.github/workflows/db-migrate.yml` on merge.
3. Vercel will deploy the frontend from the same push.

## Open questions

- None. All three design decisions were nailed down in the brainstorming turn (missed-events to top auto-expanded; list/table toggle covers all sections and persists in localStorage; separate `sound_description` field with a collapsible writing-tips panel).
