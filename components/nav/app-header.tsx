import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

type Props = {
  /** True when a signed-in user is viewing the page. */
  authed: boolean;
  /**
   * Count of bands the signed-in user is a member of. Picks the singular
   * ("My band") vs plural ("My bands") label on the nav link. Ignored when
   * `authed` is false.
   */
  bandCount: number;
};

/**
 * Sticky top-of-page nav used across signed-in surfaces (/dashboard, /explore).
 *
 * - When signed in: Explore | My band(s) | My availability | theme | Sign out.
 *   "My band" is singular when the user is in exactly one band; "My bands"
 *   otherwise (including zero — the /dashboard landing has an empty-state
 *   create-a-band CTA).
 * - When signed out: Explore | theme | Log in. /explore is a public page,
 *   so the layout rendering this component must NOT redirect unauthenticated
 *   viewers.
 *
 * The caller is responsible for layout chrome around <main>; this component
 * only paints the <header> element.
 */
export function AppHeader({ authed, bandCount }: Props) {
  const myBandsLabel = authed && bandCount === 1 ? "My band" : "My bands";
  return (
    <header className="sticky top-0 z-10 border-b border-black/10 bg-paper/90 backdrop-blur dark:border-white/10 dark:bg-black/60">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href={authed ? "/dashboard" : "/"} className="flex items-center gap-2 font-bold">
          <Logo height={32} />
          <span className="hidden sm:inline">BandSnap</span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/explore">Explore</Link>
          {authed ? (
            <>
              <Link href="/dashboard">{myBandsLabel}</Link>
              <Link href="/dashboard/availability">My availability</Link>
              <ThemeToggle />
              <form action={signOut}>
                <button type="submit" className="opacity-70 hover:opacity-100">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <ThemeToggle />
              <Link href="/login" className="opacity-70 hover:opacity-100">
                Log in
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
