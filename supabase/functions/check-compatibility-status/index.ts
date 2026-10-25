import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHandler } from "./handler.ts";

// Clients built once from environment values hold nothing about a caller.
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(
  createHandler({
    cronSecret: Deno.env.get("CRON_SECRET"),
    async listApproved() {
      const { data, error } = await supabase
        .from("content_items")
        .select("id, creator_id, title, last_verified_at, approved_at, compatibility_status")
        .eq("status", "approved");
      if (error) throw error;
      return data ?? [];
    },
    async updateStatus(id, status) {
      const { error } = await supabase.from("content_items").update({ compatibility_status: status }).eq("id", id);
      if (error) console.error("check-compatibility-status update failed:", id, error.message);
      return !error;
    },
    async insertNotifications(rows) {
      const { error } = await supabase.from("notifications").insert(rows);
      if (error) throw error;
    },
  }),
);
