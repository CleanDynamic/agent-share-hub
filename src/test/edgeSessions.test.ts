// CA-29 Parts 3 and 5. The subscription, project package and package check
// functions: a caller is known from the token, return addresses stay on this
// site, and an input that does not fit gets a 400 that names the field.

import { describe, expect, it, vi } from "vitest";
import { createHandler as createSubscription } from "../../supabase/functions/create-subscription-session/handler";
import { createHandler as createPackage } from "../../supabase/functions/create-project-package-session/handler";
import { createHandler as createVerify } from "../../supabase/functions/verify-project-package/handler";

const CREATOR = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";
const PROJECT = "44444444-4444-4444-8444-444444444444";
const OK = { success_url: "https://buildgallery.ai/project/x?package=success", cancel_url: "https://buildgallery.ai/project/x" };
const user = { id: USER, email: "a@example.com" };

const post = (body: unknown, token: string | null = "user-token", origin = "https://buildgallery.ai") =>
  new Request("https://project.supabase.co/functions/v1/x", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

describe("CA-29 P3: create-subscription-session", () => {
  const setup = (priceId: string | null = "price_creator") => {
    const createSession = vi.fn(async (_params: Record<string, unknown>) => ({ url: "https://checkout.stripe.test/s" }));
    const handler = createSubscription({
      stripe: { createSession, findCustomerId: async () => undefined },
      getUser: async (token) => (token === "user-token" ? user : null),
      getSubscriptionPriceId: async () => priceId,
    });
    return { createSession, handler };
  };

  it("subscribes to the creator's own price and ignores a price in the body", async () => {
    const { createSession, handler } = setup();
    const response = await handler(post({ creator_id: CREATOR, price_id: "price_cheapest", ...OK }));
    expect(response.status).toBe(200);
    const params = createSession.mock.calls[0][0] as { line_items: { price: string }[]; metadata: Record<string, string> };
    expect(params.line_items[0].price).toBe("price_creator");
    expect(params.metadata).toEqual({ creator_id: CREATOR, subscriber_id: USER });
  });

  it("refuses a caller with no login, a creator with no price and a foreign return address", async () => {
    const a = setup();
    expect((await a.handler(post({ creator_id: CREATOR, ...OK }, null))).status).toBe(401);
    const b = setup(null);
    expect((await b.handler(post({ creator_id: CREATOR, ...OK }))).status).toBe(400);
    const c = setup();
    expect((await c.handler(post({ creator_id: CREATOR, ...OK, success_url: "https://evil.example/" }))).status).toBe(400);
    for (const s of [a, b, c]) expect(s.createSession).not.toHaveBeenCalled();
  });

  it("names a missing field", async () => {
    const { handler } = setup();
    const response = await handler(post({ ...OK }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/^creator_id:/);
  });
});

describe("CA-29 P3: create-project-package-session", () => {
  const project = { id: PROJECT, title: "A project", package_price_gbp: 30, package_price_enabled: true };
  const setup = (row: typeof project | null = project, owns = false) => {
    const createSession = vi.fn(async (_params: Record<string, unknown>) => ({ url: "https://checkout.stripe.test/s", id: "cs_1" }));
    const handler = createPackage({
      stripe: { createSession, findCustomerId: async () => undefined },
      getUser: async (token) => (token === "user-token" ? user : null),
      getProject: async () => row,
      ownsPackage: async () => owns,
    });
    return { createSession, handler };
  };

  it("charges the project's package price", async () => {
    const { createSession, handler } = setup();
    const response = await handler(post({ project_id: PROJECT, ...OK }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://checkout.stripe.test/s", session_id: "cs_1" });
    const params = createSession.mock.calls[0][0] as { line_items: { price_data: { unit_amount: number } }[] };
    expect(params.line_items[0].price_data.unit_amount).toBe(3000);
  });

  it("falls back to this site when no return address is sent, never to a foreign origin header", async () => {
    const { createSession, handler } = setup();
    await handler(post({ project_id: PROJECT }, "user-token", "https://evil.example"));
    const params = createSession.mock.calls[0][0] as { success_url: string; cancel_url: string };
    expect(params.success_url.startsWith("https://buildgallery.ai/")).toBe(true);
    expect(params.cancel_url.startsWith("https://buildgallery.ai/")).toBe(true);
  });

  it("refuses no login, a foreign return address, a project not for sale and a package already owned", async () => {
    const cases = [
      [setup(), post({ project_id: PROJECT, ...OK }, null), 401],
      [setup(), post({ project_id: PROJECT, ...OK, cancel_url: "https://evil.example/" }), 400],
      [setup({ ...project, package_price_enabled: false }), post({ project_id: PROJECT, ...OK }), 400],
      [setup(null), post({ project_id: PROJECT, ...OK }), 404],
      [setup(project, true), post({ project_id: PROJECT, ...OK }), 409],
      [setup(), post({ ...OK }), 400],
    ] as const;
    for (const [{ handler, createSession }, request, status] of cases) {
      expect((await handler(request)).status).toBe(status);
      expect(createSession).not.toHaveBeenCalled();
    }
  });
});

describe("CA-29 P5: verify-project-package", () => {
  const paid = { payment_status: "paid", payment_intent: "pi_1", metadata: { project_id: PROJECT, user_id: USER } };
  const setup = (session: typeof paid | null = paid) => {
    const recordPurchase = vi.fn(async () => undefined);
    const handler = createVerify({
      getUser: async (token) => (token === "user-token" ? user : null),
      getSession: async () => session,
      recordPurchase,
    });
    return { recordPurchase, handler };
  };

  it("records the purchase of the caller's own paid session", async () => {
    const { recordPurchase, handler } = setup();
    const response = await handler(post({ session_id: "cs_1", project_id: PROJECT }));
    expect(response.status).toBe(200);
    expect(recordPurchase).toHaveBeenCalledWith({ projectId: PROJECT, userId: USER, paymentIntent: "pi_1" });
  });

  it("refuses no login, an unpaid session and a session for someone else", async () => {
    for (const [s, request, status] of [
      [setup(), post({ session_id: "cs_1", project_id: PROJECT }, null), 401],
      [setup({ ...paid, payment_status: "unpaid" }), post({ session_id: "cs_1", project_id: PROJECT }), 402],
      [setup({ ...paid, metadata: { project_id: PROJECT, user_id: "someone-else" } }), post({ session_id: "cs_1", project_id: PROJECT }), 403],
      [setup(), post({ project_id: PROJECT }), 400],
    ] as const) {
      expect((await s.handler(request)).status).toBe(status);
      expect(s.recordPurchase).not.toHaveBeenCalled();
    }
  });
});
