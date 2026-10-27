import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { PollResponseForm } from "@/components/polls/poll-response-form";

export const metadata: Metadata = { title: "Band availability check" };
export const dynamic = "force-dynamic";

type Preview = {
  status: "ok" | "closed" | "not_found";
  poll_id: string | null;
  band_name: string | null;
  title: string | null;
  note: string | null;
  closes_at: string | null;
  closed_at: string | null;
  member_name: string | null;
  dates: Array<{ id: string; target_date: string; position: number }> | null;
  answers: Record<string, boolean> | null;
};

export default async function PollTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("preview_poll_by_token", { p_token: token });
  const preview = (data?.[0] ?? null) as Preview | null;

  if (!preview || preview.status === "not_found") {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-16">
        <h1 className="text-2xl font-bold">Link not found</h1>
        <p className="text-sm opacity-70">
          This availability check link doesn&apos;t exist. Ask the band leader for a new one.
        </p>
      </main>
    );
  }

  const title = preview.title ?? `Availability check for ${preview.band_name}`;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <p className="text-sm opacity-60">
          Hi {preview.member_name ?? "there"} — this link is just for you.
        </p>
        <h1 className="text-2xl font-bold">{title}</h1>
        {preview.note && (
          <p className="mt-2 rounded-xl bg-black/5 p-3 text-sm italic dark:bg-white/5">
            {preview.note}
          </p>
        )}
      </header>

      {preview.status === "closed" ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          This poll has closed. Reach out to the band leader if you need to update your answer.
        </div>
      ) : (
        <PollResponseForm
          token={token}
          dates={preview.dates ?? []}
          initialAnswers={preview.answers ?? {}}
        />
      )}
    </main>
  );
}
