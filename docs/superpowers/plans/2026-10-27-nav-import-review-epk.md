# Nav + Import Review + EPK Additions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the three threads in [the design spec](../specs/2026-10-27-nav-import-review-epk-additions-design.md): shared nav on `/explore` with a "My band(s)" link, import-review page that floats missed events to the top with a list/table toggle, and new `website_url` + `sound_description` fields on bands with a writing-tips panel in the admin form.

**Architecture:** All three threads land on branch `feat/nav-import-review-epk`. The nav work extracts a shared server component (`components/nav/app-header.tsx`) used by both the dashboard layout and a new explore layout. The import-review changes stay inside one client component. The EPK work adds one DB migration plus straight-line edits to the admin form, the server action, the type file, and the public page.

**Tech Stack:** Next.js 16 (App Router, server components), React 19, Tailwind 4, Supabase (`@supabase/ssr`), TypeScript strict. Project norm: **no automated test framework**. Verification = `npm run typecheck` plus manual dev-server checks (`npm run dev` → `http://localhost:3001`). Each task ends with a commit.

**File inventory (what each task touches):**

| File | Role |
| :--- | :--- |
| `lib/build-tag.ts` | tiny shared helper for the footer build sha, lifted out of the dashboard layout |
| `components/nav/app-header.tsx` | shared sticky top nav |
| `app/dashboard/layout.tsx` | uses `AppHeader`, computes band count |
| `app/explore/layout.tsx` | wraps `/explore` in `AppHeader`, no auth gate |
| `app/explore/page.tsx` | drops its own `<main>` wrapper now that the layout owns the shell |
| `components/availability/import-review.tsx` | missed-events to top, auto-expanded, list/table toggle |
| `supabase/migrations/20261101000200_band_website_and_sound.sql` | adds `website_url` + `sound_description` columns |
| `types/database.types.ts` | hand-edit Row/Insert/Update for `bands` |
| `components/bands/band-settings-form.tsx` | writing-tips `<details>`, website input, sound textarea |
| `app/dashboard/bands/actions.ts` | `updateBand` reads+writes the two new columns |
| `app/bands/[slug]/page.tsx` | renders the Sound section + Website chip |

**Branch state at plan start:** we are on `feat/nav-import-review-epk`, which already contains two commits (the design spec and its pluralization amendment). The `fix/vault-migration-timestamp` PR is open against master; this plan does not depend on it merging first because the new migration here (`20261101000200`) sits after both `20261101000000_enforce_last_admin.sql` and the renamed vault file (`20261101000100`).

---

## Task 1: Extract `lib/build-tag.ts`

**Files:**
- Create: `lib/build-tag.ts`
- Modify: `app/dashboard/layout.tsx`

- [ ] **Step 1: Create the helper**

Create `lib/build-tag.ts` with the exact content:

```ts
/**
 * Short SHA of the deployment, or "dev" when running locally. Rendered in
 * the footer so a user can tell a reporter which build they were on when
 * a bug showed up.
 */
export function buildTag(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha) return sha.slice(0, 7);
  return "dev";
}
```

- [ ] **Step 2: Replace the inline helper in the dashboard layout**

Open `app/dashboard/layout.tsx`. Remove the local `function buildTag()` definition and import from the new helper. The diff is:

```ts
// delete these lines near the top of the file:
function buildTag(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha) return sha.slice(0, 7);
  return "dev";
}

// add this import near the other imports at the top:
import { buildTag } from "@/lib/build-tag";
```

Leave `const tag = buildTag();` and its usage in the JSX untouched.

- [ ] **Step 3: Typecheck**

Run:
```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/build-tag.ts app/dashboard/layout.tsx
git commit -m "Lift buildTag() into lib/build-tag.ts for layout reuse

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Create `<AppHeader>` shared component

**Files:**
- Create: `components/nav/app-header.tsx`

- [ ] **Step 1: Create the component**

Create `components/nav/app-header.tsx` with exactly this content:

```tsx
import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

type Props = {
  /** True when a signed-in user is viewing the page. */
  authed: boolean;
  /**
   * Count of bands the signed-in user is a member of. Picks the singular
   * ("My band") vs plural ("My bands") label on the nav link. Ignored when
   * `authed` is false.
   */
  bandCount: number;
  /** Short build SHA shown in the footer. */
  buildTag: string;
};

