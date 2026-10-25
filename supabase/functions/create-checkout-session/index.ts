import { makePaymentDeps } from "../_shared/stripeDeps.ts";
import { createCheckoutHandler } from "./handler.ts";

Deno.serve(createCheckoutHandler(makePaymentDeps()));
