import Link from "next/link";

type Props = {
  bandId: string;
  bandName: string;
  slug: string;
  logoUrl?: string | null;
  activeTab: "settings" | "availability";
};

export function BandSubNav({
  bandId,
  bandName,
  slug,
  logoUrl,
  activeTab,
}: Props) {
  const tabClass = (tab: "settings" | "availability") =>
    `rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
      activeTab === tab
        ? "bg-black text-white dark:bg-white dark:text-black"
        : "opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
    }`;

  return (
    <div className="flex flex-col gap-4 border-b border-black/10 pb-5 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${bandName} logo`}
              className="h-14 w-14 rounded-md border border-black/10 bg-paper object-contain p-1 dark:border-white/10"
            />
          ) : (
            <div
              aria-hidden
              className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-black/20 text-xs opacity-50 dark:border-white/20"
            >
              Logo
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl tracking-tight">{bandName}</h1>
            <p className="text-xs opacity-60">Manage band profile, roster, and tour dates</p>
          </div>
        </div>

        <Link
          href={`/bands/${slug}`}
          target="_blank"
          rel="noopener"
          className="rounded-full border border-black/15 px-3.5 py-1.5 text-xs font-semibold hover:border-current dark:border-white/20"
        >
          View Public EPK ↗
        </Link>
      </div>

      <nav className="flex flex-wrap items-center gap-2 pt-2">
        <Link href={`/dashboard/bands/${bandId}`} className={tabClass("settings")}>
          Settings & Roster
        </Link>
        <Link
          href={`/dashboard/bands/${bandId}/availability`}
          className={tabClass("availability")}
        >
          Availability Calendar
        </Link>
      </nav>
    </div>
  );
}

