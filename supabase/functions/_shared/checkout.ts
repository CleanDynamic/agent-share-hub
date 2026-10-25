import { isAllowedReturnUrl } from "./origins.ts";

/** The one Stripe call a checkout function makes, so a test can stand in for the client. */
export interface CheckoutStripe {
  createSession(params: Record<string, unknown>): Promise<{ url: string | null }>;
}

/** The price column is pounds (NUMERIC); Stripe takes whole pence. */
export const penceOf = (gbp: number): number => Math.round(gbp * 100);

/** A checkout sends the buyer back to this site and nowhere else. Null when both addresses are fine. */
export function returnUrlError(urls: { success_url: string; cancel_url: string }): string | null {
  for (const field of ["success_url", "cancel_url"] as const) {
    if (!isAllowedReturnUrl(urls[field])) return `${field}: must be an address on this site`;
  }
  return null;
}

/** The longest tip or pay-what-you-want amount: £1,000. */
export const MAX_PENCE = 100_000;

/** A checkout that also looks up the buyer's existing Stripe customer by email. */
export interface CustomerStripe extends CheckoutStripe {
  createSession(params: Record<string, unknown>): Promise<{ url: string | null; id?: string }>;
  findCustomerId(email: string): Promise<string | undefined>;
}

export interface SignedInUser {
  id: string;
  email: string;
}
