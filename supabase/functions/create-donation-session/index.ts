import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createDonationHandler } from "./handler.ts";

// Both clients are built from environment values only.
// The creator's shown name is public, so the public key is enough.
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" }) : null;

Deno.serve(
  createDonationHandler({
    findCreatorName: async (creatorId) => {
      const { data } = await db.from("profiles").select("display_name, username").eq("id", creatorId).maybeSingle();
      if (!data) return null;
      return (data as { display_name: string | null; username: string | null }).display_name ?? (data as { username: string | null }).username ?? "";
    },
    createSession: async (params) => {
      if (!stripe) throw new Error("Stripe is not configured");
      const session = await stripe.checkout.sessions.create(params as never);
      return { url: session.url };
    },
  }),
);
