import { createClient, requireUserId } from "@/utils/supabase/server";
import { AppHeader } from "@/components/nav/app-header";
import { buildTag } from "@/lib/build-tag";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts already redirects guests; this is defence-in-depth for
  // anything rendered under /dashboard.
  const userId = await requireUserId("/dashboard");
  const supabase = await createClient();

  // Nav label: "My band" when the viewer is in exactly one band, else "My bands".
  const { count } = await supabase
    .from("band_members")
    .select("band_id", { count: "exact", head: true })
    .eq("profile_id", userId);
  const bandCount = count ?? 0;

  const tag = buildTag();

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader authed bandCount={bandCount} />
      <main className="mx-auto w-full max-w-5xl grow px-4 py-8">{children}</main>
      <footer className="mx-auto w-full max-w-5xl px-4 py-3 text-right text-[10px] font-mono opacity-40">
        build {tag}
      </footer>
    </div>
  );
}
