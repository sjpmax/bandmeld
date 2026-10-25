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
