import type { IconKind } from "@/types/stage-plot";

type Props = {
  kind: IconKind;
  size?: number;
  className?: string;
};

/**
 * Minimal mono-color SVG per icon kind. Uses `currentColor` so parents can
 * theme via `text-...` Tailwind classes. 48x48 viewBox; `size` sets rendered
 * dimension (defaults to 48).
 */
export function StageIcon({ kind, size = 48, className }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 48 48",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  switch (kind) {
    case "drum_kit":
      return (
        <svg {...common}>
          <ellipse cx="24" cy="30" rx="12" ry="4" />
          <line x1="12" y1="30" x2="12" y2="40" />
          <line x1="36" y1="30" x2="36" y2="40" />
          <circle cx="12" cy="14" r="5" />
          <circle cx="36" cy="14" r="5" />
        </svg>
      );
    case "bass_cab":
      return (
        <svg {...common}>
          <rect x="8" y="8" width="32" height="32" rx="2" />
          <circle cx="24" cy="26" r="8" />
        </svg>
      );
    case "guitar_cab":
      return (
        <svg {...common}>
          <rect x="8" y="8" width="32" height="32" rx="2" />
          <circle cx="16" cy="20" r="5" />
          <circle cx="32" cy="20" r="5" />
          <circle cx="16" cy="34" r="5" />
          <circle cx="32" cy="34" r="5" />
        </svg>
      );
    case "bass_guitar":
    case "guitar":
      return (
        <svg {...common}>
          <circle cx="18" cy="34" r="8" />
          <line x1="24" y1="30" x2="40" y2="10" />
          <line x1="38" y1="8" x2="42" y2="12" />
        </svg>
      );
    case "keys":
      return (
        <svg {...common}>
          <rect x="6" y="14" width="36" height="20" rx="1" />
          <line x1="14" y1="14" x2="14" y2="28" />
          <line x1="22" y1="14" x2="22" y2="28" />
          <line x1="30" y1="14" x2="30" y2="28" />
          <line x1="38" y1="14" x2="38" y2="28" />
        </svg>
      );
    case "vocal_mic":
      return (
        <svg {...common}>
          <circle cx="24" cy="14" r="6" />
          <line x1="24" y1="20" x2="24" y2="36" />
          <line x1="18" y1="36" x2="30" y2="36" />
          <line x1="24" y1="36" x2="24" y2="42" />
        </svg>
      );
    case "instrument_mic":
      return (
        <svg {...common}>
          <rect x="18" y="8" width="12" height="8" rx="2" />
          <line x1="24" y1="16" x2="24" y2="40" />
          <line x1="18" y1="40" x2="30" y2="40" />
        </svg>
      );
    case "monitor_wedge":
      return (
        <svg {...common}>
          <polygon points="6,34 42,34 36,16 12,16" />
          <circle cx="24" cy="26" r="4" />
        </svg>
      );
    case "di_box":
      return (
        <svg {...common}>
          <rect x="12" y="16" width="24" height="16" rx="2" />
          <circle cx="18" cy="24" r="2" />
          <circle cx="30" cy="24" r="2" />
        </svg>
      );
    case "power":
      return (
        <svg {...common}>
          <rect x="8" y="18" width="32" height="12" rx="2" />
          <circle cx="16" cy="24" r="1.5" />
          <circle cx="24" cy="24" r="1.5" />
          <circle cx="32" cy="24" r="1.5" />
        </svg>
      );
    case "riser":
      return (
        <svg {...common}>
          <rect x="6" y="20" width="36" height="18" rx="1" />
          <line x1="6" y1="26" x2="42" y2="26" />
        </svg>
      );
    case "person":
      return (
        <svg {...common}>
          <circle cx="24" cy="14" r="6" />
          <path d="M12 42 C12 32 36 32 36 42" />
        </svg>
      );
    case "label":
      return (
        <svg {...common}>
          <rect x="6" y="14" width="36" height="20" rx="2" />
        </svg>
      );
  }
}
