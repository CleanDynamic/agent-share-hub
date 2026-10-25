// The body names the item and where to send the buyer back to. It does not say
// what the item costs: the price is content_items.price_gbp. A browser that
// still sends `price_amount` is ignored.

import { z } from "zod";
import { readBody, returnUrl } from "../_shared/body.ts";
import { fail, json, preflight } from "../_shared/cors.ts";
import { paidPence, type PaymentDeps } from "../_shared/payments.ts";

const Body = z.object({
  content_id: z.string({ required_error: "Required" }).uuid(),
  success_url: returnUrl,
  cancel_url: returnUrl,
});

export function createCheckoutHandler(deps: PaymentDeps) {
  return async (req: Request): Promise<Response> => {
    const early = preflight(req);
    if (early) return early;
    if (req.method !== "POST") return fail(req, 405, "Method not allowed");

    try {
      const body = await readBody(req, Body);
      if (!body.ok) return fail(req, 400, body.error);
      const { content_id, success_url, cancel_url } = body.data;

      const item = await deps.findItem(content_id);
      if (!item) return fail(req, 404, "Content not found");
      const pence = paidPence(item);
      if (pence === null) return fail(req, 400, "This item is not for sale");

      const buyerId = await deps.getUserId(req);
      const session = await deps.createSession({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "gbp",
              unit_amount: pence,
              product_data: { name: `Content unlock: ${item.title}`, metadata: { content_id } },
            },
            quantity: 1,
          },
        ],
        metadata: { content_id, ...(buyerId ? { buyer_id: buyerId } : {}) },
        success_url,
        cancel_url,
      });
      return json(req, { url: session.url });
    } catch (err) {
      console.error("create-checkout-session:", err);
      return fail(req, 500, "Could not start checkout");
    }
  };
}
