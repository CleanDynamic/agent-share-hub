// UX-07, in a real browser: topics and replies across the site. Home replies to a topic in place, and the reply is on the topic's
// page; a reply notification lands on that reply; and at 390 no page added to scrolls sideways.
//
// The backend is the in-memory world in support/openbuildsWorld.ts, which now answers Home's feed with the world's topics.

import { expect, test } from "@playwright/test";

import { addReplies, installWorld, newWorld } from "./support/openbuildsWorld";

test("Part 1: a topic is replied to from Home, in place, and the reply is on the topic's page", async ({ page }) => {
  const world = newWorld();
  addReplies(world, "p2", [{ id: "r1", body: "I split the rubric into its own step.", minutesAgo: 20 }]);
  await installWorld(page, world, { signedIn: true });
  await page.goto("/");

  const topic = page.getByRole("article", { name: "Post number 1" });
  await expect(topic).toBeVisible();
  // A reply group is one item: the topic's heading, how many replies, and the newest reply.
  const group = page.getByRole("article", { name: /in Post number 2$/ });
  await expect(group.getByText("I split the rubric into its own step.")).toBeVisible();
  await expect(group.getByTestId("home-reply-group-link")).toHaveAttribute("href", "/openbuilds/topics/p2#reply-r1");

  await topic.getByRole("button", { name: /^Reply/ }).click();
  const box = page.getByTestId("home-reply-box");
  await box.getByRole("textbox").fill("Home says hello");
  await box.getByRole("button", { name: "Reply", exact: true }).click();
  await expect(box).toHaveCount(0);
  expect(world.created.rpc.some((input) => input.parent_id === "p1" && input.body === "Home says hello")).toBe(true);

  await page.goto("/openbuilds/topics/p1");
  await expect(page.getByRole("heading", { level: 1, name: "Post number 1" })).toBeVisible();
  await expect(page.getByTestId("reply").getByText("Home says hello")).toBeVisible();
});

test("Part 5: a reply notification opens its topic at that reply", async ({ page }) => {
  const world = newWorld();
  // Enough replies that the one notified about starts below the first screen.
  addReplies(
    world,
    "p1",
    Array.from({ length: 12 }, (_, index) => ({ id: `r${index + 1}`, body: `Reply number ${index + 1}\nwith a second line\nand a third`, minutesAgo: 60 - index })),
  );
  world.notifications.push({ id: "nt1", recipient_id: "", actor_id: "00000000-0000-4000-8000-0000000000cc", notification_type: "post_reply", body: "replied to your topic", target_type: "post", target_id: "r12", content_id: null, project_id: null, collection_id: null, metadata: {}, is_read: false, read_at: null, created_at: "2026-11-04T11:59:00Z" });
  world.notifications[0].recipient_id = (await import("../tier2/support/supabaseStub")).ME.id;
  await installWorld(page, world, { signedIn: true });
  await page.goto("/notifications");

  // The Activity page's row (SV-20), unchanged: who, the fixed words, and the topic's heading.
  const row = page.getByTestId("activity-row").filter({ hasText: "@kit replied to your topic" });
  await expect(row).toContainText("Post number 1");
  await expect(row).toHaveAttribute("href", "/openbuilds/topics/p1#reply-r12");
  await row.click();
  await expect(page).toHaveURL(/\/openbuilds\/topics\/p1#reply-r12$/);
  const reply = page.locator("#reply-r12");
  await expect(reply).toContainText("Reply number 12");
  await expect(reply).toBeInViewport();
});

test("Part 8: at 390, Home, a build page, a profile and Library do not scroll sideways, rows stay 44 high, and the reply box types at 16", async ({ page }) => {
  const world = newWorld();
  addReplies(world, "p2", [{ id: "r1", body: "I split the rubric into its own step, and it reads a lot better now on a phone.", minutesAgo: 20, aboutNodeId: "n1" }]);
  world.posts.find((post) => post.id === "p1")!.about_build_id = "b1";
  await page.setViewportSize({ width: 390, height: 844 });
  await installWorld(page, world, { signedIn: true });
  const sideways = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  await page.goto("/");
  const topic = page.getByRole("article", { name: "Post number 1" });
  await expect(topic).toBeVisible();
  expect(await sideways()).toBeLessThanOrEqual(0);
  // The topic's row keeps 44-high targets on a phone.
  for (const button of await topic.getByTestId("engagement-row").getByRole("button").all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await topic.getByRole("button", { name: /^Reply/ }).click();
  const field = page.getByTestId("home-reply-box").getByRole("textbox");
  expect(await field.evaluate((node) => getComputedStyle(node).fontSize)).toBe("16px");
  expect(await sideways()).toBeLessThanOrEqual(0);

  await page.goto("/b2/resume-screener");
  const discussed = page.getByRole("region", { name: "Discussed in OpenBuilds" });
  await expect(discussed).toBeVisible();
  for (const row of await discussed.getByRole("listitem").all()) expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await sideways()).toBeLessThanOrEqual(0);

  await page.goto("/profile/testviewer?tab=topics");
  await expect(page.getByRole("tab", { name: /^Topics/ }).or(page.getByRole("tab", { name: "Topics" })).first()).toBeVisible();
  expect(await sideways()).toBeLessThanOrEqual(0);

  await page.goto("/library?kind=topics");
  await expect(page.getByRole("link", { name: /^Topics/ }).or(page.getByRole("tab", { name: /^Topics/ })).first()).toBeVisible();
  expect(await sideways()).toBeLessThanOrEqual(0);
});
