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
          {/* Crash cymbals on angled stands */}
          <line x1="8" y1="18" x2="8" y2="38" />
          <line x1="40" y1="18" x2="40" y2="38" />
          <ellipse cx="8" cy="14" rx="6" ry="2" />
          <ellipse cx="40" cy="14" rx="6" ry="2" />
          {/* Kick drum (large circle front and center) */}
          <circle cx="24" cy="32" r="8" />
          <circle cx="24" cy="32" r="2.5" />
          {/* Snare on stand (small drum between crashes) */}
          <ellipse cx="24" cy="20" rx="5" ry="2" />
          <line x1="22" y1="22" x2="22" y2="26" />
          <line x1="26" y1="22" x2="26" y2="26" />
          {/* Kick pedal hint */}
          <line x1="24" y1="40" x2="24" y2="43" />
        </svg>
      );

    case "bass_cab":
      return (
        <svg {...common}>
          {/* Tall cabinet */}
          <rect x="12" y="6" width="24" height="36" rx="1.5" />
          {/* Single 15" speaker driver (large) */}
          <circle cx="24" cy="22" r="9" />
          <circle cx="24" cy="22" r="3" />
          {/* Handle slot at top */}
          <rect x="20" y="3" width="8" height="2" rx="1" />
          {/* Nameplate at bottom */}
          <line x1="18" y1="38" x2="30" y2="38" />
        </svg>
      );

    case "bass_guitar":
      return (
        <svg {...common}>
          {/* Angled bass — longer neck than guitar */}
          {/* Body: offset lobes */}
          <path d="M14 36 C10 32, 10 28, 14 26 L18 24 C20 22, 24 22, 26 24 L22 32 C20 36, 18 38, 14 36 Z" />
          {/* Neck */}
          <line x1="22" y1="24" x2="38" y2="10" />
          <line x1="24" y1="26" x2="40" y2="12" />
          {/* Headstock with 2+2 tuners */}
          <path d="M38 10 L42 6 L46 10 L42 14 Z" />
          {/* Strings */}
          <line x1="16" y1="30" x2="40" y2="12" />
        </svg>
      );

    case "guitar_cab":
      return (
        <svg {...common}>
          {/* Square 4x12 cabinet */}
          <rect x="7" y="10" width="34" height="32" rx="1.5" />
          {/* 4 speakers in 2x2 grid */}
          <circle cx="16" cy="20" r="4.5" />
          <circle cx="32" cy="20" r="4.5" />
          <circle cx="16" cy="34" r="4.5" />
          <circle cx="32" cy="34" r="4.5" />
          {/* Handle slot at top */}
          <rect x="20" y="7" width="8" height="2" rx="1" />
        </svg>
      );

    case "guitar":
      return (
        <svg {...common}>
          {/* Angled electric guitar silhouette */}
          {/* Body — curved cutaways */}
          <path d="M10 38 C6 34, 6 28, 10 24 L16 20 C20 16, 26 16, 30 20 L26 26 C22 32, 18 38, 14 40 C12 41, 10 40, 10 38 Z" />
          {/* Soundhole / pickup suggestion */}
          <circle cx="18" cy="28" r="2.5" />
          {/* Neck */}
          <line x1="26" y1="22" x2="40" y2="10" />
          <line x1="28" y1="24" x2="42" y2="12" />
          {/* Frets */}
          <line x1="30" y1="18" x2="32" y2="20" />
          <line x1="34" y1="14" x2="36" y2="16" />
          {/* Headstock */}
          <path d="M40 10 L44 6 L46 10 L42 14 Z" />
        </svg>
      );

    case "keys":
      return (
        <svg {...common}>
          {/* Keyboard body with slight angle */}
          <rect x="4" y="14" width="40" height="22" rx="1" />
          {/* White keys dividers */}
          <line x1="12" y1="14" x2="12" y2="36" />
          <line x1="20" y1="14" x2="20" y2="36" />
          <line x1="28" y1="14" x2="28" y2="36" />
          <line x1="36" y1="14" x2="36" y2="36" />
          {/* Black keys */}
          <rect x="9" y="14" width="4" height="12" />
          <rect x="17" y="14" width="4" height="12" />
          <rect x="29" y="14" width="4" height="12" />
          <rect x="33" y="14" width="4" height="12" />
          {/* Top control strip */}
          <line x1="6" y1="11" x2="20" y2="11" />
        </svg>
      );

    case "vocal_mic":
      return (
        <svg {...common}>
          {/* Ball head */}
          <circle cx="24" cy="10" r="5" />
          {/* Grill lines */}
          <line x1="21" y1="8" x2="27" y2="8" />
          <line x1="20" y1="10" x2="28" y2="10" />
          <line x1="21" y1="12" x2="27" y2="12" />
          {/* Handle */}
          <path d="M22 15 L22 24 L26 24 L26 15" />
          {/* Clip connector */}
          <rect x="21" y="24" width="6" height="2" rx="0.5" />
          {/* Stand */}
          <line x1="24" y1="26" x2="24" y2="40" />
          {/* Base */}
          <line x1="16" y1="42" x2="32" y2="42" />
          <line x1="19" y1="40" x2="24" y2="42" />
          <line x1="29" y1="40" x2="24" y2="42" />
        </svg>
      );

    case "instrument_mic":
      return (
        <svg {...common}>
          {/* Angled condenser/SM57 */}
          {/* Capsule */}
          <ellipse cx="14" cy="14" rx="5" ry="3" transform="rotate(-30 14 14)" />
          {/* Body */}
          <path d="M17 16 L30 28 L34 24 L21 12 Z" />
          {/* Grill lines on capsule */}
          <line x1="12" y1="12" x2="16" y2="16" />
          <line x1="10" y1="14" x2="14" y2="18" />
          {/* Stand clip + boom */}
          <line x1="32" y1="26" x2="38" y2="32" />
          {/* Base post */}
          <line x1="38" y1="32" x2="38" y2="42" />
          <line x1="32" y1="42" x2="44" y2="42" />
        </svg>
      );

    case "monitor_wedge":
      return (
        <svg {...common}>
          {/* Angled trapezoid (viewed from side) */}
          <path d="M5 36 L43 36 L37 14 L11 14 Z" />
          {/* Large driver */}
          <circle cx="24" cy="24" r="6" />
          <circle cx="24" cy="24" r="2" />
          {/* Horn tweeter at top */}
          <path d="M20 10 L28 10 L26 14 L22 14 Z" />
          {/* Cable hint */}
          <path d="M43 36 C45 38, 44 40, 42 40" />
        </svg>
      );

    case "di_box":
      return (
        <svg {...common}>
          {/* Small rugged box */}
          <rect x="10" y="14" width="28" height="22" rx="1" />
          {/* Input jack */}
          <circle cx="16" cy="22" r="2" />
          <circle cx="16" cy="22" r="0.8" />
          {/* Output jack */}
          <circle cx="32" cy="22" r="2" />
          <circle cx="32" cy="22" r="0.8" />
          {/* Ground lift switch */}
          <rect x="21" y="28" width="6" height="3" rx="0.5" />
          {/* Label strip */}
          <line x1="12" y1="34" x2="36" y2="34" />
          {/* Side bumpers / corner protectors */}
          <line x1="10" y1="16" x2="12" y2="16" />
          <line x1="36" y1="16" x2="38" y2="16" />
        </svg>
      );

    case "power":
      return (
        <svg {...common}>
          {/* Power strip body */}
          <rect x="6" y="18" width="36" height="14" rx="2" />
          {/* Three outlets, each with two prongs */}
          <circle cx="14" cy="25" r="3" />
          <line x1="12.8" y1="24" x2="12.8" y2="26" />
          <line x1="15.2" y1="24" x2="15.2" y2="26" />
          <circle cx="24" cy="25" r="3" />
          <line x1="22.8" y1="24" x2="22.8" y2="26" />
          <line x1="25.2" y1="24" x2="25.2" y2="26" />
          <circle cx="34" cy="25" r="3" />
          <line x1="32.8" y1="24" x2="32.8" y2="26" />
          <line x1="35.2" y1="24" x2="35.2" y2="26" />
          {/* Cable snaking off left */}
          <path d="M6 32 C4 34, 2 36, 4 40" />
        </svg>
      );

    case "riser":
      return (
        <svg {...common}>
          {/* Isometric platform */}
          {/* Top face */}
          <path d="M8 24 L24 18 L40 24 L24 30 Z" />
          {/* Front face */}
          <path d="M8 24 L8 34 L24 40 L40 34 L40 24" />
          <line x1="24" y1="30" x2="24" y2="40" />
        </svg>
      );

    case "person":
      return (
        <svg {...common}>
          {/* Head */}
          <circle cx="24" cy="14" r="5" />
          {/* Shoulders and body */}
          <path d="M12 42 C12 32, 16 28, 24 28 C32 28, 36 32, 36 42" />
        </svg>
      );

    case "label":
      return (
        <svg {...common}>
          {/* Text container with handle on left (like a tag) */}
          <path d="M8 20 L14 14 L40 14 L42 16 L42 32 L40 34 L14 34 Z" />
          {/* Grommet hole */}
          <circle cx="14" cy="24" r="1.5" />
          {/* Text suggestion lines */}
          <line x1="20" y1="20" x2="36" y2="20" />
          <line x1="20" y1="24" x2="34" y2="24" />
          <line x1="20" y1="28" x2="30" y2="28" />
        </svg>
      );
  }
}
