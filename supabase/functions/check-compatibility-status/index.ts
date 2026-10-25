import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createCompatHandler, type Item } from "./handler.ts";

// Built from environment values only.
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(
  createCompatHandler({
    secret: Deno.env.get("CRON_SECRET"),
    listApproved: async () => {
      const { data, error } = await db
        .from("content_items")
        .select("id, creator_id, title, last_verified_at, approved_at, compatibility_status")
        .eq("status", "approved")
        .limit(20000);
      if (error) throw error;
      return (data ?? []) as Item[];
    },
    setStatus: async (id, status) => {
      const { error } = await db.from("content_items").update({ compatibility_status: status }).eq("id", id);
      if (error) throw error;
    },
    insertNotifications: async (rows) => {
      const { error } = await db.from("notifications").insert(rows);
      if (error) throw error;
    },
    now: () => new Date(),
  }),
);
