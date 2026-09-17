// =============================================================================
// buildgallery — mcp database types (EX-P04)
// =============================================================================
// The Database generic handed to withSupabase<Database>(), so ctx.supabase is
// a typed client rather than SupabaseClient<unknown>.
//
// This is DELIBERATELY PARTIAL. It carries only the tables this function
// actually touches — today, `profiles`, and only the three columns whoami
// reads. src/integrations/supabase/types.ts is the generated whole-schema
// file, and it cannot be imported here: an edge function cannot reach into
// src/, and copying five thousand lines of unrelated tables into this folder
// would put a second copy of the schema under the connector's care.
//
// Each later step widens this file by exactly the tables it adds. A column
// named here that does not exist in the database is a lie the compiler will
// believe, so nothing goes in until the migration that creates it lands.
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
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
