import { makePaymentDeps } from "../_shared/stripeDeps.ts";
import { createPwywHandler } from "./handler.ts";

Deno.serve(createPwywHandler(makePaymentDeps()));
