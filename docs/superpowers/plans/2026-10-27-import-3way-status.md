# Import 3-way status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single checkbox on the Google/ICS import review with a Free / Busy / Maybe segmented pill per event, and extend the List/Table toggle to the `/dashboard/availability` upcoming-blocks list.

**Architecture:** Client state in `import-review.tsx` moves from `Set<string>` of selected ids to `Record<string, Status>` keyed by event id. Each event submits one hidden `<input name="status" value="id|state">`. Server actions in `app/dashboard/availability/actions.ts` parse those entries, emit `member_unavailabilities` rows only for `busy`/`maybe` (with `is_tentative = (status === "maybe")`), and skip `free`. The availability page's "Upcoming blocks" section is extracted into a client component that owns the same List/Table view toggle, persisted independently in localStorage.

**Tech Stack:** React 19 + Next.js 16 App Router, Server Actions, Supabase (`@supabase/ssr`), Tailwind 4, TypeScript strict.

**Spec:** [docs/superpowers/specs/2026-10-27-import-3way-status-design.md](../specs/2026-10-27-import-3way-status-design.md)

---

## File Structure

- Create: `components/availability/upcoming-blocks.tsx` — Client component owning View toggle for availability page's Upcoming blocks list.
- Modify: `types/calendar-import.ts` — Add `ImportStatus` type and `statusInputValue`/`parseStatusEntry` helpers (shared between client component and both server actions, so the serialization format lives in one place).
- Modify: `components/availability/import-review.tsx` — Replace checkbox control with `StatusPill`, swap `Set<string>` state for `Record<string, ImportStatus>`, replace series "pick all" checkbox with three bulk buttons, promote the Table "Status" column header to visible text.
- Modify: `app/dashboard/availability/actions.ts` — Rewrite `applyGoogleImport` and `applyIcsImport` to consume status entries and emit `is_tentative`.
- Modify: `app/dashboard/availability/page.tsx` — Render `<UpcomingBlocks>` in place of inline list rendering.

---

## Task 1: Add shared status helpers to `types/calendar-import.ts`

**Files:**
- Modify: `types/calendar-import.ts`

- [ ] **Step 1: Add `ImportStatus` type + helpers at the bottom of the file**

Append to `types/calendar-import.ts`:

```ts
/**
 * Per-event decision on the import review form.
 * - `free`  → do not create a member_unavailability row.
 * - `busy`  → create a firm block (is_tentative = false).
 * - `maybe` → create a tentative block (is_tentative = true).
 */
export type ImportStatus = "free" | "busy" | "maybe";

/** Hidden-input value: "<eventId>|<state>". `|` is safe for both Google event ids and ICS UIDs. */
export function statusInputValue(id: string, status: ImportStatus): string {
  return `${id}|${status}`;
}

/** Inverse of statusInputValue. Returns null if the value is malformed. */
export function parseStatusEntry(raw: string): { id: string; status: ImportStatus } | null {
  const sep = raw.lastIndexOf("|");
  if (sep <= 0) return null;
  const id = raw.slice(0, sep);
  const tail = raw.slice(sep + 1);
  const status: ImportStatus =
    tail === "maybe" ? "maybe" : tail === "busy" ? "busy" : tail === "free" ? "free" : "free";
  return { id, status };
}
```

- [ ] **Step 2: Commit**

```bash
git add types/calendar-import.ts
git commit -m "feat(import): add shared ImportStatus type and status-input helpers"
```

---

## Task 2: Rewrite server actions to consume status entries

**Files:**
- Modify: `app/dashboard/availability/actions.ts:161-227` (`applyGoogleImport`)
- Modify: `app/dashboard/availability/actions.ts:237-296` (`applyIcsImport`)

Both server actions change in the same way. Current code reads `formData.getAll("selected")`, filters payload events, and emits rows missing `is_tentative`. New code reads `formData.getAll("status")`, maps each event's status, and only emits rows for busy/maybe with the right `is_tentative`.

- [ ] **Step 1: Update `applyGoogleImport` imports**

In `app/dashboard/availability/actions.ts`, change the import line that imports from `@/types/calendar-import`:

```ts
import type { ReviewableEvent } from "@/types/calendar-import";
```

to:

