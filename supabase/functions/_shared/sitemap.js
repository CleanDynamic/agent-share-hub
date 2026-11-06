// The sitemap, built once (UX-13 P3). The sitemap-xml edge function (Deno) and
// scripts/generate-sitemap.js (Node, run by `npm run build`) both import this file,
// so the two can never disagree about what the site lists.
//
// Plain ES module with no imports, so Deno, Node and the repo's Vitest all load it.
// `siteUrl` is passed in (supabase/functions/_shared/site.ts in the function, a
// join over VITE_SITE_URL in the script); every <loc> is siteUrl(path).

/** The sitemap protocol's limits for one file. */
export const MAX_URLS_PER_FILE = 50000;
export const MAX_BYTES_PER_FILE = 50 * 1024 * 1024;

/** The API returns at most 1000 rows a request, so lists are read a page at a time. */
export const PAGE_SIZE = 1000;

/**
 * The most each list may contribute. They add up to 36,004, under one file's 50,000, so
 * today the sitemap is always one file; buildSitemap writes an index instead if a caller
 * raises the caps past the limit.
 */
export const CAPS = { builds: 20000, legacy: 5000, profiles: 10000, spaces: 1000 };

/**
 * Pages that always exist and anybody may read. /privacy and /terms are left out until
 * their text is reviewed (their drafts still hold {{NEED: ...}} placeholders), and
 * /library is signed-in only. Add them here when that changes.
 */
export const STATIC_PAGES = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/builds", changefreq: "daily", priority: "0.9" },
  { path: "/openbuilds", changefreq: "daily", priority: "0.8" },
  { path: "/about", changefreq: "monthly", priority: "0.4" },
];

const LIVE_BUILD = new Set(["published", "gallery"]);

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const iso = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const bytes = (s) => new TextEncoder().encode(s).length;

const urlLine = (u) =>
  `  <url><loc>${esc(u.loc)}</loc>` +
  (u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : "") +
  `<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`;

const HEAD = '<?xml version="1.0" encoding="UTF-8"?>';
const URLSET_OPEN = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
const INDEX_OPEN = '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

/**
 * @typedef {{
 *   builds?: Array<{ slug?: string | null; status?: string | null; updated_at?: string | null; published_at?: string | null }>;
 *   profiles?: Array<{ username?: string | null; is_private?: boolean | null }>;
 *   spaces?: Array<{ slug?: string | null }>;
 *   legacy?: Array<{ slug?: string | null; id?: string | null; status?: string | null; updated_at?: string | null; published_at?: string | null }>;
 * }} SitemapRows
 *
 * Builds the sitemap. Never lists drafts, private profiles, unapproved old posts, saves,
 * messages or redirects: it lists only what the rows say is public, and the caller
 * reads the rows with the public key, so the database's own rules apply first.
 *
 * @param {SitemapRows} rows
 * @param {(path: string) => string} siteUrl
 * @param {{ maxUrlsPerFile?: number, maxBytesPerFile?: number, caps?: Partial<typeof CAPS> }} [options]
 * @returns {{ xml: string, parts: Array<{ name: string, xml: string }>, counts: Record<string, number> }}
 *   `xml` is the sitemap, or the index when the URLs do not fit one file; `parts` holds
 *   the files the index points at (named sitemap-1.xml, sitemap-2.xml ...), empty for one file.
 */
