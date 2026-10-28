# Import review 3-way status (Free / Busy / Maybe)

**Date:** 2026-10-27
**Branch:** `feat/import-3way-status`

## Goal

Replace the single-checkbox-per-event selection on the Google Calendar import review page with a Free / Busy / Maybe segmented pill, and extend the same selection vocabulary to the user's availability page.

## Why

Users importing Google events have three real intents, not two: "I'm free that day" (don't block), "I'm busy" (firm block), and "probably busy but open to the band" (tentative block). Today the UI collapses this to a checkbox; users must import a firm block and then toggle it to Maybe from the availability page afterward — a step the current help text documents but nobody does.

The import page already landed with a List/Table toggle; the Upcoming blocks list on `/dashboard/availability` should get the same affordance.

## Scope

### In

1. **Per-row Free/Busy/Maybe control (segmented pill)** on the import review page, replacing the current checkbox.
   - Applies to all three sections: missed, one-offs, recurring instances.
   - Visible across both List and Table views.
2. **Table "Status" column header** — currently sr-only; promote to a visible `<th>Status</th>`.
3. **Series card bulk controls** — replace the "pick all" checkbox with three pill-shaped buttons: *Mark all Free*, *Mark all Busy*, *Mark all Maybe*. These set every instance under that series to the chosen state in one click.
4. **Server action rewrite** — `applyGoogleImport` and `applyIcsImport` consume a status-per-event map instead of a flat set of selected ids; emit `member_unavailabilities` rows only for Busy and Maybe; set `is_tentative = (status === "maybe")`.
5. **List/Table toggle on `/dashboard/availability`** — above the "Upcoming blocks" section, same segmented pill as import review. Persisted in `bandsnap:availability-view` localStorage key.

### Out

- Changes to the ICS parse step or to the Apple/`.ics` upload page UI beyond the shared ReviewableEvent rendering.
- Changes to invite links, polls, or any non-availability page.
- Carrying the status forward on *re-imports* (dedupe path stays as it is today — matching rows are skipped).
- Repair of `fix/vault-migration-timestamp` or Supabase Auth URL config (tracked separately; blocking the Google import in prod but not this feature).

## Defaults

Match today's preselect semantics so a user who imports without touching anything sees the same result:

| Section | Default |
| --- | --- |
| Missed (events Google marked as free) | **Free** |
| One-off busy events | **Busy** |
| Recurring instances (series expanded) | **Free** |

The user can move any row to any state.

## UI

### Row control (both views)

Three touching buttons styled as one rounded-full pill, state carried by `aria-pressed`:

```
[ Free | Busy | Maybe ]
```

- Selected button filled with its state color (green / red / amber), unselected buttons flat.
- Buttons are `<button type="button">`; clicking one unsets the other two and dispatches an onChange that updates the parent component's status map.
- Keyboard: Tab reaches the pill group once; Arrow Left/Right moves between options; Space activates.

### Series card bulk

The row of three *Mark all* buttons sits where the current "pick all" checkbox is in the series card header, left-aligned. Clicking one sets every instance under the series to that status (replacing whatever each instance currently holds).

### Table column

Add a visible `<th>Status</th>` to the Table-view thead (previously `<th><span class="sr-only">Pick</span></th>`). Keeps same column width behavior as other short columns.

### Availability page toggle

Toolbar row directly above the "Upcoming blocks" list:

```
Upcoming blocks ·  N block(s)                [ ≡ List ] [ ▦ Table ]
```

- Same component shape as the import review toolbar.
- `bandsnap:availability-view` localStorage key (independent from import review's `bandsnap:import-view`).
- List view = today's current rendering, unchanged.
- Table view columns: Date (range if start ≠ end) · Day · Status (Firm/Maybe pill, click to toggle) · Reason · Actions (Switch to maybe / Mark as firm, Remove).

## Data flow

### Client state in `import-review.tsx`

Today:

```ts
const [selected, setSelected] = useState<Set<string>>(() => defaultSelected(payload));
```

Becomes:

```ts
type Status = "free" | "busy" | "maybe";
const [status, setStatus] = useState<Record<string, Status>>(() => defaultStatus(payload));
```

Where `defaultStatus` seeds each event id with its section's default (missed→free, oneOff→busy, instance→free). Hidden inputs rendered inside the form:

```html
<input type="hidden" name="status" value="<eventId>|<state>" />
```

One hidden input per event, serialized as `id|state` (the `|` separator is safe: Google event ids are URL-safe base64url, ICS uids may contain `:` and `@` but never `|`). The server parses with `lastIndexOf("|")` to be extra safe.

### Server action

`applyGoogleImport(formData)` becomes:

```ts
const statusById = new Map<string, Status>();
for (const raw of formData.getAll("status")) {
  const s = String(raw);
  const sep = s.lastIndexOf("|");
  if (sep < 0) continue;
  const id = s.slice(0, sep);
  const state = s.slice(sep + 1);
  statusById.set(id, state === "maybe" ? "maybe" : state === "busy" ? "busy" : "free");
}
// ... parse payload like today ...
const rows = events
  .map((e) => {
    const s = statusById.get(e.id) ?? "free";
    if (s === "free") return null;
    return {
      profile_id: profileId,
      start_date: String(e.startDate ?? ""),
      end_date: String(e.endDate ?? ""),
      reason: String(e.summary ?? "").slice(0, 120),
      is_tentative: s === "maybe",
    };
  })
  .filter(Boolean);
```

Dedupe path keeps working: existing `member_unavailabilities` rows carry their own `is_tentative`; a repeated import that matches start+end+reason still skips. (The dedupe key does NOT include `is_tentative` — if the user re-imports with a different status the existing row wins, same as today. That's fine for now; a user who wants to change an existing block's status does it from the availability page.)

The `nothing_selected` branch now fires when every event was marked Free (previously: no boxes checked). Error copy adjusted:

> "You didn't block any events." (was: "You didn't pick any events.")

### `applyIcsImport`

Identical change — same status map, same row-emit rule.

## Files

### Modify

- `components/availability/import-review.tsx`
  - Replace `selected: Set<string>` with `status: Record<string, Status>`.
  - Replace `onToggle` prop on `EventListRows` / `EventTableRows` with `onStatusChange(id, status)`.
  - New `StatusPill` subcomponent (local).
  - Series card: replace "pick all" checkbox with three bulk buttons wired to a new `onBulkStatus(seriesId, status)` handler.
  - Table thead: `<th>Status</th>`.
  - Hidden form inputs change from `name="selected" value={id}` (one per selected) to `name="status" value={`${id}:${state}`}` (one per event).
  - `defaultStatus(payload)` helper replaces today's `defaultSelected(payload)`.

- `app/dashboard/availability/actions.ts`
  - `applyGoogleImport`: read `status` form entries, emit rows for busy/maybe only, set `is_tentative`, update `nothing_selected` copy.
  - `applyIcsImport`: same change.

- `app/dashboard/availability/page.tsx`
  - Extract the Upcoming blocks list rendering into a new client-rendered component that owns the view-mode state.

### Create

- `components/availability/upcoming-blocks.tsx` — Client component. Props: `blocks` array, `removeAction`, `toggleTentativeAction`. Owns `view: "list" | "table"` state (localStorage-hydrated like import-review). Renders the current list OR a table with Date/Day/Status/Reason/Actions columns.

### Test / verify

- Manual verification via the real import review page (dev server) after each task — type-check and build are not enough for UI changes.
- Dedupe path: re-import the same event with a different status; existing row must survive (same as today).
- Free-only submit must redirect to `?import_error=nothing_selected` with the new copy.

## Open hazards

- **Series bulk buttons** could overwrite deliberate per-instance choices without warning. Mitigation: three bulk buttons each read as a single, deliberate action; no "pick all" ambient checkbox that users might flip while scanning. Live with it.
- **Hidden input count grows** from `selected.size` to `events.length` on submit. For a 400-event year this is still a kilobyte of form data; fine.
- **Availability page Table view** needs to handle multi-day ranges (`start_date` ≠ `end_date`). Date column renders `fmt(start) → fmt(end)` same as the List view does today.

## Rollback

Each task is a separate commit on this branch. If any lands badly, revert the commit; the server action and client component are consumer/producer of the same shape and are updated together.