```ts
import { parseStatusEntry, type ImportStatus, type ReviewableEvent } from "@/types/calendar-import";
```

- [ ] **Step 2: Replace `applyGoogleImport` body (lines 161-227)**

Replace the entire function with:

```ts
export async function applyGoogleImport(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const profileId = claims?.claims?.sub;
  if (!profileId) redirect("/login?next=/dashboard/availability");

  const payloadRaw = String(formData.get("payload") ?? "");
  const statusById = new Map<string, ImportStatus>();
  for (const raw of formData.getAll("status")) {
    const parsed = parseStatusEntry(String(raw));
    if (parsed) statusById.set(parsed.id, parsed.status);
  }

  let events: ReviewableEvent[];
  try {
    events = JSON.parse(payloadRaw) as ReviewableEvent[];
  } catch {
    redirect("/dashboard/availability?import_error=bad_payload");
  }

  const rows = events
    .map((e) => {
      const status = statusById.get(e.id) ?? "free";
      if (status === "free") return null;
      return {
        profile_id: profileId,
        start_date: String(e.startDate ?? ""),
        end_date: String(e.endDate ?? ""),
        reason: String(e.summary ?? "").slice(0, 120),
        is_tentative: status === "maybe",
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) {
    redirect("/dashboard/availability?import_error=nothing_selected");
  }

  // Dedupe against rows this user already has at the same date range + reason.
  // The dedupe key does NOT include is_tentative — a repeated import that
  // matches start+end+reason skips, keeping the existing row's firmness.
  const candidateStarts = Array.from(new Set(rows.map((r) => r.start_date)));
  const { data: existingRows } = await supabase
    .from("member_unavailabilities")
    .select("start_date, end_date, reason")
    .eq("profile_id", profileId)
    .in("start_date", candidateStarts);
  const existingKeys = new Set(
    (existingRows ?? []).map((r) => `${r.start_date}|${r.end_date}|${r.reason ?? ""}`),
  );
  const freshRows = rows.filter(
    (r) => !existingKeys.has(`${r.start_date}|${r.end_date}|${r.reason ?? ""}`),
  );
  const skippedCount = rows.length - freshRows.length;

  if (freshRows.length === 0) {
    redirect(
      `/dashboard/availability?import_error=all_duplicates&skipped=${skippedCount}`,
    );
  }

  const { error } = await supabase.from("member_unavailabilities").insert(freshRows);
  if (error) {
    redirect(`/dashboard/availability?import_error=${encodeURIComponent(error.message)}`);
  }

  await supabase
    .from("google_calendar_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("profile_id", profileId);

  revalidatePath("/dashboard/availability");
  const params = new URLSearchParams({ imported: String(freshRows.length) });
  if (skippedCount > 0) params.set("skipped", String(skippedCount));
  redirect(`/dashboard/availability?${params.toString()}`);
}
```

- [ ] **Step 3: Replace `applyIcsImport` body (lines 237-296)**

Replace the entire function with:

