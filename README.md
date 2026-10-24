# BandSnap — Phase 1 scaffold

Next.js 16 (App Router) · React 19 · Tailwind 4 · Supabase (`@supabase/ssr`) · TypeScript (strict)

## Setup

```bash
npm install
cp .env.example .env.local        # fill in URL + publishable key

# Apply both migrations to your Supabase project
npx supabase login
npx supabase link --project-ref <your-ref>
npm run db:push                   # runs supabase/migrations/* in order

npm run db:types                  # optional: regenerate types from the live DB
npm run dev
```

No CLI? Paste the two files in `supabase/migrations/` into the SQL Editor, in order.

**Auth settings (Supabase dashboard):**
- Auth → URL Configuration: Site URL `http://localhost:3000` (add your Vercel URL later), and add `http://localhost:3000/auth/confirm` to Redirect URLs.
- Optional: Auth → Email Templates → Confirm signup link →
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard`

## Structure

```
proxy.ts                        Refreshes Supabase session; guards /dashboard (Next 16 name for middleware.ts)
utils/supabase/
  client.ts                     Browser client for "use client" components
  server.ts                     Per-request server client + getUserId()/requireUserId()
  proxy.ts                      updateSession() used by root proxy.ts
  env.ts                        Fails loudly on missing env vars
types/
  database.types.ts             Database type (same format as `supabase gen types`)
  index.ts                      Aliases: Band, Profile, GigStatus, PublicEpk, ActionResult…
lib/
  epk.ts                        getPublicEpk(slug) — cached, shared by page + metadata
  embeds.ts                     Spotify / YouTube URL → safe embed URL
components/auth/auth-form.tsx   Client form: useActionState + sonner toasts
app/
  (auth)/login, signup, actions.ts   Server Actions: signIn / signUp / signOut
  auth/confirm/route.ts         Email-link → session (the only route handler)
  dashboard/                    Auth-guarded: band list, new band, band settings, availability
  bands/[slug]/                 Public EPK (+ not-found)
supabase/migrations/
  20261022000000_initial_schema.sql   Your original schema, unchanged
  20261022000100_rls_and_rpc.sql      RLS fixes, create_band, availability engine, storage
```

## Data-access conventions

- **Reads:** Server Components with `await createClient()` from `utils/supabase/server`. No `/api/*` routes.
- **Writes:** Server Actions returning `ActionResult` → shown with `toast` in a client component.
- **Create a band:** `supabase.rpc("create_band", {...})` returns the new band id — direct INSERT is blocked on purpose (the RPC also makes you admin). Unique-slug clash = Postgres error code `23505`.
- **Open dates:** `supabase.rpc("sync_band_open_dates", { p_band_id })` (admins). Covers the next 366 days: adds free dates as `actively_seeking`, removes seeking dates that now conflict, and never touches `penciled_in` / `booked` / `unavailable`.
- **Profiles** are readable only by the user and their bandmates (protects phone numbers). Don't query `profiles` from public pages.
- **Uploads:** bucket `band-assets`, path `{band_id}/{logo|press|rider}/{file}`. Only that band's admins can write; files are publicly readable.
- **Auth checks on the server:** `getClaims()` (verifies JWT), never `getSession()`.

## Known follow-ups

- **Email invites:** `band_members` needs an existing profile. Inviting non-users needs a `band_invites` table (email, band_id, token) and an accept flow — next migration.
- **Unavailability reasons** are visible to bandmates. Keep them non-sensitive or split them into an owner-only table.
- **Last-admin guard:** nothing yet stops the only admin from leaving or demoting themselves.
- `user_role` enum exists but no column uses it yet (likely `profiles.primary_role` once venues/creatives onboard).
