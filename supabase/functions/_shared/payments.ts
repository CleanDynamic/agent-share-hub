// What the checkout functions share: the item as the database knows it, the
// maths from pounds to pence, and the seams the tests replace.
//
// Pure TypeScript, so Vitest can drive each handler with a fake Stripe and a
// fake database. The real ones are in stripeDeps.ts (Deno only).

export interface SaleItem {
  id: string;
  title: string;
  creator_id: string;
  status: string;
  monetisation_type: string | null;
  price_gbp: number | null;
  is_pwyw: boolean | null;
  pwyw_enabled: boolean | null;
  pwyw_floor_gbp: number | null;
}

export const SALE_ITEM_COLUMNS =
  "id, title, creator_id, status, monetisation_type, price_gbp, is_pwyw, pwyw_enabled, pwyw_floor_gbp";

export interface Split {
  recipient_id: string;
  percentage: number;
}

export interface PaymentDeps {
  /** The signed-in buyer from the token, or null (a call with only the public key). */
  getUserId(req: Request): Promise<string | null>;
  /** The item as the database has it, or null. */
  findItem(contentId: string): Promise<SaleItem | null>;
  /** Stripe's `checkout.sessions.create`. */
  createSession(params: Record<string, unknown>): Promise<{ url: string | null }>;
  /** Only the split checkout reads these. */
  findSplits?(contentId: string): Promise<Split[]>;
  findStripeAccounts?(profileIds: string[]): Promise<Map<string, string | null>>;
}

/** content_items.price_gbp is pounds in a NUMERIC; Stripe takes pence. */
export function toPence(gbp: number): number {
  return Math.round(gbp * 100);
}

/** The price of a paid item in pence, or null when it is not for sale. */
export function paidPence(item: SaleItem): number | null {
  if (item.status !== "approved") return null;
  if (item.monetisation_type !== "paid") return null;
  if (item.price_gbp == null || !(item.price_gbp > 0)) return null;
  const pence = toPence(item.price_gbp);
  return pence >= 100 ? pence : null;
}

/** £1,000 in pence: the most a pay-what-you-want buyer may choose to pay. */
export const PWYW_CEILING_PENCE = 100_000;
/** Stripe will not take less than this for a card payment in sterling. */
export const MIN_PENCE = 100;
