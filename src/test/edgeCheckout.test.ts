// CA-29 Part 3. A checkout charges what the database says, sends the buyer back
// only to this site, and changes no stats when it starts. The Stripe client and
// the data are faked: each handler is built from the pieces index.ts wires up.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createHandler as createCheckout } from "../../supabase/functions/create-checkout-session/handler";
import { createHandler as createPwyw } from "../../supabase/functions/create-pwyw-checkout-session/handler";
import { createHandler as createSplit } from "../../supabase/functions/create-split-checkout-session/handler";
import { createHandler as createDonation } from "../../supabase/functions/create-donation-session/handler";

const ID = "11111111-1111-4111-8111-111111111111";
const CREATOR = "22222222-2222-4222-8222-222222222222";
const BUYER = "33333333-3333-4333-8333-333333333333";
const OK = { success_url: "https://buildgallery.ai/content/x?payment=success", cancel_url: "https://buildgallery.ai/content/x" };

const stripeFake = () => {
  const createSession = vi.fn(async (_params: Record<string, unknown>) => ({ url: "https://checkout.stripe.test/s" }));
  return { createSession };
};

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://project.supabase.co/functions/v1/x", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "https://buildgallery.ai", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const lineAmount = (stripe: ReturnType<typeof stripeFake>) => {
  const params = stripe.createSession.mock.calls[0][0] as { line_items: { price_data: { unit_amount: number } }[] };
  return params.line_items[0].price_data.unit_amount;
};

