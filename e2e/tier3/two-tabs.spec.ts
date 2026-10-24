// CA-23 P4 — two tabs on one build, in a real browser: two pages of one browser context, and the BroadcastChannel between them.
//
// The channel is the browser's own, so this is the one thing jsdom cannot show. The page imports the app's own `tabSync` module from
// the dev server (nothing is faked but there being no composer on the page), opens `bg-build-{buildId}` on each page, and a write
// announced on one is heard on the other, with the ids of the rows it changed, and never on the page that made it.

import { expect, test, type Page } from "@playwright/test";

const BUILD = "0d0d0d0d-0000-4000-8000-000000000001";
const OTHER_BUILD = "0d0d0d0d-0000-4000-8000-000000000002";

interface Heard {
  tab: string;
  buildId: string;
  rows: string[];
  at: number;
}

/** Open the build's channel on a page; what it hears is collected in `window.__heard`. */
async function listen(page: Page, buildId: string): Promise<string> {
  await page.goto("/signin");
  return page.evaluate(async (id) => {
    const sync = await import(/* @vite-ignore */ "/src/lib/build/tabSync.ts");
    const w = window as unknown as { __heard: unknown[]; __channel: ReturnType<typeof sync.openBuildChannel>; __sync: typeof sync };
    w.__heard = [];
    w.__sync = sync;
    w.__channel = sync.openBuildChannel(id);
    w.__channel.subscribe((message: unknown) => w.__heard.push(message));
    return sync.TAB_ID;
  }, buildId);
}

const heard = (page: Page): Promise<Heard[]> => page.evaluate(() => (window as unknown as { __heard: Heard[] }).__heard);

test.describe("two tabs of one build", () => {
  test("each tab has an id of its own, and a write announced in one is heard in the other with its row ids", async ({ browser }) => {
    const context = await browser.newContext();
    const a = await context.newPage();
    const b = await context.newPage();
    const [idA, idB] = [await listen(a, BUILD), await listen(b, BUILD)];
    expect(idA).not.toBe(idB);

    await a.evaluate(() => {
      const w = window as unknown as { __channel: { announce: (rows: string[]) => void } };
      w.__channel.announce(["node-1", "node-2", "node-1"]);
    });
    await expect.poll(async () => (await heard(b)).length).toBe(1);
    const message = (await heard(b))[0];
    expect(message).toMatchObject({ tab: idA, buildId: BUILD, rows: ["node-1", "node-2"] });
    expect(typeof message.at).toBe("number");
    // The tab that wrote does not hear itself.
    await a.waitForTimeout(300);
    expect(await heard(a)).toEqual([]);
    await context.close();
  });

  test("reads the rows a Supabase write changed from its address and its body, as the guard announces them", async ({ browser }) => {
    const context = await browser.newContext();
    const a = await context.newPage();
    const b = await context.newPage();
    await listen(a, BUILD);
    await listen(b, BUILD);
    const rows = await a.evaluate(() => {
      const w = window as unknown as { __sync: { rowsChanged: (method: string, url: string, body: string | null) => string[] } };
      const rest = "https://example.supabase.co/rest/v1";
      return [
        ...w.__sync.rowsChanged("PATCH", `${rest}/builds?id=eq.build-1`, '{"title":"x"}'),
        ...w.__sync.rowsChanged("POST", `${rest}/build_nodes?on_conflict=id`, JSON.stringify([{ id: "n1" }, { id: "n2" }])),
        ...w.__sync.rowsChanged("DELETE", `${rest}/build_nodes?id=eq.n3`, null),
      ];
    });
    expect(rows).toEqual(["build-1", "n1", "n2", "n3"]);
    await a.evaluate((ids) => (window as unknown as { __channel: { announce: (rows: string[]) => void } }).__channel.announce(ids), rows);
    await expect.poll(async () => (await heard(b))[0]?.rows).toEqual(rows);
    await context.close();
  });

  test("a different build's tab is not told", async ({ browser }) => {
    const context = await browser.newContext();
    const a = await context.newPage();
    const b = await context.newPage();
    await listen(a, BUILD);
    await listen(b, OTHER_BUILD);
    await a.evaluate(() => (window as unknown as { __channel: { announce: (rows: string[]) => void } }).__channel.announce(["x"]));
    await a.waitForTimeout(500);
    expect(await heard(b)).toEqual([]);
    await context.close();
  });

  test("a tab opened later hears the rows changed after it opened, and a tab that closed hears nothing", async ({ browser }) => {
    const context = await browser.newContext();
    const a = await context.newPage();
    const b = await context.newPage();
    await listen(a, BUILD);
    await listen(b, BUILD);
    const c = await context.newPage();
    await listen(c, BUILD);
    await b.evaluate(() => (window as unknown as { __channel: { close: () => void } }).__channel.close());
    await a.evaluate(() => (window as unknown as { __channel: { announce: (rows: string[]) => void } }).__channel.announce(["late"]));
    await expect.poll(async () => (await heard(c)).length).toBe(1);
    expect(await heard(b)).toEqual([]);
    await context.close();
  });
});
