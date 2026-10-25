import { makePaymentDeps } from "../_shared/stripeDeps.ts";
import { createSplitHandler } from "./handler.ts";

Deno.serve(createSplitHandler(makePaymentDeps()));
