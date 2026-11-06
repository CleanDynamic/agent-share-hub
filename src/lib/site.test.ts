// UX-13 P1. The site's one address in the app, and the helper that joins a path to it.

import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function load(env?: string) {
  vi.resetModules();
  if (env !== undefined) vi.stubEnv("VITE_SITE_URL", env);
  return import("./site");
}

describe("UX-13 P1 · site address", () => {
  it("falls back to openbuilds.ai when nothing is set", async () => {
    const { SITE_URL } = await load("");
    expect(SITE_URL).toBe("https://openbuilds.ai");
  });

  it("takes VITE_SITE_URL, without a trailing slash", async () => {
    const { SITE_URL, siteUrl } = await load("https://preview.example/");
    expect(SITE_URL).toBe("https://preview.example");
    expect(siteUrl("/b2/x")).toBe("https://preview.example/b2/x");
  });

  it("joins with exactly one slash", async () => {
    const { siteUrl } = await load("");
    expect(siteUrl("/b2/x")).toBe("https://openbuilds.ai/b2/x");
    expect(siteUrl("b2/x")).toBe("https://openbuilds.ai/b2/x");
    expect(siteUrl("//b2/x")).toBe("https://openbuilds.ai/b2/x");
    expect(siteUrl("/")).toBe("https://openbuilds.ai/");
    expect(siteUrl("")).toBe("https://openbuilds.ai/");
  });

  it("keeps the query and the hash", async () => {
    const { siteUrl } = await load("");
    expect(siteUrl("/builds?q=a&page=2#top")).toBe("https://openbuilds.ai/builds?q=a&page=2#top");
  });
});

describe("UX-14 P1 · the site's name", () => {
  it("is exactly OpenBuilds.ai in the app and in the edge functions, and the two agree", async () => {
    const app = await import("./site");
    const edge = await import("../../supabase/functions/_shared/site");
    expect(app.SITE_NAME).toBe("OpenBuilds.ai");
    expect(edge.SITE_NAME).toBe("OpenBuilds.ai");
    expect(edge.SITE_NAME).toBe(app.SITE_NAME);
  });
});
