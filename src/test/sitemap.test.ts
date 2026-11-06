// UX-13 P3. One sitemap, shared by the sitemap-xml function and the build script.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSitemap, CAPS, LEGAL_PAGES, loadSitemapRows, MAX_URLS_PER_FILE, readPages, STATIC_PAGES } from "../../supabase/functions/_shared/sitemap.js";

const site = (path = "") => `https://openbuilds.ai/${path.replace(/^\/+/, "")}`;
const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);

const rows = {
  builds: [
    { slug: "inbox-triage", status: "published", updated_at: "2026-10-01T08:30:00Z", published_at: "2026-09-01T00:00:00Z" },
    { slug: "from-gallery", status: "gallery", updated_at: null, published_at: "2026-08-01T00:00:00Z" },
    { slug: "secret-draft", status: "draft", updated_at: "2026-10-02T00:00:00Z" },
    { slug: "a&b <c>", status: "published", updated_at: "2026-10-03T00:00:00Z" },
  ],
  profiles: [
    { username: "ada_l", is_private: false },
    { username: "hidden", is_private: true },
    { username: null, is_private: false },
  ],
  spaces: [{ slug: "agents" }],
  legacy: [
    { slug: "old-post", id: "1", status: "approved", updated_at: "2026-01-01T00:00:00Z" },
    { slug: "pending-post", id: "2", status: "pending" },
    { slug: "inbox-triage", id: "3", status: "approved" },
  ],
};

describe("UX-13 P3 · buildSitemap", () => {
  const { xml, parts, counts } = buildSitemap(rows, site);

  it("lists the static pages, live builds, public profiles, spaces and old posts, each once", () => {
    expect(locs(xml)).toEqual([
      ...STATIC_PAGES.map((p) => site(p.path)),
      site("/b2/inbox-triage"),
      site("/b2/from-gallery"),
      site("/b2/a%26b%20%3Cc%3E"),
      site("/profile/ada_l"),
      site("/openbuilds/spaces/agents"),
      site("/b/old-post"),
    ]);
    expect(parts).toEqual([]);
    expect(counts).toMatchObject({ static: 4, builds: 3, profiles: 1, spaces: 1, legacy: 1, total: 10 });
  });

  it("never lists a draft build, a private profile, an unapproved post or a signed-in page", () => {
    const all = locs(xml).join("\n");
    for (const hidden of ["secret-draft", "hidden", "pending-post", "/library", "/messages", "/drafts", "/privacy", "/terms"]) {
      expect(all).not.toContain(hidden);
    }
  });

  it("writes lastmod from updated_at, then published_at, and none when there is neither", () => {
    expect(xml).toContain("<loc>https://openbuilds.ai/b2/inbox-triage</loc><lastmod>2026-10-01T08:30:00.000Z</lastmod>");
    expect(xml).toContain("<loc>https://openbuilds.ai/b2/from-gallery</loc><lastmod>2026-08-01T00:00:00.000Z</lastmod>");
    expect(xml).toContain("<loc>https://openbuilds.ai/profile/ada_l</loc><changefreq>");
  });

  it("escapes what the XML cannot hold", () => {
    const tricky = buildSitemap({ spaces: [{ slug: "x" }] }, (p) => `https://openbuilds.ai/${p}?a=1&b="2"`);
    expect(tricky.xml).toContain("?a=1&amp;b=&quot;2&quot;");
  });

  it("is well-formed XML, and every loc starts with https://openbuilds.ai/", () => {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
    expect(doc.documentElement.tagName).toBe("urlset");
    expect(doc.documentElement.namespaceURI).toBe("http://www.sitemaps.org/schemas/sitemap/0.9");
    const all = locs(xml);
    expect(all.length).toBeGreaterThan(3);
    for (const loc of all) expect(loc.startsWith("https://openbuilds.ai/")).toBe(true);
  });

  it("caps each list", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ slug: `b-${i}`, status: "published" }));
    const out = buildSitemap({ builds: many }, site, { caps: { builds: 10 } });
    expect(out.counts.builds).toBe(10);
    expect(CAPS.builds + CAPS.legacy + CAPS.profiles + CAPS.spaces + STATIC_PAGES.length).toBeLessThan(MAX_URLS_PER_FILE);
  });

  it("writes an index and numbered files when the URLs do not fit one file", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ slug: `b-${i}`, status: "published" }));
    const out = buildSitemap({ builds: many }, site, { maxUrlsPerFile: 4 });
    expect(out.xml).toContain("<sitemapindex");
    expect(locs(out.xml)).toEqual([site("/sitemap-1.xml"), site("/sitemap-2.xml"), site("/sitemap-3.xml")]);
    expect(out.parts.map((p) => p.name)).toEqual(["sitemap-1.xml", "sitemap-2.xml", "sitemap-3.xml"]);
    expect(out.parts.flatMap((p) => locs(p.xml))).toHaveLength(out.counts.total);
    for (const p of out.parts) expect(locs(p.xml).length).toBeLessThanOrEqual(4);
  });

  it("also splits on size", () => {
    const out = buildSitemap({ builds: [{ slug: "a", status: "published" }, { slug: "b", status: "published" }] }, site, { maxBytesPerFile: 600 });
    expect(out.parts.length).toBeGreaterThan(1);
  });
});

