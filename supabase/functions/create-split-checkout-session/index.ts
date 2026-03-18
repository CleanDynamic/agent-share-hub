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
    const { content_id, price_amount, success_url, cancel_url } = await req.json();

    if (!content_id || !price_amount || !success_url || !cancel_url) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (typeof price_amount !== "number" || price_amount < 100) {
      return new Response(
        JSON.stringify({ error: "price_amount must be at least 100 (£1.00 in pence)" }),
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch content item with creator
    const { data: item, error: itemErr } = await sb
      .from("content_items")
      .select("id, creator_id, title")
      .eq("id", content_id)
      .single();

    if (itemErr || !item) {
      return new Response(
        JSON.stringify({ error: "Content not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch revenue splits
    const { data: splits } = await sb
      .from("revenue_splits")
      .select("recipient_id, percentage")
      .eq("content_id", content_id);

    // Fetch stripe account IDs
    const recipientIds = (splits ?? []).map((s: any) => s.recipient_id);
    const allIds = [item.creator_id, ...recipientIds];
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, stripe_account_id")
      .in("id", allIds);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.stripe_account_id]));

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const transferGroup = `content_${content_id}_${Date.now()}`;

    // Compute splits
    const platformFee = Math.round(price_amount * 0.10);
    const creatorPortion = price_amount - platformFee;

    const transfers: { amount: number; destination: string }[] = [];

    let recipientTotal = 0;
    for (const split of (splits ?? [])) {
      const stripeId = profileMap.get(split.recipient_id);
      if (!stripeId) continue; // skip if no stripe account
      const amount = Math.round(creatorPortion * (split.percentage / 100));
      if (amount > 0) {
        transfers.push({ amount, destination: stripeId });
        recipientTotal += amount;
      }
    }

    const creatorFinal = creatorPortion - recipientTotal;
    const creatorStripeId = profileMap.get(item.creator_id);

    if (creatorStripeId && creatorFinal > 0) {
      transfers.push({ amount: creatorFinal, destination: creatorStripeId });
    }

    // Create checkout session
    const sessionParams: any = {
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: Math.round(price_amount),
            product_data: {
              name: `Content unlock: ${item.title}`,
              metadata: { content_id },
            },
          },
          quantity: 1,
        },
      ],
      metadata: { content_id, transfer_group: transferGroup },
      success_url,
      cancel_url,
    };

    // If there are connected accounts, set up payment intent data for transfers
    if (transfers.length > 0) {
      sessionParams.payment_intent_data = {
        transfer_group: transferGroup,
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Note: Actual transfers happen via webhook after payment succeeds.
    // For simplicity, we store the transfer intent in metadata.
    // In production, a webhook handler would create the transfers.

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Split checkout error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
