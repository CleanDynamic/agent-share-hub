// Reading a request body, checked.
//
// A body that does not match gets a 400 naming the first field at fault, and
// nothing runs. Extra fields are dropped, so a browser that still sends a field
// the server no longer trusts (checkout's price_amount) is not an error.
//
// zod is imported by an npm: specifier, because _shared/ is bundled into functions that have no import map
// (src/test/edgeBundles.test.ts). Every function takes `z` from here, so there is one import to keep.

import { z } from "npm:zod@3.25.76";
import { isAllowedReturnUrl } from "./origins.ts";

// Not a discriminated union: the app's tsconfig is not strict, and a union on `ok` does not narrow without it.
// `error` is set when `ok` is false; `data` when it is true.
export { z };

export interface Body<T> {
  ok: boolean;
  data: T;
  error: string;
}

/** Where Stripe may send a buyer back to: an address on an allowed origin. */
export const returnUrl = z
  .string({ required_error: "Required" })
  .max(2048)
  .refine(isAllowedReturnUrl, "must start with an allowed origin");

export async function readBody<S extends z.ZodTypeAny>(req: Request, schema: S): Promise<Body<z.infer<S>>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, data: undefined as never, error: "The body must be JSON" };
  }
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data, error: "" };
  const issue = parsed.error.issues[0];
  const field = issue.path.join(".");
  return { ok: false, data: undefined as never, error: field ? `${field}: ${issue.message}` : issue.message };
}
