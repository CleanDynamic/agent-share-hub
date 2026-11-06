/**
 * Writes public/sitemap.xml (UX-13 P3). `npm run build` runs it first.
 *
 * The site is served by Lovable hosting, which does not read netlify.toml, so the
 * Netlify redirect from /sitemap.xml to the sitemap-xml function does nothing there;
 * the sitemap has to be a file in the build. It is the same file the function
 * answers with: both call buildSitemap in supabase/functions/_shared/sitemap.js.
 *
 * It reads with the public key (VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY,
 * the two in .env), so the database's own rules decide what is listed. If the
 * network is unavailable or the keys are missing it exits 0 and leaves the committed
 * public/sitemap.xml (the static pages) as it is. A failed sitemap never fails a build.
 *
 * Usage: node scripts/generate-sitemap.js
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { buildSitemap, loadSitemapRows } from "../supabase/functions/_shared/sitemap.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "public", "sitemap.xml");

/** The address the site is served at, as src/lib/site.ts reads it. */
const SITE_URL = (process.env.VITE_SITE_URL?.trim() || "https://openbuilds.ai").replace(/\/+$/, "");
const siteUrl = (path = "") => `${SITE_URL}/${path.replace(/^\/+/, "")}`;

/** .env holds the project's public values; the environment wins over it. */
function readDotEnv() {
  const file = join(root, ".env");
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r]*)"?\s*$/.exec(line);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function main() {
  const env = { ...readDotEnv(), ...process.env };
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

  let rows = { builds: [], profiles: [], spaces: [], legacy: [] };
  if (url && key) {
    const db = createClient(url, key, {
      auth: { persistSession: false },
      // A slow network must not hold a build: each request gives up after 20 seconds.
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }) },
    });
    rows = await loadSitemapRows(db);
  } else {
    console.warn("sitemap: no Supabase address or public key; writing the static pages only.");
  }

  const { xml, parts, counts } = buildSitemap(rows, siteUrl);
  const live = counts.total - counts.static;
  if (live === 0 && existsSync(OUT)) {
    // Nothing could be read: keep the file that is there rather than replace a good one with less.
    console.warn("sitemap: nothing could be read; leaving public/sitemap.xml as it is.");
    return;
  }
  writeFileSync(OUT, xml + "\n");
  for (const part of parts) writeFileSync(join(root, "public", part.name), part.xml + "\n");
  console.log(`sitemap: ${counts.total} urls (${JSON.stringify(counts)}), ${parts.length} extra file(s).`);
}

main().catch((error) => {
  // Quietly: a sitemap is never a reason to fail a build.
  console.warn("sitemap: skipped,", error?.message ?? error);
});
