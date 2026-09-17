// =============================================================================
// buildgallery — mcp database types (EX-P04, widened in EX-P06)
// =============================================================================
// The Database generic handed to withSupabase<Database>(), so ctx.supabase is
// a typed client rather than SupabaseClient<unknown>.
//
// This is DELIBERATELY PARTIAL. It carries only the tables this function
// actually touches, and of each only the columns it reads or writes.
// src/integrations/supabase/types.ts is the generated whole-schema file, and
// it cannot be imported here: an edge function cannot reach into src/, and
// copying five thousand lines of unrelated tables into this folder would put
// a second copy of the schema under the connector's care.
//
// Each later step widens this file by exactly the tables it adds. A column
// named here that does not exist in the database is a lie the compiler will
// believe, so nothing goes in until the migration that creates it lands.
//
//   EX-P04  profiles        whoami reads display_name and username
//   EX-P06  import_sessions the pipe, in full — 20260917120000_import_sessions.sql
//           builds          begin_import verifies a target; list_drafts lists
//           build_nodes     list_drafts counts a draft's parts
// =============================================================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          username: string | null;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          username?: string | null;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          username?: string | null;
        };
        Relationships: [];
      };
      import_sessions: {
        Row: {
          id: string;
          user_id: string;
          client: string | null;
          source_hint: string | null;
          fingerprint: string | null;
          content_hash: string | null;
          status: string;
          chunk_count: number;
          expected_chunks: number | null;
          total_chars: number;
          declared_turns: number | null;
          declared_chars: number | null;
          reader_id: string | null;
          detection_reason: string | null;
          proposal: unknown | null;
          secret_findings: unknown | null;
          error: string | null;
          target_build_id: string | null;
          build_id: string | null;
          created_at: string;
          updated_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          client?: string | null;
          source_hint?: string | null;
          fingerprint?: string | null;
          content_hash?: string | null;
          status?: string;
          chunk_count?: number;
          expected_chunks?: number | null;
          total_chars?: number;
          declared_turns?: number | null;
          declared_chars?: number | null;
          reader_id?: string | null;
          detection_reason?: string | null;
          proposal?: unknown | null;
          secret_findings?: unknown | null;
          error?: string | null;
          target_build_id?: string | null;
          build_id?: string | null;
          created_at?: string;
          updated_at?: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          client?: string | null;
          source_hint?: string | null;
          fingerprint?: string | null;
          content_hash?: string | null;
          status?: string;
          chunk_count?: number;
          expected_chunks?: number | null;
          total_chars?: number;
          declared_turns?: number | null;
          declared_chars?: number | null;
          reader_id?: string | null;
          detection_reason?: string | null;
          proposal?: unknown | null;
          secret_findings?: unknown | null;
          error?: string | null;
          target_build_id?: string | null;
          build_id?: string | null;
          created_at?: string;
          updated_at?: string;
          expires_at?: string;
        };
        Relationships: [];
      };
      builds: {
        Row: {
          id: string;
          creator_id: string;
          title: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          title: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          title?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      build_nodes: {
        Row: {
          id: string;
          build_id: string;
        };
        Insert: {
          id?: string;
          build_id: string;
        };
        Update: {
          id?: string;
          build_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "build_nodes_build_id_fkey";
            columns: ["build_id"];
            isOneToOne: false;
            referencedRelation: "builds";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
