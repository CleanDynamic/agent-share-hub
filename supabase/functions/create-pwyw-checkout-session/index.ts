import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createHandler } from "./handler.ts";

// Clients built once from environment values hold nothing about a caller.
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const auth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2023-10-16" }) : null;

serve(
  createHandler({
    stripe: stripe && { createSession: (params) => stripe.checkout.sessions.create(params as never) },
    async getItem(contentId) {
      const { data } = await admin
        .from("content_items")
        .select("id, title, is_pwyw, pwyw_floor_gbp")
        .eq("id", contentId)
        .maybeSingle();
      return data;
    },
    async getUserId(token) {
      if (!token) return null;
      const { data } = await auth.auth.getUser(token);
      return data.user?.id ?? null;
    },
  }),
);
