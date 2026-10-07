// The gallery's address (RC-P10): read, written, and read again.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { galleryHref, parseGalleryParams } from "@/lib/build/galleryParams";

const parse = (search: string) => parseGalleryParams(new URLSearchParams(search));

describe("parseGalleryParams", () => {
  it("reads the resting gallery from an empty address", () => {
    expect(parse("")).toEqual({ lens: "all", madeFor: [], madeWith: [], query: null });
  });

  it("reads each of the four lenses", () => {
    for (const lens of ["all", "proven", "rebuilt", "unsolved"]) {
      expect(parse(`lens=${lens}`).lens).toBe(lens);
    }
  });

  it("reads a lens it has no name for as All", () => {
    expect(parse("lens=trending").lens).toBe("all");
    expect(parse("lens=").lens).toBe("all");
    expect(parse("lens=PROVEN").lens).toBe("all");
  });

  it("reads for and with as repeatable, trimmed and without repeats", () => {
    const params = parse("for=lawyers&for=%20designers%20&for=lawyers&with=Claude&with=&with=n8n");
    expect(params.madeFor).toEqual(["lawyers", "designers"]);
    expect(params.madeWith).toEqual(["Claude", "n8n"]);
  });

  it("tidies the query, and reads one under two characters as none", () => {
    expect(parse("q=%20%20inbox%20%20%20agent%20").query).toBe("inbox agent");
    expect(parse("q=a").query).toBeNull();
    expect(parse(`q=${"x".repeat(120)}`).query).toHaveLength(80);
  });
});

describe("galleryHref", () => {
  it("spells the resting gallery as /gallery", () => {
    expect(galleryHref()).toBe("/gallery");
    expect(galleryHref({ lens: "all", madeFor: [], madeWith: [], query: null })).toBe("/gallery");
  });

  it("writes only what differs from the default, in the order lens, for, with, q", () => {
    expect(
      galleryHref({
        query: "inbox agent",
        madeWith: ["Claude"],
        madeFor: ["lawyers", "designers"],
        lens: "proven",
      }),
    ).toBe("/gallery?lens=proven&for=lawyers&for=designers&with=Claude&q=inbox+agent");
  });

  it("drops what the gallery does not recognise", () => {
    expect(galleryHref({ lens: "trending" as never, query: "a", madeFor: ["  "] })).toBe("/gallery");
  });

  it("round-trips parseGalleryParams", () => {
    const addresses = [
      "",
      "lens=unsolved",
      "lens=rebuilt&for=lawyers&with=Claude&with=n8n&q=invoice+chaser",
      "for=a%26b&q=%25off%20%26%20on",
      "lens=proven&q=caf%C3%A9",
    ];
    for (const search of addresses) {
      const once = parse(search);
      const href = galleryHref(once);
      const twice = parseGalleryParams(new URL(href, "https://example.test").searchParams);
      expect(twice).toEqual(once);
      expect(galleryHref(twice)).toBe(href);
    }
  });
});

describe("shapes (UI-P28)", () => {
  it("reads shape as repeatable, known shapes only — and leaves the key out when there are none", () => {
    expect(parse("shape=agent&shape=%20app%20&shape=agent&shape=toaster").shapes).toEqual(["agent", "app"]);
    expect(parse("")).not.toHaveProperty("shapes");
    expect(parse("shape=toaster")).not.toHaveProperty("shapes");
  });

  it("writes shape after with and before q, and drops what it does not know", () => {
    expect(galleryHref({ madeWith: ["Claude"], shapes: ["agent", "workflow"], query: "inbox" })).toBe(
      "/gallery?with=Claude&shape=agent&shape=workflow&q=inbox",
    );
    expect(galleryHref({ shapes: ["toaster"] })).toBe("/gallery");
  });

  it("round-trips", () => {
    const address = "/gallery?lens=rebuilt&for=lawyers&shape=study&q=inbox+agent";
    const search = new URLSearchParams(address.split("?")[1]);
    expect(galleryHref(parseGalleryParams(search))).toBe(address);
  });
});


describe("UI-P49 — the feed's parameters", () => {
  it("reads view, model and sort, and writes them back in their places", () => {
    const params = parse("q=inbox&sort=reproduced&model=sonnet-5-5&for=lawyers&view=dashboard");
    expect(params).toMatchObject({ view: "dashboard", model: "sonnet-5-5", sort: "reproduced", madeFor: ["lawyers"], query: "inbox" });
    expect(galleryHref(params)).toBe("/gallery?view=dashboard&for=lawyers&model=sonnet-5-5&sort=reproduced&q=inbox");
  });

  it("leaves the defaults out: the feed, any model, newest", () => {
    expect(parse("view=feed&sort=newest")).toEqual({ lens: "all", madeFor: [], madeWith: [], query: null });
    expect(galleryHref({ view: "feed", sort: "newest" })).toBe("/gallery");
  });

  it("drops a model the registry does not name and a sort it does not know", () => {
    expect(parse("model=gpt-9&sort=trending")).toEqual({ lens: "all", madeFor: [], madeWith: [], query: null });
    expect(galleryHref({ model: "gpt-9", sort: "trending" as never })).toBe("/gallery");
  });
});
