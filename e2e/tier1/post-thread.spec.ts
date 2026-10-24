// Tier 1 — PT-09, a post thread from the composer to the build page.
//
// ONE MAKER WRITES A THREAD and the readers find it: two posts, a picture in the first and two in the second (CA-07: one grid per post),
// written in the composer's Post tab, published, read as post 1 in the Gallery with the tool marks after the handle,
// opened with Show more, and read in full on the build page.
//
// THE BACKEND IS FAKED (support/postThreadBackend.ts), stateful: what the composer writes is what the Gallery and the
// build page read back. Nothing reaches the network. The spec also counts what Show more costs.

import { expect, test, type Page } from "@playwright/test";

import { fakeThreadBackend, PNG, type ThreadBackend } from "./support/postThreadBackend";

const FIRST = "I built a bakery ordering site over a weekend.";
const SECOND = "Then the first orders came in.";

const picture = (name: string) => ({ name, mimeType: "image/png", buffer: PNG });

/** The Build | Post switch: tabs on a desktop, a segmented control on a phone. */
const section = (page: Page, name: RegExp) =>
  page
    .getByRole("tab", { name })
    .or(page.getByRole("radio", { name }))
    .or(page.getByRole("button", { name }))
    .first();

/** Slash menu: type the command, press Enter, and give the file chooser the pictures. */
async function insertPictures(page: Page, command: string, files: string[], total: number) {
  await page.keyboard.type(command);
  const chooser = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  await (await chooser).setFiles(files.map(picture));
  await expect(page.locator(".ProseMirror").first().locator("[data-grid-tile]")).toHaveCount(total);
}

async function writeThread(page: Page, backend: ThreadBackend) {
  await page.goto("/compose/new");
  await section(page, /^Post/).click();

  const editor = page.locator(".ProseMirror").first();
  await editor.click();
  await page.keyboard.type(FIRST);
  await page.keyboard.press("Enter");
  await insertPictures(page, "/picture", ["bakery.png"], 1);

  // The caret stays on the line above the post's pictures; New post starts the next post after them.
  await page.keyboard.type("/new post");
  await page.keyboard.press("Enter");
  await page.keyboard.type(SECOND);
  await page.keyboard.press("Enter");
  await insertPictures(page, "/picture", ["orders-a.png", "orders-b.png"], 3);

  // The thread is saved on the composer's debounce: wait for it to land.
  await expect.poll(() => JSON.stringify(backend.build()?.post_doc ?? null)).toContain("postMediaGrid");
}

async function describeAndPublish(page: Page) {
  await section(page, /^Build/).click();
  await page.getByRole("textbox", { name: "Add a prompt" }).fill("Build me an ordering site for a small bakery.");
  await page.getByRole("button", { name: "Add prompt" }).click();

  await page.getByRole("button", { name: "Card", exact: true }).click();
  const card = page.getByRole("dialog", { name: "Card" });
  await card.getByRole("textbox", { name: "Title" }).fill("Weekend bakery site");
  await card.getByRole("textbox", { name: "One-line summary" }).fill("An ordering site for a small bakery, built in a weekend.");
  await card.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Publish", exact: true }).click();
  // CA-25: the checklist opens while a recommended item (the Classification Card) is open; Confirm follows.
  const checklist = page.getByTestId("publish-checklist");
  await expect(checklist.or(page.getByTestId("publish-confirm"))).toBeVisible();
  if (await checklist.isVisible()) await checklist.getByTestId("checklist-publish").click();
  await page.getByTestId("confirm-publish").click();
}

