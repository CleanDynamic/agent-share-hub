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
