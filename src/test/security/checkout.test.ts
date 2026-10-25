// SV-01 Part 3. The checkout functions are driven with a fake Stripe and a fake
// database (the PaymentDeps seam), the way a request reaches them.

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createCheckoutHandler } from "../../../supabase/functions/create-checkout-session/handler.ts";
import { createDonationHandler } from "../../../supabase/functions/create-donation-session/handler.ts";
import { createPwywHandler } from "../../../supabase/functions/create-pwyw-checkout-session/handler.ts";
import { createSplitHandler } from "../../../supabase/functions/create-split-checkout-session/handler.ts";
import { isAllowedReturnUrl } from "../../../supabase/functions/_shared/origins.ts";
import type { PaymentDeps, SaleItem } from "../../../supabase/functions/_shared/payments.ts";

const ID = "7b2f1c1e-3b6a-4f77-9d52-0f2c8b1b9a11";
const CREATOR = "11111111-2222-4333-8444-555555555555";
const BUYER = "99999999-8888-4777-8666-555555555555";
const OK = "https://buildgallery.ai/content/x?payment=success";
const BACK = "https://buildgallery.ai/content/x";

const paid: SaleItem = {
  id: ID, title: "A paid build", creator_id: CREATOR, status: "approved", monetisation_type: "paid",
  price_gbp: 12.5, is_pwyw: false, pwyw_enabled: false, pwyw_floor_gbp: null,
};
const pwyw: SaleItem = { ...paid, monetisation_type: "paid", price_gbp: null, is_pwyw: true, pwyw_floor_gbp: 3 };