```ts
export async function applyIcsImport(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const profileId = claims?.claims?.sub;
  if (!profileId) redirect("/login?next=/dashboard/availability");

  const payloadRaw = String(formData.get("payload") ?? "");
  const statusById = new Map<string, ImportStatus>();
  for (const raw of formData.getAll("status")) {
    const parsed = parseStatusEntry(String(raw));
    if (parsed) statusById.set(parsed.id, parsed.status);
  }

  let events: ReviewableEvent[];
  try {
    events = JSON.parse(payloadRaw) as ReviewableEvent[];
  } catch {
    redirect("/dashboard/availability?import_error=bad_payload");
  }

  const rows = events
    .map((e) => {
      const status = statusById.get(e.id) ?? "free";
      if (status === "free") return null;
      return {
        profile_id: profileId,
        start_date: String(e.startDate ?? ""),
        end_date: String(e.endDate ?? ""),
        reason: String(e.summary ?? "").slice(0, 120),
        is_tentative: status === "maybe",
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) {
    redirect("/dashboard/availability?import_error=nothing_selected");
  }

  const candidateStarts = Array.from(new Set(rows.map((r) => r.start_date)));
  const { data: existingRows } = await supabase
    .from("member_unavailabilities")
    .select("start_date, end_date, reason")
    .eq("profile_id", profileId)
    .in("start_date", candidateStarts);
  const existingKeys = new Set(
    (existingRows ?? []).map((r) => `${r.start_date}|${r.end_date}|${r.reason ?? ""}`),
  );
  const freshRows = rows.filter(
    (r) => !existingKeys.has(`${r.start_date}|${r.end_date}|${r.reason ?? ""}`),
  );
  const skippedCount = rows.length - freshRows.length;

  if (freshRows.length === 0) {
    redirect(
      `/dashboard/availability?import_error=all_duplicates&skipped=${skippedCount}`,
    );
  }

  const { error } = await supabase.from("member_unavailabilities").insert(freshRows);
  if (error) {
    redirect(`/dashboard/availability?import_error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/availability");
  const params = new URLSearchParams({ imported: String(freshRows.length) });
  if (skippedCount > 0) params.set("skipped", String(skippedCount));
  redirect(`/dashboard/availability?${params.toString()}`);
}
```

- [ ] **Step 4: Update `nothing_selected` error copy on the availability page**

In `app/dashboard/availability/page.tsx` around line 98-102, change:

```tsx
) : sp.import_error === "nothing_selected" ? (
  <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm">
    You didn&apos;t pick any events.
  </p>
```

to:

```tsx
) : sp.import_error === "nothing_selected" ? (
  <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm">
    You didn&apos;t block any events — everything was marked Free.
  </p>
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no new errors; the actions still take `FormData` so the client caller signature is unchanged).

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/availability/actions.ts app/dashboard/availability/page.tsx
git commit -m "feat(import): server actions consume status entries, emit is_tentative"
```

Note: at this point the UI still submits `selected` entries, so an actual import will route everything to Free (nothing blocked) until Task 3 lands. Don't test the end-to-end import between these tasks — type-check only.

---

## Task 3: Rewrite ImportReview with pill control, bulk buttons, visible column header

**Files:**
- Modify: `components/availability/import-review.tsx`

Full rewrite of the component. Keep the surrounding file structure (`"use client"`, view toggle, section ordering, sticky submit bar). Replace the selection model and the row controls.

- [ ] **Step 1: Replace the file contents**

Replace `components/availability/import-review.tsx` entirely with:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  statusInputValue,
  type ImportStatus,
  type ReviewPayload,
  type ReviewableEvent,
  type ReviewSeries,
} from "@/types/calendar-import";

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

type Props = {
  payload: ReviewPayload;
  applyAction: (formData: FormData) => void | Promise<void>;
  applyLabel?: string;
};

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const fmt = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00`));

function rangeLabel(e: ReviewableEvent) {
  return e.startDate === e.endDate ? fmt(e.startDate) : `${fmt(e.startDate)} → ${fmt(e.endDate)}`;
}

const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short" });
function dayLabel(iso: string): string {
  return dayFmt.format(new Date(`${iso}T00:00:00`));
}

/**
 * Default status for an event, derived from its section:
 * - missed  → "free"  (Google said free; user confirms by moving to busy/maybe)
 * - oneOff  → "busy"  (matches today's preselect: on by default)
 * - recurring instance → "free" (matches today's preselect: off by default)
 */
function defaultStatus(e: ReviewableEvent, section: "missed" | "oneOff" | "instance"): ImportStatus {
  if (section === "missed") return "free";
  if (section === "oneOff") return "busy";
  return "free";
}

