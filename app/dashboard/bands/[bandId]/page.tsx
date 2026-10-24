import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, requireUserId } from "@/utils/supabase/server";
import { BandSettingsForm } from "@/components/bands/band-settings-form";
import { AssetUploader } from "@/components/bands/asset-uploader";
import { InviteMemberForm } from "@/components/bands/invite-member-form";
import { MemberRowActions } from "@/components/bands/member-row-actions";
import { MemberRoleEditor } from "@/components/bands/member-role-editor";
import { InviteRowRevoke } from "@/components/bands/invite-row-revoke";

export const metadata: Metadata = { title: "Band settings" };

export default async function BandSettingsPage({
  params,
}: {
  params: Promise<{ bandId: string }>;
}) {
  const { bandId } = await params;
  const userId = await requireUserId(`/dashboard/bands/${bandId}`);
  const supabase = await createClient();

  const [
    { data: band, error: bandErr },
    { data: members, error: membersErr },
    { data: invites, error: invitesErr },
  ] = await Promise.all([
    supabase.from("bands").select("*").eq("id", bandId).maybeSingle(),
    supabase
      .from("band_members")
      .select("id, profile_id, role_in_band, is_admin, joined_at")
      .eq("band_id", bandId)
      .order("joined_at", { ascending: true }),
    supabase
      .from("band_invites")
      .select("id, email, role_in_band, created_at, expires_at")
      .eq("band_id", bandId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  if (bandErr) throw bandErr;
  if (!band) notFound();
  if (membersErr) throw membersErr;
  if (invitesErr) throw invitesErr;

  // Fetch profile names for the member list (bandmates-only RLS allows this).
  const profileIds = members?.map((m) => m.profile_id) ?? [];
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", profileIds)
    : { data: [] };
  const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

  const me = members?.find((m) => m.profile_id === userId);
  const viewerIsAdmin = me?.is_admin === true;

  const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-center gap-4">
        {band.logo_url && (
          <img
            src={band.logo_url}
            alt={`${band.name} logo`}
            className="h-16 w-16 rounded-md border border-black/10 object-contain dark:border-white/10"
          />
        )}
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{band.name}</h1>
          <p className="opacity-70">
            <Link href={`/bands/${band.slug}`} className="underline hover:no-underline">
              Public EPK ↗
            </Link>
          </p>
        </div>
      </header>

      {!viewerIsAdmin && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          You&apos;re a member of this band but not an admin. Settings and invites are read-only.
        </p>
      )}

      {viewerIsAdmin && (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Band details</h2>
          <BandSettingsForm band={band} />
        </section>
      )}

      {viewerIsAdmin && (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Assets</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <AssetUploader
              bandId={band.id}
              kind="logo"
              label="Logo"
              helper="PNG / SVG preferred. Shown on your public page."
              currentUrl={band.logo_url}
              preview="image"
            />
            <AssetUploader
              bandId={band.id}
              kind="press"
              label="Press photo"
              helper="High-res JPG or PNG. Venues download this for flyers."
              currentUrl={band.press_photo_url}
              preview="image"
            />
            <AssetUploader
              bandId={band.id}
              kind="rider"
              label="Tech rider (PDF)"
              helper="Backline, inputs, stage plot. One page is fine."
              currentUrl={band.tech_rider_url}
              preview="link"
            />
            <AssetUploader
              bandId={band.id}
              kind="epk"
              label="EPK (PDF)"
              helper="Upload your existing EPK. Free tier — hosting only."
              currentUrl={band.epk_pdf_url}
              preview="link"
            />
          </div>

          <div className="rounded-xl border border-dashed border-black/20 bg-black/[0.02] p-4 dark:border-white/20 dark:bg-white/[0.02]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">EPK Builder</h3>
                <p className="text-sm opacity-70">
                  Coming soon — Premium. We&apos;ll compose your bio, press photo, music embeds, draw
                  stats and tech rider into a one-link EPK you can email to venues.
                </p>
              </div>
              <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200">
                Coming soon
              </span>
            </div>
            <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-sm opacity-80">
              <li>Press photo at the top, clean name + genre + home city.</li>
              <li>Two or three short paragraphs — what you sound like, who you&apos;ve shared a bill with.</li>
              <li>Embedded Spotify + YouTube so bookers can hear you without leaving the page.</li>
              <li>Tech rider link, contact email, honest draw estimate.</li>
            </ul>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Members ({members?.length ?? 0})</h2>
        <ul className="flex flex-col gap-2">
          {members?.map((m) => {
            const p = profileMap.get(m.profile_id);
            const isSelf = m.profile_id === userId;
            return (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 p-3 dark:border-white/10"
              >
                <div>
                  <p className="font-medium">
                    {p?.full_name ?? "Member"}
                    {isSelf && <span className="ml-2 text-xs opacity-60">(you)</span>}
                  </p>
                  <p className="text-sm opacity-70">
                    <MemberRoleEditor
                      bandId={band.id}
                      profileId={m.profile_id}
                      currentRole={m.role_in_band ?? "Member"}
                      canEdit={viewerIsAdmin || isSelf}
                    />
                    {m.is_admin && (
                      <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                        Admin
                      </span>
                    )}
                  </p>
                </div>
                <MemberRowActions
                  memberId={m.id}
                  bandId={band.id}
                  isAdmin={m.is_admin ?? false}
                  isSelf={isSelf}
                  viewerIsAdmin={viewerIsAdmin}
                />
              </li>
            );
          })}
        </ul>
      </section>

      {viewerIsAdmin && (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Invite bandmates</h2>
          <p className="text-sm opacity-70">
            Invites are email-locked and one-time-use. Share the link privately — anyone with it who
            signs in with that email can join once.
          </p>
          <InviteMemberForm bandId={band.id} />

          {invites && invites.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold opacity-80">Pending invites</h3>
              <ul className="flex flex-col gap-2">
                {invites.map((i) => (
                  <li
                    key={i.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 p-3 dark:border-white/10"
                  >
                    <div>
                      <p className="font-medium">{i.email}</p>
                      <p className="text-sm opacity-70">
                        {i.role_in_band} · expires {dateFmt.format(new Date(i.expires_at))}
                      </p>
                    </div>
                    <InviteRowRevoke inviteId={i.id} bandId={band.id} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
