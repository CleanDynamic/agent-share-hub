import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHandler } from "./handler.ts";

// Clients built once from environment values hold nothing about a caller.
const auth = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

serve(
  createHandler({
    async getUser(token) {
      if (!token) return null;
      const { data } = await auth.auth.getUser(token);
      return data.user ? { id: data.user.id } : null;
    },
    async getSession(sessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        return {
          payment_status: session.payment_status,
          payment_intent: (session.payment_intent as string | null) ?? null,
          metadata: session.metadata,
        };
      } catch {
        return null;
      }
    },
    async recordPurchase({ projectId, userId, paymentIntent }) {
      // Insert purchase using service role
      const { data: project } = await admin.from("projects").select("package_price_gbp").eq("id", projectId).single();
      const { error } = await admin.from("project_package_purchases").upsert(
        {
          project_id: projectId,
          user_id: userId,
          stripe_payment_intent_id: paymentIntent,
          amount_gbp: project?.package_price_gbp ?? 0,
        },
        { onConflict: "project_id,user_id" },
      );
      if (error) throw error;
    },
  }),
);
