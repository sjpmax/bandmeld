# Stage plot builder — design

**Date:** 2026-10-24
**Status:** Approved for implementation planning
**Related:** [`docs/brainstorms/stage-plot.md`](../../brainstorms/stage-plot.md), [`band snap PRD.md`](../../../band%20snap%20PRD.md) §3.2

## Summary

A top-down stage diagram the band admin assembles in-app and the public EPK renders as inline SVG. The admin drags gear icons and roster members onto a fixed-aspect canvas with "Crowd" labeled at the bottom edge. A separate print-friendly route lets venue engineers Save-as-PDF.

For most DIY bands this *is* the tech rider — backline is usually supplied by the venue, and hospitality isn't a line item at this scale. The stage plot plus the input list cover what a sound engineer actually needs. The existing `bands.tech_rider_url` PDF stays available for the minority of bands that want to upload a formal rider document, but the two don't need to coexist — each band picks what they send.

## Scope

**In scope**

- Admin-only drag-drop editor on desktop and tablet (≥768px).
- Fixed curated gear library (~14 icons) with a labeled-rectangle escape hatch. Each amp has its matching instrument icon in the tray (guitar for guitar cab, bass for bass cab).
- Person icons auto-populated from `band_members`, carrying each member's `role_in_band`. A "+ Guest performer" slot adds a Person with no `member_id` for fill-ins and sit-ins — admin types the label.
- Fixed-aspect canvas, free-drag, normalized coords, Crowd fixed at bottom.
- Input list panel (ordered rows: channel, source, mic, phantom, notes) in the same editor, modeled independently from the plot.
- Public inline SVG on `/bands/[slug]`.
- Print-friendly `/bands/[slug]/stage-plot` route for browser Save-as-PDF.

**Non-goals (v1)**

- Scale-accurate stage dimensions.
- Multiple aspect presets or custom stage shapes (corner, round, wedge).
- Flippable Crowd orientation.
- Mobile editing (<768px shows a view/nudge card instead).
- User-drawn custom icon shapes (long tail covered by the labeled-rectangle escape hatch).
- Per-icon-to-input-list schema linkage (only a UX nudge connects them).
- Server-generated PDF rendering (browser Save-as-PDF covers it).
- Multi-stage touring configurations.
- Concurrent-edit conflict resolution (last-write-wins is accepted).

## Decisions

Working through the handoff's seven open forks:

1. **Who edits:** admin-only. The admin is often the most-organized member, not necessarily on stage. Person icons are auto-populated from `band_members` so the admin never types a name.
2. **Gear library:** fixed curated set of 14 icons (drum kit, bass cab, bass guitar, guitar cab, guitar, keys, vocal mic, instrument mic, monitor wedge, DI box, power, riser, person, label). Every amp has its matching instrument icon so admins can represent "guitar on a stand next to a cab" naturally. The `label` icon renders as a labeled rectangle — the escape hatch for unusual gear without shipping a shape editor.
3. **Canvas model:** one fixed-aspect rectangle. Icons drag freely; coords stored as normalized 0..1 floats. No grid snap, no aspect presets, no numeric stage dimensions — venues rarely specify, and the simpler UI wins.
4. **Crowd anchor:** fixed, always at the bottom edge. Matches sound-engineer convention. Adding flip later is a trivial CSS transform.
5. **Output:** inline SVG on the public EPK plus a print-friendly `/bands/[slug]/stage-plot` route that the user sends through the browser's Save-as-PDF. No server-side PDF toolchain, no client-side canvas library.
6. **Mobile:** desktop and tablet edit (≥768px). Mobile shows a view-only EPK section and a "Open on a larger screen to edit" nudge in the dashboard. Editing is a once-every-few-months task, not an on-the-go one.
7. **Signal flow:** included as a sibling input-list panel in the same editor, but modeled independently from the plot. The two tables don't link; a UX nudge offers to add an input-list row when the admin drops a vocal mic, instrument mic, or DI box.

## Architecture

### Routes

- `app/dashboard/bands/[bandId]/stage-plot/page.tsx` — the editor. Admin-guarded like the band's other dashboard pages. Under 768px shows a nudge card instead of the editor.
- `app/dashboard/bands/[bandId]/stage-plot/actions.ts` — Server Action `saveStagePlot(bandId, plot)` validating admin + Zod schema, then one UPDATE on `bands.stage_plot`.
- `app/bands/[slug]/stage-plot/page.tsx` — public print-friendly route. Minimal chrome; letter-aspect SVG; `@media print` strips remaining UI.
- `app/bands/[slug]/page.tsx` — existing public EPK, extended with a "Stage plot" section rendering inline SVG when `stage_plot` is non-null and `items.length > 0`.
- `app/dashboard/bands/[bandId]/page.tsx` — existing band settings page, extended with a "Stage plot" link alongside the existing settings/availability links.

