// Pay what you want. The buyer picks the amount, between the item's floor
// (content_items.pwyw_floor_gbp) and £1,000.
//
// This function used to add to pwyw_purchase_count and pwyw_avg_paid_gbp when a
// checkout STARTED, so anyone could inflate them by starting checkouts they
// never paid for. It writes nothing now. Nothing in this repository confirms a
// pay-what-you-want payment (there is no Stripe webhook, and verify-project-package
// is for project packages), so the two figures stay as they are until one does.

import { z, readBody, returnUrl } from "../_shared/body.ts";
import { fail, json, preflight } from "../_shared/cors.ts";
import { MIN_PENCE, PWYW_CEILING_PENCE, toPence, type PaymentDeps } from "../_shared/payments.ts";

const Body = z.object({
  content_id: z.string({ required_error: "Required" }).uuid(),
  buyer_amount_pence: z.number({ required_error: "Required" }).int().min(MIN_PENCE, "Minimum payment is £1.00").max(PWYW_CEILING_PENCE, "Maximum payment is £1,000.00"),
  success_url: returnUrl,
  cancel_url: returnUrl,
});

export function createPwywHandler(deps: PaymentDeps) {
  return async (req: Request): Promise<Response> => {
    const early = preflight(req);
    if (early) return early;
    if (req.method !== "POST") return fail(req, 405, "Method not allowed");

    try {
      const body = await readBody(req, Body);
      if (!body.ok) return fail(req, 400, body.error);
      const { content_id, buyer_amount_pence, success_url, cancel_url } = body.data;

      const item = await deps.findItem(content_id);
      if (!item || item.status !== "approved") return fail(req, 404, "Content not found");
      if (!item.is_pwyw && !item.pwyw_enabled) return fail(req, 400, "This item is not pay what you want");

      const floorPence = toPence(item.pwyw_floor_gbp ?? 0);
      if (buyer_amount_pence < floorPence) return fail(req, 400, `Minimum is £${(floorPence / 100).toFixed(2)}`);

      const buyerId = await deps.getUserId(req);
      const session = await deps.createSession({
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
        metadata: { content_id, is_pwyw: "true", ...(buyerId ? { buyer_id: buyerId } : {}) },
        success_url,
        cancel_url,
      });
      return json(req, { url: session.url });
    } catch (err) {
      console.error("create-pwyw-checkout-session:", err);
      return fail(req, 500, "Could not start checkout");
    }
  };
}
