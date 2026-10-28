# Stage Plot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a top-down stage plot editor on the band dashboard, a public SVG render on the EPK, and a print-friendly route for Save-as-PDF — per [the design spec](../specs/2026-10-24-stage-plot-design.md).

**Architecture:** Single `bands.stage_plot` JSONB column holding the whole document. A shared Zod schema in `types/stage-plot.ts` is the source of truth for the shape. A pure `StagePlotRenderer` component draws the SVG; it's reused by the editor canvas, the public EPK section, and the print route. The editor is a client component with raw pointer events (no drag library). Autosave debounced 2s → one Server Action → one UPDATE on `bands`.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind 4, Supabase (via `@supabase/ssr`), TypeScript strict, Zod (new dependency), sonner (already installed) for toasts.

**File inventory (what each task touches):**

| File | Role |
| :--- | :--- |
| `supabase/migrations/20261031000000_stage_plot.sql` | adds `bands.stage_plot JSONB` |
| `types/database.types.ts` | regenerated after migration |
| `types/stage-plot.ts` | Zod schema, type exports, kind constants, helpers |
| `components/stage-plot/icon.tsx` | SVG icon per `kind` |
| `components/stage-plot/renderer.tsx` | pure read-only canvas |
| `components/stage-plot/input-list-view.tsx` | pure read-only input-list table |
| `components/stage-plot/editor.tsx` | client editor (tray, canvas, input list, autosave) |
| `components/stage-plot/mobile-nudge.tsx` | the "open on a larger screen" card |
| `components/bands/band-subnav.tsx` | add a "Stage plot" tab |
| `app/dashboard/bands/[bandId]/stage-plot/page.tsx` | admin-guarded editor route |
| `app/dashboard/bands/[bandId]/stage-plot/actions.ts` | `saveStagePlot` Server Action |
| `app/bands/[slug]/page.tsx` | add Stage plot section + print link |
| `app/bands/[slug]/stage-plot/page.tsx` | print-friendly route |
| `package.json` | add `zod` |

Project norm: no test framework yet. Verification = `npm run typecheck` + manual dev-server checks (`npm run dev`, listening on `http://localhost:3001`). Each task ends with a commit.

---

## Task 1: Add zod dependency

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (regenerated)

- [ ] **Step 1: Install zod**

Run from the repo root:

```bash
npm install zod
```

Expected: `package.json` gains a `"zod": "^3.x.x"` entry under `dependencies` and `package-lock.json` is updated. No peer-dep warnings.

- [ ] **Step 2: Verify typecheck still passes**

```bash
npm run typecheck
```

Expected: exits 0 with no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add zod dependency for stage plot schema"
```

---

## Task 2: Database migration — `bands.stage_plot` column

**Files:**
- Create: `supabase/migrations/20261031000000_stage_plot.sql`
- Modify: `types/database.types.ts` (via `npm run db:types`)

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20261031000000_stage_plot.sql`:

```sql
-- =============================================================================
-- MIGRATION 13: Stage plot
--
-- Adds a nullable JSONB column on `bands` to hold the whole stage-plot
-- document (icons + input list). No new RLS: existing bands policies
-- cover it — admins write via the saveStagePlot Server Action, public
-- read via the EPK. Zod validates the blob at the Server Action boundary.
-- =============================================================================

ALTER TABLE public.bands
  ADD COLUMN IF NOT EXISTS stage_plot JSONB;

COMMENT ON COLUMN public.bands.stage_plot IS
  'Stage plot document (icons + input list). Shape defined by Zod schema in types/stage-plot.ts. Null = never created.';
```

- [ ] **Step 2: Apply the migration locally**

```bash
npm run db:push
```

Expected: Supabase CLI reports the migration applied. If this is a fresh clone, follow the setup section of [README.md](../../../README.md) first (link the project).

- [ ] **Step 3: Regenerate `types/database.types.ts`**

```bash
npm run db:types
```

Expected: `types/database.types.ts` is overwritten. Open it and confirm the `bands` table's `Row` type now has `stage_plot: Json | null`.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261031000000_stage_plot.sql types/database.types.ts
git commit -m "Add bands.stage_plot JSONB column

Nullable column holds the stage plot document (icons + input list).
Shape validated by Zod at the Server Action boundary — no new RLS."
```

---

## Task 3: Shared schema and types (`types/stage-plot.ts`)

**Files:**
- Create: `types/stage-plot.ts`

- [ ] **Step 1: Write the schema file**

Create `types/stage-plot.ts`:

```ts
import { z } from "zod";

// The full set of icon kinds. Order matters for display in the gear tray.
export const ICON_KINDS = [
  "drum_kit",
  "bass_cab",
  "bass_guitar",
  "guitar_cab",
  "guitar",
  "keys",
  "vocal_mic",
  "instrument_mic",
  "monitor_wedge",
  "di_box",
  "power",
  "riser",
  "person",
  "label",
] as const;

export type IconKind = (typeof ICON_KINDS)[number];

// Kinds that show up in the gear tray (everything except person/label — those
// come from the roster section and the Guest/Label slots respectively).
export const GEAR_KINDS: IconKind[] = [
  "drum_kit",
  "bass_cab",
  "bass_guitar",
  "guitar_cab",
  "guitar",
  "keys",
  "vocal_mic",
  "instrument_mic",
  "monitor_wedge",
  "di_box",
  "power",
  "riser",
];

// Kinds that trigger the "Add to input list?" nudge when dropped.
export const INPUT_LIKE_KINDS: IconKind[] = ["vocal_mic", "instrument_mic", "di_box"];

// Human labels used in trays and nudges.
export const KIND_LABELS: Record<IconKind, string> = {
  drum_kit: "Drum kit",
  bass_cab: "Bass cab",
  bass_guitar: "Bass guitar",
  guitar_cab: "Guitar cab",
  guitar: "Guitar",
  keys: "Keys",
  vocal_mic: "Vocal mic",
  instrument_mic: "Instrument mic",
  monitor_wedge: "Monitor wedge",
  di_box: "DI box",
  power: "Power",
  riser: "Riser",
  person: "Person",
  label: "Label",
};

export const stagePlotItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(ICON_KINDS),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  label: z.string().max(80).optional(),
  member_id: z.string().uuid().optional(),
});

export const inputListRowSchema = z.object({
  id: z.string().min(1),
  channel: z.number().int().min(1).max(99),
  source: z.string().max(80),
  mic: z.string().max(80),
  phantom: z.boolean(),
  notes: z.string().max(160).optional(),
});

export const stagePlotSchema = z.object({
  version: z.literal(1),
  items: z.array(stagePlotItemSchema).max(60),
  input_list: z.array(inputListRowSchema).max(48),
});

export type StagePlotItem = z.infer<typeof stagePlotItemSchema>;
export type InputListRow = z.infer<typeof inputListRowSchema>;
export type StagePlot = z.infer<typeof stagePlotSchema>;

