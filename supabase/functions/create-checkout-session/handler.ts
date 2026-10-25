import { z } from "zod/v4";
import { penceOf, returnUrlError, type CheckoutStripe } from "../_shared/checkout.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { bearerToken, errorResponse, fieldError, jsonResponse } from "../_shared/http.ts";

// price_amount may still arrive from an old client; it is not read. The price is
// the item's own, from the database.
const Body = z.object({
  content_id: z.guid(),
  success_url: z.url(),
  cancel_url: z.url(),
});

export interface SaleItem {
  id: string;
  title: string | null;
  price_gbp: number | null;
  monetisation_type: string | null;
}

export interface Deps {
  /** Null when STRIPE_SECRET_KEY is not set. */
  stripe: CheckoutStripe | null;
  getItem(contentId: string): Promise<SaleItem | null>;
  /** The id of the user the token belongs to; null for a guest or the site's public key. */
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

      const item = await deps.getItem(content_id);
      if (!item) return errorResponse("Content not found", 404, cors);
      if (item.monetisation_type !== "paid" || !item.price_gbp || item.price_gbp <= 0) {
        return errorResponse("This item is not for sale", 400, cors);
      }

      if (!deps.stripe) return errorResponse("Stripe is not configured", 500, cors);

      const buyerId = await deps.getUserId(bearerToken(req));
      const session = await deps.stripe.createSession({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "gbp",
              unit_amount: penceOf(item.price_gbp),
              product_data: { name: `Content unlock: ${content_id}`, metadata: { content_id } },
            },
            quantity: 1,
          },
        ],
        metadata: buyerId ? { content_id, buyer_id: buyerId } : { content_id },
        success_url,
        cancel_url,
      });

      return jsonResponse({ url: session.url }, 200, cors);
    } catch (err) {
      console.error("Stripe checkout error:", err);
      return errorResponse("Could not start checkout", 500, cors);
    }
  };
}
