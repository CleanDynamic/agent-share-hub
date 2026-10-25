// A paid item whose proceeds are split between its creator and named
// recipients. Price and splits come from the database. Nothing in src calls
// this function, but it is still reachable, so it is held to the same rules as
// create-checkout-session, and it needs a signed-in buyer.
//
// The transfers themselves are meant to be made by a Stripe webhook after
// payment succeeds. No such webhook exists in this repository, so the session
// is created with a transfer group and nothing is transferred yet.

import { z, readBody, returnUrl } from "../_shared/body.ts";
import { fail, json, preflight } from "../_shared/cors.ts";
import { paidPence, type PaymentDeps } from "../_shared/payments.ts";

const Body = z.object({
  content_id: z.string({ required_error: "Required" }).uuid(),
  success_url: returnUrl,
  cancel_url: returnUrl,
});

export function createSplitHandler(deps: PaymentDeps, now: () => number = Date.now) {
  return async (req: Request): Promise<Response> => {
    const early = preflight(req);
    if (early) return early;
    if (req.method !== "POST") return fail(req, 405, "Method not allowed");

    try {
      const buyerId = await deps.getUserId(req);
      if (!buyerId) return fail(req, 401, "Sign in to buy this");

      const body = await readBody(req, Body);
      if (!body.ok) return fail(req, 400, body.error);
      const { content_id, success_url, cancel_url } = body.data;

      const item = await deps.findItem(content_id);
      if (!item) return fail(req, 404, "Content not found");
      const pence = paidPence(item);
      if (pence === null) return fail(req, 400, "This item is not for sale");

      const splits = (await deps.findSplits?.(content_id)) ?? [];
      const accounts = (await deps.findStripeAccounts?.([item.creator_id, ...splits.map((s) => s.recipient_id)])) ?? new Map();

      const transferGroup = `content_${content_id}_${now()}`;
      const platformFee = Math.round(pence * 0.1);
      const creatorPortion = pence - platformFee;

      let transferring = false;
      let recipientTotal = 0;
      for (const split of splits) {
        const amount = Math.round(creatorPortion * (split.percentage / 100));
        if (amount > 0 && accounts.get(split.recipient_id)) {
          transferring = true;
          recipientTotal += amount;
        }
      }
      if (creatorPortion - recipientTotal > 0 && accounts.get(item.creator_id)) transferring = true;

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
        metadata: { content_id, transfer_group: transferGroup, buyer_id: buyerId },
        ...(transferring ? { payment_intent_data: { transfer_group: transferGroup } } : {}),
        success_url,
        cancel_url,
      });
      return json(req, { url: session.url });
    } catch (err) {
      console.error("create-split-checkout-session:", err);
      return fail(req, 500, "Could not start checkout");
    }
  };
}
