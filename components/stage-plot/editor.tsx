"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { saveStagePlot } from "@/app/dashboard/bands/[bandId]/stage-plot/actions";
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
  const [nudgeDismissed, setNudgeDismissed] = useState<Set<string>>(new Set());
  const [nudgeFor, setNudgeFor] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  type SaveStatus = "idle" | "saving" | "saved" | "unsaved";
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const dirtyRef = useRef(false);
  const didMountRef = useRef(false);
  const justDraggedRef = useRef(false);

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
    if (INPUT_LIKE_KINDS.includes(item.kind)) {
      setNudgeFor(item.id);
    }
  }

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
    if (drag.kind === "canvas") justDraggedRef.current = true;
    setDrag({ kind: "none" });
  }

  function onBackgroundClick() {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    setSelectedId(null);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
      e.preventDefault();
      deleteItem(selectedId);
    }
  }

  // Mark the plot dirty on user-driven state changes. Skip the mount pass
  // so just opening the editor doesn't trigger an unchanged-plot UPDATE.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
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

  return (
    <div className="flex flex-col gap-3" tabIndex={0} onKeyDown={onKeyDown}>
      <div className="flex items-center justify-end text-xs opacity-70">
        {saveStatus === "idle" && <span>&nbsp;</span>}
        {saveStatus === "saving" && <span>Saving…</span>}
        {saveStatus === "saved" && <span>Saved ✓</span>}
        {saveStatus === "unsaved" && (
          <span className="text-red-600">
            Unsaved changes —{" "}
            <button type="button" onClick={() => { dirtyRef.current = true; setPlot((p) => ({ ...p })); }} className="underline">
              retry
            </button>
          </span>
        )}
      </div>
      <div className="grid grid-cols-[180px_1fr_240px] gap-4">
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
            </div>
          );
        })}
        <div className="pointer-events-none absolute inset-x-0 bottom-1.5 text-center text-[11px] font-semibold uppercase tracking-widest opacity-60">
          ─── Crowd ───
        </div>
      </div>

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
      </div>
    </div>
  );
}
