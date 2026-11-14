// The sign-in specs' Supabase stub. RUN AGAINST MOCKS: every read is empty, a password sign-in succeeds, nothing reaches
// a project. `signInDelayMs` holds the password sign-in back, so a pending button can be looked at.
import type { Page } from "@playwright/test";

const USER = {
  id: "00000000-0000-4000-8000-0000000000a1",
  aud: "authenticated",
  role: "authenticated",
  email: "ada@example.test",
  email_confirmed_at: new Date(0).toISOString(),
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [],
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

function jwt(payload: Record<string, unknown>) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.sig`;
}

export async function stub(page: Page, { signInDelayMs = 0 }: { signInDelayMs?: number } = {}) {
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
  await page.route(/supabase\.co\/rest\/v1\//, (route) =>
    route.request().method() === "OPTIONS"
      ? route.fulfill({ status: 204, headers: cors })
      : route.fulfill({ status: 200, contentType: "application/json", headers: { ...cors, "content-range": "0-0/0" }, body: route.request().url().includes("/rpc/") ? "null" : "[]" }),
  );
  await page.route(/supabase\.co\/auth\/v1\//, async (route) => {
    const url = route.request().url();
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (url.includes("/token")) {
      if (signInDelayMs) await new Promise((resolve) => setTimeout(resolve, signInDelayMs));
      const exp = Math.floor(Date.now() / 1000) + 3600;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: cors,
        body: JSON.stringify({ access_token: jwt({ sub: USER.id, exp, role: "authenticated" }), token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "r", user: USER }),
      });
    }
    if (url.includes("/user")) return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(USER) });
    return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: "{}" });
  });
  await page.route(/supabase\.co\/(storage|functions|realtime)\//, (route) => route.fulfill({ status: 200, headers: cors, body: "{}" }));
}