No new route handlers. The app's "only one route handler" convention (`auth/confirm`) is preserved.

### Data model

One migration adds a nullable JSONB column on `bands`. No new RLS — existing admin-write / public-read policies on `bands` cover it.

```sql
alter table public.bands add column stage_plot jsonb;
```

A shared Zod schema in `types/stage-plot.ts` defines the shape, imported by editor, Server Action, and renderers:

```ts
type StagePlot = {
  version: 1
  items: StagePlotItem[]
  input_list: InputListRow[]
}

type StagePlotItem = {
  id: string           // crypto.randomUUID()
  kind: 'drum_kit' | 'bass_cab' | 'bass_guitar' | 'guitar_cab' | 'guitar'
      | 'keys' | 'vocal_mic' | 'instrument_mic' | 'monitor_wedge' | 'di_box'
      | 'power' | 'riser' | 'person' | 'label'
  x: number            // 0..1 normalized, origin top-left
  y: number            // 0..1 normalized
  label?: string       // required for 'label' and 'person'; optional override elsewhere
  member_id?: string   // optional on 'person'. Set for roster members; absent for guest performers.
}

type InputListRow = {
  id: string
  channel: number
  source: string
  mic: string          // free text ("SM57", "DI", "clip-on condenser")
  phantom: boolean
  notes?: string
}
```

Notes:

- `version: 1` lets future schema changes migrate in-code on read.
- Person icons snapshot `label` at place-time (name + `role_in_band`) so the public EPK renders a stable label regardless of roster churn. Guest performers get an admin-typed `label` and no `member_id`.
- `member_id` lets the editor cross-reference the live `band_members` row on load. When a `member_id` no longer matches a current band member, the editor auto-prunes the item from the loaded state and surfaces a one-line toast ("Removed Jonny — no longer in the band"); autosave persists the pruned plot 2s later. Guest-performer items (no `member_id`) are left alone.
- Canvas aspect is a renderer constant per Decision 3. **16:9 (1.78) everywhere** — editor, EPK, and print route — so normalized coords land at the same relative position in every surface. In the print route the SVG occupies the top portion of the letter page; the input list fills the rest.

### Editor UI

Three-column layout on ≥768px:

```
┌──────────────────────────────────────────────────────────┐
│  < back · "Stage plot" · [Save status indicator]         │
├──────────────┬───────────────────────────────┬───────────┤
│  Icon tray   │        Canvas (fixed AR)      │ Input     │
│              │                               │ list      │
│  Gear:       │   [drag icons here]           │           │
│  · Drum kit  │                               │ 1. Kick…  │
│  · Bass cab  │                               │ 2. Snare… │
│  · …         │                               │ + add row │
│  · Label     │   ─── Crowd ───               │           │
│              │                               │           │
│  Roster:     │                               │           │
│  · Jonny (dr)│                               │           │
│  · Sam (bs)  │                               │           │
└──────────────┴───────────────────────────────┴───────────┘
```

- **Icon tray (left):** gear icons (fixed library) and roster (Person icons from `band_members`, labeled with `role_in_band`). A "+ Guest performer" slot at the bottom of the roster section drops a Person with no `member_id`; admin types the label (e.g. "Fiona — fiddle"). Dragging a tray item to the canvas creates a new `StagePlotItem` at drop coords. Tray roster items disappear from the tray once placed to avoid double-placement; the Guest performer slot stays available for additional sit-ins.
- **Canvas (center):** absolute-positioned icons over an SVG background that renders the stage rectangle + "Crowd" label. Click to select; drag to move; Delete key or inline × removes.
- **Input list (right):** inline-edit table rows for channel, source, mic (free text), phantom (checkbox), notes. Drag handle reorders; × deletes; "+ add row" appends with next channel.
- **Save status (top-right):** "Saved" / "Saving…" / "Unsaved changes" (after failed retries).

Interactions:

- **Drag from tray to canvas:** pointerdown on tray item starts a ghost that follows the cursor; pointerup on canvas creates the item at normalized coords.
- **Drag on canvas:** pointerdown on an existing item moves it. Coords clamped to [0, 1].
- **Mic/DI nudge:** when `vocal_mic`, `instrument_mic`, or `di_box` is placed, show a one-time contextual prompt on the dropped item: "Add to input list?" Accepting appends a prefilled row (`source` prefilled from icon kind, next available channel). Dismiss and the prompt doesn't fire again for that item.
- **Mobile (<768px):** no editor UI. Server-rendered card: "Open on a larger screen to edit the stage plot. [View current plot →]" linking to the public print route.

