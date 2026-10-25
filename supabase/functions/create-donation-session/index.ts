import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createHandler } from "./handler.ts";

// A client built once from an environment value holds nothing about a caller.
const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" }) : null;

serve(createHandler({ stripe: stripe && { createSession: (params) => stripe.checkout.sessions.create(params as never) } }));
