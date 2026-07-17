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
      activities: {
        Row: {
          actor_id: string;
          created_at: string;
          id: string;
          kind: string;
          media_id: string | null;
          payload: Json;
          visibility: string;
        };
        Insert: {
          actor_id: string;
          created_at?: string;
          id?: string;
          kind: string;
          media_id?: string | null;
          payload?: Json;
          visibility?: string;
        };
        Update: {
          actor_id?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          media_id?: string | null;
          payload?: Json;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activities_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
        ];
      };
      beta_invites: {
        Row: {
          claimed_at: string | null;
          claimed_by: string | null;
          code_hash: string;
          created_at: string;
          created_by: string;
          expires_at: string;
          id: string;
        };
        Insert: {
          claimed_at?: string | null;
          claimed_by?: string | null;
          code_hash: string;
          created_at?: string;
          created_by: string;
          expires_at: string;
          id?: string;
        };
        Update: {
          claimed_at?: string | null;
          claimed_by?: string | null;
          code_hash?: string;
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "beta_invites_claimed_by_fkey";
            columns: ["claimed_by"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "beta_invites_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      episodes: {
        Row: {
          air_date: string | null;
          created_at: string;
          episode_number: number;
          id: string;
          metadata: Json;
          runtime_minutes: number | null;
          season_id: string;
          still_path: string | null;
          synopsis: string | null;
          title: string;
        };
        Insert: {
          air_date?: string | null;
          created_at?: string;
          episode_number: number;
          id?: string;
          metadata?: Json;
          runtime_minutes?: number | null;
          season_id: string;
          still_path?: string | null;
          synopsis?: string | null;
          title: string;
        };
        Update: {
          air_date?: string | null;
          created_at?: string;
          episode_number?: number;
          id?: string;
          metadata?: Json;
          runtime_minutes?: number | null;
          season_id?: string;
          still_path?: string | null;
          synopsis?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "episodes_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
        ];
      };
      friendships: {
        Row: {
          addressee_id: string;
          created_at: string;
          id: string;
          requester_id: string;
          status: Database["public"]["Enums"]["friendship_status"];
          updated_at: string;
        };
        Insert: {
          addressee_id: string;
          created_at?: string;
          id?: string;
          requester_id: string;
          status?: Database["public"]["Enums"]["friendship_status"];
          updated_at?: string;
        };
        Update: {
          addressee_id?: string;
          created_at?: string;
          id?: string;
          requester_id?: string;
          status?: Database["public"]["Enums"]["friendship_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey";
            columns: ["addressee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "friendships_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      media: {
        Row: {
          backdrop_path: string | null;
          created_at: string;
          format: Database["public"]["Enums"]["media_format"];
          id: string;
          metadata: Json;
          metadata_updated_at: string | null;
          original_title: string | null;
          poster_path: string | null;
          release_year: number | null;
          runtime_minutes: number | null;
          title: string;
          tmdb_id: number | null;
        };
        Insert: {
          backdrop_path?: string | null;
          created_at?: string;
          format: Database["public"]["Enums"]["media_format"];
          id?: string;
          metadata?: Json;
          metadata_updated_at?: string | null;
          original_title?: string | null;
          poster_path?: string | null;
          release_year?: number | null;
          runtime_minutes?: number | null;
          title: string;
          tmdb_id?: number | null;
        };
        Update: {
          backdrop_path?: string | null;
          created_at?: string;
          format?: Database["public"]["Enums"]["media_format"];
          id?: string;
          metadata?: Json;
          metadata_updated_at?: string | null;
          original_title?: string | null;
          poster_path?: string | null;
          release_year?: number | null;
          runtime_minutes?: number | null;
          title?: string;
          tmdb_id?: number | null;
        };
        Relationships: [];
      };
      pairwise_comparisons: {
        Row: {
          compared_at: string;
          id: string;
          left_media_id: string;
          preferred_media_id: string;
          ranking_scope: string;
          right_media_id: string;
          user_id: string;
        };
        Insert: {
          compared_at?: string;
          id?: string;
          left_media_id: string;
          preferred_media_id: string;
          ranking_scope?: string;
          right_media_id: string;
          user_id: string;
        };
        Update: {
          compared_at?: string;
          id?: string;
          left_media_id?: string;
          preferred_media_id?: string;
          ranking_scope?: string;
          right_media_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pairwise_comparisons_left_media_id_fkey";
            columns: ["left_media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pairwise_comparisons_preferred_media_id_fkey";
            columns: ["preferred_media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pairwise_comparisons_right_media_id_fkey";
            columns: ["right_media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pairwise_comparisons_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          display_name: string;
          handle: string;
          id: string;
          is_private: boolean;
          library_initialized_at: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name: string;
          handle: string;
          id: string;
          is_private?: boolean;
          library_initialized_at?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          handle?: string;
          id?: string;
          is_private?: boolean;
          library_initialized_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          kind: string;
          media_id: string;
          spoiler_episode: number | null;
          spoiler_level: Database["public"]["Enums"]["spoiler_level"];
          spoiler_season: number | null;
          updated_at: string;
          visibility: string;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          id?: string;
          kind: string;
          media_id: string;
          spoiler_episode?: number | null;
          spoiler_level?: Database["public"]["Enums"]["spoiler_level"];
          spoiler_season?: number | null;
          updated_at?: string;
          visibility?: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          media_id?: string;
          spoiler_episode?: number | null;
          spoiler_level?: Database["public"]["Enums"]["spoiler_level"];
          spoiler_season?: number | null;
          updated_at?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
        ];
      };
      room_candidates: {
        Row: {
          created_at: string;
          id: string;
          media_id: string;
          position: number;
          reason: string;
          room_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          media_id: string;
          position: number;
          reason: string;
          room_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          media_id?: string;
          position?: number;
          reason?: string;
          room_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "room_candidates_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "room_candidates_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "watch_rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      room_participants: {
        Row: {
          joined_at: string;
          role: string;
          room_id: string;
          user_id: string;
        };
        Insert: {
          joined_at?: string;
          role?: string;
          room_id: string;
          user_id: string;
        };
        Update: {
          joined_at?: string;
          role?: string;
          room_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "room_participants_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "watch_rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "room_participants_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      room_votes: {
        Row: {
          candidate_id: string;
          created_at: string;
          updated_at: string;
          vote: Database["public"]["Enums"]["room_vote"];
          voter_id: string;
        };
        Insert: {
          candidate_id: string;
          created_at?: string;
          updated_at?: string;
          vote: Database["public"]["Enums"]["room_vote"];
          voter_id: string;
        };
        Update: {
          candidate_id?: string;
          created_at?: string;
          updated_at?: string;
          vote?: Database["public"]["Enums"]["room_vote"];
          voter_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "room_votes_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "room_candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "room_votes_voter_id_fkey";
            columns: ["voter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      seasons: {
        Row: {
          created_at: string;
          episode_count: number | null;
          id: string;
          media_id: string;
          metadata: Json;
          poster_path: string | null;
          release_year: number | null;
          season_number: number;
          title: string | null;
        };
        Insert: {
          created_at?: string;
          episode_count?: number | null;
          id?: string;
          media_id: string;
          metadata?: Json;
          poster_path?: string | null;
          release_year?: number | null;
          season_number: number;
          title?: string | null;
        };
        Update: {
          created_at?: string;
          episode_count?: number | null;
          id?: string;
          media_id?: string;
          metadata?: Json;
          poster_path?: string | null;
          release_year?: number | null;
          season_number?: number;
          title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "seasons_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
        ];
      };
      shelf_collaborators: {
        Row: {
          added_at: string;
          can_edit: boolean;
          shelf_id: string;
          user_id: string;
        };
        Insert: {
          added_at?: string;
          can_edit?: boolean;
          shelf_id: string;
          user_id: string;
        };
        Update: {
          added_at?: string;
          can_edit?: boolean;
          shelf_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shelf_collaborators_shelf_id_fkey";
            columns: ["shelf_id"];
            isOneToOne: false;
            referencedRelation: "shelves";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shelf_collaborators_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      shelf_items: {
        Row: {
          added_at: string;
          added_by: string;
          id: string;
          media_id: string;
          note: string | null;
          position: number;
          shelf_id: string;
        };
        Insert: {
          added_at?: string;
          added_by: string;
          id?: string;
          media_id: string;
          note?: string | null;
          position: number;
          shelf_id: string;
        };
        Update: {
          added_at?: string;
          added_by?: string;
          id?: string;
          media_id?: string;
          note?: string | null;
          position?: number;
          shelf_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shelf_items_added_by_fkey";
            columns: ["added_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shelf_items_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shelf_items_shelf_id_fkey";
            columns: ["shelf_id"];
            isOneToOne: false;
            referencedRelation: "shelves";
            referencedColumns: ["id"];
          },
        ];
      };
      shelves: {
        Row: {
          atmosphere: string | null;
          automatic_rules: Json | null;
          created_at: string;
          description: string | null;
          featured_media_id: string | null;
          id: string;
          owner_id: string;
          title: string;
          updated_at: string;
          visibility: Database["public"]["Enums"]["shelf_visibility"];
        };
        Insert: {
          atmosphere?: string | null;
          automatic_rules?: Json | null;
          created_at?: string;
          description?: string | null;
          featured_media_id?: string | null;
          id?: string;
          owner_id: string;
          title: string;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["shelf_visibility"];
        };
        Update: {
          atmosphere?: string | null;
          automatic_rules?: Json | null;
          created_at?: string;
          description?: string | null;
          featured_media_id?: string | null;
          id?: string;
          owner_id?: string;
          title?: string;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["shelf_visibility"];
        };
        Relationships: [
          {
            foreignKeyName: "shelves_featured_media_id_fkey";
            columns: ["featured_media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shelves_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_media_states: {
        Row: {
          id: string;
          intent: Json;
          media_id: string;
          progress_episode: number | null;
          progress_season: number | null;
          saved_at: string;
          status: Database["public"]["Enums"]["library_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          intent?: Json;
          media_id: string;
          progress_episode?: number | null;
          progress_season?: number | null;
          saved_at?: string;
          status?: Database["public"]["Enums"]["library_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          intent?: Json;
          media_id?: string;
          progress_episode?: number | null;
          progress_season?: number | null;
          saved_at?: string;
          status?: Database["public"]["Enums"]["library_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_media_states_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_media_states_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      verdicts: {
        Row: {
          episode_id: string | null;
          id: string;
          kind: Database["public"]["Enums"]["verdict_kind"];
          media_id: string;
          normalized: number;
          personal_rank: number | null;
          qualities: string[];
          recorded_at: string;
          season_id: string | null;
          tags: string[];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          episode_id?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["verdict_kind"];
          media_id: string;
          normalized: number;
          personal_rank?: number | null;
          qualities?: string[];
          recorded_at?: string;
          season_id?: string | null;
          tags?: string[];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          episode_id?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["verdict_kind"];
          media_id?: string;
          normalized?: number;
          personal_rank?: number | null;
          qualities?: string[];
          recorded_at?: string;
          season_id?: string | null;
          tags?: string[];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "verdicts_episode_id_fkey";
            columns: ["episode_id"];
            isOneToOne: false;
            referencedRelation: "episodes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "verdicts_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "verdicts_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "verdicts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      watch_events: {
        Row: {
          created_at: string;
          episode_id: string | null;
          event_type: string;
          id: string;
          media_id: string;
          metadata: Json;
          rewatch_number: number | null;
          season_id: string | null;
          user_id: string;
          watched_at: string;
        };
        Insert: {
          created_at?: string;
          episode_id?: string | null;
          event_type: string;
          id?: string;
          media_id: string;
          metadata?: Json;
          rewatch_number?: number | null;
          season_id?: string | null;
          user_id: string;
          watched_at?: string;
        };
        Update: {
          created_at?: string;
          episode_id?: string | null;
          event_type?: string;
          id?: string;
          media_id?: string;
          metadata?: Json;
          rewatch_number?: number | null;
          season_id?: string | null;
          user_id?: string;
          watched_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "watch_events_episode_id_fkey";
            columns: ["episode_id"];
            isOneToOne: false;
            referencedRelation: "episodes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "watch_events_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "watch_events_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "watch_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      watch_rooms: {
        Row: {
          constraints: Json;
          created_at: string;
          host_id: string;
          id: string;
          name: string;
          selected_media_id: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          constraints?: Json;
          created_at?: string;
          host_id: string;
          id?: string;
          name: string;
          selected_media_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          constraints?: Json;
          created_at?: string;
          host_id?: string;
          id?: string;
          name?: string;
          selected_media_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "watch_rooms_host_id_fkey";
            columns: ["host_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "watch_rooms_selected_media_id_fkey";
            columns: ["selected_media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      dearmor: { Args: { "": string }; Returns: string };
      fips_mode: { Args: never; Returns: boolean };
      gen_random_uuid: { Args: never; Returns: string };
      gen_salt: { Args: { "": string }; Returns: string };
      pgp_armor_headers: {
        Args: { "": string };
        Returns: Record<string, unknown>[];
      };
    };
    Enums: {
      friendship_status: "pending" | "accepted" | "blocked";
      library_status:
        | "watching"
        | "up-next"
        | "planned"
        | "paused"
        | "completed"
        | "dropped"
        | "rewatching"
        | "archived";
      media_format: "movie" | "series";
      room_vote: "yes" | "maybe" | "no";
      shelf_visibility: "private" | "public" | "collaborative";
      spoiler_level: "title" | "season" | "episode" | "checkpoint";
      verdict_kind:
        "all-timer" | "loved" | "liked" | "mixed" | "not-for-me" | "dropped";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      friendship_status: ["pending", "accepted", "blocked"],
      library_status: [
        "watching",
        "up-next",
        "planned",
        "paused",
        "completed",
        "dropped",
        "rewatching",
        "archived",
      ],
      media_format: ["movie", "series"],
      room_vote: ["yes", "maybe", "no"],
      shelf_visibility: ["private", "public", "collaborative"],
      spoiler_level: ["title", "season", "episode", "checkpoint"],
      verdict_kind: [
        "all-timer",
        "loved",
        "liked",
        "mixed",
        "not-for-me",
        "dropped",
      ],
    },
  },
} as const;
