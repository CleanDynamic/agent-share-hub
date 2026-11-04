// UX-05, in a real browser: the OpenBuilds feed, a space made and posted in, and a post hidden by a moderator.
//
// The backend is the in-memory world in support/openbuildsWorld.ts. It cannot prove a policy; it models the one rule these specs
// lean on and leaves the client's own filters to be what is tested. The old requests page is covered by bounties-board.spec.ts.

import { expect, test } from "@playwright/test";

import { installWorld, newWorld } from "./support/openbuildsWorld";

test("the feed switches to Still open, the address changes, and the old list stays until the new one arrives", async ({ page }) => {
  const world = newWorld();
  await installWorld(page, world, { signedIn: false });
  await page.goto("/openbuilds");

  await expect(page.getByRole("heading", { level: 1, name: "OpenBuilds" })).toBeVisible();
  // Signed out: Everyone only, no tabs.
  await expect(page.getByRole("tablist")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Post number 1" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Post number 2" })).toBeVisible();

  world.hold.armed = true;
  await page.getByRole("button", { name: "Still open" }).click();
  await expect(page).toHaveURL(/\/openbuilds\?open=1$/);
  // The new read is held: the old list is still drawn, and nothing is mid-fade.
  await expect(page.getByRole("heading", { name: "Post number 1" })).toBeVisible();
  const faded = await page.evaluate(() => {
    const list = document.querySelector('[aria-label="Feed"]');
    return list ? list.getAnimations({ subtree: true }).length : 0;
  });
  expect(faded).toBe(0);
  await expect.poll(() => world.hold.release !== null).toBe(true);
  world.hold.release?.();

  await expect(page.getByRole("heading", { name: "Post number 1" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Post number 2" })).toBeVisible();
  expect(world.asked.some((asked) => asked.includes("still_open=eq.true"))).toBe(true);

  // A default value leaves the address.
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page).toHaveURL(/\/openbuilds$/);
});

test("a reader makes a space, posts in it with a step attached, and hides the post; a signed-out reader never sees it", async ({ page, browser }) => {
  const world = newWorld();
  await installWorld(page, world, { signedIn: true });
  await page.goto("/openbuilds");

  // Make a space.
  await expect(page.getByRole("heading", { level: 1, name: "OpenBuilds" })).toBeVisible();
  await page.getByRole("button", { name: "Make a space" }).click();
  const make = page.getByRole("dialog", { name: "Make a space" });
  await make.getByRole("textbox", { name: "Name" }).fill("Hiring tools");
  await make.getByRole("textbox", { name: "Description" }).fill("Screeners and scorers");
  await make.getByRole("button", { name: "Make space" }).click();
  await expect(page).toHaveURL(/\/openbuilds\/spaces\/hiring-tools$/);
  await expect(page.getByRole("heading", { level: 1, name: "Hiring tools" })).toBeVisible();
  expect(world.created.spaces[0]).toMatchObject({ slug: "hiring-tools", name: "Hiring tools", who_can_post: "anyone" });

  // Post in it: words plus an attached step.
  await page.getByRole("button", { name: "Post here" }).first().click();
  const window = page.getByRole("dialog", { name: "New post" });
  await expect(window.getByRole("button", { name: "Post to: Hiring tools" })).toBeVisible();
  await window.getByRole("textbox", { name: "Post" }).fill("Can anyone make the scorer faster?\nIt takes four seconds a CV.");
  await window.getByRole("button", { name: "Attach work" }).click();
  await page.getByRole("button", { name: "Step" }).click();
  await page.getByRole("button", { name: /Rubric/ }).first().click();
  await expect(window.getByText("Step 2 · Code")).toBeVisible();
  await window.getByRole("button", { name: "Post", exact: true }).click();

  // The window closes at once and the card is at the top.
  await expect(window).toHaveCount(0);
  const first = page.getByRole("article").first();
  await expect(first.getByRole("heading", { name: "Can anyone make the scorer faster?" })).toBeVisible();
  expect(world.created.rpc[0]).toMatchObject({ body: "Can anyone make the scorer faster?\nIt takes four seconds a CV.", attachments: [{ kind: "step", build_id: "b1", node_id: "n2" }] });
  expect(world.created.rpc[0].space_ids).toEqual([world.created.spaces[0].id]);

  // Hide it as a moderator: greyed for the moderator.
  await first.getByRole("button", { name: "Moderate this post" }).click();
  await page.getByRole("menuitem", { name: "Hide" }).click();
  await page.getByRole("textbox", { name: "Reason for hiding" }).fill("Test");
  await page.getByRole("button", { name: "Hide", exact: true }).click();
  await expect(page.getByText("Hidden by @testviewer · only moderators see this")).toBeVisible();

  // Gone for a signed-out reader.
  const context = await browser.newContext();
  const anonymous = await context.newPage();
  await installWorld(anonymous, world, { signedIn: false });
  await anonymous.goto("/openbuilds/spaces/hiring-tools");
  await expect(anonymous.getByRole("heading", { level: 1, name: "Hiring tools" })).toBeVisible();
  await expect(anonymous.getByText("No posts here yet.")).toBeVisible();
  await expect(anonymous.getByText("Can anyone make the scorer faster?")).toHaveCount(0);
  await context.close();
});
