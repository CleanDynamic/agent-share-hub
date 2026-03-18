import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content_id, buyer_amount_pence, success_url, cancel_url } = await req.json();

    if (!content_id || !buyer_amount_pence || !success_url || !cancel_url) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch content item to validate floor price
    const { data: item, error: itemErr } = await sb
      .from("content_items")
      .select("id, title, pwyw_floor_gbp, pwyw_purchase_count, pwyw_avg_paid_gbp")
      .eq("id", content_id)
      .single();

    if (itemErr || !item) {
      return new Response(
        JSON.stringify({ error: "Content not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const floorPence = Math.round((item.pwyw_floor_gbp ?? 0) * 100);
    if (buyer_amount_pence < floorPence) {
      return new Response(
        JSON.stringify({ error: `Minimum is £${(floorPence / 100).toFixed(2)}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (buyer_amount_pence < 100) {
      return new Response(
        JSON.stringify({ error: "Minimum payment is £1.00" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: "Stripe is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: Math.round(buyer_amount_pence),
            product_data: {
              name: `Pay what you want: ${item.title}`,
              metadata: { content_id },
            },
          },
          quantity: 1,
        },
      ],
      metadata: { content_id, is_pwyw: "true" },
      success_url,
      cancel_url,
    });

    // Update PWYW stats
    const currentCount = item.pwyw_purchase_count ?? 0;
    const currentAvg = item.pwyw_avg_paid_gbp ?? 0;
    const buyerGbp = buyer_amount_pence / 100;
    const newAvg = currentCount === 0
      ? buyerGbp
      : ((currentAvg * currentCount) + buyerGbp) / (currentCount + 1);

    await sb.from("content_items").update({
      pwyw_purchase_count: currentCount + 1,
      pwyw_avg_paid_gbp: Math.round(newAvg * 100) / 100,
    }).eq("id", content_id);

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("PWYW checkout error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
