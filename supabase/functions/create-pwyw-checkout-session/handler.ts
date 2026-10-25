import { z } from "zod/v4";
import { MAX_PENCE, penceOf, returnUrlError, type CheckoutStripe } from "../_shared/checkout.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { bearerToken, errorResponse, fieldError, jsonResponse } from "../_shared/http.ts";

const Body = z.object({
  content_id: z.guid(),
  buyer_amount_pence: z.number().int().max(MAX_PENCE),
  success_url: z.url(),
  cancel_url: z.url(),
});

export interface PwywItem {
  id: string;
  title: string | null;
  is_pwyw: boolean | null;
  pwyw_floor_gbp: number | null;
}

export interface Deps {
  stripe: CheckoutStripe | null;
  getItem(contentId: string): Promise<PwywItem | null>;
  getUserId(token: string | null): Promise<string | null>;
}

// Starting a checkout writes nothing. pwyw_purchase_count and pwyw_avg_paid_gbp
// were updated here, before anyone paid, so anyone could move them. Nothing in
// the repository confirms a pay-what-you-want payment (verify-project-package
// confirms project packages only, and there is no Stripe webhook), so nothing
// updates them now.
export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return preflight(req);
    const cors = corsHeaders(req);
    if (req.method !== "POST") return errorResponse("Method not allowed", 405, cors);

    try {
      const raw = await req.json().catch(() => null);
      const parsed = Body.safeParse(raw);
      if (!parsed.success) return errorResponse(fieldError(parsed.error), 400, cors);
      const { content_id, buyer_amount_pence, success_url, cancel_url } = parsed.data;

      const urlError = returnUrlError({ success_url, cancel_url });
      if (urlError) return errorResponse(urlError, 400, cors);

      const item = await deps.getItem(content_id);
      if (!item) return errorResponse("Content not found", 404, cors);
      if (!item.is_pwyw) return errorResponse("This item is not pay what you want", 400, cors);

      const floorPence = penceOf(item.pwyw_floor_gbp ?? 0);
      if (buyer_amount_pence < floorPence) {
        return errorResponse(`buyer_amount_pence: minimum is £${(floorPence / 100).toFixed(2)}`, 400, cors);
      }
      if (buyer_amount_pence < 100) {
        return errorResponse("buyer_amount_pence: minimum payment is £1.00", 400, cors);
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
              unit_amount: buyer_amount_pence,
              product_data: { name: `Pay what you want: ${item.title}`, metadata: { content_id } },
            },
            quantity: 1,
          },
        ],
        metadata: buyerId ? { content_id, is_pwyw: "true", buyer_id: buyerId } : { content_id, is_pwyw: "true" },
        success_url,
        cancel_url,
      });

      return jsonResponse({ url: session.url }, 200, cors);
    } catch (err) {
      console.error("PWYW checkout error:", err);
      return errorResponse("Could not start checkout", 500, cors);
    }
  };
}