export function buildSitemap(rows, siteUrl, options = {}) {
  const maxUrls = options.maxUrlsPerFile ?? MAX_URLS_PER_FILE;
  const maxBytes = options.maxBytesPerFile ?? MAX_BYTES_PER_FILE;
  const caps = { ...CAPS, ...(options.caps ?? {}) };

  const urls = [];
  const seen = new Set();
  const counts = { static: 0, builds: 0, profiles: 0, spaces: 0, legacy: 0, total: 0 };
  const add = (kind, path, lastmod, changefreq, priority) => {
    const loc = siteUrl(path);
    if (seen.has(loc)) return;
    seen.add(loc);
    urls.push({ loc, lastmod: iso(lastmod), changefreq, priority });
    counts[kind] += 1;
  };

  for (const p of STATIC_PAGES) add("static", p.path, null, p.changefreq, p.priority);

  const buildSlugs = new Set();
  for (const b of (rows.builds ?? []).slice(0, caps.builds)) {
    if (!b?.slug || (b.status != null && !LIVE_BUILD.has(b.status))) continue;
    buildSlugs.add(b.slug);
    add("builds", `/b2/${encodeURIComponent(b.slug)}`, b.updated_at || b.published_at, "weekly", "0.8");
  }

  // A profile row has no updated_at, so its entry has no lastmod rather than a wrong one.
  for (const p of (rows.profiles ?? []).slice(0, caps.profiles)) {
    if (!p?.username || p.is_private) continue;
    add("profiles", `/profile/${encodeURIComponent(p.username)}`, null, "weekly", "0.5");
  }

  for (const s of (rows.spaces ?? []).slice(0, caps.spaces)) {
    if (!s?.slug) continue;
    add("spaces", `/openbuilds/spaces/${encodeURIComponent(s.slug)}`, null, "daily", "0.5");
  }

  // Older posts that still have a reader page at /b/:slug. One that is also a build is listed once, as the build.
  for (const c of (rows.legacy ?? []).slice(0, caps.legacy)) {
    const slug = c?.slug || c?.id;
    if (!slug || c.status !== "approved" || buildSlugs.has(slug)) continue;
    add("legacy", `/b/${encodeURIComponent(slug)}`, c.updated_at || c.published_at, "weekly", "0.4");
  }

  counts.total = urls.length;

  // Split into files that respect both limits.
  const files = [];
  let current = [];
  let size = bytes(HEAD) + bytes(URLSET_OPEN) + bytes("</urlset>") + 3;
  for (const u of urls) {
    const line = urlLine(u);
    const lineSize = bytes(line) + 1;
    if (current.length > 0 && (current.length >= maxUrls || size + lineSize > maxBytes)) {
      files.push(current);
      current = [];
      size = bytes(HEAD) + bytes(URLSET_OPEN) + bytes("</urlset>") + 3;
    }
    current.push(line);
    size += lineSize;
  }
  files.push(current);

  const urlset = (lines) => [HEAD, URLSET_OPEN, ...lines, "</urlset>"].join("\n");
  if (files.length === 1) return { xml: urlset(files[0]), parts: [], counts };

  const parts = files.map((lines, i) => ({ name: `sitemap-${i + 1}.xml`, xml: urlset(lines) }));
  const index = [
    HEAD,
    INDEX_OPEN,
    ...parts.map((p) => `  <sitemap><loc>${esc(siteUrl(`/${p.name}`))}</loc></sitemap>`),
    "</sitemapindex>",
  ].join("\n");
  return { xml: index, parts, counts };
}

/**
 * Reads up to `cap` rows a page at a time. `fetchPage(from, to)` returns the rows from
 * index `from` to `to` inclusive (a PostgREST `.range()`), or null on an error.
 */
export async function readPages(fetchPage, cap, pageSize = PAGE_SIZE) {
  const out = [];
  for (let from = 0; out.length < cap; from += pageSize) {
    const want = Math.min(pageSize, cap - out.length);
    const page = (await fetchPage(from, from + want - 1)) ?? [];
    out.push(...page);
    if (page.length < want) break;
  }
  return out;
}

/**
 * Reads every list the sitemap needs, with the public key (`db` is a Supabase client
 * made with it), so the database's rules apply: a draft build, a private profile and
 * an unapproved post are not returned to it. A list that fails to read is empty, and
 * the static pages are still written.
 *
 * Each read is a range over an index:
 *   builds    status IN ('published','gallery') ORDER BY published_at DESC   idx_builds_status_published (status, published_at DESC)
 *   profiles  is_private = false AND username IS NOT NULL ORDER BY username   the unique index on profiles.username
 *   spaces    ORDER BY slug                                                    the unique index on spaces.slug
 *   legacy    status = 'approved' ORDER BY published_at DESC                   idx_content_items_status (status)
 * To check, run in the SQL editor, for each, EXPLAIN (ANALYZE, BUFFERS) on the same query with LIMIT 1000:
 * the plan should show an Index Scan or Bitmap Index Scan on the index named, and no Seq Scan once the table
 * holds more than a few thousand rows. (The legacy read sorts its approved rows; it is capped at 5,000.)
 */
export async function loadSitemapRows(db, caps = CAPS) {
  const read = (table, columns, shape, cap) =>
    readPages(async (from, to) => {
      const { data, error } = await shape(db.from(table).select(columns)).range(from, to);
      return error ? null : data;
    }, cap);

  const [builds, profiles, spaces, legacy] = await Promise.all([
    read("builds", "slug, status, updated_at, published_at", (q) => q.in("status", ["published", "gallery"]).order("published_at", { ascending: false }), caps.builds),
    read("profiles", "username, is_private", (q) => q.eq("is_private", false).not("username", "is", null).order("username"), caps.profiles),
    read("spaces", "slug", (q) => q.order("slug"), caps.spaces),
    read("content_items", "slug, id, status, updated_at, published_at", (q) => q.eq("status", "approved").order("published_at", { ascending: false }), caps.legacy),
  ]);
  return { builds, profiles, spaces, legacy };
}
