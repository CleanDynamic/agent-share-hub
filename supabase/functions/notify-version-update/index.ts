import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHandler } from "./handler.ts";

// Clients built once from environment values hold nothing about a caller.
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const auth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);

Deno.serve(
  createHandler({
    async getUser(token) {
      if (!token) return null;
      const { data } = await auth.auth.getUser(token);
      return data.user ? { id: data.user.id } : null;
    },
    async getContentCreator(contentId) {
      const { data } = await admin.from("content_items").select("creator_id").eq("id", contentId).maybeSingle();
      return data?.creator_id ?? null;
    },
    async getRecipients(contentId) {
      // Get unique user IDs from downloads and saves for this content
      const [downloads, saves] = await Promise.all([
        admin.from("downloads").select("user_id").eq("content_id", contentId).not("user_id", "is", null),
        admin.from("user_saves").select("user_id").eq("content_id", contentId),
      ]);
      if (downloads.error) throw downloads.error;
      if (saves.error) throw saves.error;
      return [...(downloads.data ?? []), ...(saves.data ?? [])].map((row: { user_id: string }) => row.user_id);
    },
    async insertNotifications(rows) {
      const { error } = await admin.from("notifications").insert(rows);
      if (error) throw error;
    },
  }),
);
