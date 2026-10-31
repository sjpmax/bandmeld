import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient, requireUserId } from "@/utils/supabase/server";
import { BandSubNav } from "@/components/bands/band-subnav";

export const metadata: Metadata = { title: "Polls" };

export default async function PollsListPage({
  params,
}: {
  params: Promise<{ bandId: string }>;
}) {
  const { bandId } = await params;
  await requireUserId(`/dashboard/bands/${bandId}/polls`);
  const supabase = await createClient();

  const { data: band } = await supabase
    .from("bands")
    .select("id, name, slug, logo_url")
    .eq("id", bandId)
    .maybeSingle();
  if (!band) notFound();

  const { data: isAdmin } = await supabase.rpc("is_band_admin", { p_band_id: bandId });
  if (!isAdmin) redirect(`/dashboard/bands/${bandId}`);

  const { data: polls } = await supabase
    .from("polls")
    .select("id, title, created_at, closes_at, closed_at")
    .eq("band_id", bandId)
    .order("created_at", { ascending: false });

  const dateFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-10">
      <BandSubNav
        bandId={band.id}
        bandName={band.name}
        slug={band.slug}
        logoUrl={band.logo_url}
        activeTab="polls"
      />

      <main className="flex flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Polls</h1>
          <Link
            href={`/dashboard/bands/${bandId}/polls/new`}
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            + Ask the band
          </Link>
        </header>

        <p className="rounded-xl border border-black/10 bg-black/5 p-3 text-sm opacity-80 dark:border-white/10 dark:bg-white/5">
          Each member gets a personal link — no login needed. When you close a poll, every <strong>&ldquo;No&rdquo;</strong> answer is added as a one-day unavailability on that member&rsquo;s calendar, and the band&rsquo;s open dates update automatically. <strong>Yes</strong> answers don&rsquo;t change anything. Polls don&rsquo;t auto-close when their deadline passes — open the poll and click <em>Close &amp; apply to calendar</em> when you&rsquo;re ready.
        </p>

        {!polls || polls.length === 0 ? (
          <p className="rounded-xl border border-black/10 p-6 text-sm opacity-70 dark:border-white/10">
            No polls yet. Hit <strong>Ask the band</strong> to send one.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {polls.map((p) => {
              const closed = p.closed_at !== null || new Date(p.closes_at) < new Date();
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 p-3 dark:border-white/10"
                >
                  <div>
                    <Link
                      href={`/dashboard/bands/${bandId}/polls/${p.id}`}
                      className="font-medium underline"
                    >
                      {p.title ?? "Availability check"}
                    </Link>
                    <p className="text-sm opacity-70">
                      Created {dateFmt.format(new Date(p.created_at))} ·{" "}
                      {closed ? "closed" : `closes ${dateFmt.format(new Date(p.closes_at))}`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
