import { z } from "zod/v4";
import { returnUrlError, type CustomerStripe, type SignedInUser } from "../_shared/checkout.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { bearerToken, errorResponse, fieldError, jsonResponse } from "../_shared/http.ts";

// price_id may still arrive from an old client; it is not read. The price is the
// creator's own subscription_price_id, from the database.
const Body = z.object({
  creator_id: z.guid(),
  success_url: z.url(),
  cancel_url: z.url(),
});

export interface Deps {
  stripe: CustomerStripe | null;
  /** The user the token belongs to, with an email; null when there is none. */
  getUser(token: string | null): Promise<SignedInUser | null>;
  getSubscriptionPriceId(creatorId: string): Promise<string | null>;
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
      const { creator_id, success_url, cancel_url } = parsed.data;

      const user = await deps.getUser(bearerToken(req));
      if (!user) return errorResponse("Authentication required to subscribe", 401, cors);

      const urlError = returnUrlError({ success_url, cancel_url });
      if (urlError) return errorResponse(urlError, 400, cors);

      const priceId = await deps.getSubscriptionPriceId(creator_id);
      if (!priceId) return errorResponse("This creator has no subscription", 400, cors);

      if (!deps.stripe) return errorResponse("Stripe is not configured", 500, cors);

      // Check for existing Stripe customer
      const customerId = await deps.stripe.findCustomerId(user.email);

      const session = await deps.stripe.createSession({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        metadata: { creator_id, subscriber_id: user.id },
        success_url,
        cancel_url,
      });

      return jsonResponse({ url: session.url }, 200, cors);
    } catch (err) {
      console.error("Subscription session error:", err);
      return errorResponse("Could not start the subscription", 500, cors);
    }
  };
}
