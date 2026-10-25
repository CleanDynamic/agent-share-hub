import Stripe from "https://esm.sh/stripe@18.5.0";
import { getCaller } from "../_shared/caller.ts";
import { z, readBody, returnUrl } from "../_shared/body.ts";
import { fail, json, preflight } from "../_shared/cors.ts";

// Nothing in src calls this function. It is still reachable, so it checks its
// input and its caller like the others.
const Body = z.object({
  creator_id: z.string({ required_error: "Required" }).uuid(),
  price_id: z.string({ required_error: "Required" }).regex(/^price_[A-Za-z0-9]+$/, "must be a Stripe price id"),
  success_url: returnUrl,
  cancel_url: returnUrl,
});

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== "POST") return fail(req, 405, "Method not allowed");

  try {
    const user = await getCaller(req);
    if (!user?.email) return fail(req, 401, "Sign in to subscribe");

    const body = await readBody(req, Body);
    if (!body.ok) return fail(req, 400, body.error);
    const { creator_id, price_id, success_url, cancel_url } = body.data;

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Stripe is not configured");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId: string | undefined = customers.data.length > 0 ? customers.data[0].id : undefined;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: price_id, quantity: 1 }],
      mode: "subscription",
      metadata: { creator_id, subscriber_id: user.id },
      success_url,
      cancel_url,
    });

    return json(req, { url: session.url });
  } catch (err) {
    console.error("create-subscription-session:", err);
    return fail(req, 500, "Could not start the subscription");
  }
});
