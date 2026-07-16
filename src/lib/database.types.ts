export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          handle: string;
          display_name: string;
          avatar_url: string | null;
          bio: string | null;
          is_private: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          handle: string;
          display_name: string;
          avatar_url?: string | null;
          bio?: string | null;
          is_private?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          handle?: string;
          display_name?: string;
          avatar_url?: string | null;
          bio?: string | null;
          is_private?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      beta_invites: {
        Row: {
          id: string;
          code_hash: string;
          created_by: string;
          claimed_by: string | null;
          expires_at: string;
          claimed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          code_hash: string;
          created_by: string;
          claimed_by?: string | null;
          expires_at: string;
          claimed_at?: string | null;
          created_at?: string;
        };
        Update: {
          claimed_by?: string | null;
          claimed_at?: string | null;
          expires_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
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
      verdict_kind:
        "all-timer" | "loved" | "liked" | "mixed" | "not-for-me" | "dropped";
    };
    CompositeTypes: Record<string, never>;
  };
}
