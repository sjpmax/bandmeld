import Link from "next/link";
import { Logo } from "@/components/logo";
import { getUserId } from "@/utils/supabase/server";

export default async function HomePage() {
  const userId = await getUserId();

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-16 px-4 py-16">
      <section className="flex flex-col items-start gap-6">
        <Logo height={120} />
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">BandSnap</h1>
        <p className="max-w-prose text-xl opacity-80">
          Sync your band&apos;s calendars, bundle co-bills with other local acts, and pitch venues a
          turnkey show package — without the group-text spiral.
        </p>
        <div className="flex flex-wrap gap-3">
          {userId ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-accent px-5 py-2.5 font-medium text-white"
            >
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/signup"
                className="rounded-full bg-accent px-5 py-2.5 font-medium text-white"
              >
                Create your band
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-current px-5 py-2.5 font-medium"
              >
                Log in
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold">Sound familiar?</h2>
        <p className="opacity-80">
          You want to book a show. So you text your bandmates to find out when everyone&apos;s
          actually free. Half reply, half don&apos;t. Once you&apos;ve got a date, you message two
          other bands to see if <em>they&apos;re</em> free on it. Then you email a venue booker who
          gets a hundred of these a week. By the time anyone replies the date is already gone.
        </p>
        <ul className="flex flex-col gap-2 pl-5 opacity-80 marker:text-accent" style={{ listStyleType: "disc" }}>
          <li>Group chats where nobody confirms anything until it&apos;s too late.</li>
          <li>Playing phone operator between three bands trying to pick one Friday.</li>
          <li>Cold-emailing bookers with no draw history, press kit, or lineup locked in.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold">What BandSnap does</h2>
        <ul className="flex flex-col gap-4">
          <li>
            <h3 className="font-semibold">1. Members post their blocks, we show the open dates.</h3>
            <p className="opacity-80">
              Each band member connects their Google Calendar (or types a few blocks). We overlay
              everyone and compute the dates your whole band can play — automatically, up to a year
              out. Each person&apos;s reasons stay private; bandmates only see the dates.
            </p>
          </li>
          <li>
            <h3 className="font-semibold">
              2. Build a 3–4 act bill without the five-way DM chain.
            </h3>
            <p className="opacity-80">
              Pick a date and invite two or three other bands you&apos;d share a stage with. When
              everyone confirms, the bill locks into a venue pitch package — all four press kits,
              draw estimates, and tech riders in one link.
            </p>
          </li>
          <li>
            <h3 className="font-semibold">3. Pitch venues a complete package in one link.</h3>
            <p className="opacity-80">
              Email that link to any booker. They see the full lineup, hear the music, download the
              rider, and click Approve. No account required on their end.
            </p>
          </li>
        </ul>
      </section>

      <section className="rounded-xl border border-black/10 p-6 dark:border-white/10">
        <h2 className="text-xl font-bold">On the roadmap</h2>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm opacity-80">
          <li>Double-blind post-show ratings between bands, venues, and crew.</li>
          <li>Hire a flyer artist in three tiers — $5 template, $40 new concept, $100 hand-drawn.</li>
          <li>Local photographer directory suggested when your show locks.</li>
          <li>Discord slash command for date polls, so you don&apos;t leave your group chat.</li>
        </ul>
      </section>

      <footer className="mt-8 text-sm opacity-60">
        Built for the DIY / local original music scene — indie, punk, metal, rock, country, hip-hop.
      </footer>
    </main>
  );
}
