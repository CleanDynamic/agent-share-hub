/* CA-18b P3 — colour and references at the foot of Details, at 1440 wide, in the References fixture.

   Code 4 (in Login flow), Data model (a single colour), Prompt 1 (uncoloured, with linked text), Session 2 (in the group) and a tile
   with nothing: the section is the last thing in Details, under a hairline with 22 above and below, and nothing in it can be typed into.

     npm run audit -- composer-details-references */

import { expect, test } from "@playwright/test";

const open = (select: string, theme = "dusk") => `/dev/kit/pages/sandbox?theme=${theme}&build=references&select=${select}&window=1`;

test.use({ viewport: { width: 1440, height: 1500 } });

test("composer/details-references/group", async ({ page }) => {
  await page.goto(open("rf-c4"));
  const refs = page.getByTestId("details-refs");
  await refs.waitFor();
  expect(await refs.getAttribute("data-state")).toBe("group");
  const rule = await refs.evaluate((node) => { const css = getComputedStyle(node); return { top: css.borderTopWidth, above: css.marginTop, below: css.paddingTop }; });
  expect(rule).toEqual({ top: "1px", above: "22px", below: "22px" });
  // The last thing in Details, after the Not set line.
  const notSet = (await page.getByTestId("details-not-set").boundingBox())!;
  const box = (await refs.boundingBox())!;
  expect(box.y).toBeGreaterThan(notSet.y + notSet.height);
  const panel = await page.getByTestId("details-refs-panel").evaluate((node) => { const css = getComputedStyle(node); return { pad: css.padding, radius: css.borderRadius, shadow: css.boxShadow }; });
  expect(panel.pad).toBe("14px 16px");
  expect(panel.radius).toBe("8px");
  expect(panel.shadow).toContain("3px");
  const rows = page.getByTestId("details-refs-member");
  await expect(rows).toHaveCount(3);
  for (const row of await rows.all()) expect((await row.boundingBox())!.height).toBe(36);
  expect(await page.getByTestId("details-aside").locator("input, textarea, select, [contenteditable]").count()).toBe(0);
  // A row selects its component: Details now shows Check 5.
  await rows.nth(2).click();
  await expect(page.getByTestId("details-aside").getByText("Link opens once").first()).toBeVisible();
  await page.screenshot({ path: "design/audits/composer/ca-18b/references/code-4-in-login-flow-dusk-1440.png" });
});

test("composer/details-references/single colour, linked text and nothing", async ({ page }) => {
  await page.goto(open("rf-m2"));
  const refs = page.getByTestId("details-refs");
  await refs.waitFor();
  expect(await refs.getAttribute("data-state")).toBe("single");
  await expect(page.getByTestId("details-refs-sub")).toHaveText("Set on this tile only");
  await expect(page.getByTestId("details-refs-also")).toContainText("not grouped");
  await page.screenshot({ path: "design/audits/composer/ca-18b/references/data-model-single-colour-dusk-1440.png" });

  await page.goto(open("rf-p1"));
  await page.getByTestId("details-refs").waitFor();
  expect(await page.getByTestId("details-refs").getAttribute("data-state")).toBe("linked");
  await expect(page.getByTestId("details-refs-panel")).toHaveCount(0);
  await page.screenshot({ path: "design/audits/composer/ca-18b/references/prompt-1-linked-text-dusk-1440.png" });

  await page.goto(open("rf-p3"));
  await page.getByTestId("details-aside").waitFor();
  await expect(page.getByTestId("details-refs")).toHaveCount(0);
});
