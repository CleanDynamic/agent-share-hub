// A tip to a creator. The buyer chooses the amount (£1 to £1,000). The creator
// must exist, and the name Stripe shows is the creator's own, from their
// profile, not whatever the body says.

import { z, readBody, returnUrl } from "../_shared/body.ts";
import { fail, json, preflight } from "../_shared/cors.ts";
import { MIN_PENCE, PWYW_CEILING_PENCE } from "../_shared/payments.ts";

const Body = z.object({
  creator_id: z.string({ required_error: "Required" }).uuid(),
  amount_pence: z.number({ required_error: "Required" }).int().min(MIN_PENCE, "Minimum tip is £1.00").max(PWYW_CEILING_PENCE, "Maximum tip is £1,000.00"),
  success_url: returnUrl,
  cancel_url: returnUrl,
});

export interface DonationDeps {
  /** The creator's shown name, or null when no such creator exists. */
  findCreatorName(creatorId: string): Promise<string | null>;
  createSession(params: Record<string, unknown>): Promise<{ url: string | null }>;
}

export function createDonationHandler(deps: DonationDeps) {
  return async (req: Request): Promise<Response> => {
    const early = preflight(req);
    if (early) return early;
    if (req.method !== "POST") return fail(req, 405, "Method not allowed");

    try {
      const body = await readBody(req, Body);
      if (!body.ok) return fail(req, 400, body.error);
      const { creator_id, amount_pence, success_url, cancel_url } = body.data;

      const name = await deps.findCreatorName(creator_id);
      if (name === null) return fail(req, 404, "Creator not found");

      const session = await deps.createSession({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "gbp",
              unit_amount: amount_pence,
              product_data: { name: `Tip for ${name || "a creator"} on NeoScale AI`, metadata: { creator_id } },
            },
            quantity: 1,
          },
        ],
        metadata: { creator_id, type: "donation" },
        success_url,
        cancel_url,
      });
      return json(req, { url: session.url });
    } catch (err) {
      console.error("create-donation-session:", err);
      return fail(req, 500, "Could not start the tip");
    }
  };
}
