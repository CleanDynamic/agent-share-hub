// UX-06, in a real browser: the post page. Opened from the feed; the Thread and the Wall switched with the address changing and
// nothing fading.
//
// The backend is the in-memory world in support/openbuildsWorld.ts (UX-05's), which now answers getPost.

import { expect, test } from "@playwright/test";

import { addReplies, installWorld, newWorld } from "./support/openbuildsWorld";

test("a post opens from the feed, and the Thread and the Wall switch in the address with no fade", async ({ page }) => {
  const world = newWorld();
  addReplies(world, "p1", [
    { id: "r1", body: "I split the rubric into its own step.", minutesAgo: 50, build: "b1" },
    { id: "r2", body: "Same here, it halves the time.", minutesAgo: 40, author: "me" },
    { id: "r3", parent: "r1", body: "Which model did you score with?", minutesAgo: 30, author: "me" },
  ]);
  await installWorld(page, world, { signedIn: false });
  await page.goto("/openbuilds");

  await page.getByRole("link", { name: "Post number 1" }).click();
  await expect(page).toHaveURL(/\/openbuilds\/topics\/p1$/);
  await expect(page.getByRole("heading", { level: 1, name: "Post number 1" })).toBeVisible();
  await expect(page.getByText("I split the rubric into its own step.")).toBeVisible();
  await expect(page.getByRole("list", { name: /Replies to / }).getByText("Which model did you score with?")).toBeVisible();

  // Nothing is moving once the page has arrived.
  const moving = () =>
    page.evaluate(() => {
      const root = document.querySelector('[data-testid="openbuilds-post"]');
      return root ? root.getAnimations({ subtree: true }).length + (root.closest("main")?.getAnimations().length ?? 0) : -1;
    });
  await expect.poll(moving).toBe(0);

  await page.getByRole("button", { name: "Wall · 1 build" }).click();
  await expect(page).toHaveURL(/\/openbuilds\/topics\/p1\?view=wall$/);
  await expect(page.getByRole("region", { name: "Wall" }).getByTestId("wall-card")).toHaveCount(1);
  expect(await moving()).toBe(0);

  await page.getByRole("button", { name: /^Thread · / }).click();
  await expect(page).toHaveURL(/\/openbuilds\/topics\/p1$/);
  await expect(page.getByRole("region", { name: "Thread" })).toBeVisible();
  expect(await moving()).toBe(0);
});

test("the old address opens the same page", async ({ page }) => {
  const world = newWorld();
  await installWorld(page, world, { signedIn: false });
  await page.goto("/openbuilds/posts/p2");
  await expect(page).toHaveURL(/\/openbuilds\/topics\/p2$/);
  await expect(page.getByRole("heading", { level: 1, name: "Post number 2" })).toBeVisible();
});

test("a reader replies on a step of the post's build and sees the reply marked on that step", async ({ page }) => {
  const world = newWorld();
  world.posts[0].attachments = [{ position: 0, kind: "build", build_id: "b1", node_id: null, part_key: null, session_key: null, media_path: null, media_kind: null, snapshot: null }];
  await installWorld(page, world, { signedIn: true });
  await page.goto("/openbuilds/topics/p1");
  await expect(page.getByRole("heading", { level: 1, name: "Post number 1" })).toBeVisible();

  await page.getByRole("button", { name: "Step 2 · Code, Rubric" }).click();
  await page.getByRole("menuitem", { name: "Reply on this step" }).click();
  const box = page.getByTestId("reply-box");
  await expect(box.getByText("On Step 2 · Code")).toBeVisible();
  await box.getByPlaceholder("Reply with words, work, or both").fill("Split the rubric into weights.");
  await box.getByRole("button", { name: "Reply", exact: true }).click();

  const reply = page.getByTestId("reply").filter({ hasText: "Split the rubric into weights." });
  await expect(reply.getByTestId("reply-about")).toHaveText("Step 2 · Code");
  expect(world.created.rpc.at(-1)).toMatchObject({ parent_id: "p1", about_node_id: "n2", body: "Split the rubric into weights." });
  // Once the server answers, the page reads the thread again and the reply is still marked.
  await expect.poll(() => world.posts.some((post) => post.parent_id === "p1" && post.about_node_id === "n2")).toBe(true);
  await expect(reply.getByTestId("reply-about")).toHaveText("Step 2 · Code");
  // The step now counts its reply.
  await expect(page.getByRole("button", { name: "Step 2 · Code, Rubric, 1 reply" })).toBeVisible();
});