function deps(item: SaleItem | null, user: string | null = null) {
  const createSession = vi.fn(async (_params: Record<string, unknown>) => ({ url: "https://checkout.stripe.test/s" }));
  const d: PaymentDeps = {
    getUserId: async () => user,
    findItem: async () => item,
    createSession,
    findSplits: async () => [{ recipient_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", percentage: 20 }],
    findStripeAccounts: async () => new Map([[CREATOR, "acct_1"], ["aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", "acct_2"]]),
  };
  return { d, createSession };
}

const post = (body: unknown, origin = "https://buildgallery.ai") =>
  new Request("https://fn.test/x", { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });

const unit = (call: Record<string, unknown>) =>
  ((call.line_items as { price_data: { unit_amount: number } }[])[0]).price_data.unit_amount;

describe("SV-01 P3: the price comes from the database", () => {
  it("ignores a lower price in the body", async () => {
    const { d, createSession } = deps(paid);
    const res = await createCheckoutHandler(d)(post({ content_id: ID, price_amount: 100, success_url: OK, cancel_url: BACK }));
    expect(res.status).toBe(200);
    expect(unit(createSession.mock.calls[0][0])).toBe(1250);
  });

  it("records the buyer from the token, never from the body", async () => {
    const { d, createSession } = deps(paid, BUYER);
    await createCheckoutHandler(d)(post({ content_id: ID, buyer_id: "someone-else", success_url: OK, cancel_url: BACK }));
    expect(createSession.mock.calls[0][0].metadata).toEqual({ content_id: ID, buyer_id: BUYER });
  });

  it.each([
    ["free", { ...paid, monetisation_type: "free" }],
    ["unpriced", { ...paid, price_gbp: null }],
    ["unapproved", { ...paid, status: "draft" }],
    ["under a pound", { ...paid, price_gbp: 0.5 }],
  ])("refuses an item that is %s with 400 or 404", async (_name, item) => {
    const { d, createSession } = deps(item as SaleItem);
    const res = await createCheckoutHandler(d)(post({ content_id: ID, success_url: OK, cancel_url: BACK }));
    expect([400, 404]).toContain(res.status);
    expect(createSession).not.toHaveBeenCalled();
  });
});

describe("SV-01 P3: return addresses", () => {
  it.each([
    ["a foreign address", "https://evil.example/steal"],
    ["a lookalike host", "https://buildgallery.ai.evil.example/x"],
    ["a credential trick", "https://buildgallery.ai@evil.example/x"],
    ["a javascript address", "javascript:alert(1)"],
    ["not an address", "/relative"],
  ])("refuses %s as success_url with 400 naming the field", async (_name, url) => {
    const { d, createSession } = deps(paid);
    const res = await createCheckoutHandler(d)(post({ content_id: ID, success_url: url, cancel_url: BACK }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/^success_url:/);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("accepts the allowed origins and nothing else", () => {
    expect(isAllowedReturnUrl("https://buildgallery.ai/a")).toBe(true);
    expect(isAllowedReturnUrl("http://localhost:8080/a")).toBe(true);
    expect(isAllowedReturnUrl("https://agent-share-hub.lovable.app/a?b=1")).toBe(true);
    expect(isAllowedReturnUrl("http://buildgallery.ai/a")).toBe(false);
    expect(isAllowedReturnUrl("https://evil.example")).toBe(false);
  });

  it.each([
    ["pwyw", () => createPwywHandler(deps(pwyw).d), { content_id: ID, buyer_amount_pence: 500 }],
    ["donation", () => createDonationHandler({ findCreatorName: async () => "Maya", createSession: async () => ({ url: "u" }) }), { creator_id: CREATOR, amount_pence: 500 }],
    ["split", () => createSplitHandler(deps(paid, BUYER).d), { content_id: ID }],
  ])("%s refuses a foreign cancel_url", async (_name, make, base) => {
    const res = await make()(post({ ...base, success_url: OK, cancel_url: "https://evil.example" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/^cancel_url:/);
  });
});

describe("SV-01 P3: pay what you want", () => {
  it("starting a checkout changes no stats", async () => {
    const src = readFileSync("supabase/functions/create-pwyw-checkout-session/handler.ts", "utf8");
    expect(src).not.toMatch(/\.update\(|\.upsert\(|pwyw_purchase_count\s*:|pwyw_avg_paid_gbp\s*:/);
    const { d, createSession } = deps(pwyw);
    const res = await createPwywHandler(d)(post({ content_id: ID, buyer_amount_pence: 500, success_url: OK, cancel_url: BACK }));
    expect(res.status).toBe(200);
    expect(unit(createSession.mock.calls[0][0])).toBe(500);
  });

  it("holds the amount between the floor and £1,000", async () => {
    const { d } = deps(pwyw);
    const h = createPwywHandler(d);
    expect((await h(post({ content_id: ID, buyer_amount_pence: 299, success_url: OK, cancel_url: BACK }))).status).toBe(400);
    expect((await h(post({ content_id: ID, buyer_amount_pence: 100_001, success_url: OK, cancel_url: BACK }))).status).toBe(400);
    expect((await h(post({ content_id: ID, buyer_amount_pence: 300, success_url: OK, cancel_url: BACK }))).status).toBe(200);
  });

  it("refuses an item that is not pay what you want", async () => {
    const { d } = deps(paid);
    const res = await createPwywHandler(d)(post({ content_id: ID, buyer_amount_pence: 500, success_url: OK, cancel_url: BACK }));
    expect(res.status).toBe(400);
  });
});

describe("SV-01 P3: split and donation", () => {
  it("needs a signed-in buyer and takes the price from the database", async () => {
    const anon = deps(paid, null);
    expect((await createSplitHandler(anon.d)(post({ content_id: ID, success_url: OK, cancel_url: BACK }))).status).toBe(401);
    const signed = deps(paid, BUYER);
    const res = await createSplitHandler(signed.d, () => 1)(post({ content_id: ID, price_amount: 100, success_url: OK, cancel_url: BACK }));
    expect(res.status).toBe(200);
    const params = signed.createSession.mock.calls[0][0];
    expect(unit(params)).toBe(1250);
    expect(params.payment_intent_data).toEqual({ transfer_group: `content_${ID}_1` });
  });

  it("tips a creator that exists, naming them from the database", async () => {
    const createSession = vi.fn(async (_p: Record<string, unknown>) => ({ url: "u" }));
    const h = createDonationHandler({ findCreatorName: async (id) => (id === CREATOR ? "Maya" : null), createSession });
    const res = await h(post({ creator_id: CREATOR, amount_pence: 500, creator_display_name: "Free iPhones", success_url: OK, cancel_url: BACK }));
    expect(res.status).toBe(200);
    expect(JSON.stringify(createSession.mock.calls[0][0])).toContain("Tip for Maya");
    expect(JSON.stringify(createSession.mock.calls[0][0])).not.toContain("Free iPhones");
    const gone = await h(post({ creator_id: "00000000-0000-4000-8000-000000000000", amount_pence: 500, success_url: OK, cancel_url: BACK }));
    expect(gone.status).toBe(404);
  });
});
