import type { Metadata } from "next";
import Link from "next/link";
import { createClient, requireUserId } from "@/utils/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const userId = await requireUserId("/dashboard");
  const supabase = await createClient();

  const [{ data: profile }, { data: memberships, error }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    supabase
      .from("band_members")
      .select("is_admin, role_in_band, band:bands (id, name, slug, home_city)")
      .eq("profile_id", userId)
      .order("joined_at", { ascending: true }),
  ]);

  if (error) throw error; // → app/error.tsx

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold sm:text-3xl">
          Hey{profile?.full_name ? `, ${profile.full_name}` : ""} 👋
        </h1>
        <Link href="/dashboard/bands/new" className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white">
          New band
        </Link>
      </div>

      {memberships && memberships.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {memberships.map(({ band, is_admin, role_in_band }) =>
            band ? (
              <li key={band.id} className="rounded-xl border border-black/10 p-4 dark:border-white/10">
                <Link href={`/dashboard/bands/${band.id}`} className="text-lg font-semibold">
                  {band.name}
                </Link>
                <p className="text-sm opacity-70">
                  {band.home_city} · {role_in_band}
                  {is_admin ? " · Admin" : ""}
                </p>
                <Link href={`/bands/${band.slug}`} className="mt-2 inline-block text-sm underline">
                  View public EPK
                </Link>
              </li>
            ) : null,
          )}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-black/20 p-6 text-center opacity-80 dark:border-white/20">
          You&apos;re not in any bands yet. Create one to get your EPK live.
        </p>
      )}
    </div>
  );
}
