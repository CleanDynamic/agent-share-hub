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
    expect(galleryHref()).toBe("/builds");
    expect(galleryHref({ lens: "all", madeFor: [], madeWith: [], query: null })).toBe("/builds");
  });

  it("writes only what differs from the default, in the order lens, for, with, q", () => {
    expect(
      galleryHref({
        query: "inbox agent",
        madeWith: ["Claude"],
        madeFor: ["lawyers", "designers"],
        lens: "proven",
      }),
    ).toBe("/builds?lens=proven&for=lawyers&for=designers&with=Claude&q=inbox+agent");
  });

  it("drops what the gallery does not recognise", () => {
    expect(galleryHref({ lens: "trending" as never, query: "a", madeFor: ["  "] })).toBe("/builds");
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
      "/builds?with=Claude&shape=agent&shape=workflow&q=inbox",
    );
    expect(galleryHref({ shapes: ["toaster"] })).toBe("/builds");
  });

  it("round-trips", () => {
    const address = "/builds?lens=rebuilt&for=lawyers&shape=study&q=inbox+agent";
    const search = new URLSearchParams(address.split("?")[1]);
    expect(galleryHref(parseGalleryParams(search))).toBe(address);
  });
});


describe("SV-11 — the view, open and the resting sort", () => {
  it("reads view, model and sort, and writes them back in their places", () => {
    const params = parse("q=inbox&sort=newest&model=sonnet-5-5&for=lawyers&view=maps");
    expect(params).toMatchObject({ view: "maps", model: "sonnet-5-5", sort: "newest", madeFor: ["lawyers"], query: "inbox" });
    expect(galleryHref(params)).toBe("/builds?view=maps&for=lawyers&model=sonnet-5-5&sort=newest&q=inbox");
  });

  it("leaves the defaults out: the Table, any model, most reproduced", () => {
    expect(parse("view=table&sort=reproduced")).toEqual({ lens: "all", madeFor: [], madeWith: [], query: null });
    expect(galleryHref({ sort: "reproduced" })).toBe("/builds");
  });

  it("drops the retired views, a model the registry does not name and a sort it does not know", () => {
    expect(parse("view=dashboard&model=gpt-9&sort=trending")).toEqual({ lens: "all", madeFor: [], madeWith: [], query: null });
    expect(parse("view=feed").view).toBeUndefined();
    expect(galleryHref({ model: "gpt-9", sort: "trending" as never })).toBe("/builds");
  });

  it("reads open=1 as the Open requests filter and writes it after f", () => {
    expect(parse("open=1").open).toBe(true);
    expect(parse("open=yes").open).toBeUndefined();
    expect(galleryHref({ facets: ["field:education"], open: true, sort: "newest" })).toBe("/builds?f=field%3Aeducation&open=1&sort=newest");
  });

  it("drops the dashboard's parameters", () => {
    expect(parse("tab=makers&lab=Google&report=multi&active=30&dsort=prompts&build=x&by=field")).toEqual({ lens: "all", madeFor: [], madeWith: [], query: null });
  });
});

describe("TF-14 — the tool parameter", () => {
  it("reads tool as an id, writes it after model and before sort, and reads a name as its id", () => {
    const params = parse("sort=rebuilt&tool=lovable&model=sonnet-5-5");
    expect(params).toMatchObject({ tool: "lovable", model: "sonnet-5-5", sort: "rebuilt" });
    expect(galleryHref(params)).toBe("/builds?model=sonnet-5-5&tool=lovable&sort=rebuilt");
    expect(parse("tool=Claude%20Code").tool).toBe("claude-code");
  });

  it("drops a tool the registry does not name, and leaves the key out when none is chosen", () => {
    expect(parse("tool=notatool")).toEqual({ lens: "all", madeFor: [], madeWith: [], query: null });
    expect(galleryHref({ tool: "notatool" })).toBe("/builds");
    expect(galleryHref({})).toBe("/builds");
  });

  it("round-trips, and leaves with alone", () => {
    const href = galleryHref(parse("with=Lovable&tool=lovable"));
    expect(href).toBe("/builds?with=Lovable&tool=lovable");
    expect(parse(href.split("?")[1])).toMatchObject({ madeWith: ["Lovable"], tool: "lovable" });
  });
});

describe("CA-13 P12 — the pattern parameter", () => {
  it("reads one of the three, writes it after tool and before sort, and drops anything else", () => {
    const params = parse("sort=confirmed&pattern=router&tool=lovable");
    expect(params).toMatchObject({ pattern: "router", tool: "lovable" });
    expect(galleryHref(params)).toBe("/builds?tool=lovable&pattern=router&sort=confirmed");
    expect(parse("pattern=nonsense")).toEqual({ lens: "all", madeFor: [], madeWith: [], query: null });
    expect(galleryHref(parse("pattern=structured-output"))).toBe("/builds?pattern=structured-output");
  });
});

describe("CA-16: classification facets in the address", () => {
  it("reads f as repeatable, keeps only keys the lists know, and without repeats", () => {
    const params = parse("f=field:ai-ml&f=skill:no-coding&f=skill:nope&f=nofacet&f=field:ai-ml&f=cost%3Afree-plans-are-enough");
    expect(params.facets).toEqual(["field:ai-ml", "skill:no-coding", "cost:free-plans-are-enough"]);
  });

  it("leaves facets out of the resting address", () => {
    expect(parse("")).not.toHaveProperty("facets");
    expect(galleryHref({ facets: [] })).toBe("/builds");
  });

  it("writes f between pattern and sort, one per key, and a parse then write is a tidy", () => {
    const href = galleryHref({ query: "nlp", sort: "rebuilt", pattern: "router", facets: ["field:ai-ml", "bad", "skill:no-coding"] });
    expect(href).toBe("/builds?pattern=router&f=field%3Aai-ml&f=skill%3Ano-coding&sort=rebuilt&q=nlp");
    expect(galleryHref(parse(href.split("?")[1]))).toBe(href);
  });
});