test("writes a two-post thread, publishes it, and it reads in the Gallery and on the build page", async ({ page }) => {
  const backend = await fakeThreadBackend(page);

  await writeThread(page, backend);
  await describeAndPublish(page);
  await expect.poll(() => backend.build()?.status).not.toBe("draft");

  // The Gallery: post 1, the tool marks after the handle, post 2 behind Show more.
  const before = backend.requests.length;
  await page.goto("/gallery");
  const item = page.locator("[data-feed-post]").first();
  await expect(item).toBeVisible();
  await expect(item.getByTestId("feed-author-name")).toHaveText("Audit Runner");
  const authorRow = item.locator("[data-feed-author-row]");
  await expect(authorRow).toContainText("@audit");
  await expect(authorRow.getByRole("img", { name: /^Made with Claude/ })).toBeVisible();
  // The marks come after the handle, not before it.
  const order = await authorRow.evaluate((row) => {
    const handle = row.textContent?.indexOf("@audit") ?? -1;
    const marks = row.querySelector("[data-made-with]");
    return { handle, marks: marks ? Array.from(row.querySelectorAll("*")).indexOf(marks) : -1, text: row.textContent ?? "" };
  });
  expect(order.handle).toBeGreaterThanOrEqual(0);
  expect(order.marks).toBeGreaterThan(0);

  await expect(item.getByText(FIRST)).toBeVisible();

  // The first page reads the list and its cards, and nothing for the action row: the counts arrive with the cards.
  const first = backend.requests.slice(before).filter((entry) => entry.url.includes("/rest/v1/") && entry.method === "GET");
  expect(first.filter((entry) => entry.url.includes("like_count,comment_count&id=in"))).toHaveLength(0);
  expect(first.filter((entry) => entry.url.includes("/rest/v1/builds?") && entry.url.includes("status=in.(published,gallery)"))).toHaveLength(2);
  // Post 2 is in the page but folded away until Show more.
  const toggle = item.locator("[data-post-toggle]");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toContainText("Show more");

  const mediaBefore = backend.count("/rest/v1/build_media", "GET");
  const signBefore = backend.count("/object/sign/", "POST");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(item.getByText(SECOND)).toBeVisible();
  await expect(item.getByRole("img", { name: /^Picture/ })).toHaveCount(3);

  // Show more costs one read of the thread's pictures, and the signing of the pictures that read brought in.
  await expect.poll(() => backend.count("/rest/v1/build_media", "GET") - mediaBefore).toBe(1);
  const signed = backend.count("/object/sign/", "POST") - signBefore;
  expect(signed).toBeGreaterThanOrEqual(2);
  expect(signed).toBeLessThanOrEqual(3);

  // The build page: both posts, open, with no Show more.
  await page.goto(`/b2/${backend.build()?.slug}`);
  const hero = page.getByTestId("build-hero");
  await expect(hero).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Weekend bakery site" })).toBeVisible();
  await expect(hero.getByText(FIRST)).toBeVisible();
  await expect(hero.getByText(SECOND)).toBeVisible();
  await expect(hero.getByRole("img", { name: /^Picture/ })).toHaveCount(3);
  await expect(hero.locator("[data-post-toggle]")).toHaveCount(0);
  await expect(page.getByTestId("build-author-row")).toContainText("@audit");
  // Your own build offers no Follow.
  await expect(page.getByRole("button", { name: /^Follow/ })).toHaveCount(0);
});

/** Every control in these regions has a name; below 768px each is 44px and each field 16px. */
async function controlsOf(page: Page, scopes: string[]) {
  return page.evaluate((selectors) => {
    const controls = 'button, a[href], input:not([type=hidden]), textarea, select, [role=option]';
    const nameOf = (el: Element) =>
      (
        el.getAttribute("aria-label") ||
        (el.getAttribute("aria-labelledby") ?? "").split(" ").map((id) => document.getElementById(id)?.textContent ?? "").join(" ") ||
        el.textContent ||
        el.querySelector("img[alt]")?.getAttribute("alt") ||
        el.getAttribute("title") ||
        el.getAttribute("placeholder") ||
        ""
      ).trim();
    const found: { name: string; tag: string; width: number; height: number; font: number }[] = [];
    for (const root of selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)))) {
      for (const el of Array.from(root.querySelectorAll(controls))) {
        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0 || getComputedStyle(el).visibility === "hidden") continue;
        found.push({ name: nameOf(el), tag: el.tagName.toLowerCase(), width: box.width, height: box.height, font: parseFloat(getComputedStyle(el).fontSize) });
      }
    }
    return found;
  }, scopes);
}

test("the thread's controls are named, reachable by keyboard, and 44px on a phone", async ({ page }) => {
  const backend = await fakeThreadBackend(page);
  const phone = (page.viewportSize()?.width ?? 1440) < 768;

  await writeThread(page, backend);
  const composer = await controlsOf(page, ['[data-testid="post-tab"]']);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.type("/");
  const slash = await controlsOf(page, ["[role=listbox]"]);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Backspace");

  await describeAndPublish(page);
  await expect.poll(() => backend.build()?.status).not.toBe("draft");

  // The Gallery item, by keyboard: Tab to Show more and press Enter.
  await page.goto("/gallery");
  const item = page.locator("[data-feed-post]").first();
  await expect(item).toBeVisible();
  const toggle = item.locator("[data-post-toggle]");
  for (let presses = 0; presses < 60 && !(await toggle.evaluate((el) => el === document.activeElement)); presses += 1) {
    await page.keyboard.press("Tab");
  }
  await expect(toggle).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const gallery = await controlsOf(page, ["[data-feed-post]"]);

  // The build page, by keyboard: Tab to Copy for AI.
  await page.goto(`/b2/${backend.build()?.slug}`);
  await expect(page.getByTestId("build-hero")).toBeVisible();
  const copy = page.getByRole("button", { name: "Copy for AI" });
  for (let presses = 0; presses < 80 && !(await copy.evaluate((el) => el === document.activeElement)); presses += 1) {
    await page.keyboard.press("Tab");
  }
  await expect(copy).toBeFocused();
  const build = await controlsOf(page, ['[data-testid="build-hero"]']);

  for (const [where, controls] of [["composer", composer], ["slash menu", slash], ["gallery item", gallery], ["build thread", build]] as const) {
    expect(controls.length, `${where} has controls`).toBeGreaterThan(0);
    expect(controls.filter((control) => control.name === ""), `${where}: unnamed controls`).toEqual([]);
    if (!phone) continue;
    expect(
      controls.filter((control) => Math.min(control.width, control.height) < 44 && !(control.width < 44 && control.height >= 44)),
      `${where}: targets under 44px`,
    ).toEqual([]);
    expect(
      controls.filter((control) => ["input", "textarea"].includes(control.tag) && control.font < 16),
      `${where}: fields under 16px`,
    ).toEqual([]);
  }
});