/**
 * Sticky top-of-page nav used across signed-in surfaces (/dashboard, /explore).
 *
 * - When signed in: Explore | My band(s) | My availability | theme | Sign out.
 *   "My band" is singular when the user is in exactly one band; "My bands"
 *   otherwise (including zero — the /dashboard landing has an empty-state
 *   create-a-band CTA).
 * - When signed out: Explore | theme | Log in. /explore is a public page,
 *   so the layout rendering this component must NOT redirect unauthenticated
 *   viewers.
 *
 * The caller is responsible for layout chrome around <main>; this component
 * only paints the <header> element.
 */
export function AppHeader({ authed, bandCount }: Props) {
  const myBandsLabel = authed && bandCount === 1 ? "My band" : "My bands";
  return (
    <header className="sticky top-0 z-10 border-b border-black/10 bg-paper/90 backdrop-blur dark:border-white/10 dark:bg-black/60">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href={authed ? "/dashboard" : "/"} className="flex items-center gap-2 font-bold">
          <Logo height={32} />
          <span className="hidden sm:inline">BandSnap</span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/explore">Explore</Link>
          {authed ? (
            <>
              <Link href="/dashboard">{myBandsLabel}</Link>
              <Link href="/dashboard/availability">My availability</Link>
              <ThemeToggle />
              <form action={signOut}>
                <button type="submit" className="opacity-70 hover:opacity-100">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <ThemeToggle />
              <Link href="/login" className="opacity-70 hover:opacity-100">
                Log in
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
```

Note: `buildTag` is in the Props shape so a caller can thread the value through in a single component later if we add footer rendering here. For now it is accepted and intentionally unused inside `<AppHeader>`; the layout keeps rendering the footer alongside the header. Leaving it in the signature now avoids a Props-shape churn in the next task.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: no errors. The `buildTag` prop will be flagged as unused only if the project enables `noUnusedParameters`; the current `tsconfig.json` does not, so no warning. If one appears, prefix the param with an underscore (`_buildTag`) in the destructure.

- [ ] **Step 3: Commit**

```bash
git add components/nav/app-header.tsx
git commit -m "Add shared <AppHeader> with signed-in and signed-out variants

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Wire the dashboard layout to `<AppHeader>`

**Files:**
- Modify: `app/dashboard/layout.tsx`

- [ ] **Step 1: Rewrite the layout**

Replace the entire contents of `app/dashboard/layout.tsx` with:

```tsx
import { createClient, requireUserId } from "@/utils/supabase/server";
import { AppHeader } from "@/components/nav/app-header";
import { buildTag } from "@/lib/build-tag";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts already redirects guests; this is defence-in-depth for
  // anything rendered under /dashboard.
  const userId = await requireUserId("/dashboard");
  const supabase = await createClient();

  // Nav label: "My band" when the viewer is in exactly one band, else "My bands".
  const { count } = await supabase
    .from("band_members")
    .select("band_id", { count: "exact", head: true })
    .eq("profile_id", userId);
  const bandCount = count ?? 0;

  const tag = buildTag();

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader authed bandCount={bandCount} buildTag={tag} />
      <main className="mx-auto w-full max-w-5xl grow px-4 py-8">{children}</main>
      <footer className="mx-auto w-full max-w-5xl px-4 py-3 text-right text-[10px] font-mono opacity-40">
        build {tag}
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Smoke-check in the browser**

Start the dev server if it is not already up:
```bash
npm run dev
```
In another terminal, open `http://localhost:3001/dashboard` while signed in. Expected:
- Header looks identical to before (Logo · BandSnap · Explore · My band(s) · My availability · theme · Sign out).
- With a signed-in user in zero or 2+ bands, the link reads "My bands".
- With a user in exactly one band, it reads "My band".
- Build sha footer still renders at the bottom.

If you don't have a convenient second account, flip your own membership count by creating a dummy second band from `/dashboard/bands/new` to observe the plural, then delete it.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/layout.tsx
git commit -m "Dashboard layout: use shared AppHeader; query band count for nav label

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Create `app/explore/layout.tsx` and simplify the page

**Files:**
- Create: `app/explore/layout.tsx`
- Modify: `app/explore/page.tsx`

- [ ] **Step 1: Create the explore layout**

Create `app/explore/layout.tsx` with:

```tsx
import { createClient } from "@/utils/supabase/server";
import { AppHeader } from "@/components/nav/app-header";
import { buildTag } from "@/lib/build-tag";

export default async function ExploreLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  // Public page — do NOT redirect unauthenticated viewers. We just read
  // claims to decide which nav variant to show.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;

  let bandCount = 0;
  if (userId) {
    const { count } = await supabase
      .from("band_members")
      .select("band_id", { count: "exact", head: true })
      .eq("profile_id", userId);
    bandCount = count ?? 0;
  }

  const tag = buildTag();

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader authed={!!userId} bandCount={bandCount} buildTag={tag} />
      <main className="mx-auto w-full max-w-5xl grow px-4 py-8">{children}</main>
      <footer className="mx-auto w-full max-w-5xl px-4 py-3 text-right text-[10px] font-mono opacity-40">
        build {tag}
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Strip the duplicate shell from the page**

The current `app/explore/page.tsx` wraps its content in `<main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">`. The layout now owns `<main>`, so swap the page's outer element to a plain fragment-flavoured container.

In `app/explore/page.tsx`, change the opening and closing of the return block:

```tsx
// before:
return (
  <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
    …
  </main>
);

// after:
return (
  <div className="flex flex-col gap-6">
    …
  </div>
);
```

Everything inside the former `<main>` stays byte-identical.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 4: Browser smoke check**

With the dev server running:
- Visit `http://localhost:3001/explore` while signed in → full nav visible, "My band(s)" link navigates to `/dashboard`.
- Sign out, visit `/explore` → nav shows Explore · theme · Log in. No "Sign out" button, no "My band(s)" or "My availability" links.
- Visit `/bands/<any-slug>` → still layout-less (nav absent). Confirms we did not accidentally hoist the nav onto the public EPK.

- [ ] **Step 5: Commit**

```bash
git add app/explore/layout.tsx app/explore/page.tsx
git commit -m "Add shared nav to /explore; page sheds its own layout wrapper

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Import review — missed-events to the top, auto-expanded

**Files:**
- Modify: `components/availability/import-review.tsx`

- [ ] **Step 1: Delete the `showMissed` state and the collapsing button**

Open `components/availability/import-review.tsx`. Remove the `showMissed` state declaration. The line to delete is:

```tsx
const [showMissed, setShowMissed] = useState(false);
```

- [ ] **Step 2: Rewrite the missed section**

Replace the entire JSX block starting at the comment `{/* "Did I miss one?" — events we skipped because Google marks them "free" */}` down to its closing `</section>` with the auto-expanded version. The new block looks like:

```tsx
{/* Google marked these as free — surfaced first so users can rescue real conflicts
    before they move on. */}
{payload.missed.length > 0 && (
  <section className="flex flex-col gap-3">
    <div className="rounded-xl border border-dashed border-amber-500/60 bg-amber-500/5 p-3">
      <p className="font-semibold">Google marked these as free — any you can't play?</p>
      <p className="text-sm opacity-70">
        {payload.missed.length} event{payload.missed.length === 1 ? "" : "s"} came back as "free"
        in your calendar. Tap any that are actually conflicts to add them to your blocks.
      </p>
    </div>
    <ul className="flex flex-col gap-2">
      {payload.missed.map((e) => (
        <li
          key={e.id}
          className="flex items-center gap-3 rounded-xl border border-black/10 p-3 dark:border-white/10"
        >
          <input
            type="checkbox"
            id={`miss-${e.id}`}
            name="selected"
            value={e.id}
            checked={selected.has(e.id)}
            onChange={(ev) => toggleEvent(e.id, ev.currentTarget.checked)}
            className="h-5 w-5"
          />
          <label htmlFor={`miss-${e.id}`} className="flex flex-1 flex-col">
            <span className="font-medium">{e.summary}</span>
            <span className="text-sm opacity-70">
              {rangeLabel(e)}
              {e.spanDays >= 2 && (
                <> · <span className="font-medium">{e.spanDays} days</span></>
              )}
            </span>
          </label>
        </li>
      ))}
    </ul>
  </section>
)}
```

- [ ] **Step 3: Move this missed section ABOVE the One-off section**

Cut the entire `{payload.missed.length > 0 && ( … )}` block you just wrote and paste it so it is the **first child** inside the top-level `<form>`, right after the hidden `<input type="hidden" name="payload" value={payloadJson} />`. The visual order inside the form becomes:

1. Hidden payload input (unchanged)
2. **Missed events** section (new position)
3. One-off & multi-day events section (unchanged)
4. Recurring events section (unchanged)
5. Sticky submit bar (unchanged)

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 5: Browser smoke check**

With the dev server running and the Vault migration PR not necessarily merged, you may not be able to reach `/dashboard/availability/import` without a working Google connection. If you can:
- Visit the review page after a Google import.
- The amber "Google marked these as free — any you can't play?" block should sit at the very top, fully expanded with all missed events shown and all unchecked.
- One-off events section unchanged below it.

If you cannot reach the live import page, instead render the component directly in a scratch route (`app/dev/import-preview/page.tsx` with a hand-rolled `payload`) OR skip the browser check and lean on the next task's full-page QA pass.

- [ ] **Step 6: Commit**

```bash
git add components/availability/import-review.tsx
git commit -m "Import review: float missed events to the top, auto-expanded

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Import review — list / table toggle persisted in localStorage

**Files:**
- Modify: `components/availability/import-review.tsx`

- [ ] **Step 1: Add view state with localStorage hydration**

Near the top of the component (next to the existing `useState` hooks), add:

```tsx
type ViewMode = "list" | "table";
const VIEW_STORAGE_KEY = "bandsnap:import-view";

function readStoredView(): ViewMode {
  if (typeof window === "undefined") return "list";
  try {
    const v = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return v === "table" ? "table" : "list";
  } catch {
    return "list";
  }
}

// …inside the ImportReview component:
const [view, setView] = useState<ViewMode>(readStoredView);

useEffect(() => {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    // Private browsing or storage disabled — remember only for this session.
  }
}, [view]);
```

Add `useEffect` to the existing `useMemo, useState` import from React. The import line becomes:

```tsx
import { useEffect, useMemo, useState } from "react";
```

- [ ] **Step 2: Add the toolbar row above the first section**

Immediately after the hidden `<input type="hidden" name="payload" …/>` and **before** the missed-events section, add a toolbar row:

```tsx
<div className="flex items-center justify-between gap-3 text-sm">
  <span className="opacity-70">
    {payload.missed.length} missed · {payload.oneOffs.length} one-off ·{" "}
    {payload.recurringSeries.length} series
  </span>
  <div
    role="group"
    aria-label="View mode"
    className="inline-flex overflow-hidden rounded-full border border-black/15 dark:border-white/20"
  >
    <button
      type="button"
      aria-pressed={view === "list"}
      onClick={() => setView("list")}
      className={
        "px-3 py-1 text-xs font-medium " +
        (view === "list" ? "bg-ink text-paper dark:bg-white dark:text-black" : "opacity-70")
      }
    >
      ≡ List
    </button>
    <button
      type="button"
      aria-pressed={view === "table"}
      onClick={() => setView("table")}
      className={
        "px-3 py-1 text-xs font-medium " +
        (view === "table" ? "bg-ink text-paper dark:bg-white dark:text-black" : "opacity-70")
      }
    >
      ▦ Table
    </button>
  </div>
</div>
```

- [ ] **Step 3: Factor out `EventListRows` and `EventTableRows` local components**

At the bottom of the same file (below the exported `ImportReview` function), add two small presentational components used by every section's leaf-row rendering:

```tsx
type RowsProps = {
  events: ReviewableEvent[];
  selected: Set<string>;
  onToggle: (id: string, next: boolean) => void;
  /** Prefix for input ids so the three sections never collide. */
  idPrefix: string;
};

function EventListRows({ events, selected, onToggle, idPrefix }: RowsProps) {
  return (
    <ul className="flex flex-col gap-2">
      {events.map((e) => (
        <li
          key={e.id}
          className="flex items-center gap-3 rounded-xl border border-black/10 p-3 dark:border-white/10"
        >
          <input
            type="checkbox"
            id={`${idPrefix}-${e.id}`}
            name="selected"
            value={e.id}
            checked={selected.has(e.id)}
            onChange={(ev) => onToggle(e.id, ev.currentTarget.checked)}
            className="h-5 w-5"
          />
          <label htmlFor={`${idPrefix}-${e.id}`} className="flex flex-1 flex-col">
            <span className="font-medium">{e.summary}</span>
            <span className="text-sm opacity-70">
              {rangeLabel(e)}
              {e.spanDays >= 2 && (
                <> · <span className="font-medium">{e.spanDays} days</span></>
              )}
              {!e.isAllDay && e.spanDays === 1 && <> · timed</>}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short" });
function dayLabel(iso: string): string {
  return dayFmt.format(new Date(`${iso}T00:00:00`));
}

function EventTableRows({ events, selected, onToggle, idPrefix }: RowsProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
      <table className="w-full text-sm">
        <thead className="bg-black/5 text-left text-xs uppercase tracking-wide dark:bg-white/5">
          <tr>
            <th className="w-10 px-3 py-2" scope="col">
              <span className="sr-only">Pick</span>
            </th>
            <th className="px-3 py-2" scope="col">Date</th>
            <th className="px-3 py-2" scope="col">Day</th>
            <th className="px-3 py-2" scope="col">Event</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-t border-black/5 dark:border-white/10">
              <td className="px-3 py-2 align-middle">
                <input
                  type="checkbox"
                  id={`${idPrefix}-${e.id}`}
                  name="selected"
                  value={e.id}
                  checked={selected.has(e.id)}
                  onChange={(ev) => onToggle(e.id, ev.currentTarget.checked)}
                  className="h-5 w-5"
                />
              </td>
              <td className="px-3 py-2 align-middle">
                <label htmlFor={`${idPrefix}-${e.id}`}>{rangeLabel(e)}</label>
              </td>
              <td className="px-3 py-2 align-middle opacity-70">{dayLabel(e.startDate)}</td>
              <td className="px-3 py-2 align-middle">
                {e.summary}
                {e.spanDays >= 2 && (
                  <span className="opacity-60"> · {e.spanDays} days</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Replace the inline `<ul>` renderings with the new components**

Three places in the component currently render event rows inline. Replace each with the appropriate component call, which picks list vs. table from `view`.

**(a) Missed events section** — replace the inner `<ul>` from Task 5 with:

```tsx
{view === "table" ? (
  <EventTableRows
    events={payload.missed}
    selected={selected}
    onToggle={toggleEvent}
    idPrefix="miss"
  />
) : (
  <EventListRows
    events={payload.missed}
    selected={selected}
    onToggle={toggleEvent}
    idPrefix="miss"
  />
)}
```

**(b) One-off section** — replace the entire `<ul>…</ul>` block with:

```tsx
{view === "table" ? (
  <EventTableRows
    events={payload.oneOffs}
    selected={selected}
    onToggle={toggleEvent}
    idPrefix="ev"
  />
) : (
  <EventListRows
    events={payload.oneOffs}
    selected={selected}
    onToggle={toggleEvent}
    idPrefix="ev"
  />
)}
```

**(c) Recurring series — instances inside an expanded series** — the series header card (summary, N instances, Hide/Instances button, series-level "pick all" checkbox) stays as it is in both modes. ONLY the inner expanded instance list switches to the table layout. Inside the series `<li>`, replace the `isOpen && ( <ul>…</ul> )` block with:

```tsx
{isOpen && (
  <div className="border-t border-black/10 p-3 dark:border-white/10">
    {view === "table" ? (
      <EventTableRows
        events={s.instances}
        selected={selected}
        onToggle={toggleEvent}
        idPrefix={`inst-${s.seriesId}`}
      />
    ) : (
      <ul className="flex flex-col gap-1 pl-7">
        {s.instances.map((inst) => (
          <li key={inst.id} className="flex items-center gap-3">
            <input
              type="checkbox"
              id={`inst-${inst.id}`}
              name="selected"
              value={inst.id}
              checked={selected.has(inst.id)}
              onChange={(ev) => toggleEvent(inst.id, ev.currentTarget.checked)}
              className="h-4 w-4"
            />
            <label htmlFor={`inst-${inst.id}`} className="text-sm opacity-80">
              {rangeLabel(inst)}
            </label>
          </li>
        ))}
      </ul>
    )}
  </div>
)}
```

The hidden-input preservation block (`!isOpen && s.instances.filter(…).map(…)`) stays as-is — it still carries selected instance ids even when the panel is collapsed.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 6: Browser smoke check**

With the dev server running:
- Open the review page. The toolbar row shows `[≡ List] [▦ Table]` on the right and section counts on the left.
- Click Table. All three sections (missed, one-off, and any expanded series instances) switch to the four-column table layout. Series header cards remain cards.
- Reload the page. The table mode persists.
- Click List to go back. Reload — list mode persists.
- Tick a few events in each mode, submit, and confirm the server-side import sees the same selection (confirm via the success count on the redirect).

- [ ] **Step 7: Commit**

```bash
git add components/availability/import-review.tsx
git commit -m "Import review: add list/table toggle persisted in localStorage

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Database migration for `website_url` and `sound_description`

**Files:**
- Create: `supabase/migrations/20261101000200_band_website_and_sound.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20261101000200_band_website_and_sound.sql`:

```sql
-- =============================================================================
-- MIGRATION: Band EPK — website URL + sound description
--
-- Adds two nullable text columns on `bands`:
--   * website_url       — the band's own site (bandcamp, squarespace, …).
--                         Surfaced as a public chip on the EPK alongside the
--                         existing social links.
--   * sound_description — longer-form free text (several paragraphs) about
--                         what the band sounds like. Rendered as its own
--                         section on the public EPK below the hero.
--
-- Row-level security on `bands` already covers both columns (admin-write,
-- public-read), so no policy changes are needed.
-- =============================================================================

ALTER TABLE public.bands
  ADD COLUMN IF NOT EXISTS website_url       TEXT,
  ADD COLUMN IF NOT EXISTS sound_description TEXT;
```

- [ ] **Step 2: Lint the SQL by eye**

Open the file. Confirm:
- Timestamp prefix `20261101000200` is unique against every other file in `supabase/migrations/` (`ls supabase/migrations/` — expect no other file starting with `20261101000200`).
- Columns use `IF NOT EXISTS` so a re-run is a no-op.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20261101000200_band_website_and_sound.sql
git commit -m "Add bands.website_url and bands.sound_description columns

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

The GitHub Actions workflow applies this to Supabase on push to master. For local dev, if a linked Supabase CLI is available, `npm run db:push` applies it against the dev project; otherwise, paste the SQL into the Supabase dashboard SQL editor.

---

## Task 8: Extend the `bands` type definitions

**Files:**
- Modify: `types/database.types.ts`

- [ ] **Step 1: Add fields to the three `bands` shapes**

Open `types/database.types.ts`. The `bands` entry has three nested shapes: `Row`, `Insert`, `Update`. Add the two new fields to each.

In the `Row` shape (where `linktree_url: string | null;` lives), add two lines directly after `linktree_url`:

```ts
          linktree_url: string | null;
          website_url: string | null;
          sound_description: string | null;
```

In the `Insert` shape, mirror it (optional, nullable):

```ts
          linktree_url?: string | null;
          website_url?: string | null;
          sound_description?: string | null;
```

Do the same in the `Update` shape:

```ts
          linktree_url?: string | null;
          website_url?: string | null;
          sound_description?: string | null;
```

Nothing else in `types/database.types.ts` or `types/index.ts` changes — `Band = Tables<"bands">` and `PublicEpk = Band & { … }` pick up the new fields automatically from the `Row` edit.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: no errors (and no "property does not exist" complaints from the later tasks referencing these fields, since they aren't written yet).

- [ ] **Step 3: Commit**

```bash
git add types/database.types.ts
git commit -m "Types: hand-add website_url + sound_description to bands shapes

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

A later `npm run db:types` regen will produce the same shape.

---

## Task 9: Band settings form — website input, sound textarea, writing tips

**Files:**
- Modify: `components/bands/band-settings-form.tsx`

- [ ] **Step 1: Add the Writing-tips panel at the top of the form**

In `components/bands/band-settings-form.tsx`, inside the `<form>` and above the "Band name" `<label>`, add:

```tsx
<details className="rounded-xl border border-dashed border-black/15 bg-black/5 p-3 text-sm dark:border-white/20 dark:bg-white/5">
  <summary className="cursor-pointer font-semibold">Writing tips for your EPK</summary>
  <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 opacity-80">
    <li>
      Lead with the <em>feel</em>. "Dirty garage rock" beats "we play rock music."
    </li>
    <li>Name two or three touchstones ("…for fans of X and Y").</li>
    <li>What's the live show like — loud, intimate, dancey, spectacle?</li>
    <li>Who's in the band and what instruments?</li>
    <li>One memorable line a booker could paste into a flyer.</li>
  </ul>
</details>
```

- [ ] **Step 2: Add the Sound textarea below the Bio textarea**

Find the existing `Short bio` label block. Directly after its closing `</label>` tag and before the `<fieldset className="flex flex-col gap-3"><legend className="text-sm font-medium">Streaming</legend>…` block, add:

```tsx
<label className="flex flex-col gap-1.5 text-sm font-medium">
  Sound
  <textarea
    name="sound_description"
    rows={6}
    maxLength={2000}
    defaultValue={band.sound_description ?? ""}
    placeholder="What does your band sound like? A few sentences or paragraphs — see the tips above."
    className={input + " min-h-[9rem] resize-y"}
  />
</label>
```

- [ ] **Step 3: Add the Website input to the Social fieldset**

Inside the `<fieldset><legend>Social</legend><div className="grid gap-4 sm:grid-cols-2">…</div></fieldset>` block, extend the grid to three columns on larger screens and add the Website input as the first child inside the grid:

Change the grid wrapper from:

```tsx
<div className="grid gap-4 sm:grid-cols-2">
```

to:

```tsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
```

Then add this new label as the FIRST child inside that grid (before Instagram):

```tsx
<label className="flex flex-col gap-1.5 text-sm font-medium">
  Website
  <input
    name="website_url"
    type="url"
    maxLength={300}
    defaultValue={band.website_url ?? ""}
    placeholder="https://yourband.com"
    className={input}
  />
</label>
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: no errors (relies on Task 8 having added `website_url` and `sound_description` to the `Band` type).

- [ ] **Step 5: Commit**

```bash
git add components/bands/band-settings-form.tsx
git commit -m "Band settings form: writing tips panel, Sound textarea, Website input

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: Server action reads + persists the two new fields

**Files:**
- Modify: `app/dashboard/bands/actions.ts`

- [ ] **Step 1: Read the two new fields from `formData`**

In `app/dashboard/bands/actions.ts`, locate the `updateBand` function. Inside the block of `const … = String(formData.get("…") ?? "").trim() || null;` reads, add two new lines next to the other optional URL / text fields. Place them right after the `const linktreeUrl = …;` line:

```ts
  const websiteUrl = String(formData.get("website_url") ?? "").trim() || null;
  const soundDescription = String(formData.get("sound_description") ?? "").trim() || null;
```

- [ ] **Step 2: Pass the two fields into the Supabase update object**

A few lines further down, inside the `.update({ … })` call, append the new fields alongside the other URL columns. Insert them between `linktree_url: linktreeUrl,` and `avg_local_draw: avgLocalDraw,`:

```ts
      linktree_url: linktreeUrl,
      website_url: websiteUrl,
      sound_description: soundDescription,
      avg_local_draw: avgLocalDraw,
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: no errors. If TS complains that `website_url` or `sound_description` is not assignable to the Update shape, re-check Task 8 — the `Update` shape needs both as optional nullable fields.

- [ ] **Step 4: Browser smoke check (local DB only)**

If you have a local Supabase project with the migration applied (`npm run db:push`), sign in, visit `/dashboard/bands/<a-band-you-admin>`, fill in Website + Sound, submit, and reload. Both values should persist. If you only have the prod DB and the migration has not yet merged, skip to Task 12's QA pass instead.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/bands/actions.ts
git commit -m "updateBand: persist website_url + sound_description from form

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 11: Public EPK — render Sound section + Website chip

**Files:**
- Modify: `app/bands/[slug]/page.tsx`

- [ ] **Step 1: Render the Sound section**

In `app/bands/[slug]/page.tsx`, locate the existing bio render:

```tsx
{band.bio && <p className="whitespace-pre-line text-lg leading-relaxed">{band.bio}</p>}
```

Directly below that line (above the streaming embeds `{(spotify || appleMusic || youtube) && (…)}` block), add:

```tsx
{band.sound_description && (
  <section className="flex flex-col gap-2">
    <h2 className="text-xl font-semibold tracking-tight">Sound</h2>
    <p className="whitespace-pre-line text-base leading-relaxed opacity-90">
      {band.sound_description}
    </p>
  </section>
)}
```

- [ ] **Step 2: Add Website chip to the social-links row**

Find the `<section className="flex flex-wrap gap-2">` block that renders the Spotify / Apple Music / YouTube / Instagram / Linktree chips. Extend its outer conditional and add the Website chip at the top.

Change the outer conditional from:

```tsx
{(band.spotify_url ||
  band.apple_music_url ||
  band.youtube_url ||
  band.instagram_url ||
  band.linktree_url) && (
```

to:

```tsx
{(band.website_url ||
  band.spotify_url ||
  band.apple_music_url ||
  band.youtube_url ||
  band.instagram_url ||
  band.linktree_url) && (
```

Then, directly inside the opening `<section …>` tag, add the Website chip as the first child, before the Spotify block:

```tsx
{band.website_url && (
  <a
    href={band.website_url}
    target="_blank"
    rel="noopener"
    className="rounded-full border border-current/30 px-3 py-1 text-sm hover:border-current"
  >
    Website ↗
  </a>
)}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 4: Browser smoke check**

With dev server running and a band row that has the two new fields populated locally:
- Visit `/bands/<slug>`. A "Sound" header appears below the bio with the paragraph text intact.
- A "Website ↗" chip appears in the social row, linking out in a new tab.
- A band with no website / no sound renders exactly as before (no "Sound" heading, no Website chip, section hides when all other chips are also empty).

- [ ] **Step 5: Commit**

```bash
git add app/bands/[slug]/page.tsx
git commit -m "Public EPK: render Sound section and Website chip when present

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 12: Final verification + push + PR

**Files:** none modified; verification only.

- [ ] **Step 1: Final typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 2: Full-tree build**

```bash
npm run build
```
Expected: build succeeds with no new warnings beyond those already present on master. If Next flags "Module not found" or "Property does not exist on type Band", go back to the task that introduced the import or field.

- [ ] **Step 3: Manual QA matrix**

With `npm run dev` running and a signed-in admin account:

- Dashboard
  - [ ] `/dashboard` renders. Nav visible. "My band(s)" link label matches the user's band count.
- Explore
  - [ ] `/explore` renders, nav visible. Signed-out variant also renders the nav (sign out and revisit).
  - [ ] `/bands/<slug>` still has NO nav (public).
- Import review (requires Google OAuth to be working — if the vault-migration PR is still pending, this step is deferred)
  - [ ] Missed events block is at the top, open by default.
  - [ ] List/Table toggle works; preference survives a reload.
  - [ ] Importing a few events shows the correct success toast on `/dashboard/availability`.
- EPK admin
  - [ ] Writing-tips panel toggles open/closed.
  - [ ] Save Website URL + Sound. Reload the admin page — both persist.
- EPK public
  - [ ] `/bands/<slug>` shows a Sound section below the bio when `sound_description` is set.
  - [ ] Website chip renders when `website_url` is set and links out.

- [ ] **Step 4: Push the branch**

```bash
git push -u origin feat/nav-import-review-epk
```

- [ ] **Step 5: Open the PR**

If `gh` is available on the machine, open the PR via CLI; otherwise visit the URL printed by the push command. PR body template:

```
## Summary
- Share a sticky top nav across /dashboard and /explore via a new <AppHeader>. Add a "My band(s)" link whose label matches the viewer's membership count.
- Import review: float the missed-events block to the top (auto-expanded) and add a List/Table toggle persisted in localStorage.
- EPK: new `bands.website_url` and `bands.sound_description` columns, wired through the admin form, the server action, and the public page. Admin form also gets a collapsible Writing tips panel.

## Test plan
- [ ] /dashboard renders unchanged visually; "My band(s)" label matches count
- [ ] /explore keeps the nav for signed-in and signed-out viewers
- [ ] /bands/<slug> stays layout-less for anonymous viewers
- [ ] Import review page: missed events on top, auto-expanded; List/Table toggle persists
- [ ] Admin: Writing tips expands; Website + Sound save and reload
- [ ] Public EPK: Sound section renders below bio when present; Website chip appears first in social row

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

- [ ] **Step 6: Watch the migration workflow**

Once merged to master, confirm the `.github/workflows/db-migrate.yml` run finishes green. If it fails, inspect the Actions log and re-run `supabase db push` locally against the linked project to see which migration tripped it.

---

## Done

Tasks 1–12 cover every bullet in the design spec. Spec sections map to tasks as follows:

| Spec section | Covered by |
| :--- | :--- |
| A — Shared app header component | Task 2 |
| A — Dashboard layout rewire + band count | Task 3 |
| A — Explore layout + page shell cleanup | Task 4 |
| A — `buildTag` lifted to helper | Task 1 |
| B — Missed events to the top, auto-expanded | Task 5 |
| B — List/table toggle with localStorage persistence | Task 6 |
| C — Schema migration | Task 7 |
| C — Types hand-edit | Task 8 |
| C — Admin form (Writing tips, Sound, Website) | Task 9 |
| C — `updateBand` persists both fields | Task 10 |
| C — Public EPK rendering (Sound + Website chip) | Task 11 |
| Rollout + PR | Task 12 |