export function ImportReview({ payload, applyAction, applyLabel = "Import" }: Props) {
  const allEvents: ReviewableEvent[] = useMemo(
    () => [
      ...payload.oneOffs,
      ...payload.recurringSeries.flatMap((s) => s.instances),
      ...payload.missed,
    ],
    [payload],
  );
  const payloadJson = useMemo(() => JSON.stringify(allEvents), [allEvents]);

  const [status, setStatus] = useState<Record<string, ImportStatus>>(() => {
    const map: Record<string, ImportStatus> = {};
    for (const e of payload.oneOffs) map[e.id] = defaultStatus(e, "oneOff");
    for (const s of payload.recurringSeries) {
      for (const inst of s.instances) map[inst.id] = defaultStatus(inst, "instance");
    }
    for (const e of payload.missed) map[e.id] = defaultStatus(e, "missed");
    return map;
  });

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [view, setView] = useState<ViewMode>("list");

  useEffect(() => {
    const stored = readStoredView();
    if (stored !== "list") setView(stored);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      // Private browsing / storage disabled — just remember for this session.
    }
  }, [view]);

  function setEventStatus(id: string, next: ImportStatus) {
    setStatus((prev) => ({ ...prev, [id]: next }));
  }

  function setSeriesStatus(series: ReviewSeries, next: ImportStatus) {
    setStatus((prev) => {
      const copy = { ...prev };
      for (const inst of series.instances) copy[inst.id] = next;
      return copy;
    });
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  }

  const blockedCount = Object.values(status).filter((s) => s !== "free").length;

  return (
    <form action={applyAction} className="flex flex-col gap-8">
      <input type="hidden" name="payload" value={payloadJson} />
      {allEvents.map((e) => (
        <input
          key={e.id}
          type="hidden"
          name="status"
          value={statusInputValue(e.id, status[e.id] ?? "free")}
        />
      ))}

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

      {payload.missed.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="rounded-xl border border-dashed border-amber-500/60 bg-amber-500/5 p-3">
            <h2 className="text-xl font-semibold">
              Google marked these as free — any you can&apos;t play?
            </h2>
            <p className="text-sm opacity-70">
              {payload.missed.length} event{payload.missed.length === 1 ? "" : "s"} came back as &quot;free&quot;
              in your calendar. Switch any that are actually conflicts to Busy or Maybe.
            </p>
          </div>
          {view === "table" ? (
            <EventTableRows events={payload.missed} status={status} onChange={setEventStatus} />
          ) : (
            <EventListRows events={payload.missed} status={status} onChange={setEventStatus} />
          )}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">
          One-off & multi-day events{" "}
          <span className="text-sm font-normal opacity-60">({payload.oneOffs.length})</span>
        </h2>
        {payload.oneOffs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/20 p-4 text-sm opacity-70 dark:border-white/20">
            No single or multi-day events found.
          </p>
        ) : view === "table" ? (
          <EventTableRows events={payload.oneOffs} status={status} onChange={setEventStatus} />
        ) : (
          <EventListRows events={payload.oneOffs} status={status} onChange={setEventStatus} />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">
          Recurring events{" "}
          <span className="text-sm font-normal opacity-60">
            ({payload.recurringSeries.length} series)
          </span>
        </h2>
        <p className="text-sm opacity-70">
          Off by default — rehearsal and standing meetings rarely mean you can&apos;t play. Flip a
          series on if it&apos;s a real conflict.
        </p>
        {payload.recurringSeries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/20 p-4 text-sm opacity-70 dark:border-white/20">
            No recurring events found.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {payload.recurringSeries.map((s) => {
              const total = s.instances.length;
              const blocked = s.instances.filter((i) => (status[i.id] ?? "free") !== "free").length;
              const isOpen = expanded.has(s.seriesId);
              return (
                <li key={s.seriesId} className="rounded-xl border border-black/10 dark:border-white/10">
                  <div className="flex flex-wrap items-center gap-3 p-3">
                    <div className="flex flex-1 flex-col">
                      <span className="font-medium">{s.summary}</span>
                      <span className="text-sm opacity-70">
                        {total} instance{total === 1 ? "" : "s"}
                        {blocked > 0 && ` · ${blocked} blocked`}
                      </span>
                    </div>
                    <BulkStatusButtons onPick={(next) => setSeriesStatus(s, next)} />
                    <button
                      type="button"
                      onClick={() => toggleExpanded(s.seriesId)}
                      className="text-sm underline opacity-70 hover:opacity-100"
                    >
                      {isOpen ? "Hide" : "Instances"}
                    </button>
                  </div>
                  {isOpen && (
                    <div className="border-t border-black/10 p-3 dark:border-white/10">
                      {view === "table" ? (
                        <EventTableRows
                          events={s.instances}
                          status={status}
                          onChange={setEventStatus}
                        />
                      ) : (
                        <EventListRows
                          events={s.instances}
                          status={status}
                          onChange={setEventStatus}
                        />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-full border border-black/15 bg-paper/95 px-5 py-3 shadow-lg backdrop-blur dark:border-white/20 dark:bg-black/70">
        <span className="text-sm">
          <span className="font-semibold">{blockedCount}</span> event
          {blockedCount === 1 ? "" : "s"} to block
        </span>
        <button
          type="submit"
          disabled={blockedCount === 0}
          className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {applyLabel} {blockedCount || ""} as unavailability
        </button>
      </div>
    </form>
  );
}

type RowsProps = {
  events: ReviewableEvent[];
  status: Record<string, ImportStatus>;
  onChange: (id: string, next: ImportStatus) => void;
};

function EventListRows({ events, status, onChange }: RowsProps) {
  return (
    <ul className="flex flex-col gap-2">
      {events.map((e) => (
        <li
          key={e.id}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-black/10 p-3 dark:border-white/10"
        >
          <div className="flex flex-1 flex-col min-w-0">
            <span className="font-medium">{e.summary}</span>
            <span className="text-sm opacity-70">
              {rangeLabel(e)}
              {e.spanDays >= 2 && (
                <> · <span className="font-medium">{e.spanDays} days</span></>
              )}
              {!e.isAllDay && e.spanDays === 1 && <> · timed</>}
            </span>
          </div>
          <StatusPill current={status[e.id] ?? "free"} onChange={(next) => onChange(e.id, next)} />
        </li>
      ))}
    </ul>
  );
}

function EventTableRows({ events, status, onChange }: RowsProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
      <table className="w-full text-sm">
        <thead className="bg-black/5 text-left text-xs uppercase tracking-wide dark:bg-white/5">
          <tr>
            <th className="px-3 py-2" scope="col">Date</th>
            <th className="px-3 py-2" scope="col">Day</th>
            <th className="px-3 py-2" scope="col">Event</th>
            <th className="px-3 py-2" scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-t border-black/5 dark:border-white/10">
              <td className="px-3 py-2 align-middle whitespace-nowrap">{rangeLabel(e)}</td>
              <td className="px-3 py-2 align-middle opacity-70 whitespace-nowrap">{dayLabel(e.startDate)}</td>
              <td className="px-3 py-2 align-middle">
                {e.summary}
                {e.spanDays >= 2 && (
                  <span className="opacity-60"> · {e.spanDays} days</span>
                )}
              </td>
              <td className="px-3 py-2 align-middle">
                <StatusPill
                  current={status[e.id] ?? "free"}
                  onChange={(next) => onChange(e.id, next)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type PillProps = {
  current: ImportStatus;
  onChange: (next: ImportStatus) => void;
};

const PILL_OPTIONS: { value: ImportStatus; label: string; on: string }[] = [
  { value: "free",  label: "Free",  on: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { value: "busy",  label: "Busy",  on: "bg-red-500/15 text-red-700 dark:text-red-300" },
  { value: "maybe", label: "Maybe", on: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
];

function StatusPill({ current, onChange }: PillProps) {
  return (
    <div
      role="group"
      aria-label="Status"
      className="inline-flex overflow-hidden rounded-full border border-black/15 bg-black/5 p-0.5 dark:border-white/20 dark:bg-white/5"
    >
      {PILL_OPTIONS.map((opt) => {
        const active = current === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={
              "rounded-full px-3 py-1 text-xs font-medium transition-colors " +
              (active ? opt.on + " font-semibold" : "opacity-70 hover:opacity-100")
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function BulkStatusButtons({ onPick }: { onPick: (next: ImportStatus) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <span className="mr-1 opacity-60">Mark all:</span>
      {PILL_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onPick(opt.value)}
          className="rounded-full border border-black/15 bg-white px-2.5 py-1 font-medium hover:bg-black/5 dark:border-white/20 dark:bg-white/5 dark:hover:bg-white/10"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Verify in a browser**

Start the dev server (`npm run dev`), visit `/dashboard/availability/import` (requires a connected Google Calendar; if the vault PR hasn't landed yet, exercise the ICS upload path instead at `/dashboard/availability/import/ics`). Verify:
- Each event row shows the Free/Busy/Maybe pill with the correct default (missed → Free; one-off → Busy; recurring → Free).
- Clicking a pill button updates the highlight and the count in the sticky bar.
- Series card has three "Mark all Free / Busy / Maybe" buttons; clicking one sets every instance in that series.
- Table view shows a visible "Status" column header.
- Table and List toggle still remembers preference across reloads.
- Submitting with everything on Free lands on `/dashboard/availability?import_error=nothing_selected` with the new copy.
- Submitting a mix of Busy and Maybe inserts rows with the right `is_tentative` values (check in Supabase or on the availability page).

Fix anything broken before moving on.

- [ ] **Step 5: Commit**

```bash
git add components/availability/import-review.tsx
git commit -m "feat(import): segmented pill status control, bulk series buttons, visible Status column"
```

---

## Task 4: Extract UpcomingBlocks with List/Table toggle on availability page

**Files:**
- Create: `components/availability/upcoming-blocks.tsx`
- Modify: `app/dashboard/availability/page.tsx:165-215` (replace inline list rendering)

- [ ] **Step 1: Create `components/availability/upcoming-blocks.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { ClearScheduleButton } from "./clear-schedule-button";

type ViewMode = "list" | "table";
const VIEW_STORAGE_KEY = "bandsnap:availability-view";

function readStoredView(): ViewMode {
  if (typeof window === "undefined") return "list";
  try {
    const v = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return v === "table" ? "table" : "list";
  } catch {
    return "list";
  }
}

type Block = {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  is_tentative: boolean;
};

type Props = {
  blocks: Block[];
  removeAction: (id: string) => Promise<void> | void;
  toggleTentativeAction: (id: string, tentative: boolean) => Promise<void> | void;
};

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const fmt = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00`));
const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const dayLabel = (iso: string) => dayFmt.format(new Date(`${iso}T00:00:00`));

function rangeLabel(b: Block): string {
  return b.start_date === b.end_date ? fmt(b.start_date) : `${fmt(b.start_date)} → ${fmt(b.end_date)}`;
}

export function UpcomingBlocks({ blocks, removeAction, toggleTentativeAction }: Props) {
  const [view, setView] = useState<ViewMode>("list");

  useEffect(() => {
    const stored = readStoredView();
    if (stored !== "list") setView(stored);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      // Private browsing / storage disabled.
    }
  }, [view]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Upcoming blocks</h2>
        <div className="flex items-center gap-3">
          {blocks.length > 0 && (
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
          )}
          <ClearScheduleButton count={blocks.length} />
        </div>
      </div>

      {blocks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/20 p-6 text-center opacity-80 dark:border-white/20">
          No blocked dates. Add a range above or pull from Google Calendar.
        </p>
      ) : view === "table" ? (
        <BlocksTable
          blocks={blocks}
          removeAction={removeAction}
          toggleTentativeAction={toggleTentativeAction}
        />
      ) : (
        <BlocksList
          blocks={blocks}
          removeAction={removeAction}
          toggleTentativeAction={toggleTentativeAction}
        />
      )}
    </section>
  );
}

function BlocksList({ blocks, removeAction, toggleTentativeAction }: Props) {
  return (
    <ul className="flex flex-col gap-2">
      {blocks.map((b) => (
        <li
          key={b.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 p-3 dark:border-white/10"
        >
          <div className="flex-1 min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              <span>{rangeLabel(b)}</span>
              {b.is_tentative && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  Maybe
                </span>
              )}
            </p>
            {b.reason && <p className="text-sm opacity-70">{b.reason}</p>}
          </div>
          <div className="flex items-center gap-3">
            <form action={toggleTentativeAction.bind(null, b.id, !b.is_tentative)}>
              <button type="submit" className="text-sm opacity-70 hover:underline hover:opacity-100">
                {b.is_tentative ? "Mark as firm" : "Switch to maybe"}
              </button>
            </form>
            <form action={removeAction.bind(null, b.id)}>
              <button type="submit" className="text-sm text-red-600 hover:underline">
                Remove
              </button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}

function BlocksTable({ blocks, removeAction, toggleTentativeAction }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
      <table className="w-full text-sm">
        <thead className="bg-black/5 text-left text-xs uppercase tracking-wide dark:bg-white/5">
          <tr>
            <th className="px-3 py-2" scope="col">Date</th>
            <th className="px-3 py-2" scope="col">Day</th>
            <th className="px-3 py-2" scope="col">Status</th>
            <th className="px-3 py-2" scope="col">Reason</th>
            <th className="px-3 py-2 text-right" scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((b) => (
            <tr key={b.id} className="border-t border-black/5 dark:border-white/10">
              <td className="px-3 py-2 align-middle whitespace-nowrap">{rangeLabel(b)}</td>
              <td className="px-3 py-2 align-middle opacity-70 whitespace-nowrap">
                {dayLabel(b.start_date)}
              </td>
              <td className="px-3 py-2 align-middle">
                {b.is_tentative ? (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                    Maybe
                  </span>
                ) : (
                  <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">
                    Firm
                  </span>
                )}
              </td>
              <td className="px-3 py-2 align-middle opacity-80">{b.reason ?? ""}</td>
              <td className="px-3 py-2 align-middle text-right">
                <div className="inline-flex items-center gap-3">
                  <form action={toggleTentativeAction.bind(null, b.id, !b.is_tentative)}>
                    <button type="submit" className="text-sm opacity-70 hover:underline hover:opacity-100">
                      {b.is_tentative ? "Mark as firm" : "Switch to maybe"}
                    </button>
                  </form>
                  <form action={removeAction.bind(null, b.id)}>
                    <button type="submit" className="text-sm text-red-600 hover:underline">
                      Remove
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Replace the inline rendering in `app/dashboard/availability/page.tsx`**

In `app/dashboard/availability/page.tsx`, update imports at the top:

```tsx
import { ClearScheduleButton } from "@/components/availability/clear-schedule-button";
```

Remove the above line and add:

```tsx
import { UpcomingBlocks } from "@/components/availability/upcoming-blocks";
```

Then replace the entire `<section>` block that renders Upcoming blocks (lines 165-215) with:

```tsx
<UpcomingBlocks
  blocks={blocks ?? []}
  removeAction={removeUnavailability}
  toggleTentativeAction={setUnavailabilityTentative}
/>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Verify in a browser**

Start dev server and visit `/dashboard/availability`. Add a block and a tentative block if the list is empty. Verify:
- The `[≡ List][▦ Table]` toggle appears to the left of "Clear schedule" when there's at least one block, and is hidden when empty.
- List view is unchanged from before (ranges, Maybe badge, "Switch to maybe"/"Remove" controls).
- Table view shows columns Date / Day / Status / Reason / Actions.
- Toggling to Table and reloading restores Table (localStorage persistence works).
- Switching Maybe/Firm from the table row updates the row immediately after action completes.
- Import review page's own view-mode toggle still works independently (different localStorage key).

- [ ] **Step 6: Commit**

```bash
git add components/availability/upcoming-blocks.tsx app/dashboard/availability/page.tsx
git commit -m "feat(availability): List/Table toggle on upcoming blocks"
```

---

## Self-Review

**Spec coverage:**
- Pill control on every event row (missed / one-offs / recurring instances) → Task 3 ✓
- Visible "Status" table column header → Task 3 ✓
- Series bulk Mark all Free/Busy/Maybe → Task 3 (`BulkStatusButtons`) ✓
- Server action status-per-event parsing + `is_tentative` emit → Task 2 ✓
- `applyIcsImport` parallel change → Task 2 ✓
- Updated `nothing_selected` copy → Task 2 ✓
- `/dashboard/availability` List/Table toggle with separate localStorage key → Task 4 ✓
- Shared status helpers (defaults, serialization) → Task 1 ✓

**No placeholders detected.** All code blocks are complete; file paths and line ranges are specific.

**Type consistency:** `ImportStatus` is defined once in `types/calendar-import.ts` and used by both server actions and the client component. `statusInputValue` / `parseStatusEntry` are the only serialization boundary. `Block` type in `upcoming-blocks.tsx` matches the shape selected from Supabase in `page.tsx` (`id, start_date, end_date, reason, is_tentative`).

**Known trade-off between tasks:** After Task 2 lands but before Task 3, the UI still submits `selected` form entries, so any import attempted during that window will route to the `nothing_selected` branch. Tasks 2 and 3 should be executed back-to-back and only end-to-end tested after Task 3 — Task 2's verification step is type-check only, by design.
