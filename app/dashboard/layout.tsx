import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireUserId } from "@/utils/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts already redirects guests; this is defence-in-depth for
  // anything rendered under /dashboard.
  await requireUserId("/dashboard");

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-black/10 bg-paper/90 backdrop-blur dark:border-white/10 dark:bg-black/60">
        <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold">
            <Logo height={32} />
            <span className="hidden sm:inline">BandSnap</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/dashboard/availability">My availability</Link>
            <ThemeToggle />
            <form action={signOut}>
              <button type="submit" className="opacity-70 hover:opacity-100">Sign out</button>
            </form>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
