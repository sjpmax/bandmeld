import type { IconKind } from "@/types/stage-plot";

type Props = {
  kind: IconKind;
  size?: number;
  className?: string;
};

// Kinds whose artwork lives at /stage-plot/<kind>.png.
// person & label stay as inline SVG (no artwork provided and they theme
// cleanly with currentColor).
const IMAGE_KINDS: ReadonlySet<IconKind> = new Set([
  "drum_kit",
  "guitar",
  "acoustic_guitar",
  "bass_guitar",
  "amp",
  "keys",
  "mic",
  "di_box",
]);

/**
 * Icon per `IconKind`. Gear kinds render a PNG from /public/stage-plot/;
 * person and label stay as inline SVG tinted via currentColor. The PNG
 * artwork is black line-art on transparent — `dark:invert` flips it to
 * white against the dark stage canvas.
 */
export function StageIcon({ kind, size = 48, className }: Props) {
  if (IMAGE_KINDS.has(kind)) {
    return (
      <img
        src={`/stage-plot/${kind}.png`}
        width={size}
        height={size}
        alt=""
        aria-hidden
        draggable={false}
        className={`object-contain dark:invert${className ? ` ${className}` : ""}`}
      />
    );
  }

  const common = {
    width: size,
    height: size,
    viewBox: "0 0 48 48",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  if (kind === "person") {
    return (
      <svg {...common}>
        <circle cx="24" cy="14" r="5" />
        <path d="M12 42 C12 32, 16 28, 24 28 C32 28, 36 32, 36 42" />
      </svg>
    );
  }

  // label
  return (
    <svg {...common}>
      <path d="M8 20 L14 14 L40 14 L42 16 L42 32 L40 34 L14 34 Z" />
      <circle cx="14" cy="24" r="1.5" />
      <line x1="20" y1="20" x2="36" y2="20" />
      <line x1="20" y1="24" x2="34" y2="24" />
      <line x1="20" y1="28" x2="30" y2="28" />
    </svg>
  );
}
