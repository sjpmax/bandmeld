import type { IconKind } from "@/types/stage-plot";

type Props = {
  kind: IconKind;
  size?: number;
  className?: string;
};

/**
 * Mono-color SVG per icon kind. Uses `currentColor` so parents can theme via
 * `text-...` Tailwind classes. 48x48 viewBox; `size` sets rendered dimension.
 * Original artwork — line-art silhouettes inspired by common stage-plot
 * conventions. No licensed assets consumed.
 *
 * Set is intentionally minimal (8 kinds): drum kit, electric guitar, bass
 * guitar, amp, keys, mic, person, label. DI boxes, monitor wedges, power
 * strips, risers, and distinct instrument/vocal mics are all left to the
 * venue to provide — not drawn here.
 */
export function StageIcon({ kind, size = 48, className }: Props) {
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

  switch (kind) {
    case "drum_kit":
      return (
        <svg {...common}>
          <line x1="8" y1="18" x2="8" y2="38" />
          <line x1="40" y1="18" x2="40" y2="38" />
          <ellipse cx="8" cy="14" rx="6" ry="2" />
          <ellipse cx="40" cy="14" rx="6" ry="2" />
          <circle cx="24" cy="32" r="8" />
          <circle cx="24" cy="32" r="2.5" />
          <ellipse cx="24" cy="20" rx="5" ry="2" />
          <line x1="22" y1="22" x2="22" y2="26" />
          <line x1="26" y1="22" x2="26" y2="26" />
          <line x1="24" y1="40" x2="24" y2="43" />
        </svg>
      );

    case "guitar":
      return (
        <svg {...common}>
          {/* Electric guitar — Strat-like curves + horn cutaway */}
          <path d="M10 38 C6 34, 6 28, 10 24 L16 20 C20 16, 26 16, 30 20 L26 26 C22 32, 18 38, 14 40 C12 41, 10 40, 10 38 Z" />
          <circle cx="18" cy="28" r="2" />
          <rect x="20" y="26" width="6" height="2.5" />
          <line x1="26" y1="22" x2="40" y2="10" />
          <line x1="28" y1="24" x2="42" y2="12" />
          <line x1="30" y1="18" x2="32" y2="20" />
          <line x1="34" y1="14" x2="36" y2="16" />
          <path d="M40 10 L44 6 L46 10 L42 14 Z" />
        </svg>
      );

    case "bass_guitar":
      return (
        <svg {...common}>
          {/* Longer-neck bass — P-bass-like body */}
          <path d="M14 36 C10 32, 10 28, 14 26 L18 24 C20 22, 24 22, 26 24 L22 32 C20 36, 18 38, 14 36 Z" />
          <line x1="22" y1="24" x2="38" y2="10" />
          <line x1="24" y1="26" x2="40" y2="12" />
          <path d="M38 10 L42 6 L46 10 L42 14 Z" />
          <line x1="16" y1="30" x2="40" y2="12" />
        </svg>
      );

    case "amp":
      return (
        <svg {...common}>
          {/* Amp cabinet — single large speaker to read as "amp" without
              choosing a specific guitar/bass configuration */}
          <rect x="8" y="8" width="32" height="32" rx="2" />
          <circle cx="24" cy="24" r="10" />
          <circle cx="24" cy="24" r="3" />
          <line x1="12" y1="12" x2="20" y2="12" />
          <line x1="28" y1="12" x2="36" y2="12" />
        </svg>
      );

    case "keys":
      return (
        <svg {...common}>
          <rect x="4" y="14" width="40" height="22" rx="1" />
          <line x1="12" y1="14" x2="12" y2="36" />
          <line x1="20" y1="14" x2="20" y2="36" />
          <line x1="28" y1="14" x2="28" y2="36" />
          <line x1="36" y1="14" x2="36" y2="36" />
          <rect x="9" y="14" width="4" height="12" />
          <rect x="17" y="14" width="4" height="12" />
          <rect x="29" y="14" width="4" height="12" />
          <rect x="33" y="14" width="4" height="12" />
          <line x1="6" y1="11" x2="20" y2="11" />
        </svg>
      );

    case "mic":
      return (
        <svg {...common}>
          {/* Ball mic on a stand with a boom base — covers vocals and
              instrument miking without differentiating */}
          <circle cx="24" cy="10" r="5" />
          <line x1="21" y1="8" x2="27" y2="8" />
          <line x1="20" y1="10" x2="28" y2="10" />
          <line x1="21" y1="12" x2="27" y2="12" />
          <path d="M22 15 L22 24 L26 24 L26 15" />
          <rect x="21" y="24" width="6" height="2" rx="0.5" />
          <line x1="24" y1="26" x2="24" y2="40" />
          <line x1="16" y1="42" x2="32" y2="42" />
          <line x1="19" y1="40" x2="24" y2="42" />
          <line x1="29" y1="40" x2="24" y2="42" />
        </svg>
      );

    case "person":
      return (
        <svg {...common}>
          <circle cx="24" cy="14" r="5" />
          <path d="M12 42 C12 32, 16 28, 24 28 C32 28, 36 32, 36 42" />
        </svg>
      );

    case "label":
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
}
