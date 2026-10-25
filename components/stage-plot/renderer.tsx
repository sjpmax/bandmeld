import type { StagePlot } from "@/types/stage-plot";
import { KIND_LABELS } from "@/types/stage-plot";
import { StageIcon } from "./icon";

type Props = {
  plot: StagePlot;
  /** When true, draws a dashed guide grid (editor only). */
  showGuides?: boolean;
};

/**
 * Read-only renderer. 16:9 aspect ratio. Items are positioned by their
 * normalized (x, y) coords with 0,0 at the top-left and 1,1 at the
 * bottom-right. "Crowd" label is baked in at the bottom edge.
 */
export function StagePlotRenderer({ plot, showGuides = false }: Props) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-black/15 bg-paper text-ink dark:border-white/15 dark:bg-[#1a1a1a] dark:text-[#f2efe9]"
      style={{ aspectRatio: "16 / 9" }}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 160 90"
        preserveAspectRatio="none"
        aria-hidden
      >
        {showGuides && (
          <>
            <line x1="40" y1="0" x2="40" y2="90" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="2 2" />
            <line x1="80" y1="0" x2="80" y2="90" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="2 2" />
            <line x1="120" y1="0" x2="120" y2="90" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="2 2" />
            <line x1="0" y1="30" x2="160" y2="30" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="2 2" />
            <line x1="0" y1="60" x2="160" y2="60" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="2 2" />
          </>
        )}
      </svg>

      {plot.items.map((item) => {
        const captionLabel = item.label ?? (item.kind === "label" ? "" : KIND_LABELS[item.kind]);
        return (
          <div
            key={item.id}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
            style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%` }}
          >
            <StageIcon kind={item.kind} size={36} />
            {captionLabel && (
              <span className="whitespace-nowrap rounded bg-paper/80 px-1 text-[10px] font-medium leading-tight backdrop-blur-sm dark:bg-black/40">
                {captionLabel}
              </span>
            )}
          </div>
        );
      })}

      <div className="pointer-events-none absolute inset-x-0 bottom-1.5 text-center text-[11px] font-semibold uppercase tracking-widest opacity-60">
        ─── Crowd ───
      </div>
    </div>
  );
}
