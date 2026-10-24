import Link from "next/link";
import { Logo } from "@/components/logo";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-6 px-4 py-16">
      <Logo height={160} />
      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">BandSnap</h1>
      <p className="max-w-prose text-lg opacity-80">
        Sync your band&apos;s calendars, publish a press kit in minutes, and get booked.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/signup" className="rounded-full bg-accent px-5 py-2.5 font-medium text-white">
          Create your band
        </Link>
        <Link href="/login" className="rounded-full border border-current px-5 py-2.5 font-medium">
          Log in
        </Link>
      </div>
    </main>
  );
}
