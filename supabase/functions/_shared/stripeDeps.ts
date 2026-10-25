// The real Stripe client and database behind PaymentDeps. Deno only: the
// handlers never import this, so the tests never load it.

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCaller } from "./caller.ts";
import { SALE_ITEM_COLUMNS, type PaymentDeps, type SaleItem } from "./payments.ts";

export function makePaymentDeps(): PaymentDeps {
  // Both clients are built from environment values only; nothing about a caller
  // is kept here between requests.
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2023-10-16" }) : null;

  return {
    getUserId: async (req) => (await getCaller(req))?.id ?? null,
    findItem: async (contentId) => {
      const { data } = await db.from("content_items").select(SALE_ITEM_COLUMNS).eq("id", contentId).maybeSingle();
      return (data as SaleItem | null) ?? null;
    },
    createSession: async (params) => {
      if (!stripe) throw new Error("Stripe is not configured");
      const session = await stripe.checkout.sessions.create(params as never);
      return { url: session.url };
    },
    findSplits: async (contentId) => {
      const { data } = await db.from("revenue_splits").select("recipient_id, percentage").eq("content_id", contentId).limit(50);
      return (data ?? []) as { recipient_id: string; percentage: number }[];
    },
    findStripeAccounts: async (ids) => {
      const { data } = await db.from("profiles").select("id, stripe_account_id").in("id", ids).limit(100);
      return new Map((data ?? []).map((p: { id: string; stripe_account_id: string | null }) => [p.id, p.stripe_account_id]));
    },
  };
}