describe("CA-29 P3: create-checkout-session", () => {
  const paid = { id: ID, title: "A build", creator_id: CREATOR, price_gbp: 12.5, monetisation_type: "paid" };
  const setup = (item: Record<string, unknown> | null = paid, userId: string | null = null) => {
    const stripe = stripeFake();
    const handler = createCheckout({ stripe, getItem: async () => item as never, getUserId: async () => userId });
    return { stripe, handler };
  };

  it("charges the item's price and ignores a lower price in the body", async () => {
    const { stripe, handler } = setup();
    const response = await handler(post({ content_id: ID, price_amount: 100, ...OK }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://checkout.stripe.test/s" });
    expect(lineAmount(stripe)).toBe(1250);
  });

  it("rounds a price in pounds to whole pence", async () => {
    const { stripe, handler } = setup({ ...paid, price_gbp: 4.995 });
    await handler(post({ content_id: ID, ...OK }));
    expect(lineAmount(stripe)).toBe(Math.round(4.995 * 100));
  });

  it("refuses a success_url or cancel_url on a foreign origin with 400", async () => {
    for (const bad of [{ success_url: "https://evil.example/x" }, { cancel_url: "https://buildgallery.ai.evil.example/" }]) {
      const { stripe, handler } = setup();
      const response = await handler(post({ content_id: ID, ...OK, ...bad }));
      expect(response.status).toBe(400);
      expect((await response.json()).error).toMatch(/success_url|cancel_url/);
      expect(stripe.createSession).not.toHaveBeenCalled();
    }
  });

  it("names the missing field in a 400 and runs nothing", async () => {
    const { stripe, handler } = setup();
    const response = await handler(post({ ...OK }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/^content_id:/);
    expect(stripe.createSession).not.toHaveBeenCalled();
  });

  it("refuses a body that is not JSON", async () => {
    const { handler } = setup();
    expect((await handler(post("{nope"))).status).toBe(400);
  });

  it("refuses an item with no price, an item not for sale, and an unknown item", async () => {
    for (const [item, status] of [
      [{ ...paid, price_gbp: null }, 400],
      [{ ...paid, price_gbp: 0 }, 400],
      [{ ...paid, monetisation_type: "free" }, 400],
      [null, 404],
    ] as const) {
      const { stripe, handler } = setup(item);
      const response = await handler(post({ content_id: ID, ...OK }));
      expect(response.status).toBe(status);
      expect(stripe.createSession).not.toHaveBeenCalled();
    }
  });

  it("records the buyer from the token, never from the body", async () => {
    const { stripe, handler } = setup(paid, BUYER);
    await handler(post({ content_id: ID, buyer_id: "someone-else", ...OK }, { Authorization: "Bearer user-token" }));
    const params = stripe.createSession.mock.calls[0][0] as { metadata: Record<string, string> };
    expect(params.metadata).toEqual({ content_id: ID, buyer_id: BUYER });
  });

  it("records no buyer for a guest", async () => {
    const { stripe, handler } = setup(paid, null);
    await handler(post({ content_id: ID, buyer_id: "someone-else", ...OK }));
    const params = stripe.createSession.mock.calls[0][0] as { metadata: Record<string, string> };
    expect(params.metadata).toEqual({ content_id: ID });
  });

  it("gives a foreign origin no allow header", async () => {
    const { handler } = setup();
    const response = await handler(post({ content_id: ID, ...OK }, { origin: "https://evil.example" }));
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("answers a Stripe failure with a plain error and no detail", async () => {
    const stripe = { createSession: vi.fn(async () => { throw new Error("secret detail sk_live_123"); }) };
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const handler = createCheckout({ stripe, getItem: async () => paid as never, getUserId: async () => null });
    const response = await handler(post({ content_id: ID, ...OK }));
    quiet.mockRestore();
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("sk_live_123");
  });
});

describe("CA-29 P3: create-pwyw-checkout-session", () => {
  const item = { id: ID, title: "A build", is_pwyw: true, pwyw_floor_gbp: 3, pwyw_purchase_count: 4, pwyw_avg_paid_gbp: 5 };
  const setup = (row: Record<string, unknown> | null = item) => {
    const stripe = stripeFake();
    return { stripe, handler: createPwyw({ stripe, getItem: async () => row as never, getUserId: async () => null }) };
  };

  it("takes the buyer's amount between the floor and £1,000", async () => {
    const { stripe, handler } = setup();
    const response = await handler(post({ content_id: ID, buyer_amount_pence: 750, ...OK }));
    expect(response.status).toBe(200);
    expect(lineAmount(stripe)).toBe(750);
  });

  it("refuses an amount under the floor, under £1, over £1,000 or not whole pence", async () => {
    for (const amount of [299, 50, 100_001, 500.5, -1, "500"]) {
      const { stripe, handler } = setup();
      const response = await handler(post({ content_id: ID, buyer_amount_pence: amount, ...OK }));
      expect(response.status, String(amount)).toBe(400);
      expect(stripe.createSession).not.toHaveBeenCalled();
    }
  });

  it("refuses an item that is not pay what you want", async () => {
    const { stripe, handler } = setup({ ...item, is_pwyw: false });
    expect((await handler(post({ content_id: ID, buyer_amount_pence: 750, ...OK }))).status).toBe(400);
    expect(stripe.createSession).not.toHaveBeenCalled();
  });

  it("refuses a foreign return address", async () => {
    const { stripe, handler } = setup();
    const response = await handler(post({ content_id: ID, buyer_amount_pence: 750, ...OK, success_url: "https://evil.example/" }));
    expect(response.status).toBe(400);
    expect(stripe.createSession).not.toHaveBeenCalled();
  });

  it("changes no stats when a checkout starts", async () => {
    const frozen = Object.freeze({ ...item });
    const { handler } = setup(frozen);
    expect((await handler(post({ content_id: ID, buyer_amount_pence: 750, ...OK }))).status).toBe(200);
    expect(frozen.pwyw_purchase_count).toBe(4);
    expect(frozen.pwyw_avg_paid_gbp).toBe(5);

    // Nothing in the function writes: no database write exists in its folder to run.
    const folder = join("supabase", "functions", "create-pwyw-checkout-session");
    for (const name of readdirSync(folder)) {
      const source = readFileSync(join(folder, name), "utf8");
      expect(source, name).not.toMatch(/\.(update|upsert|insert|delete|rpc)\(/);
      expect(source, name).not.toMatch(/pwyw_purchase_count\s*:|pwyw_avg_paid_gbp\s*:/);
    }
  });
});

describe("CA-29 P3: create-split-checkout-session", () => {
  const item = { id: ID, creator_id: CREATOR, title: "A build", price_gbp: 20, monetisation_type: "paid" };
  const make = (row: Record<string, unknown> | null = item) => {
    const stripe = stripeFake();
    const getSplits = vi.fn(async () => [{ recipient_id: BUYER, percentage: 25 }]);
    const getStripeAccounts = vi.fn(async () => new Map([[CREATOR, "acct_creator"], [BUYER, "acct_other"]]));
    const handler = createSplit({ stripe, getItem: async () => row as never, getSplits, getStripeAccounts, getUserId: async () => null });
    return { stripe, handler, getSplits };
  };

  it("charges the item's price, reads the splits from the database and ignores a body price", async () => {
    const { stripe, handler, getSplits } = make();
    const response = await handler(post({ content_id: ID, price_amount: 100, ...OK }));
    expect(response.status).toBe(200);
    expect(lineAmount(stripe)).toBe(2000);
    expect(getSplits).toHaveBeenCalledWith(ID);
  });

  it("refuses a foreign return address and an item not for sale", async () => {
    const a = make();
    expect((await a.handler(post({ content_id: ID, ...OK, cancel_url: "https://evil.example/" }))).status).toBe(400);
    const b = make({ ...item, monetisation_type: "free" });
    expect((await b.handler(post({ content_id: ID, ...OK }))).status).toBe(400);
    expect(a.stripe.createSession).not.toHaveBeenCalled();
    expect(b.stripe.createSession).not.toHaveBeenCalled();
  });
});

describe("CA-29 P3: create-donation-session", () => {
  const setup = () => {
    const stripe = stripeFake();
    return { stripe, handler: createDonation({ stripe }) };
  };

  it("sends the tipper back only to this site", async () => {
    const { stripe, handler } = setup();
    const body = { creator_id: CREATOR, amount_pence: 500, creator_display_name: "Ada", ...OK };
    expect((await handler(post(body))).status).toBe(200);
    expect(lineAmount(stripe)).toBe(500);
    const refused = await handler(post({ ...body, success_url: "https://evil.example/" }));
    expect(refused.status).toBe(400);
    expect(stripe.createSession).toHaveBeenCalledTimes(1);
  });

  it("names a missing or out of range field", async () => {
    const { handler } = setup();
    const missing = await handler(post({ amount_pence: 500, ...OK }));
    expect((await missing.json()).error).toMatch(/^creator_id:/);
    const small = await handler(post({ creator_id: CREATOR, amount_pence: 99, ...OK }));
    expect((await small.json()).error).toMatch(/^amount_pence:/);
  });
});
