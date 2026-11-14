// G18: Google, GitHub and X carry the return address to the callback, through safeReturnPath.

import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOAuth = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args) } },
}));

import { startOAuthSignIn } from "./oauth";

const redirectTo = () => new URL((signInWithOAuth.mock.calls.at(-1)![0] as { options: { redirectTo: string } }).options.redirectTo);

beforeEach(() => {
  signInWithOAuth.mockReset();
  signInWithOAuth.mockResolvedValue({ error: null });
});

describe("startOAuthSignIn", () => {
  it.each([
    ["google", "google"],
    ["github", "github"],
    ["x", "twitter"],
  ] as const)("sends %s back to /auth/callback with the return address", async (provider, supabaseProvider) => {
    await expect(startOAuthSignIn(provider, "/library?view=saved#top")).resolves.toBeNull();
    expect(signInWithOAuth.mock.calls.at(-1)![0]).toMatchObject({ provider: supabaseProvider });
    const url = redirectTo();
    expect(url.origin).toBe(window.location.origin);
    expect(url.pathname).toBe("/auth/callback");
    expect(url.searchParams.get("provider")).toBe(provider);
    expect(url.searchParams.get("redirect")).toBe("/library?view=saved#top");
  });

  it("carries no return when there is none, so the callback asks where next", async () => {
    await startOAuthSignIn("google", null);
    expect(redirectTo().searchParams.has("redirect")).toBe(false);
  });

  it("carries / for a return that would leave the site", async () => {
    await startOAuthSignIn("github", "https://example.com");
    expect(redirectTo().searchParams.get("redirect")).toBe("/");
  });

  it("says it could not start when the client refuses", async () => {
    signInWithOAuth.mockResolvedValue({ error: { message: "boom" } });
    await expect(startOAuthSignIn("x", null)).resolves.toBe("Couldn't connect to x. Please try again.");
  });
});
