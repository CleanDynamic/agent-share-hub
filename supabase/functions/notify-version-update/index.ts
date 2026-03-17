import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content_id, version_number, changelog, content_title, creator_id } = await req.json();

    if (!content_id || !version_number || !creator_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get unique user IDs from downloads and saves for this content
    const [{ data: downloads }, { data: saves }] = await Promise.all([
      supabase.from("downloads").select("user_id").eq("content_id", content_id).not("user_id", "is", null),
      supabase.from("user_saves").select("user_id").eq("content_id", content_id),
    ]);

    const userIds = [...new Set([
      ...(downloads ?? []).map((d: any) => d.user_id),
      ...(saves ?? []).map((s: any) => s.user_id),
    ])].filter((id) => id && id !== creator_id);

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ notified: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Batch insert notifications
    const notifications = userIds.map((uid: string) => ({
      recipient_id: uid,
      actor_id: creator_id,
      notification_type: "version_update",
      content_id,
      metadata: { version_number, changelog: (changelog || "").slice(0, 200), content_title: content_title || "" },
    }));

    // Insert in batches of 100
    for (let i = 0; i < notifications.length; i += 100) {
      const batch = notifications.slice(i, i + 100);
      await supabase.from("notifications").insert(batch);
    }

    return new Response(JSON.stringify({ notified: userIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