test("a step tile made in a reply is saved as a draft, and the draft is in Drafts", async ({ page }) => {
  const world = newWorld();
  await installWorld(page, world, { signedIn: true });
  await page.goto("/openbuilds/topics/p1");
  await expect(page.getByRole("heading", { level: 1, name: "Post number 1" })).toBeVisible();

  const box = page.getByTestId("reply-box");
  await box.getByRole("button", { name: "Make a step tile" }).click();
  const editor = box.getByRole("region", { name: "Step tile" });
  await expect(editor.getByText("Saved to Drafts")).toBeVisible();
  await editor.getByLabel("Prompt").fill("Score each CV against the rubric, one line per criterion.");
  await editor.getByRole("button", { name: "Harness: No harness chosen" }).click();
  await page.getByRole("menuitemradio", { name: "Claude Code" }).click();
  await expect(editor.getByRole("button", { name: "Harness: Claude Code" })).toBeVisible();
  await box.getByRole("button", { name: "Reply", exact: true }).click();

  const reply = page.getByTestId("reply").filter({ hasText: "Score each CV against the rubric" });
  await expect(reply).toBeVisible();
  await expect.poll(() => world.created.rpc.length).toBe(1);

  // One draft, named after the post, with one session and the one tile; the reply attaches that tile.
  const drafts = world.builds.filter((build) => build.status === "draft");
  expect(drafts.map((build) => build.title)).toEqual(["Reply: Post number 1"]);
  const tiles = world.nodes.filter((node) => node.build_id === drafts[0].id);
  expect(tiles).toHaveLength(1);
  expect(tiles[0]).toMatchObject({ type: "prompt", payload: { text: "Score each CV against the rubric, one line per criterion." } });
  expect(world.sessions.filter((session) => session.build_id === drafts[0].id)).toHaveLength(1);
  expect(world.created.rpc[0].attachments[0]).toMatchObject({ kind: "step", build_id: drafts[0].id, node_id: tiles[0].id });

  // UX-09 P3: the draft remembers its topic, and Drafts says so under its title.
  await expect.poll(() => world.builds.find((build) => build.id === drafts[0].id)?.made_for_topic_id).toBe("p1");

  await page.goto("/drafts");
  await expect(page.getByText("Reply: Post number 1").first()).toBeVisible();
  await expect(page.getByTestId("draft-for-topic")).toHaveText("For @kit's topic");
});

test("a reader adds someone's step from a reply to a draft and finds it in the composer", async ({ page }) => {
  const world = newWorld();
  addReplies(world, "p1", [{ id: "r1", body: "This is the rubric step I use.", minutesAgo: 30, step: "n2" }]);
  world.builds.push({ id: "d-mine", slug: "my-screener", title: "My screener", status: "draft", creator_id: "00000000-0000-4000-8000-00000000beef", making: {}, made_with: [], reproduction_count: 0, session_count: 0, parent_build_id: null, updated_at: "2026-11-04T11:00:00Z", created_at: "2026-11-01T00:00:00Z" });
  await installWorld(page, world, { signedIn: true });
  await page.goto("/openbuilds/topics/p1");

  const reply = page.getByTestId("reply").filter({ hasText: "This is the rubric step I use." });
  await reply.getByRole("button", { name: "Add to a draft" }).click();
  await page.getByRole("menuitem", { name: "My screener" }).click();
  await expect(page.getByText("Added to My screener.")).toBeVisible();

  // The copy is in the draft, credited to the step's source.
  await expect.poll(() => world.nodes.filter((node) => node.build_id === "d-mine").length).toBe(1);
  expect(world.nodes.find((node) => node.build_id === "d-mine")).toMatchObject({ type: "code", title: "Rubric", source_ref: { node_id: "n2", build_id: "b1", saved_item_id: null } });

  await page.getByRole("button", { name: "Open draft" }).click();
  await expect(page).toHaveURL(/\/compose\/d-mine$/);
  await expect(page.getByText("Rubric").first()).toBeVisible();
});

