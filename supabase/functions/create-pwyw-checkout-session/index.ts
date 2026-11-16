import { makePaymentDeps } from "../_shared/stripeDeps.ts";
import { limitByIp, RATE_RULES } from "../_shared/rateLimit.ts";
import { databaseRateStore } from "../_shared/rateLimitStore.ts";
import { createPwywHandler } from "./handler.ts";

const store = databaseRateStore();

Deno.serve(createPwywHandler(makePaymentDeps(), (req) => limitByIp(req, "create-pwyw-checkout-session", RATE_RULES["create-pwyw-checkout-session"], store)));
