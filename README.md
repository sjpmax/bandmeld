# BandMeld

Multi-sided marketplace for the DIY / local live music scene. Bands sync calendars, assemble 3–4 act bills on mutually open dates, pitch turnkey packages to venues, and hold each other accountable via a double-blind 3-way rating system.

Full product spec: [bandmeld PRD.md](./bandmeld%20PRD.md).

**Stack:** Next.js 16 (App Router) · React 19 · Tailwind 4 · Supabase (`@supabase/ssr`) · TypeScript (strict).

## Phase roadmap (from the PRD)

| Phase | Scope | Status |
| :---- | :---- | :---- |
| **1 — Trojan Horse** | Member calendar sync · Band EPK · Shareable public band page | In progress (this repo) |
| **2 — Network** | Band-to-band Bill Builder · Local photographer directory · 3-way ratings | Not started |
| **3 — Venue marketplace** | Shareable pitch pages · Inbound open-slot board · Verified draw stats | Not started |
| **4 — Mobile + monetization** | React Native app · Escrow / door splits | Not started |

### Phase 1 progress

Built:
- Auth (signup, login, email confirm, sign out) — [app/(auth)/](app/(auth)/), [app/auth/confirm/route.ts](app/auth/confirm/route.ts)
- Supabase schema + RLS + RPCs — [supabase/migrations/](supabase/migrations/)
- `create_band` RPC (makes creator admin, enforces unique slug) + create-band form
- `sync_band_open_dates` RPC (next 366 days, member unavailability → `actively_seeking`) + preferred gig days filter
- `band-assets` storage bucket (logo / press / rider), admin-write / public-read
- Dashboard shell listing user's bands — [app/dashboard/page.tsx](app/dashboard/page.tsx)
- Band settings (bio, links, genres, social) + uploads + roster + role editing + mandatory-member toggle — [app/dashboard/bands/[bandId]/page.tsx](app/dashboard/bands/[bandId]/page.tsx)
- Band calendar with interactive flip states (`actively_seeking` ↔ `penciled_in` ↔ `booked`) + conflict detection — [app/dashboard/bands/[bandId]/availability/page.tsx](app/dashboard/bands/[bandId]/availability/page.tsx)
- Band invites with `band_invites` table, email-locked tokens, `/invite/[token]` accept flow preserving token through sign-up — [app/invite/[token]/page.tsx](app/invite/[token]/page.tsx)
- Public EPK with Spotify / Apple Music / YouTube embeds + open dates + stage plot — [app/bands/[slug]/page.tsx](app/bands/[slug]/page.tsx)
- Stage plot editor (drag-drop canvas + input list) + print-friendly route — [app/dashboard/bands/[bandId]/stage-plot/](app/dashboard/bands/[bandId]/stage-plot/)
- My-availability picker (add / remove unavailability blocks, tentative/firm) — [app/dashboard/availability/page.tsx](app/dashboard/availability/page.tsx)
- Google Calendar import (OAuth, review-then-apply, dedupe) — [app/dashboard/availability/import/page.tsx](app/dashboard/availability/import/page.tsx), [lib/google-calendar.ts](lib/google-calendar.ts)
- Apple Calendar `.ics` upload-only import — [app/dashboard/availability/import/ics/page.tsx](app/dashboard/availability/import/ics/page.tsx), [lib/ics.ts](lib/ics.ts) *(on `feat/apple-ics-fallback`)*
- Google OAuth tokens stored in Supabase Vault, not plaintext — [supabase/migrations/](supabase/migrations/) *(on `feat/vault-oauth-tokens`)*
- Last-admin guard trigger — can't demote or remove the sole admin of a band *(on `fix/last-admin-guard`)*

Still open:
- [ ] EPK visual design pass (hero, sections, visual hierarchy)
- [ ] Phase 2 Bill Builder — 3-4 act matchmaking + draft lineup pitch package
- [ ] Phase 2 photographer / creative directory
- [ ] Phase 2 double-blind 3-way rating system

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
- Auth → URL Configuration: Site URL `http://localhost:3001` (add your Vercel URL later), and add `http://localhost:3001/auth/confirm` and `http://localhost:3001/auth/google/callback` to Redirect URLs.
- Optional: Auth → Email Templates → Confirm signup link →
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard`

### Google Calendar import (OAuth)

Users can click **Connect Google Calendar** on `/dashboard/availability` to link their Google account and pull busy events into `member_unavailabilities`. Setup is a one-time dance:

1. **Google Cloud Console**
   - Create a project. Enable the **Google Calendar API**.
   - OAuth consent screen → *External*, Testing mode (add yourself as a test user; publishing + Google's app verification is required to onboard non-test users for the sensitive `calendar.events` scope).
   - OAuth consent screen → **Scopes** → *Add or Remove Scopes* → check `.../auth/calendar.events` (covers both reading the user's events for import AND writing confirmed show dates back to their calendar). Save.
   - Credentials → Create *OAuth client ID* → *Web application*.
     - Authorized redirect URI: `https://<your-ref>.supabase.co/auth/v1/callback` (yes, Supabase's, not ours — Supabase proxies the flow).

2. **Supabase dashboard**
   - Auth → Providers → Google → paste the Client ID + Client Secret, **enable**.
   - Auth → URL Configuration → Redirect URLs → add `http://localhost:3001/auth/google/callback` (and the prod equivalent later).

3. **This app's `.env.local`** — same values as step 2, needed server-side to refresh access tokens:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```

The flow: user clicks the button → `supabase.auth.linkIdentity('google', …)` (not `signInWithOAuth`, so we don't create a second account) → Google consent → `/auth/google/callback` captures `provider_token` + `provider_refresh_token` into `public.google_calendar_connections` → redirects to `/dashboard/availability/import` for review. Preselect rules (one-offs + 2+ day blocks on, recurring series off) match [band snap PRD.md](./band%20snap%20PRD.md) §3.1.

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
  20261022000000_initial_schema.sql   Original schema
  20261022000100_rls_and_rpc.sql      RLS fixes, create_band, availability engine, storage
  20261024000000_google_calendar.sql  google_calendar_connections (OAuth tokens, owner-only RLS)
lib/google-calendar.ts            Google Calendar v3 client: token refresh, event list, classify
app/auth/google/callback/         OAuth landing: exchanges code → stores provider tokens
```

## Data-access conventions

- **Reads:** Server Components with `await createClient()` from `utils/supabase/server`. No `/api/*` routes.
- **Writes:** Server Actions returning `ActionResult` → shown with `toast` in a client component.
- **Create a band:** `supabase.rpc("create_band", {...})` returns the new band id — direct INSERT is blocked on purpose (the RPC also makes you admin). Unique-slug clash = Postgres error code `23505`.
- **Open dates:** `supabase.rpc("sync_band_open_dates", { p_band_id })` (admins). Covers the next 366 days: adds free dates as `actively_seeking`, removes seeking dates that now conflict, and never touches `penciled_in` / `booked` / `unavailable`.
- **Profiles** are readable only by the user and their bandmates (protects phone numbers). Don't query `profiles` from public pages.
- **Uploads:** bucket `band-assets`, path `{band_id}/{logo|press|rider}/{file}`. Only that band's admins can write; files are publicly readable.
- **Auth checks on the server:** `getClaims()` (verifies JWT), never `getSession()`.

## Auto-migrating on push

[.github/workflows/db-migrate.yml](.github/workflows/db-migrate.yml) runs `supabase db push` on every push to `master` that touches `supabase/migrations/**`. Set these repo secrets (GitHub → Settings → Secrets and variables → Actions):

- `SUPABASE_ACCESS_TOKEN` — personal access token from https://supabase.com/dashboard/account/tokens
- `SUPABASE_PROJECT_REF` — the 20-char slug from the Supabase dashboard URL
- `SUPABASE_DB_PASSWORD` — database password (Supabase → Settings → Database)

Already-applied migrations are no-ops, so the workflow is safe to re-run (or trigger via *Actions → Supabase migrations → Run workflow*).

## Known follow-ups

- **Unavailability reasons** are owner-only now (private per migration 4). Keep that in mind if you add new query paths.
- `user_role` enum exists but no column uses it yet (likely `profiles.primary_role` once venues/creatives onboard).
- **TZ drift between Google (server-UTC) and ICS (browser-local)** — the same conceptual timed event imported both ways can land on different `YYYY-MM-DD` strings. Standardize before shipping both widely.
- **EPK design pass** — the public page is functional but visually unpolished.
