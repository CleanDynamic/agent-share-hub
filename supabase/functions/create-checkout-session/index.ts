import { makePaymentDeps } from "../_shared/stripeDeps.ts";
import { limitByIp, RATE_RULES } from "../_shared/rateLimit.ts";
import { databaseRateStore } from "../_shared/rateLimitStore.ts";
import { createCheckoutHandler } from "./handler.ts";

const store = databaseRateStore();

Deno.serve(createCheckoutHandler(makePaymentDeps(), (req) => limitByIp(req, "create-checkout-session", RATE_RULES["create-checkout-session"], store)));
