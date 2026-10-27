import { createClient } from "@/utils/supabase/server";
import { AppHeader } from "@/components/nav/app-header";
import { buildTag } from "@/lib/build-tag";

export default async function ExploreLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  // Public page — do NOT redirect unauthenticated viewers. We just read
  // claims to decide which nav variant to show.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;

  let bandCount = 0;
  if (userId) {
    const { count } = await supabase
      .from("band_members")
      .select("band_id", { count: "exact", head: true })
      .eq("profile_id", userId);
    bandCount = count ?? 0;
  }

  const tag = buildTag();

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader authed={!!userId} bandCount={bandCount} />
      <main className="mx-auto w-full max-w-5xl grow px-4 py-8">{children}</main>
      <footer className="mx-auto w-full max-w-5xl px-4 py-3 text-right text-[10px] font-mono opacity-40">
        build {tag}
      </footer>
    </div>
  );
}
