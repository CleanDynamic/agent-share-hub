import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createHandler } from "./handler.ts";

// Clients built once from environment values hold nothing about a caller.
const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
const auth = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" }) : null;

serve(
  createHandler({
    stripe: stripe && {
      createSession: (params) => stripe.checkout.sessions.create(params as never),
      async findCustomerId(email) {
        const customers = await stripe.customers.list({ email, limit: 1 });
        return customers.data[0]?.id;
      },
    },
    async getUser(token) {
      if (!token) return null;
      const { data } = await auth.auth.getUser(token);
      return data.user?.email ? { id: data.user.id, email: data.user.email } : null;
    },
    async getSubscriptionPriceId(creatorId) {
      const { data } = await admin.from("profiles").select("subscription_price_id").eq("id", creatorId).maybeSingle();
      return data?.subscription_price_id ?? null;
    },
  }),
);
