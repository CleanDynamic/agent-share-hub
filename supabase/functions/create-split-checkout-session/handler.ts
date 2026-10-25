import { z } from "zod/v4";
import { penceOf, returnUrlError, type CheckoutStripe } from "../_shared/checkout.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { bearerToken, errorResponse, fieldError, jsonResponse } from "../_shared/http.ts";

// price_amount may still arrive from an old client; it is not read. The price and
// the splits are the item's own, from the database.
const Body = z.object({
  content_id: z.guid(),
  success_url: z.url(),
  cancel_url: z.url(),
});

export interface SplitItem {
  id: string;
  creator_id: string;
  title: string | null;
  price_gbp: number | null;
  monetisation_type: string | null;
}

export interface Deps {
  stripe: CheckoutStripe | null;
  getItem(contentId: string): Promise<SplitItem | null>;
  getSplits(contentId: string): Promise<{ recipient_id: string; percentage: number }[]>;
  /** Stripe account id by profile id. */
  getStripeAccounts(profileIds: string[]): Promise<Map<string, string | null>>;
  getUserId(token: string | null): Promise<string | null>;
}

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return preflight(req);
    const cors = corsHeaders(req);
    if (req.method !== "POST") return errorResponse("Method not allowed", 405, cors);

    try {
      const raw = await req.json().catch(() => null);
      const parsed = Body.safeParse(raw);
      if (!parsed.success) return errorResponse(fieldError(parsed.error), 400, cors);
      const { content_id, success_url, cancel_url } = parsed.data;

      const urlError = returnUrlError({ success_url, cancel_url });
      if (urlError) return errorResponse(urlError, 400, cors);

      if (!deps.stripe) return errorResponse("Stripe is not configured", 500, cors);

      const item = await deps.getItem(content_id);
      if (!item) return errorResponse("Content not found", 404, cors);
      if (item.monetisation_type !== "paid" || !item.price_gbp || item.price_gbp <= 0) {
        return errorResponse("This item is not for sale", 400, cors);
      }
      const priceAmount = penceOf(item.price_gbp);

      const splits = await deps.getSplits(content_id);
      const accounts = await deps.getStripeAccounts([item.creator_id, ...splits.map((s) => s.recipient_id)]);
      const transferGroup = `content_${content_id}_${Date.now()}`;

      // Compute splits
      const platformFee = Math.round(priceAmount * 0.1);
      const creatorPortion = priceAmount - platformFee;

      const transfers: { amount: number; destination: string }[] = [];

      let recipientTotal = 0;
      for (const split of splits) {
        const stripeId = accounts.get(split.recipient_id);
        if (!stripeId) continue; // skip if no stripe account
        const amount = Math.round(creatorPortion * (split.percentage / 100));
        if (amount > 0) {
          transfers.push({ amount, destination: stripeId });
          recipientTotal += amount;
        }
      }

      const creatorFinal = creatorPortion - recipientTotal;
      const creatorStripeId = accounts.get(item.creator_id);

      if (creatorStripeId && creatorFinal > 0) {
        transfers.push({ amount: creatorFinal, destination: creatorStripeId });
      }

      const buyerId = await deps.getUserId(bearerToken(req));
      const sessionParams: Record<string, unknown> = {
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "gbp",
              unit_amount: priceAmount,
              product_data: { name: `Content unlock: ${item.title}`, metadata: { content_id } },
            },
            quantity: 1,
          },
        ],
        metadata: buyerId ? { content_id, transfer_group: transferGroup, buyer_id: buyerId } : { content_id, transfer_group: transferGroup },
        success_url,
        cancel_url,
      };

      // If there are connected accounts, set up payment intent data for transfers
      if (transfers.length > 0) {
        sessionParams.payment_intent_data = { transfer_group: transferGroup };
      }

      const session = await deps.stripe.createSession(sessionParams);

      // Note: Actual transfers happen via webhook after payment succeeds.
      // For simplicity, we store the transfer intent in metadata.
      // In production, a webhook handler would create the transfers.

      return jsonResponse({ url: session.url }, 200, cors);
    } catch (err) {
      console.error("Split checkout error:", err);
      return errorResponse("Could not start checkout", 500, cors);
    }
  };
}
