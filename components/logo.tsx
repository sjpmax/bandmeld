import { useId } from "react";

/**
 * BandSnap mark (placeholder until the final artwork arrives).
 * Two puzzle pieces — band (left) and venue (right) — joined by beamed
 * eighth notes. Inline SVG so colours follow the site's light/dark theme.
 *
 * To swap in final artwork: replace this component's body with an
 * <Image src={...} /> of the new file; call sites don't change.
 */
export function Logo({ height = 40, className = "" }: { height?: number; className?: string }) {
  // Unique ids so two logos on one page don't share a mask.
  const uid = useId().replace(/:/g, "");
  const tabId = `tab-${uid}`;
  const maskId = `socket-${uid}`;

  return (
    <svg
      viewBox="0 0 240 160"
      height={height}
      width={Math.round(height * 1.5)}
      role="img"
      aria-label="BandSnap"
      className={className}
    >
      <defs>
        <path id={tabId} d="M116 72 H128 A16 16 0 1 1 128 88 H116 Z" />
        <mask id={maskId}>
          <rect width="240" height="160" fill="#fff" />
          <use href={`#${tabId}`} fill="#000" stroke="#000" strokeWidth={8} strokeLinejoin="round" />
        </mask>
      </defs>

      {/* left piece: the band */}
      <g className="fill-ink dark:fill-paper">
        <rect x="16" y="16" width="104" height="128" rx="14" />
        <use href={`#${tabId}`} />
      </g>

      {/* right piece: the venue, with a socket for the band's tab */}
      <rect className="fill-accent" x="124" y="16" width="100" height="128" rx="14" mask={`url(#${maskId})`} />

      {/* beamed eighth notes joining the two pieces */}
      <g className="fill-paper dark:fill-ink">
        <ellipse cx="62" cy="114" rx="16" ry="11.5" transform="rotate(-22 62 114)" />
        <ellipse cx="180" cy="102" rx="16" ry="11.5" transform="rotate(-22 180 102)" />
        <rect x="72.5" y="44" width="6" height="68" />
        <rect x="190.5" y="32" width="6" height="68" />
        <polygon points="72.5,42 196.5,30 196.5,46 72.5,58" />
      </g>
    </svg>
  );
}
