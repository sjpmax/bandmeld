import { z } from "zod";

// The full set of icon kinds. Order matters for display in the gear tray.
export const ICON_KINDS = [
  "drum_kit",
  "guitar",
  "bass_guitar",
  "amp",
  "keys",
  "mic",
  "person",
  "label",
] as const;

export type IconKind = (typeof ICON_KINDS)[number];

// Kinds that show up in the gear tray (everything except person/label — those
// come from the roster section and the Guest/Label slots respectively).
export const GEAR_KINDS: IconKind[] = [
  "drum_kit",
  "guitar",
  "bass_guitar",
  "amp",
  "keys",
  "mic",
];

// Kinds that trigger the "Add to input list?" nudge when dropped.
export const INPUT_LIKE_KINDS: IconKind[] = ["mic"];

// Human labels used in trays and nudges.
export const KIND_LABELS: Record<IconKind, string> = {
  drum_kit: "Drums",
  guitar: "Guitar",
  bass_guitar: "Bass",
  amp: "Amp",
  keys: "Keys",
  mic: "Mic",
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
 * Maps legacy icon kinds (pre-simplification) onto the current set.
 * A `null` value means the item should be dropped entirely — those kinds
 * (DI box, monitor wedge, power, riser, dedicated instrument mic) are now
 * considered venue-provided and don't belong on the band's own plot.
 */
const LEGACY_KIND_MIGRATION: Record<string, IconKind | null> = {
  bass_cab: "amp",
  guitar_cab: "amp",
  vocal_mic: "mic",
  instrument_mic: "mic",
  monitor_wedge: null,
  di_box: null,
  power: null,
  riser: null,
};

/** Rewrites a raw stage_plot blob so legacy item kinds survive Zod parsing. */
function migrateLegacyKinds(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const obj = raw as { items?: unknown };
  if (!Array.isArray(obj.items)) return raw;

  const items: unknown[] = [];
  for (const item of obj.items) {
    if (!item || typeof item !== "object") {
      items.push(item);
      continue;
    }
    const kind = (item as { kind?: unknown }).kind;
    if (typeof kind !== "string") {
      items.push(item);
      continue;
    }
    if (kind in LEGACY_KIND_MIGRATION) {
      const next = LEGACY_KIND_MIGRATION[kind];
      if (next === null) continue; // drop
      items.push({ ...item, kind: next });
    } else {
      items.push(item);
    }
  }
  return { ...obj, items };
}

/**
 * Parse an unknown value (e.g. `bands.stage_plot` which is `Json | null`) into
 * a valid StagePlot, or return EMPTY_STAGE_PLOT if the value is null/malformed.
 * The editor and all renderers use this so a corrupt or legacy blob never
 * crashes the page. Legacy icon kinds are migrated before validation.
 */
export function parseStagePlot(raw: unknown): StagePlot {
  if (raw == null) return EMPTY_STAGE_PLOT;
  const migrated = migrateLegacyKinds(raw);
  const result = stagePlotSchema.safeParse(migrated);
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