test("the Wall draws the builds in replies, and Reply with a build opens the picker at Build", async ({ page }) => {
  const world = newWorld();
  addReplies(world, "p1", [
    { id: "r1", body: "Mine, with the rubric split out.", minutesAgo: 50, build: "b1" },
    { id: "r2", body: "Words only.", minutesAgo: 40 },
  ]);
  await installWorld(page, world, { signedIn: true });
  await page.goto("/openbuilds/topics/p1?view=wall");

  const wall = page.getByRole("region", { name: "Wall" });
  const card = wall.getByTestId("wall-card");
  await expect(card).toHaveCount(1);
  await expect(card.getByRole("heading", { name: "Resume screener" })).toBeVisible();
  await expect(card.getByText("Claude Code · new build")).toBeVisible();
  await expect(card.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/b2/resume-screener");

  await expect(wall.getByText("Built something for this? Reply with a build.")).toBeVisible();
  await wall.getByRole("button", { name: "Reply with a build" }).click();
  const picker = page.getByRole("dialog", { name: "Attach work" });
  await expect(picker).toBeVisible();
  await expect(picker.getByRole("button", { name: "Build", pressed: true })).toBeVisible();
  // The box took the way in's place and carries the one primary.
  await expect(wall.getByRole("button", { name: "Reply with a build" })).toHaveCount(0);
  await expect(page.locator('[data-visual-slot="btn-primary"]')).toHaveCount(1);
});

test("at 390 wide the page is one column with no sideways scroll, on the Thread and the Wall", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const world = newWorld();
  world.posts[0].attachments = [{ position: 0, kind: "build", build_id: "b1", node_id: null, part_key: null, session_key: null, media_path: null, media_kind: null, snapshot: null }];
  addReplies(world, "p1", [
    { id: "r1", body: "I split the rubric into its own step, and here is a long line of words that has to wrap inside the phone's column.", minutesAgo: 50, build: "b1" },
    { id: "r2", body: "Same here.", minutesAgo: 40, author: "me", aboutNodeId: "n2" },
    { id: "r3", parent: "r1", body: "Which model did you score with?", minutesAgo: 30, author: "me" },
  ]);
  await installWorld(page, world, { signedIn: true });
  await page.goto("/openbuilds/topics/p1");
  await expect(page.getByRole("heading", { level: 1, name: "Post number 1" })).toBeVisible();

  const sideways = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await expect(page.getByTestId("openbuilds-post")).toHaveAttribute("data-layout", "one");
  expect(await sideways()).toBeLessThanOrEqual(0);

  // The switch spans the column at 44 high; the side column comes after the replies.
  const show = page.getByRole("group", { name: "Show" });
  const thread = page.getByRole("button", { name: /^Thread · / });
  expect((await thread.boundingBox())?.height).toBe(44);
  const column = await page.getByRole("region", { name: "Thread" }).boundingBox();
  expect(Math.abs(((await show.boundingBox())?.width ?? 0) - (column?.width ?? 0))).toBeLessThanOrEqual(1);
  const side = await page.getByRole("complementary", { name: "About this post" }).boundingBox();
  expect(side!.y).toBeGreaterThan(column!.y + column!.height - 1);

  await page.getByRole("button", { name: "Wall · 1 build" }).click();
  await expect(page.getByTestId("wall-card")).toHaveCount(1);
  expect(await sideways()).toBeLessThanOrEqual(0);
  await expect(page.getByRole("checkbox", { name: "Line up steps" })).toHaveCount(0);
});
