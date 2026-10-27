export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      band_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          band_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role_in_band: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          band_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role_in_band?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          band_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role_in_band?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "band_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "band_invites_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "band_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      band_members: {
        Row: {
          band_id: string
          id: string
          is_admin: boolean
          is_required_for_gigs: boolean
          joined_at: string | null
          profile_id: string
          role_in_band: string | null
        }
        Insert: {
          band_id: string
          id?: string
          is_admin?: boolean
          is_required_for_gigs?: boolean
          joined_at?: string | null
          profile_id: string
          role_in_band?: string | null
        }
        Update: {
          band_id?: string
          id?: string
          is_admin?: boolean
          is_required_for_gigs?: boolean
          joined_at?: string | null
          profile_id?: string
          role_in_band?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "band_members_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "band_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      band_open_dates: {
        Row: {
          band_id: string
          created_at: string | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["gig_status"]
          target_date: string
        }
        Insert: {
          band_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["gig_status"]
          target_date: string
        }
        Update: {
          band_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["gig_status"]
          target_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "band_open_dates_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
        ]
      }
      bands: {
        Row: {
          apple_music_url: string | null
          avg_local_draw: number | null
          bio: string | null
          created_at: string | null
          epk_pdf_url: string | null
          genres: string[]
          home_city: string
          home_city_lat: number | null
          home_city_lng: number | null
          id: string
          instagram_url: string | null
          is_fake: boolean
          linktree_url: string | null
          logo_url: string | null
          name: string
          preferred_gig_days: number[]
          press_photo_url: string | null
          slug: string
          sound_description: string | null
          spotify_url: string | null
          stage_plot: Json | null
          tech_rider_url: string | null
          updated_at: string | null
          website_url: string | null
          youtube_url: string | null
        }
        Insert: {
          apple_music_url?: string | null
          avg_local_draw?: number | null
          bio?: string | null
          created_at?: string | null
          epk_pdf_url?: string | null
          genres?: string[]
          home_city: string
          home_city_lat?: number | null
          home_city_lng?: number | null
          id?: string
          instagram_url?: string | null
          is_fake?: boolean
          linktree_url?: string | null
          logo_url?: string | null
          name: string
          preferred_gig_days?: number[]
          press_photo_url?: string | null
          slug: string
          sound_description?: string | null
          spotify_url?: string | null
          stage_plot?: Json | null
          tech_rider_url?: string | null
          updated_at?: string | null
          website_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          apple_music_url?: string | null
          avg_local_draw?: number | null
          bio?: string | null
          created_at?: string | null
          epk_pdf_url?: string | null
          genres?: string[]
          home_city?: string
          home_city_lat?: number | null
          home_city_lng?: number | null
          id?: string
          instagram_url?: string | null
          is_fake?: boolean
          linktree_url?: string | null
          logo_url?: string | null
          name?: string
          preferred_gig_days?: number[]
          press_photo_url?: string | null
          slug?: string
          sound_description?: string | null
          spotify_url?: string | null
          stage_plot?: Json | null
          tech_rider_url?: string | null
          updated_at?: string | null
          website_url?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      google_calendar_connections: {
        Row: {
          created_at: string | null
          expires_at: string
          google_sub: string
          last_synced_at: string | null
          profile_id: string
          scope: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          google_sub: string
          last_synced_at?: string | null
          profile_id: string
          scope: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          google_sub?: string
          last_synced_at?: string | null
          profile_id?: string
          scope?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_connections_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_unavailabilities: {
        Row: {
          created_at: string | null
          end_date: string
          id: string
          is_tentative: boolean
          profile_id: string
          reason: string | null
          start_date: string
        }
        Insert: {
          created_at?: string | null
          end_date: string
          id?: string
          is_tentative?: boolean
          profile_id: string
          reason?: string | null
          start_date: string
        }
        Update: {
          created_at?: string | null
          end_date?: string
          id?: string
          is_tentative?: boolean
          profile_id?: string
          reason?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_unavailabilities_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_dates: {
        Row: {
          id: string
          poll_id: string
          position: number
          target_date: string
        }
        Insert: {
          id?: string
          poll_id: string
          position?: number
          target_date: string
        }
        Update: {
          id?: string
          poll_id?: string
          position?: number
          target_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_dates_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_invites: {
        Row: {
          created_at: string
          email_error: string | null
          email_sent_at: string | null
          id: string
          last_viewed_at: string | null
          poll_id: string
          profile_id: string
          token: string
        }
        Insert: {
          created_at?: string
          email_error?: string | null
          email_sent_at?: string | null
          id?: string
          last_viewed_at?: string | null
          poll_id: string
          profile_id: string
          token: string
        }
        Update: {
          created_at?: string
          email_error?: string | null
          email_sent_at?: string | null
          id?: string
          last_viewed_at?: string | null
          poll_id?: string
          profile_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_invites_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_invites_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_responses: {
        Row: {
          answer: boolean
          id: string
          poll_date_id: string
          poll_invite_id: string
          submitted_at: string
        }
        Insert: {
          answer: boolean
          id?: string
          poll_date_id: string
          poll_invite_id: string
          submitted_at?: string
        }
        Update: {
          answer?: boolean
          id?: string
          poll_date_id?: string
          poll_invite_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_responses_poll_date_id_fkey"
            columns: ["poll_date_id"]
            isOneToOne: false
            referencedRelation: "poll_dates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_responses_poll_invite_id_fkey"
            columns: ["poll_invite_id"]
            isOneToOne: false
            referencedRelation: "poll_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          band_id: string
          closed_at: string | null
          closes_at: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          title: string | null
        }
        Insert: {
          band_id: string
          closed_at?: string | null
          closes_at?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          title?: string | null
        }
        Update: {
          band_id?: string
          closed_at?: string | null
          closes_at?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "polls_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_band_invite: { Args: { p_token: string }; Returns: string }
      close_poll: { Args: { p_poll_id: string }; Returns: undefined }
      create_band: {
        Args: {
          p_bio?: string
          p_founder_role?: string
          p_genres?: string[]
          p_home_city: string
          p_name: string
          p_slug: string
        }
        Returns: string
      }
      create_band_invite: {
        Args: { p_band_id: string; p_email: string; p_role_in_band?: string }
        Returns: string
      }
      create_poll: {
        Args: {
          p_band_id: string
          p_closes_at?: string
          p_dates: string[]
          p_note?: string
          p_title?: string
        }
        Returns: {
          email: string
          full_name: string
          poll_id: string
          profile_id: string
          token: string
        }[]
      }
      delete_google_tokens: { Args: never; Returns: undefined }
      get_google_tokens: {
        Args: never
        Returns: {
          access_token: string
          refresh_token: string
        }[]
      }
      is_band_admin: { Args: { p_band_id: string }; Returns: boolean }
      is_band_member: { Args: { p_band_id: string }; Returns: boolean }
      mark_poll_invite_email: {
        Args: { p_error?: string; p_invite_id: string; p_ok: boolean }
        Returns: undefined
      }
      preview_band_invite: {
        Args: { p_token: string }
        Returns: {
          band_id: string
          band_name: string
          band_slug: string
          email: string
          is_valid: boolean
          reason: string
          role_in_band: string
        }[]
      }
      preview_poll_by_token: {
        Args: { p_token: string }
        Returns: {
          answers: Json
          band_name: string
          closed_at: string
          closes_at: string
          dates: Json
          member_name: string
          note: string
          poll_id: string
          status: string
          title: string
        }[]
      }
      revoke_band_invite: { Args: { p_invite_id: string }; Returns: undefined }
      set_band_preferred_gig_days: {
        Args: { p_band_id: string; p_preferred_days: number[] }
        Returns: undefined
      }
      set_google_tokens: {
        Args: { p_access_token: string; p_refresh_token: string }
        Returns: undefined
      }
      set_member_required_for_gigs: {
        Args: {
          p_band_id: string
          p_is_required: boolean
          p_profile_id: string
        }
        Returns: undefined
      }
      set_member_role: {
        Args: {
          p_band_id: string
          p_profile_id: string
          p_role_in_band: string
        }
        Returns: undefined
      }
      shares_band_with: { Args: { p_profile_id: string }; Returns: boolean }
      submit_poll_response: {
        Args: { p_answers: Json; p_token: string }
        Returns: undefined
      }
      sync_band_open_dates: { Args: { p_band_id: string }; Returns: undefined }
    }
    Enums: {
      gig_status: "actively_seeking" | "penciled_in" | "booked" | "unavailable"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      gig_status: ["actively_seeking", "penciled_in", "booked", "unavailable"],
    },
  },
} as const
