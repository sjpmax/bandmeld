import Link from "next/link";

type Props = { bandSlug: string };

export function StagePlotMobileNudge({ bandSlug }: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-black/15 bg-paper p-5 text-sm dark:border-white/15">
      <p className="font-medium">
        Stage plot editing needs a larger screen.
      </p>
      <p className="opacity-70">
        Open BandSnap on a tablet or desktop to drag icons onto the stage.
      </p>
      <Link
        href={`/bands/${bandSlug}/stage-plot`}
        className="self-start rounded-full border border-black/15 px-3.5 py-1.5 text-xs font-semibold hover:border-current dark:border-white/20"
      >
        View current plot ↗
      </Link>
    </div>
  );
}
