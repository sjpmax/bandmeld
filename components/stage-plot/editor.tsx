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