export const EMPTY_STAGE_PLOT: StagePlot = {
  version: 1,
  items: [],
  input_list: [],
};

/**
 * Parse an unknown value (e.g. `bands.stage_plot` which is `Json | null`) into
 * a valid StagePlot, or return EMPTY_STAGE_PLOT if the value is null/malformed.
 * The editor and all renderers use this so a corrupt or legacy blob never
 * crashes the page.
 */
export function parseStagePlot(raw: unknown): StagePlot {
  if (raw == null) return EMPTY_STAGE_PLOT;
  const result = stagePlotSchema.safeParse(raw);
  return result.success ? result.data : EMPTY_STAGE_PLOT;
}

export function isPersonItem(item: StagePlotItem): boolean {
  return item.kind === "person";
}

/** Next unused channel number for a new input-list row. */
export function nextChannel(rows: InputListRow[]): number {
  if (rows.length === 0) return 1;
  return Math.max(...rows.map((r) => r.channel)) + 1;
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add types/stage-plot.ts
git commit -m "Add stage plot Zod schema and types"
```

---

## Task 4: SVG icon component (`components/stage-plot/icon.tsx`)

**Files:**
- Create: `components/stage-plot/icon.tsx`

Simple, mono-color SVG symbols. One switch keyed by `kind`. Each icon fits in a 48×48 viewBox with 4px padding. `currentColor` so icons inherit text color (works in light/dark mode).

- [ ] **Step 1: Write the icon component**

Create `components/stage-plot/icon.tsx`:

```tsx
import type { IconKind } from "@/types/stage-plot";

type Props = {
  kind: IconKind;
  size?: number;
  className?: string;
};

/**
 * Minimal mono-color SVG per icon kind. Uses `currentColor` so parents can
 * theme via `text-...` Tailwind classes. 48x48 viewBox; `size` sets rendered
 * dimension (defaults to 48).
 */
export function StageIcon({ kind, size = 48, className }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 48 48",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  switch (kind) {
    case "drum_kit":
      return (
        <svg {...common}>
          <ellipse cx="24" cy="30" rx="12" ry="4" />
          <line x1="12" y1="30" x2="12" y2="40" />
          <line x1="36" y1="30" x2="36" y2="40" />
          <circle cx="12" cy="14" r="5" />
          <circle cx="36" cy="14" r="5" />
        </svg>
      );
    case "bass_cab":
      return (
        <svg {...common}>
          <rect x="8" y="8" width="32" height="32" rx="2" />
          <circle cx="24" cy="26" r="8" />
        </svg>
      );
    case "guitar_cab":
      return (
        <svg {...common}>
          <rect x="8" y="8" width="32" height="32" rx="2" />
          <circle cx="16" cy="20" r="5" />
          <circle cx="32" cy="20" r="5" />
          <circle cx="16" cy="34" r="5" />
          <circle cx="32" cy="34" r="5" />
        </svg>
      );
    case "bass_guitar":
    case "guitar":
      return (
        <svg {...common}>
          <circle cx="18" cy="34" r="8" />
          <line x1="24" y1="30" x2="40" y2="10" />
          <line x1="38" y1="8" x2="42" y2="12" />
        </svg>
      );
    case "keys":
      return (
        <svg {...common}>
          <rect x="6" y="14" width="36" height="20" rx="1" />
          <line x1="14" y1="14" x2="14" y2="28" />
          <line x1="22" y1="14" x2="22" y2="28" />
          <line x1="30" y1="14" x2="30" y2="28" />
          <line x1="38" y1="14" x2="38" y2="28" />
        </svg>
      );
    case "vocal_mic":
      return (
        <svg {...common}>
          <circle cx="24" cy="14" r="6" />
          <line x1="24" y1="20" x2="24" y2="36" />
          <line x1="18" y1="36" x2="30" y2="36" />
          <line x1="24" y1="36" x2="24" y2="42" />
        </svg>
      );
    case "instrument_mic":
      return (
        <svg {...common}>
          <rect x="18" y="8" width="12" height="8" rx="2" />
          <line x1="24" y1="16" x2="24" y2="40" />
          <line x1="18" y1="40" x2="30" y2="40" />
        </svg>
      );
    case "monitor_wedge":
      return (
        <svg {...common}>
          <polygon points="6,34 42,34 36,16 12,16" />
          <circle cx="24" cy="26" r="4" />
        </svg>
      );
    case "di_box":
      return (
        <svg {...common}>
          <rect x="12" y="16" width="24" height="16" rx="2" />
          <circle cx="18" cy="24" r="2" />
          <circle cx="30" cy="24" r="2" />
        </svg>
      );
    case "power":
      return (
        <svg {...common}>
          <rect x="8" y="18" width="32" height="12" rx="2" />
          <circle cx="16" cy="24" r="1.5" />
          <circle cx="24" cy="24" r="1.5" />
          <circle cx="32" cy="24" r="1.5" />
        </svg>
      );
    case "riser":
      return (
        <svg {...common}>
          <rect x="6" y="20" width="36" height="18" rx="1" />
          <line x1="6" y1="26" x2="42" y2="26" />
        </svg>
      );
    case "person":
      return (
        <svg {...common}>
          <circle cx="24" cy="14" r="6" />
          <path d="M12 42 C12 32 36 32 36 42" />
        </svg>
      );
    case "label":
      return (
        <svg {...common}>
          <rect x="6" y="14" width="36" height="20" rx="2" />
        </svg>
      );
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add components/stage-plot/icon.tsx
git commit -m "Add stage plot icon component"
```

---

## Task 5: Read-only renderer (`components/stage-plot/renderer.tsx`)

**Files:**
- Create: `components/stage-plot/renderer.tsx`

A `<div>` with 16:9 aspect ratio. Stage background rendered via a child `<svg>` (border + "Crowd" label). Items are absolute-positioned `<div>` children, each containing a `StageIcon` and (if `label` is set) a caption below. Pure read-only — no interactions. Used by the EPK section, print route, and (visually) the editor canvas.

- [ ] **Step 1: Write the renderer**

Create `components/stage-plot/renderer.tsx`:

```tsx
import type { StagePlot } from "@/types/stage-plot";
import { KIND_LABELS } from "@/types/stage-plot";
import { StageIcon } from "./icon";

type Props = {
  plot: StagePlot;
  /** When true, draws a dashed guide grid (editor only). */
  showGuides?: boolean;
};

/**
 * Read-only renderer. 16:9 aspect ratio. Items are positioned by their
 * normalized (x, y) coords with 0,0 at the top-left and 1,1 at the
 * bottom-right. "Crowd" label is baked in at the bottom edge.
 */
export function StagePlotRenderer({ plot, showGuides = false }: Props) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-black/15 bg-paper dark:border-white/15"
      style={{ aspectRatio: "16 / 9" }}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 160 90"
        preserveAspectRatio="none"
        aria-hidden
      >
        {showGuides && (
          <>
            <line x1="40" y1="0" x2="40" y2="90" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="2 2" />
            <line x1="80" y1="0" x2="80" y2="90" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="2 2" />
            <line x1="120" y1="0" x2="120" y2="90" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="2 2" />
            <line x1="0" y1="30" x2="160" y2="30" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="2 2" />
            <line x1="0" y1="60" x2="160" y2="60" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="2 2" />
          </>
        )}
      </svg>

      {plot.items.map((item) => {
        const captionLabel = item.label ?? (item.kind === "label" ? "" : KIND_LABELS[item.kind]);
        return (
          <div
            key={item.id}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
            style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%` }}
          >
            <StageIcon kind={item.kind} size={36} />
            {captionLabel && (
              <span className="whitespace-nowrap rounded bg-paper/80 px-1 text-[10px] font-medium leading-tight backdrop-blur-sm dark:bg-black/40">
                {captionLabel}
              </span>
            )}
          </div>
        );
      })}

      <div className="pointer-events-none absolute inset-x-0 bottom-1.5 text-center text-[11px] font-semibold uppercase tracking-widest opacity-60">
        ─── Crowd ───
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add components/stage-plot/renderer.tsx
git commit -m "Add read-only stage plot renderer"
```

---

## Task 6: Read-only input list view (`components/stage-plot/input-list-view.tsx`)

**Files:**
- Create: `components/stage-plot/input-list-view.tsx`

- [ ] **Step 1: Write the component**

Create `components/stage-plot/input-list-view.tsx`:

```tsx
import type { InputListRow } from "@/types/stage-plot";

type Props = { rows: InputListRow[] };

/**
 * Read-only input list table for the public EPK and the print route.
 * Rows are rendered in channel-ascending order regardless of input order.
 */
export function InputListView({ rows }: Props) {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => a.channel - b.channel);

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-black/15 text-left text-xs uppercase tracking-wide opacity-60 dark:border-white/15">
          <th className="w-10 py-1.5 pr-2">Ch</th>
          <th className="py-1.5 pr-2">Source</th>
          <th className="py-1.5 pr-2">Mic / DI</th>
          <th className="w-16 py-1.5 pr-2">+48V</th>
          <th className="py-1.5">Notes</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => (
          <tr key={row.id} className="border-b border-black/5 dark:border-white/5">
            <td className="py-1.5 pr-2 font-mono tabular-nums">{row.channel}</td>
            <td className="py-1.5 pr-2">{row.source}</td>
            <td className="py-1.5 pr-2">{row.mic}</td>
            <td className="py-1.5 pr-2">{row.phantom ? "Yes" : "—"}</td>
            <td className="py-1.5 opacity-70">{row.notes ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add components/stage-plot/input-list-view.tsx
git commit -m "Add read-only input list view"
```

---

## Task 7: Public EPK section (modify `app/bands/[slug]/page.tsx`)

**Files:**
- Modify: `app/bands/[slug]/page.tsx`

The band row already includes `stage_plot` since `getPublicEpk` selects `*`. Parse it and render a new section when it's non-empty.

- [ ] **Step 1: Add imports and parse the plot**

Open `app/bands/[slug]/page.tsx`. At the top with the other imports, add:

```tsx
import { parseStagePlot } from "@/types/stage-plot";
import { StagePlotRenderer } from "@/components/stage-plot/renderer";
import { InputListView } from "@/components/stage-plot/input-list-view";
```

Inside `BandEpkPage` (after `const band = await getPublicEpk(slug);` and the null guard), add:

```tsx
const plot = parseStagePlot(band.stage_plot);
const hasPlot = plot.items.length > 0;
```

- [ ] **Step 2: Add the Stage plot section**

Place this new section between the existing header/embeds and the open-dates section (match the existing section styling — look at how other sections wrap in `<section className="flex flex-col gap-3">`). Insert:

```tsx
{hasPlot && (
  <section className="flex flex-col gap-3">
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-xl font-semibold tracking-tight">Stage plot</h2>
      <a
        href={`/bands/${band.slug}/stage-plot`}
        className="text-xs font-semibold opacity-70 hover:opacity-100"
      >
        Printable version →
      </a>
    </div>
    <StagePlotRenderer plot={plot} />
    {plot.input_list.length > 0 && (
      <div className="mt-2 overflow-x-auto">
        <InputListView rows={plot.input_list} />
      </div>
    )}
  </section>
)}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 4: Manual verification (seed data by hand to confirm renderer works)**

Run the dev server:

```bash
npm run dev
```

In a separate terminal, open the Supabase SQL editor (or `psql`) and run against your local project (replace `<band_id>` with any band id from `select id, slug from bands limit 5;`):

```sql
UPDATE public.bands
SET stage_plot = '{
  "version": 1,
  "items": [
    { "id": "a1", "kind": "drum_kit", "x": 0.5, "y": 0.3 },
    { "id": "a2", "kind": "guitar_cab", "x": 0.2, "y": 0.3 },
    { "id": "a3", "kind": "bass_cab", "x": 0.8, "y": 0.3 },
    { "id": "a4", "kind": "vocal_mic", "x": 0.5, "y": 0.7, "label": "Lead vox" }
  ],
  "input_list": [
    { "id": "r1", "channel": 1, "source": "Kick", "mic": "Beta 52", "phantom": false },
    { "id": "r2", "channel": 2, "source": "Snare", "mic": "SM57", "phantom": false },
    { "id": "r3", "channel": 3, "source": "Lead vox", "mic": "SM58", "phantom": false }
  ]
}'::jsonb
WHERE id = '<band_id>';
```

Visit `http://localhost:3001/bands/<slug>` for that band. Expected: a "Stage plot" section renders a 16:9 canvas with four icons positioned correctly, "Crowd" label at the bottom, and the input list table below.

Clear the test data when done:

```sql
UPDATE public.bands SET stage_plot = NULL WHERE id = '<band_id>';
```

- [ ] **Step 5: Commit**

```bash
git add app/bands/[slug]/page.tsx
git commit -m "Render stage plot section on public EPK"
```

---

## Task 8: Print route (`app/bands/[slug]/stage-plot/page.tsx`)

**Files:**
- Create: `app/bands/[slug]/stage-plot/page.tsx`

- [ ] **Step 1: Create the route**

Create `app/bands/[slug]/stage-plot/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicEpk } from "@/lib/epk";
import { parseStagePlot } from "@/types/stage-plot";
import { StagePlotRenderer } from "@/components/stage-plot/renderer";
import { InputListView } from "@/components/stage-plot/input-list-view";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const band = await getPublicEpk(slug);
  return { title: band ? `${band.name} — Stage plot` : "Band not found" };
}

export default async function StagePlotPrintPage({ params }: Props) {
  const { slug } = await params;
  const band = await getPublicEpk(slug);
  if (!band) notFound();

  const plot = parseStagePlot(band.stage_plot);
  if (plot.items.length === 0) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">{band.name}</h1>
        <p className="opacity-60">No stage plot available.</p>
      </main>
    );
  }

  return (
    <main className="print-root mx-auto flex max-w-[8.5in] flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{band.name}</h1>
        <p className="text-sm opacity-70">Stage plot — {band.home_city}</p>
      </header>

      <StagePlotRenderer plot={plot} />

      {plot.input_list.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">Input list</h2>
          <InputListView rows={plot.input_list} />
        </section>
      )}

      <style>{`
        @media print {
          @page { size: letter portrait; margin: 0.5in; }
          body { background: white !important; }
          .print-root { max-width: 100% !important; padding: 0 !important; }
          header + div { page-break-inside: avoid; }
        }
      `}</style>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Manual verification**

Seed the band's `stage_plot` as in Task 7 Step 4 if you haven't. Visit `http://localhost:3001/bands/<slug>/stage-plot`. Expected: minimal page with band name, 16:9 renderer, input list below. Hit Ctrl+P and inspect "Save as PDF" preview — a letter-portrait page with the plot filling the top and no site chrome.

- [ ] **Step 4: Commit**

```bash
git add app/bands/[slug]/stage-plot/page.tsx
git commit -m "Add print-friendly stage plot route"
```

---

## Task 9: Server Action — `saveStagePlot`

**Files:**
- Create: `app/dashboard/bands/[bandId]/stage-plot/actions.ts`

- [ ] **Step 1: Write the action**

Create `app/dashboard/bands/[bandId]/stage-plot/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUserId } from "@/utils/supabase/server";
import { stagePlotSchema } from "@/types/stage-plot";
import type { ActionResult } from "@/types";

/**
 * Persist a stage plot for a band. The action verifies the caller is an
 * admin of the band, Zod-validates the incoming blob, then writes it in
 * a single UPDATE. Idempotent: callers may invoke this on every autosave.
 */
export async function saveStagePlot(
  bandId: string,
  plot: unknown,
): Promise<ActionResult> {
  const userId = await requireUserId(`/dashboard/bands/${bandId}/stage-plot`);
  const supabase = await createClient();

  const { data: member, error: memberErr } = await supabase
    .from("band_members")
    .select("is_admin")
    .eq("band_id", bandId)
    .eq("profile_id", userId)
    .maybeSingle();

  if (memberErr) return { ok: false, error: memberErr.message };
  if (!member || member.is_admin !== true) {
    return { ok: false, error: "Only band admins can edit the stage plot." };
  }

  const parsed = stagePlotSchema.safeParse(plot);
  if (!parsed.success) {
    return { ok: false, error: "The stage plot data looks corrupt. Reload the page." };
  }

  const { error: updateErr } = await supabase
    .from("bands")
    .update({ stage_plot: parsed.data })
    .eq("id", bandId);

  if (updateErr) return { ok: false, error: updateErr.message };

  revalidatePath(`/dashboard/bands/${bandId}/stage-plot`);
  return { ok: true, message: "Saved." };
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/bands/[bandId]/stage-plot/actions.ts
git commit -m "Add saveStagePlot Server Action"
```

---

## Task 10: Mobile nudge component

**Files:**
- Create: `components/stage-plot/mobile-nudge.tsx`

- [ ] **Step 1: Write the nudge**

Create `components/stage-plot/mobile-nudge.tsx`:

```tsx
import Link from "next/link";

type Props = { bandSlug: string };

export function StagePlotMobileNudge({ bandSlug }: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-black/15 bg-paper p-5 text-sm dark:border-white/15">
      <p className="font-medium">
        Stage plot editing needs a larger screen.
      </p>
      <p className="opacity-70">
        Open BandMeld on a tablet or desktop to drag icons onto the stage.
      </p>
      <Link
        href={`/bands/${bandSlug}/stage-plot`}
        className="self-start rounded-full border border-black/15 px-3.5 py-1.5 text-xs font-semibold hover:border-current dark:border-white/20"
      >
        View current plot ↗
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add components/stage-plot/mobile-nudge.tsx
git commit -m "Add mobile nudge card for stage plot editor"
```

---

## Task 11: Editor dashboard page (server component shell)

**Files:**
- Create: `app/dashboard/bands/[bandId]/stage-plot/page.tsx`

Loads the band, roster, and current plot. Renders the mobile nudge at <768px via a Tailwind responsive wrapper. Mounts the client-side editor at ≥768px.

- [ ] **Step 1: Write the page shell**

Create `app/dashboard/bands/[bandId]/stage-plot/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient, requireUserId } from "@/utils/supabase/server";
import { parseStagePlot } from "@/types/stage-plot";
import { BandSubNav } from "@/components/bands/band-subnav";
import { StagePlotMobileNudge } from "@/components/stage-plot/mobile-nudge";
import { StagePlotEditor } from "@/components/stage-plot/editor";

export const metadata: Metadata = { title: "Stage plot" };

export default async function StagePlotEditorPage({
  params,
}: {
  params: Promise<{ bandId: string }>;
}) {
  const { bandId } = await params;
  const userId = await requireUserId(`/dashboard/bands/${bandId}/stage-plot`);
  const supabase = await createClient();

  const [{ data: band, error: bandErr }, { data: members, error: membersErr }] =
    await Promise.all([
      supabase.from("bands").select("*").eq("id", bandId).maybeSingle(),
      supabase
        .from("band_members")
        .select("id, profile_id, role_in_band, is_admin")
        .eq("band_id", bandId),
    ]);

  if (bandErr) throw bandErr;
  if (!band) notFound();
  if (membersErr) throw membersErr;

  const me = members?.find((m) => m.profile_id === userId);
  const viewerIsAdmin = me?.is_admin === true;

  const profileIds = members?.map((m) => m.profile_id) ?? [];
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", profileIds)
    : { data: [] };
  const profileMap = new Map(profiles?.map((p) => [p.id, p.full_name]) ?? []);

  const roster = (members ?? []).map((m) => ({
    member_id: m.profile_id,
    name: profileMap.get(m.profile_id) ?? "Member",
    role: m.role_in_band ?? "",
  }));

  const plot = parseStagePlot(band.stage_plot);

  return (
    <div className="flex flex-col gap-6">
      <BandSubNav
        bandId={band.id}
        bandName={band.name}
        slug={band.slug}
        logoUrl={band.logo_url}
        activeTab="stage-plot"
      />

      {!viewerIsAdmin && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          You&apos;re a member of this band but not an admin. The stage plot is admin-only.
        </p>
      )}

      {viewerIsAdmin && (
        <>
          {/* Mobile nudge */}
          <div className="md:hidden">
            <StagePlotMobileNudge bandSlug={band.slug} />
          </div>
          {/* Editor */}
          <div className="hidden md:block">
            <StagePlotEditor bandId={band.id} roster={roster} initialPlot={plot} />
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Expected: fails because `StagePlotEditor` doesn't exist yet. We'll create it in Task 12. Note the error, continue.

```bash
npm run typecheck
```

- [ ] **Step 3: Commit — hold until editor exists**

Do not commit this task alone — commit together with Task 12 so `master` stays buildable.

---

## Task 12: Editor — tray + canvas with drag-to-move and tray-drop

**Files:**
- Create: `components/stage-plot/editor.tsx`

The editor is one client component. It owns the plot state, handles pointer events for drag-to-move on canvas items, drop-from-tray to create items, and renders the current plot visually. No autosave yet — that's Task 13.

- [ ] **Step 1: Write the editor**

Create `components/stage-plot/editor.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import { StageIcon } from "./icon";
import {
  EMPTY_STAGE_PLOT,
  GEAR_KINDS,
  INPUT_LIKE_KINDS,
  KIND_LABELS,
  type IconKind,
  type StagePlot,
  type StagePlotItem,
} from "@/types/stage-plot";

type RosterEntry = { member_id: string; name: string; role: string };

type Props = {
  bandId: string;
  roster: RosterEntry[];
  initialPlot: StagePlot;
};

type DragState =
  | { kind: "none" }
  | { kind: "canvas"; itemId: string; offsetX: number; offsetY: number }
  | { kind: "tray-gear"; iconKind: IconKind }
  | { kind: "tray-roster"; member: RosterEntry };

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function StagePlotEditor({ bandId, roster, initialPlot }: Props) {
  const [plot, setPlot] = useState<StagePlot>(initialPlot.items ? initialPlot : EMPTY_STAGE_PLOT);
  const [drag, setDrag] = useState<DragState>({ kind: "none" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Members already placed on the canvas (hidden from the roster tray).
  const placedMemberIds = new Set(
    plot.items.filter((i) => i.member_id).map((i) => i.member_id as string),
  );
  const availableRoster = roster.filter((r) => !placedMemberIds.has(r.member_id));

  function updateItem(id: string, patch: Partial<StagePlotItem>) {
    setPlot((p) => ({ ...p, items: p.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  }

  function deleteItem(id: string) {
    setPlot((p) => ({ ...p, items: p.items.filter((i) => i.id !== id) }));
    setSelectedId(null);
  }

  function addItem(item: StagePlotItem) {
    setPlot((p) => ({ ...p, items: [...p.items, item] }));
  }

  function canvasCoords(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    };
  }

  function onItemPointerDown(e: React.PointerEvent, item: StagePlotItem) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(item.id);
    const coords = canvasCoords(e.clientX, e.clientY);
    if (!coords) return;
    setDrag({ kind: "canvas", itemId: item.id, offsetX: coords.x - item.x, offsetY: coords.y - item.y });
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function onCanvasPointerMove(e: React.PointerEvent) {
    if (drag.kind !== "canvas") return;
    const coords = canvasCoords(e.clientX, e.clientY);
    if (!coords) return;
    updateItem(drag.itemId, { x: clamp01(coords.x - drag.offsetX), y: clamp01(coords.y - drag.offsetY) });
  }

  function onCanvasPointerUp(e: React.PointerEvent) {
    const coords = canvasCoords(e.clientX, e.clientY);
    if (drag.kind === "tray-gear" && coords) {
      addItem({ id: newId(), kind: drag.iconKind, x: coords.x, y: coords.y });
    } else if (drag.kind === "tray-roster" && coords) {
      const label = drag.member.role ? `${drag.member.name} — ${drag.member.role}` : drag.member.name;
      addItem({
        id: newId(),
        kind: "person",
        x: coords.x,
        y: coords.y,
        label,
        member_id: drag.member.member_id,
      });
    }
    setDrag({ kind: "none" });
  }

  function onBackgroundClick() {
    setSelectedId(null);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
      e.preventDefault();
      deleteItem(selectedId);
    }
  }

  return (
    <div
      className="grid grid-cols-[180px_1fr_240px] gap-4"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      {/* Tray */}
      <aside className="flex flex-col gap-4 overflow-y-auto">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-60">Gear</h3>
          <ul className="grid grid-cols-3 gap-1.5">
            {GEAR_KINDS.map((kind) => (
              <li key={kind}>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setDrag({ kind: "tray-gear", iconKind: kind });
                  }}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-md border border-black/10 p-1 hover:border-current dark:border-white/15"
                  aria-label={`Drag ${KIND_LABELS[kind]} onto the stage`}
                >
                  <StageIcon kind={kind} size={28} />
                  <span className="text-[9px] leading-tight opacity-70">{KIND_LABELS[kind]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-60">Roster</h3>
          <ul className="flex flex-col gap-1">
            {availableRoster.map((m) => (
              <li key={m.member_id}>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setDrag({ kind: "tray-roster", member: m });
                  }}
                  className="flex w-full items-center gap-2 rounded-md border border-black/10 p-1.5 text-left text-xs hover:border-current dark:border-white/15"
                >
                  <StageIcon kind="person" size={20} />
                  <span>
                    <span className="font-medium">{m.name}</span>
                    {m.role && <span className="opacity-60"> · {m.role}</span>}
                  </span>
                </button>
              </li>
            ))}
            {availableRoster.length === 0 && (
              <li className="text-xs opacity-50">Everyone placed.</li>
            )}
          </ul>
        </div>
      </aside>

      {/* Canvas */}
      <div
        ref={canvasRef}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onPointerLeave={onCanvasPointerUp}
        onClick={onBackgroundClick}
        className="relative w-full overflow-hidden rounded-xl border border-black/15 bg-paper dark:border-white/15"
        style={{ aspectRatio: "16 / 9", touchAction: "none" }}
      >
        {plot.items.map((item) => {
          const captionLabel = item.label ?? (item.kind === "label" ? "" : KIND_LABELS[item.kind]);
          const isSelected = item.id === selectedId;
          return (
            <div
              key={item.id}
              onPointerDown={(e) => onItemPointerDown(e, item)}
              className={`absolute flex -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center gap-0.5 rounded ${
                isSelected ? "ring-2 ring-accent" : ""
              }`}
              style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%`, touchAction: "none" }}
            >
              <StageIcon kind={item.kind} size={36} />
              {captionLabel && (
                <span className="whitespace-nowrap rounded bg-paper/80 px-1 text-[10px] font-medium leading-tight backdrop-blur-sm dark:bg-black/40">
                  {captionLabel}
                </span>
              )}
              {isSelected && (
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteItem(item.id);
                  }}
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white"
                  aria-label="Remove item"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
        <div className="pointer-events-none absolute inset-x-0 bottom-1.5 text-center text-[11px] font-semibold uppercase tracking-widest opacity-60">
          ─── Crowd ───
        </div>
      </div>

      {/* Right rail placeholder — input list panel added in Task 14 */}
      <aside className="rounded-xl border border-dashed border-black/15 p-3 text-xs opacity-50 dark:border-white/15">
        Input list (next task)
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0 (unused `bandId` warning is fine; it'll be used in Task 13).

- [ ] **Step 3: Manual verification**

Start the dev server and navigate to `/dashboard/bands/<bandId>/stage-plot` as an admin. Expected:
- Three-column layout.
- Gear grid in left tray; roster entries listed under it.
- Can drag a gear tile and release over the canvas → an item appears at the drop location.
- Can drag an existing item on the canvas → it follows the cursor and settles.
- Clicking an item selects it (accent ring + × button). Delete key removes it.
- Reload resets the plot (autosave not wired yet — expected).

- [ ] **Step 4: Commit (with Task 11's page)**

```bash
git add app/dashboard/bands/[bandId]/stage-plot/page.tsx components/stage-plot/editor.tsx
git commit -m "Add stage plot editor shell with drag-drop and delete

Admin-only editor page with tray + canvas drag interactions. Roster
entries drop as Person items pinned to member_id. Input list panel
and autosave arrive in follow-up tasks."
```

---

## Task 13: Autosave + save status indicator

**Files:**
- Modify: `components/stage-plot/editor.tsx`

- [ ] **Step 1: Add imports and status state**

In `components/stage-plot/editor.tsx`, add to the top imports:

```tsx
import { useEffect } from "react";
import { toast } from "sonner";
import { saveStagePlot } from "@/app/dashboard/bands/[bandId]/stage-plot/actions";
```

Inside `StagePlotEditor`, after the existing `useState` lines, add:

```tsx
type SaveStatus = "idle" | "saving" | "saved" | "unsaved";
const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
const dirtyRef = useRef(false);
```

(Update the `useRef` import at the top: `import { useEffect, useRef, useState } from "react";`.)

- [ ] **Step 2: Add debounced autosave effect**

Below the existing handler functions (before the `return`), add:

```tsx
// Any state change marks the plot dirty.
useEffect(() => {
  dirtyRef.current = true;
}, [plot]);

useEffect(() => {
  if (!dirtyRef.current) return;
  const timer = setTimeout(async () => {
    dirtyRef.current = false;
    setSaveStatus("saving");

    let lastError: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await saveStagePlot(bandId, plot);
      if (result.ok) {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 2000);
        return;
      }
      lastError = result.error;
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
    setSaveStatus("unsaved");
    toast.error(`Couldn't save: ${lastError ?? "unknown error"}`);
  }, 2000);

  return () => clearTimeout(timer);
}, [plot, bandId]);
```

- [ ] **Step 3: Add the status indicator to the layout**

Wrap the current `grid` div in a vertical flex that holds the indicator above:

Replace the opening `<div className="grid grid-cols-[180px_1fr_240px] gap-4" tabIndex={0} onKeyDown={onKeyDown}>` with:

```tsx
<div className="flex flex-col gap-3" tabIndex={0} onKeyDown={onKeyDown}>
  <div className="flex items-center justify-end text-xs opacity-70">
    {saveStatus === "idle" && <span>&nbsp;</span>}
    {saveStatus === "saving" && <span>Saving…</span>}
    {saveStatus === "saved" && <span>Saved ✓</span>}
    {saveStatus === "unsaved" && (
      <span className="text-red-600">
        Unsaved changes —{" "}
        <button type="button" onClick={() => dirtyRef.current = true} className="underline">
          retry
        </button>
      </span>
    )}
  </div>
  <div className="grid grid-cols-[180px_1fr_240px] gap-4">
```

And add a matching closing `</div>` at the end of the component (two closes instead of one).

Note: the keydown handler needs to move onto the inner grid or the outer flex. Put `tabIndex={0}` and `onKeyDown={onKeyDown}` on the outer flex (as written above). Remove them from the previous grid div.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 5: Manual verification**

Reload the editor, make a change (drag an icon), wait 2 seconds. Expected: "Saving…" → "Saved ✓" (fades after 2s). Reload the page — the plot persists.

Simulate failure: temporarily kill the Supabase connection (e.g., set a bogus `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`, restart `npm run dev`, make a change). Expected: "Saving…" → three retries over ~2s → "Unsaved changes" with a retry button + sonner toast. Restore the env var, click retry.

- [ ] **Step 6: Commit**

```bash
git add components/stage-plot/editor.tsx
git commit -m "Add stage plot autosave with status indicator"
```

---

## Task 14: Input list panel editing

**Files:**
- Modify: `components/stage-plot/editor.tsx`

- [ ] **Step 1: Add input-list state helpers**

In `components/stage-plot/editor.tsx`, below the `addItem` helper, add:

```tsx
function updateRow(id: string, patch: Partial<import("@/types/stage-plot").InputListRow>) {
  setPlot((p) => ({
    ...p,
    input_list: p.input_list.map((r) => (r.id === id ? { ...r, ...patch } : r)),
  }));
}

function deleteRow(id: string) {
  setPlot((p) => ({ ...p, input_list: p.input_list.filter((r) => r.id !== id) }));
}

function addRow() {
  const nextCh = plot.input_list.length === 0
    ? 1
    : Math.max(...plot.input_list.map((r) => r.channel)) + 1;
  setPlot((p) => ({
    ...p,
    input_list: [
      ...p.input_list,
      { id: newId(), channel: nextCh, source: "", mic: "", phantom: false },
    ],
  }));
}
```

- [ ] **Step 2: Replace the placeholder right rail with the input list panel**

Replace the existing `<aside>` placeholder (the one that says "Input list (next task)") with:

```tsx
<aside className="flex flex-col gap-2">
  <h3 className="text-xs font-semibold uppercase tracking-wide opacity-60">Input list</h3>
  <div className="flex flex-col gap-1 overflow-y-auto">
    {plot.input_list.map((row) => (
      <div
        key={row.id}
        className="grid grid-cols-[32px_1fr_28px] gap-1 rounded-md border border-black/10 p-1.5 text-xs dark:border-white/15"
      >
        <input
          type="number"
          min={1}
          max={99}
          value={row.channel}
          onChange={(e) => updateRow(row.id, { channel: Number(e.target.value) || 1 })}
          className="w-full rounded border border-black/10 bg-transparent px-1 text-center font-mono tabular-nums dark:border-white/15"
          aria-label="Channel"
        />
        <div className="flex flex-col gap-1">
          <input
            type="text"
            placeholder="Source (Kick, Vox 1…)"
            value={row.source}
            onChange={(e) => updateRow(row.id, { source: e.target.value })}
            className="w-full rounded border border-black/10 bg-transparent px-1 dark:border-white/15"
          />
          <input
            type="text"
            placeholder="Mic / DI"
            value={row.mic}
            onChange={(e) => updateRow(row.id, { mic: e.target.value })}
            className="w-full rounded border border-black/10 bg-transparent px-1 dark:border-white/15"
          />
          <label className="flex items-center gap-1 text-[10px] opacity-70">
            <input
              type="checkbox"
              checked={row.phantom}
              onChange={(e) => updateRow(row.id, { phantom: e.target.checked })}
            />
            +48V
          </label>
        </div>
        <button
          type="button"
          onClick={() => deleteRow(row.id)}
          className="flex items-start justify-end text-base opacity-50 hover:opacity-100"
          aria-label="Remove row"
        >
          ×
        </button>
      </div>
    ))}
    {plot.input_list.length === 0 && (
      <p className="rounded-md border border-dashed border-black/15 p-2 text-xs opacity-60 dark:border-white/15">
        No inputs yet.
      </p>
    )}
  </div>
  <button
    type="button"
    onClick={addRow}
    className="self-start rounded-md border border-black/15 px-2 py-1 text-xs hover:border-current dark:border-white/20"
  >
    + Add row
  </button>
</aside>
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 4: Manual verification**

Open the editor. Click "+ Add row" → row appears with channel 1. Edit source, mic; toggle phantom. Add another row — channel auto-increments. Delete a row. Wait 2s → "Saved". Reload → data persists.

- [ ] **Step 5: Commit**

```bash
git add components/stage-plot/editor.tsx
git commit -m "Add input list panel to stage plot editor"
```

---

## Task 15: Mic/DI nudge → prefill input list row

**Files:**
- Modify: `components/stage-plot/editor.tsx`

When a mic or DI item is placed on the canvas, show a one-time inline prompt on that item: "Add to input list?" Accept adds a row prefilled with the icon kind's label as `source`. Dismiss leaves the plot alone.

- [ ] **Step 1: Track which items have been offered**

In `StagePlotEditor`, add near the other `useState` lines:

```tsx
const [nudgeDismissed, setNudgeDismissed] = useState<Set<string>>(new Set());
const [nudgeFor, setNudgeFor] = useState<string | null>(null);
```

Update `addItem` to trigger a nudge for input-like kinds:

```tsx
function addItem(item: StagePlotItem) {
  setPlot((p) => ({ ...p, items: [...p.items, item] }));
  if (INPUT_LIKE_KINDS.includes(item.kind)) {
    setNudgeFor(item.id);
  }
}
```

- [ ] **Step 2: Render the nudge balloon on the matching item**

Inside the canvas item render (where we render `isSelected && <button … × …>`), add a sibling conditional:

```tsx
{nudgeFor === item.id && !nudgeDismissed.has(item.id) && (
  <div className="absolute left-1/2 top-full z-10 mt-2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-md border border-black/15 bg-paper px-2 py-1 text-xs shadow-sm dark:border-white/15 dark:bg-black">
    <span>Add to input list?</span>
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const kindLabel = KIND_LABELS[item.kind];
        const nextCh = plot.input_list.length === 0
          ? 1
          : Math.max(...plot.input_list.map((r) => r.channel)) + 1;
        setPlot((p) => ({
          ...p,
          input_list: [
            ...p.input_list,
            {
              id: newId(),
              channel: nextCh,
              source: item.label ?? kindLabel,
              mic: item.kind === "di_box" ? "DI" : "",
              phantom: false,
            },
          ],
        }));
        setNudgeDismissed((d) => new Set(d).add(item.id));
        setNudgeFor(null);
      }}
      className="rounded bg-accent px-1.5 py-0.5 font-semibold text-black"
    >
      Add
    </button>
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setNudgeDismissed((d) => new Set(d).add(item.id));
        setNudgeFor(null);
      }}
      className="rounded px-1 opacity-60 hover:opacity-100"
    >
      ✕
    </button>
  </div>
)}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 4: Manual verification**

Drag a vocal mic to the canvas. A small balloon appears below it: "Add to input list?" with Add and ✕. Click Add → a new input-list row appears with channel 1 (or next), source "Vocal mic". Click ✕ on another → no row added, balloon dismissed. Dragging the same item again does NOT re-trigger (dismissed per-item). Dragging a drum kit does nothing extra.

- [ ] **Step 5: Commit**

```bash
git add components/stage-plot/editor.tsx
git commit -m "Add mic/DI nudge to prefill input list row"
```

---

## Task 16: Guest performer slot in the roster tray

**Files:**
- Modify: `components/stage-plot/editor.tsx`

- [ ] **Step 1: Add the Guest performer slot button**

In the roster tray `<ul>` (after the roster `.map`, inside the same `<ul>` or just below it), add a persistent slot that triggers a tray drag with a pseudo-roster member. Add this as the last `<li>` child in the roster `<ul>`:

```tsx
<li>
  <button
    type="button"
    onPointerDown={(e) => {
      e.preventDefault();
      setDrag({
        kind: "tray-roster",
        member: { member_id: "", name: "", role: "" },
      });
    }}
    className="flex w-full items-center gap-2 rounded-md border border-dashed border-black/20 p-1.5 text-left text-xs opacity-70 hover:opacity-100 dark:border-white/20"
  >
    <StageIcon kind="person" size={20} />
    <span>+ Guest performer</span>
  </button>
</li>
```

- [ ] **Step 2: Branch the drop handler to leave `member_id` undefined when empty**

In the existing `onCanvasPointerUp` handler, change the `tray-roster` branch to:

```tsx
} else if (drag.kind === "tray-roster" && coords) {
  const isGuest = !drag.member.member_id;
  const label = isGuest
    ? "Guest"
    : drag.member.role
      ? `${drag.member.name} — ${drag.member.role}`
      : drag.member.name;
  addItem({
    id: newId(),
    kind: "person",
    x: coords.x,
    y: coords.y,
    label,
    ...(isGuest ? {} : { member_id: drag.member.member_id }),
  });
}
```

Also: when the item is a guest Person, the admin should be able to rename it. Add a small inline label-edit affordance when a guest Person is selected. Inside the item render, after the delete button, add:

```tsx
{isSelected && item.kind === "person" && !item.member_id && (
  <input
    type="text"
    value={item.label ?? ""}
    onChange={(e) => updateItem(item.id, { label: e.target.value })}
    onPointerDown={(e) => e.stopPropagation()}
    placeholder="Name"
    className="mt-1 w-32 rounded border border-black/15 bg-paper px-1 text-[10px] dark:border-white/15 dark:bg-black"
  />
)}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 4: Manual verification**

Open the editor. See "+ Guest performer" at the bottom of the roster. Drag it onto the canvas — a Person item appears labeled "Guest". Click to select — an inline name input appears below the ×. Type "Fiona — fiddle". Autosave fires. Reload — the guest persists with the typed name.

- [ ] **Step 5: Commit**

```bash
git add components/stage-plot/editor.tsx
git commit -m "Add guest performer slot to stage plot editor"
```

---

## Task 17: Auto-prune dangling member items on editor load

**Files:**
- Modify: `components/stage-plot/editor.tsx`

If a `band_members` row is deleted after a Person was placed, prune that item on mount, surface a one-line toast per removed member, and autosave fires via the normal 2s debounce (since the state change marks the plot dirty).

- [ ] **Step 1: Add the prune effect on mount**

In `StagePlotEditor`, after the autosave `useEffect`, add:

```tsx
useEffect(() => {
  const rosterIds = new Set(roster.map((r) => r.member_id));
  const dangling = plot.items.filter(
    (i) => i.kind === "person" && i.member_id && !rosterIds.has(i.member_id),
  );
  if (dangling.length === 0) return;
  for (const item of dangling) {
    toast(`Removed ${item.label ?? "a member"} — no longer in the band`);
  }
  setPlot((p) => ({
    ...p,
    items: p.items.filter(
      (i) => !(i.kind === "person" && i.member_id && !rosterIds.has(i.member_id)),
    ),
  }));
  // Autosave debounce will catch this change on its own.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

(The dependency array is intentionally empty — this is a mount-only pass. The rest of the editor reacts to plot changes.)

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 3: Manual verification**

Place a Person item (roster-linked), wait for autosave, then via SQL delete the matching `band_members` row:

```sql
DELETE FROM public.band_members WHERE profile_id = '<pruned_member_profile_id>' AND band_id = '<band_id>';
```

Reload the editor. Expected: toast "Removed <Name> — no longer in the band"; the Person icon is gone; "Saved ✓" fires within 2s. Reload again — icon stays gone. Guest Person items (no member_id) are untouched regardless.

- [ ] **Step 4: Commit**

```bash
git add components/stage-plot/editor.tsx
git commit -m "Auto-prune dangling member stage plot items on load"
```

---

## Task 18: Add Stage plot tab to BandSubNav

**Files:**
- Modify: `components/bands/band-subnav.tsx`
- Modify: `app/dashboard/bands/[bandId]/page.tsx` (no change needed to activeTab typing — already `settings | availability`; we widen it)
- Modify: `app/dashboard/bands/[bandId]/availability/page.tsx` (same)

- [ ] **Step 1: Widen the `activeTab` prop and add the new tab link**

Open `components/bands/band-subnav.tsx`. Change the `Props` type:

```tsx
type Props = {
  bandId: string;
  bandName: string;
  slug: string;
  logoUrl?: string | null;
  activeTab: "settings" | "availability" | "stage-plot";
};
```

Change the `tabClass` signature:

```tsx
const tabClass = (tab: "settings" | "availability" | "stage-plot") =>
```

Inside the `<nav>` block, after the existing "Availability Calendar" `Link`, add:

```tsx
<Link
  href={`/dashboard/bands/${bandId}/stage-plot`}
  className={tabClass("stage-plot")}
>
  Stage plot
</Link>
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0 — the existing callers (`activeTab="settings"` and `activeTab="availability"`) still typecheck, and the new editor page's `activeTab="stage-plot"` is now valid.

- [ ] **Step 3: Manual verification**

Open any band's dashboard page. See three tabs across the subnav: Settings & Roster · Availability Calendar · Stage plot. Click Stage plot → navigates to the editor route. Current tab styling tracks correctly on each page.

- [ ] **Step 4: Commit**

```bash
git add components/bands/band-subnav.tsx
git commit -m "Add Stage plot tab to band subnav"
```

---

## Task 19: End-to-end manual verification

No code changes — this is the final pre-merge sweep from the spec's Testing & verification section.

- [ ] **Step 1: Run typecheck**

```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 2: Walk the full verification checklist**

With `npm run dev` running and signed in as a band admin:

1. **New band → editor opens empty.** Create a new band (or pick one with no `stage_plot`). Open the Stage plot tab → three-column layout; gear tray populated; roster tray populated; canvas is empty; input list empty.
2. **Drag three gear icons → persist.** Drag drum kit, guitar cab, bass cab onto the canvas. Wait 2s → "Saved ✓". Reload page → coords persist.
3. **Mic nudge → row prefilled.** Drag a vocal mic → balloon appears → click "Add" → an input-list row appears with the next channel number and source "Vocal mic".
4. **Dangling member pruned.** Place a roster Person → wait for save. In SQL: `DELETE FROM public.band_members WHERE band_id = '<id>' AND profile_id = '<id>';`. Reload editor → the Person icon is gone, toast fired, autosave fires. Reload again → still gone.
5. **Guest performer persists.** Drag "+ Guest performer" onto the canvas → type name in the inline input → wait for save → reload → guest still present with typed name (never auto-pruned).
6. **Public EPK renders inline.** Open `/bands/<slug>` → Stage plot section visible with icons positioned correctly; input list below; "Printable version →" link in the section header.
7. **Print route Ctrl+P.** Open `/bands/<slug>/stage-plot` → minimal page. Ctrl+P preview shows letter portrait, no site chrome, plot filling top portion, input list below.
8. **Mobile viewport.** DevTools responsive mode at 375px → `/dashboard/bands/<id>/stage-plot` shows the nudge card instead of the editor, with a "View current plot ↗" link.
9. **Non-admin direct action call.** Sign in as a non-admin member → open browser devtools → attempt a Server Action call manually (or temporarily add `<button onClick={() => saveStagePlot(bandId, {} as any)}>` to a page). The call returns `{ ok: false, error: "Only band admins can edit the stage plot." }`.
10. **Malformed save rejected.** Call `saveStagePlot(bandId, { foo: "bar" })` from a devtool → returns `{ ok: false, error: "The stage plot data looks corrupt. Reload the page." }`. The `bands.stage_plot` column is untouched.

- [ ] **Step 3: Clean up any temporary dev data**

Remove seeded plots or members you added for testing.

- [ ] **Step 4: Final commit (if any devtool stubs were added for step 9 testing, remove them)**

No files should need changes. If you added anything, revert.

```bash
git status
```

Expected: clean. If anything's dirty, inspect and either commit the fix or `git restore` the file.

---

## Open follow-ups (not this plan)

Per the spec:
- Server-generated PDF rendering if browser Save-as-PDF proves inadequate.
- Flippable Crowd orientation.
- Stage-shape variants (corner, round, wedge).
- Mobile touch drag-drop editing.
- Phase 2 Bill Builder integration — the stage plot slots into the venue pitch package naturally; no code shared yet, but the print route is already a usable artifact.
- Signal routing beyond the input list (channel splits, monitor sends, in-ear mixes).