describe("UX-13 P3 · the legal pages", () => {
  it("are listed exactly when their text is reviewed, and the flags here match src/content/legal/reviewed.ts", () => {
    const source = readFileSync("src/content/legal/reviewed.ts", "utf8");
    const flag = (name: string) => new RegExp(`export const ${name} = true;`).test(source);
    expect(LEGAL_PAGES.find((l) => l.path === "/privacy")?.reviewed).toBe(flag("PRIVACY_REVIEWED"));
    expect(LEGAL_PAGES.find((l) => l.path === "/terms")?.reviewed).toBe(flag("TERMS_REVIEWED"));
  });

  it("appear in the sitemap when a flag is true", () => {
    LEGAL_PAGES[0].reviewed = true;
    try {
      expect(locs(buildSitemap({}, site).xml)).toContain(site("/privacy"));
      expect(locs(buildSitemap({}, site).xml)).not.toContain(site("/terms"));
    } finally {
      LEGAL_PAGES[0].reviewed = false;
    }
  });
});

describe("UX-13 P3 · readPages", () => {
  it("reads page by page up to the cap and stops on a short page", async () => {
    const calls: Array<[number, number]> = [];
    const out = await readPages(async (from, to) => {
      calls.push([from, to]);
      return Array.from({ length: Math.min(to, 2399) - from + 1 }, (_, i) => from + i);
    }, 5000);
    expect(out).toHaveLength(2400);
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    expect(await readPages(async () => null, 10)).toEqual([]);
    expect(await readPages(async (f, t) => Array(t - f + 1).fill(0), 1500)).toHaveLength(1500);
  });
});

describe("UX-13 P3 · one source for the function and the build", () => {
  it("both import the shared module and neither carries an old address", () => {
    const fn = readFileSync("supabase/functions/sitemap-xml/index.ts", "utf8");
    const script = readFileSync("scripts/generate-sitemap.js", "utf8");
    expect(fn).toContain("../_shared/sitemap.js");
    expect(script).toContain("../supabase/functions/_shared/sitemap.js");
    expect(readFileSync("package.json", "utf8")).toContain('"build": "node scripts/generate-sitemap.js && vite build"');
  });

  it("the committed fallback holds the static pages at openbuilds.ai", () => {
    const xml = readFileSync("public/sitemap.xml", "utf8");
    expect(locs(xml)).toEqual(STATIC_PAGES.map((p) => site(p.path)));
    expect(readFileSync("public/robots.txt", "utf8")).toContain("Sitemap: https://openbuilds.ai/sitemap.xml");
  });
});

describe("UX-13 P3 · loadSitemapRows", () => {
  it("reads builds, profiles, spaces and old posts with the filters that keep drafts and private rows out", async () => {
    const seen: Record<string, string[]> = {};
    const db = {
      from(table: string) {
        const log = (seen[table] = []) as string[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const q: any = {
          select: (c: string) => (log.push(`select ${c}`), q),
          in: (c: string, v: string[]) => (log.push(`in ${c} ${v.join(",")}`), q),
          eq: (c: string, v: unknown) => (log.push(`eq ${c} ${v}`), q),
          not: (c: string, op: string) => (log.push(`not ${c} ${op}`), q),
          order: (c: string) => (log.push(`order ${c}`), q),
          range: async (from: number, to: number) => ({ data: from === 0 ? [{ slug: `${table}-1`, status: "approved", id: "x" }] : [], error: null, range: [from, to] }),
        };
        return q;
      },
    };
    const out = await loadSitemapRows(db);
    expect(out.builds).toHaveLength(1);
    expect(seen.builds).toContain("in status published,gallery");
    expect(seen.profiles).toEqual(expect.arrayContaining(["eq is_private false", "not username is"]));
    expect(seen.content_items).toContain("eq status approved");
    expect(seen.spaces).toContain("order slug");
  });
});
