import { z } from "zod/v4";
import { MAX_PENCE, returnUrlError, type CheckoutStripe } from "../_shared/checkout.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { errorResponse, fieldError, jsonResponse } from "../_shared/http.ts";

const Body = z.object({
  creator_id: z.guid(),
  amount_pence: z.number().int().min(100, "must be at least 100 (£1.00)").max(MAX_PENCE),
  creator_display_name: z.string().max(100).optional(),
  success_url: z.url(),
  cancel_url: z.url(),
});

export interface Deps {
  stripe: CheckoutStripe | null;
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
      const { creator_id, amount_pence, creator_display_name, success_url, cancel_url } = parsed.data;

      const urlError = returnUrlError({ success_url, cancel_url });
      if (urlError) return errorResponse(urlError, 400, cors);

      if (!deps.stripe) return errorResponse("Stripe is not configured", 500, cors);

      const displayName = creator_display_name || "a creator";

      const session = await deps.stripe.createSession({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "gbp",
              unit_amount: amount_pence,
              product_data: { name: `Tip for ${displayName} on NeoScale AI`, metadata: { creator_id } },
            },
            quantity: 1,
          },
        ],
        metadata: { creator_id, type: "donation" },
        success_url,
        cancel_url,
      });

      return jsonResponse({ url: session.url }, 200, cors);
    } catch (err) {
      console.error("Donation session error:", err);
      return errorResponse("Could not start the tip", 500, cors);
    }
  };
}
