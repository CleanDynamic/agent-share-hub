import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCaller } from "../_shared/caller.ts";
import { createNotifyHandler, type Notification } from "./handler.ts";

// Built from environment values only; nothing about a caller is kept here.
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(
  createNotifyHandler({
    getUserId: async (req) => (await getCaller(req))?.id ?? null,
    findCreator: async (contentId) => {
      const { data } = await db.from("content_items").select("creator_id").eq("id", contentId).maybeSingle();
      return (data as { creator_id: string } | null)?.creator_id ?? null;
    },
    findAudience: async (contentId) => {
      const [downloads, saves] = await Promise.all([
        db.from("downloads").select("user_id").eq("content_id", contentId).not("user_id", "is", null).limit(10000),
        db.from("user_saves").select("user_id").eq("content_id", contentId).limit(10000),
      ]);
      if (downloads.error) throw downloads.error;
      if (saves.error) throw saves.error;
      return [...(downloads.data ?? []), ...(saves.data ?? [])].map((row: { user_id: string }) => row.user_id);
    },
    insertNotifications: async (batch: Notification[]) => {
      const { error } = await db.from("notifications").insert(batch);
      if (error) throw error;
    },
  }),
);
