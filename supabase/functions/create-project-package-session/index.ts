import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { project_id, success_url, cancel_url } = await req.json();
    if (!project_id) throw new Error("project_id is required");

    // Fetch project details
    const { data: project, error: projErr } = await supabaseClient
      .from("projects")
      .select("id, title, package_price_gbp, package_price_enabled")
      .eq("id", project_id)
      .single();

    if (projErr || !project) throw new Error("Project not found");
    if (!project.package_price_enabled || !project.package_price_gbp) {
      throw new Error("Package pricing not enabled for this project");
    }

    // Check if already purchased
    const { data: existing } = await supabaseClient
      .from("project_package_purchases")
      .select("id")
      .eq("project_id", project_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) throw new Error("You already own this project package");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Find or create customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const amountPence = Math.round(project.package_price_gbp * 100);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: amountPence,
            product_data: {
              name: `Full project unlock — ${project.title} on NeoScale AI`,
            },
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: success_url || `${req.headers.get("origin")}/project/${project_id}?package=success`,
      cancel_url: cancel_url || `${req.headers.get("origin")}/project/${project_id}`,
      metadata: {
        project_id,
        user_id: user.id,
        type: "project_package",
      },
    });

    // Insert purchase record (on success redirect the frontend will verify)
    // We insert immediately — the success page can verify payment status if needed
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // We don't insert here — we'll insert on success callback
    // Instead store session info for later verification

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