### Public EPK render

A new "Stage plot" section on `app/bands/[slug]/page.tsx`:

- Hidden entirely when `stage_plot` is null or `items.length === 0`.
- Renders the inline SVG via a shared `StagePlotRenderer` component (same component as the editor, read-only mode).
- Below the SVG, a plain `<table>` renders `input_list`. Hidden when `input_list.length === 0`.
- A "Printable version →" link navigates to `/bands/[slug]/stage-plot`.

### Print route

`app/bands/[slug]/stage-plot/page.tsx` — a minimal page with:

- The band name at the top.
- The SVG laid out at the shared 16:9 aspect (same as editor and EPK), filling the top portion of the letter-portrait page.
- The input-list `<table>` below.
- `@media print` CSS removes site chrome, scales to 100% page width, and prevents page breaks mid-SVG.

The user hits Ctrl+P / Cmd+P and selects "Save as PDF" from the browser dialog. No new dependency.

### Save flow

- Editor keeps a client-side `plot` state (seeded from the server-rendered initial blob).
- A debounced effect (2s after last change) calls the `saveStagePlot` Server Action.
- The action: `requireUserId()` → verify admin on `band_members` → Zod-validate the incoming blob → `update bands set stage_plot = $1 where id = $bandId`.
- Save status: in-flight = "Saving…", success = "Saved" (resets to idle after 2s), failure = retry up to 3× with exponential backoff, then surface a sonner toast and switch to "Unsaved changes" with a manual Save button.
- Concurrent edits: last-write-wins. Accepted for v1.

### Edge cases

- **Member leaves after being placed:** on next editor load, items whose `member_id` no longer matches a current `band_members` row are pruned from the loaded state and a one-line toast surfaces ("Removed Jonny — no longer in the band"). Autosave persists the pruned plot. Public EPK renders the stored label until the admin next opens the editor — practical and no stale UI state. Guest-performer items (no `member_id`) are never auto-pruned.
- **Icon kind retired in a future version:** renderer fallback — unknown `kind` renders as a labeled rectangle with the kind name. `version: 1` on the blob lets a future renderer migrate in-code on read.
- **Empty state:** dashboard link is always visible to admins; the editor opens on an empty canvas with roster pre-populated in the tray and a one-sentence tip. EPK with null/empty plot hides the section entirely — no placeholder.
- **Validation failure on save:** Zod rejects → `ActionResult` error → sonner toast ("Couldn't save plot — the data looks corrupt. Reload the page?"). Tripwire for client bugs; shouldn't fire in normal use.
- **Non-admin hitting the Server Action directly:** rejected with the project's standard `ActionResult` error.

## Testing & verification

The project doesn't ship a test framework yet (Phase 1 relies on `npm run typecheck` + manual verification via the dev server). This feature matches that norm.

**What catches regressions:**

- **TypeScript:** the Zod schema generates `StagePlot`; editor, Server Action, and renderer import it. Any shape drift fails `tsc --noEmit`.
- **Zod at the boundary:** the Server Action validates every save, so a malformed blob never reaches Postgres.
- **Manual verification plan** (dev server at `localhost:3001`, pre-merge checklist):
  1. New band → open stage plot → tray + canvas render, roster populated in Person section.
  2. Drag three gear icons to the canvas → coords persist across page reload.
  3. Drop a vocal mic → nudge appears → accept → row added to input list with next channel.
  4. Delete a `band_members` row via SQL → reopen editor → the member's Person icon is pruned on load, toast surfaces, autosave fires → reload → icon stays gone.
  5. Drop a "+ Guest performer" Person → type label → reload → guest icon persists (never pruned).
  6. Public EPK: plot renders inline; input-list table renders below; print link works; Ctrl+P in the print route produces a clean letter-size page.
  7. Mobile viewport (375px): dashboard stage plot route shows the nudge card, not the editor.
  8. Non-admin invokes the Server Action directly → rejected.

**Future test addition** (not this feature's job): the Zod schema and the pure `StagePlotRenderer` are both unit-testable without a browser if Vitest is adopted later.

## Open follow-ups (deliberately deferred)

- Server-generated PDF rendering (if browser Save-as-PDF proves inadequate for venue engineers).
- Flippable Crowd orientation (if corner-stage complaints surface).
- Stage-shape variants (round, wedge).
- Mobile touch drag-drop editing.
- Phase 2 Bill Builder integration: the stage plot should slot into the venue pitch package naturally — no shared code yet, but the public print route already works for that.
- Full backline / signal routing beyond the input list (channel splits, monitor sends, in-ear mixes).
