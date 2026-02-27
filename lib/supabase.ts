import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Minimal database type so Supabase query builder accepts our tables without
// requiring generated types from the Supabase CLI.
type Row = Record<string, unknown>;
type Database = {
  public: {
    Tables: {
      user_credentials: { Row: Row; Insert: Row; Update: Row; Relationships: [] };
      user_settings: { Row: Row; Insert: Row; Update: Row; Relationships: [] };
      posts: { Row: Row; Insert: Row; Update: Row; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let client: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Supabase environment variables are not configured.");
    }
    client = createClient<Database>(url, key, {
      auth: { persistSession: false },
    });
  }
  return client;
}
