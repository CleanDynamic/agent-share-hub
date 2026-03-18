import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000).toISOString();

  // Fetch all approved items
  const { data: items, error } = await supabase
    .from("content_items")
    .select("id, creator_id, title, last_verified_at, approved_at, compatibility_status")
    .eq("status", "approved");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  let updatedCount = 0;
  const notifications: any[] = [];

  for (const item of items ?? []) {
    let newStatus: string;

    if (item.last_verified_at && item.last_verified_at >= ninetyDaysAgo) {
      newStatus = "verified";
    } else if (item.last_verified_at && item.last_verified_at < ninetyDaysAgo) {
      newStatus = "outdated";
    } else if (!item.last_verified_at && item.approved_at && item.approved_at < ninetyDaysAgo) {
      newStatus = "outdated";
    } else {
      newStatus = "unverified";
    }

    if (newStatus !== item.compatibility_status) {
      await supabase
        .from("content_items")
        .update({ compatibility_status: newStatus })
        .eq("id", item.id);
      updatedCount++;

      // Notify creator when newly outdated
      if (newStatus === "outdated" && item.compatibility_status !== "outdated") {
        const daysSince = item.last_verified_at
          ? Math.floor((now.getTime() - new Date(item.last_verified_at).getTime()) / 86400000)
          : item.approved_at
            ? Math.floor((now.getTime() - new Date(item.approved_at).getTime()) / 86400000)
            : 90;

        notifications.push({
          recipient_id: item.creator_id,
          notification_type: "compatibility_warning",
          content_id: item.id,
          metadata: { content_title: item.title, days_since_verified: daysSince },
        });
      }
    }
  }

  // Batch insert notifications
  if (notifications.length > 0) {
    await supabase.from("notifications").insert(notifications);
  }

  return new Response(JSON.stringify({ updated: updatedCount, notified: notifications.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
