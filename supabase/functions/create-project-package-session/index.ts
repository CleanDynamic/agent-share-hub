import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createHandler } from "./handler.ts";

// Clients built once from environment values hold nothing about a caller.
const client = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

serve(
  createHandler({
    stripe: stripeKey
      ? {
          createSession: (params) => stripe.checkout.sessions.create(params as never),
          async findCustomerId(email) {
            const customers = await stripe.customers.list({ email, limit: 1 });
            return customers.data[0]?.id;
          },
        }
      : null,
    async getUser(token) {
      if (!token) return null;
      const { data } = await client.auth.getUser(token);
      return data.user?.email ? { id: data.user.id, email: data.user.email } : null;
    },
    async getProject(projectId) {
      const { data } = await client
        .from("projects")
        .select("id, title, package_price_gbp, package_price_enabled")
        .eq("id", projectId)
        .maybeSingle();
      return data;
    },
    async ownsPackage(projectId, userId) {
      const { data } = await client
        .from("project_package_purchases")
        .select("id")
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .maybeSingle();
      return !!data;
    },
  }),
);
