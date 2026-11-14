// G21: Home, Builds, a build page, the Composer and the sign-in dialog load with zero CSP violations, in both themes, with
// the policy from netlify.toml ENFORCED. RUN AGAINST MOCKS: Supabase is stubbed and Cloudflare's script is replaced by a
// stand-in, after the browser has checked each request against the policy (the policy is checked first, so a host it does
// not allow is still a violation).
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

import { stub } from "../signin/support";

const POLICY = (() => {
  const match = /Content-Security-Policy(?:-Report-Only)?\s*=\s*"([^"]+)"/.exec(readFileSync("netlify.toml", "utf8"));
  if (!match) throw new Error("netlify.toml has no Content-Security-Policy");
  return match[1];
})();

const PROJECT_REF = "zybdotagjwektucfdkri";

async function enforce(page: Page, theme: "noon" | "dusk", signedIn: boolean) {
  await page.addInitScript(
    ([theme, ref, signedIn]) => {
      (window as unknown as { __csp: string[] }).__csp = [];
      document.addEventListener("securitypolicyviolation", (event) => {
        (window as unknown as { __csp: string[] }).__csp.push(`${event.violatedDirective} ${event.blockedURI}`);
      });
      try {
        window.localStorage.setItem("bg-theme", theme);
        if (signedIn) {
          const exp = Math.floor(Date.now() / 1000) + 3600;
          const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
          const access = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "00000000-0000-4000-8000-0000000000a1", exp, role: "authenticated" })}.sig`;
          window.localStorage.setItem(
            `sb-${ref}-auth-token`,
            JSON.stringify({ access_token: access, refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: exp, user: { id: "00000000-0000-4000-8000-0000000000a1", email: "ada@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} } }),
          );
        }
      } catch {
        /* a storage-less context is a harness problem */
      }
    },
    [theme, PROJECT_REF, signedIn] as const,
  );
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") return route.fallback();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), "content-security-policy": POLICY } });
  });
  await page.route(/challenges\.cloudflare\.com/, (route) =>
    route.fulfill({ status: 200, contentType: "text/javascript", body: "window.turnstile={render:function(){return 'w'},reset:function(){},remove:function(){}};" }),
  );
  await stub(page);
}

const PAGES: [string, string, boolean][] = [
  ["Home", "/", false],
  ["Builds", "/builds", false],
  ["a build page", "/b/a-build", false],
  ["the Composer", "/compose", true],
  ["the sign-in dialog", "/?signin=login", false],
];

for (const theme of ["noon", "dusk"] as const) {
  for (const [name, path, signedIn] of PAGES) {
    test(`${name} loads with zero CSP violations (${theme})`, async ({ page }) => {
      const console: string[] = [];
      page.on("console", (message) => {
        if (/content security policy/i.test(message.text())) console.push(message.text());
      });
      await enforce(page, theme, signedIn);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      if (path.includes("signin")) await expect(page.getByRole("dialog")).toBeVisible();
      // Long enough for lazy chunks, the widget's script and late requests.
      await page.waitForTimeout(1500);
      const violations = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
      expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
      // The page itself was drawn, not a redirect to sign in.
      expect(new URL(page.url()).pathname).toBe(path.split("?")[0]);
      expect({ violations, console }).toEqual({ violations: [], console: [] });
    });
  }
}
