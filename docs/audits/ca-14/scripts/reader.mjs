// CA-14: the reader's page for the scenario draft, published, at 1280 and 430 in both themes.
//   node docs/audits/ca-14/scripts/reader.mjs <out-dir>
// Each run starts from a fresh scenario draft (scenario.mjs): Session 1 typed (3 tiles), Session 2 imported (66 prompts),
// Session 3 started fresh.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { API, SITE, session } from "../../ca-09/scripts/lib.mjs";
import { launch, openDraft } from "./shots.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] ?? "docs/audits/ca-14/after");
mkdirSync(out, { recursive: true });

const scenario = () => execFileSync("node", [path.join(here, "scenario.mjs"), "--reset"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n").pop();


const browser = await launch();
for (const size of ["desktop", "phone"]) {
  for (const theme of ["noon", "dusk"]) {
    const reader = await openPublished(browser, size, theme);
    const steps = reader.getByTestId("build-steps").first();
    await steps.waitFor({ timeout: 15000 }).catch(() => undefined);
    await reader.evaluate(() => document.querySelector('[data-testid="build-steps"]')?.scrollIntoView({ block: "start" }));
    await reader.waitForTimeout(500);
    await reader.screenshot({ path: path.join(out, `08-reader-${size}-${theme}.png`) });
    await reader.context().close();
  }
}
async function openPublished(browser, size, theme) {
  const id = scenario();
  const token = (await session()).access_token;
  const headers = { "content-type": "application/json", apikey: "ca09-publishable-placeholder", authorization: `Bearer ${token}`, prefer: "return=representation" };
  const slug = `ca14-reader-${size}-${theme}`;
  await fetch(`${API}/rest/v1/builds?id=eq.${id}`, { method: "PATCH", headers, body: JSON.stringify({ status: "published", slug, published_at: new Date().toISOString(), outcome: "A router and a plan." }) });
  // The maker's titles and a folded long session, as the maker left them.
  const get = await (await fetch(`${API}/rest/v1/builds?id=eq.${id}&select=making`, { headers })).json();
  const making = get[0].making;
  const keys = Object.keys(making.sessions_meta);
  const imported = keys.find((key) => !key.startsWith("typed-"));
  const [typed, fresh] = keys.filter((key) => key.startsWith("typed-") && making.sessions_meta[key].tool === "claude").concat(keys.filter((key) => key.startsWith("typed-") && making.sessions_meta[key].tool !== "claude"));
  making.sessions_meta[typed].title = "Planning";
  making.sessions_meta[imported].title = "Router";
  making.session_order = [fresh, typed, imported];
  making.sessions_collapsed = [imported];
  await fetch(`${API}/rest/v1/builds?id=eq.${id}`, { method: "PATCH", headers, body: JSON.stringify({ making }) });
  const { context, page } = await openDraft(browser, size, theme, id, `/b2/${slug}`).catch(async () => {
    const ctx = await browser.newContext();
    return { context: ctx, page: await ctx.newPage() };
  });
  return page;
}

await browser.close();
