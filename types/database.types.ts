/**
 * Supabase database types for BandSnap.
 *
 * Hand-written to mirror the output of `supabase gen types typescript`
 * for migrations 0001 + 0002. Once your project is linked, regenerate with:
 *
 *   npx supabase login
 *   npx supabase link --project-ref <your-ref>
 *   npm run db:types
 *
 * The generated file is a drop-in replacement for this one.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          avatar_url: string | null;
          phone: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          full_name: string;
          avatar_url?: string | null;
          phone?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string;
          avatar_url?: string | null;
          phone?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      bands: {
        Row: {
          id: string;
          name: string;
          slug: string;
          bio: string | null;
          home_city: string;
          genres: string[];
          logo_url: string | null;
          press_photo_url: string | null;
          tech_rider_url: string | null;
          spotify_url: string | null;
          youtube_url: string | null;
          apple_music_url: string | null;
          epk_pdf_url: string | null;
          instagram_url: string | null;
          linktree_url: string | null;
          avg_local_draw: number | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          bio?: string | null;
          home_city: string;
          genres?: string[];
          logo_url?: string | null;
          press_photo_url?: string | null;
          tech_rider_url?: string | null;
          spotify_url?: string | null;
          youtube_url?: string | null;
          apple_music_url?: string | null;
          epk_pdf_url?: string | null;
          instagram_url?: string | null;
          linktree_url?: string | null;
          avg_local_draw?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          bio?: string | null;
          home_city?: string;
          genres?: string[];
          logo_url?: string | null;
          press_photo_url?: string | null;
          tech_rider_url?: string | null;
          spotify_url?: string | null;
          youtube_url?: string | null;
          apple_music_url?: string | null;
          epk_pdf_url?: string | null;
          instagram_url?: string | null;
          linktree_url?: string | null;
          avg_local_draw?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      band_invites: {
        Row: {
          id: string;
          band_id: string;
          email: string;
          token: string;
          role_in_band: string;
          invited_by: string | null;
          created_at: string;
          expires_at: string;
          accepted_at: string | null;
          accepted_by: string | null;
        };
        Insert: {
          id?: string;
          band_id: string;
          email: string;
          token: string;
          role_in_band?: string;
          invited_by?: string | null;
          created_at?: string;
          expires_at?: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
        };
        Update: {
          id?: string;
          band_id?: string;
          email?: string;
          token?: string;
          role_in_band?: string;
          invited_by?: string | null;
          created_at?: string;
          expires_at?: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "band_invites_band_id_fkey";
            columns: ["band_id"];
            isOneToOne: false;
            referencedRelation: "bands";
            referencedColumns: ["id"];
          },
        ];
      };
      band_members: {
        Row: {
          id: string;
          band_id: string;
          profile_id: string;
          role_in_band: string | null;
          is_admin: boolean | null;
          joined_at: string | null;
        };
        Insert: {
          id?: string;
          band_id: string;
          profile_id: string;
          role_in_band?: string | null;
          is_admin?: boolean | null;
          joined_at?: string | null;
        };
        Update: {
          id?: string;
          band_id?: string;
          profile_id?: string;
          role_in_band?: string | null;
          is_admin?: boolean | null;
          joined_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "band_members_band_id_fkey";
            columns: ["band_id"];
            isOneToOne: false;
            referencedRelation: "bands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "band_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      member_unavailabilities: {
        Row: {
          id: string;
          profile_id: string;
          start_date: string;
          end_date: string;
          reason: string | null;
          is_tentative: boolean;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          profile_id: string;
          start_date: string;
          end_date: string;
          reason?: string | null;
          is_tentative?: boolean;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          profile_id?: string;
          start_date?: string;
          end_date?: string;
          reason?: string | null;
          is_tentative?: boolean;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "member_unavailabilities_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      google_calendar_connections: {
        Row: {
          profile_id: string;
          google_sub: string;
          access_token: string;
          refresh_token: string | null;
          expires_at: string;
          scope: string;
          last_synced_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          profile_id: string;
          google_sub: string;
          access_token: string;
          refresh_token?: string | null;
          expires_at: string;
          scope: string;
          last_synced_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          profile_id?: string;
          google_sub?: string;
          access_token?: string;
          refresh_token?: string | null;
          expires_at?: string;
          scope?: string;
          last_synced_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "google_calendar_connections_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      band_open_dates: {
        Row: {
          id: string;
          band_id: string;
          target_date: string;
          status: Database["public"]["Enums"]["gig_status"] | null;
          notes: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          band_id: string;
          target_date: string;
          status?: Database["public"]["Enums"]["gig_status"] | null;
          notes?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          band_id?: string;
          target_date?: string;
          status?: Database["public"]["Enums"]["gig_status"] | null;
          notes?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "band_open_dates_band_id_fkey";
            columns: ["band_id"];
            isOneToOne: false;
            referencedRelation: "bands";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      // ---- Added in 0002_rls_and_rpc.sql ----
      create_band: {
        Args: {
          p_name: string;
          p_slug: string;
          p_home_city: string;
          p_genres?: string[];
          p_bio?: string;
        };
        Returns: string; // new band id
      };
      sync_band_open_dates: {
        Args: { p_band_id: string };
        Returns: undefined;
      };
      shares_band_with: {
        Args: { p_profile_id: string };
        Returns: boolean;
      };
      is_band_admin: {
        Args: { p_band_id: string };
        Returns: boolean;
      };
      is_band_member: {
        Args: { p_band_id: string };
        Returns: boolean;
      };
      // ---- Added in 0005_bands_and_invites.sql ----
      create_band_invite: {
        Args: { p_band_id: string; p_email: string; p_role_in_band?: string };
        Returns: string; // token
      };
      preview_band_invite: {
        Args: { p_token: string };
        Returns: {
          band_id: string | null;
          band_name: string | null;
          band_slug: string | null;
          email: string | null;
          role_in_band: string | null;
          is_valid: boolean;
          reason: string | null;
        }[];
      };
      accept_band_invite: {
        Args: { p_token: string };
        Returns: string; // band id joined
      };
      revoke_band_invite: {
        Args: { p_invite_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      user_role: "band_leader" | "band_member" | "venue_manager" | "creative";
      gig_status: "actively_seeking" | "penciled_in" | "booked" | "unavailable";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// -----------------------------------------------------------------------------
// Helper generics (same names the Supabase CLI emits)
// -----------------------------------------------------------------------------
type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];

export const Constants = {
  public: {
    Enums: {
      user_role: ["band_leader", "band_member", "venue_manager", "creative"],
      gig_status: ["actively_seeking", "penciled_in", "booked", "unavailable"],
    },
  },
} as const;
