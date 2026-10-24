/**
 * App-level aliases. Import these in components instead of reaching into
 * Database["public"]["Tables"][...] everywhere. They stay valid after
 * regenerating database.types.ts.
 */
import type { Enums, Tables, TablesInsert, TablesUpdate } from "./database.types";

export type { Database, Json } from "./database.types";

// Rows
export type Profile = Tables<"profiles">;
export type Band = Tables<"bands">;
export type BandMember = Tables<"band_members">;
export type BandInvite = Tables<"band_invites">;
export type MemberUnavailability = Tables<"member_unavailabilities">;
export type BandOpenDate = Tables<"band_open_dates">;

// Inserts / updates
export type BandUpdate = TablesUpdate<"bands">;
export type ProfileUpdate = TablesUpdate<"profiles">;
export type MemberUnavailabilityInsert = TablesInsert<"member_unavailabilities">;
export type BandOpenDateUpdate = TablesUpdate<"band_open_dates">;

// Enums
export type GigStatus = Enums<"gig_status">;
export type UserRole = Enums<"user_role">;

// Composite shapes used by pages
export type BandMemberWithProfile = BandMember & {
  profile: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
};

/** Public EPK payload for /bands/[slug]. */
export type PublicEpk = Band & {
  open_dates: Pick<BandOpenDate, "target_date" | "status">[];
};

/** Statuses a talent buyer should see as bookable on the EPK. */
export const PUBLIC_BOOKABLE_STATUSES: GigStatus[] = ["actively_seeking", "penciled_in"];

/** Shape returned by Server Actions; pairs with useActionState + toasts. */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };
