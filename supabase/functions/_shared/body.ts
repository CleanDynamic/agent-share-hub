// Reading a request body, checked.
//
// A body that does not match gets a 400 naming the first field at fault, and
// nothing runs. Extra fields are dropped, so a browser that still sends a field
// the server no longer trusts (checkout's price_amount) is not an error.
//
// `zod` comes from each function's deno.json, the way mcp/deno.json does it.

import { z } from "zod";
import { isAllowedReturnUrl } from "./origins.ts";

export type Body<T> = { ok: true; data: T } | { ok: false; error: string };

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
    return { ok: false, error: "The body must be JSON" };
  }
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  const issue = parsed.error.issues[0];
  const field = issue.path.join(".");
  return { ok: false, error: field ? `${field}: ${issue.message}` : issue.message };
}
