// Tier 2 — messaging: open a thread, send a message, and keep realtime working.
//
// WHY THIS FILE EXISTS, AND WHY IT EXISTS NOW. The e2e skill lists "Messaging:
// open thread, send message" as tier-2 item 8, and every repaint prompt in this
// series is told to leave tiers 1 and 2 passing. `e2e/tier2/` had never been
// created — docs/retired-surfaces.md recorded the same gap at NS-P55 and nothing
// closed it since. BG-P26 repaints the messaging surface under a hard constraint
// that realtime subscriptions, presence, read-state writes and unread counting
// must not change, and a constraint with no test behind it is a wish. This file
// is the test behind it, written before the repaint so that "still works" has a
// green baseline to mean something against.
//
// WHAT EACH TEST PROTECTS, in the language of BG-P26's hard constraint 1:
//   - realtime subscriptions → "a message sent elsewhere arrives…"
//   - unread counting        → "the frame's badge carries the unread count"
//   - read-state writes      → "opening a thread marks it read"
//   - the send path          → "sending writes a message row"
// Plus the structural half of constraint 2: a bubble's max-width is load-bearing
// and is measured here, so a repaint that reaches for it goes red.
//
// NO SLEEPS. The skill is explicit — "Await the subscription rather than
// sleeping", "No waitForTimeout — wait for the condition". Every wait here is
// either a Playwright web-first assertion or `waitForSubscription()`, which
// resolves off the actual Phoenix join frame.
//
// WHAT IT DOES NOT COVER. RLS. The stub serves whatever the seed holds, so it
// cannot show that one user's threads are hidden from another; that needs a live
// dev project, and the skill's own "the RLS test is not optional" still stands as
// an open gap, not something this file quietly satisfies.

import { expect, test, type Page } from "@playwright/test";
import {
  DEFAULT_THREAD_ID,
  ME,
  THEM,
  installSupabaseStub,
  msg,
} from "./support/supabaseStub";

/** The two rooms, as the boot script in index.html reads them. */
const THEMES = ["exhibition", "dusk"] as const;

/** BG-P26 acceptance 1 names these four widths. */
const WIDTHS = [1400, 1024, 768, 390];

async function withTheme(page: Page, theme: string) {
  await page.addInitScript((value) => {
    try {
      window.localStorage.setItem("bg-theme", value as string);
    } catch {
      /* ignore */
    }
  }, theme);
}

/**
 * The thread list row for the seeded conversation. Rows are buttons whose
 * accessible name is built from the other party, the time and the preview, so
 * the role selector the skill asks for works here without adding a testid.
 */
function threadRow(page: Page) {
  return page.getByRole("button", { name: /Other Party/ }).first();
}

/**
 * Body text that exists ONLY inside the conversation.
 *
 * The newest message doubles as the thread list's preview, so waiting on it
 * from a thread route matches two elements and trips strict mode. The first
 * message of the history is unambiguous, and its presence means the same thing:
 * the conversation has rendered.
 */
const CONVERSATION_READY = "first of a run";

test.describe("the thread list", () => {
  test("lists the threads the signed-in user belongs to", async ({ page }) => {
    await installSupabaseStub(page);
    await page.goto("/messages");

    await expect(threadRow(page)).toBeVisible();
    await expect(threadRow(page)).toContainText("the last thing they said");
  });

  test("carries the thread's unread count", async ({ page }) => {
    await installSupabaseStub(page);
    await page.goto("/messages");

    // getThreads counts the two messages from the other party that landed after
    // last_read_at. Scoped to the row itself, so the frame's own badge cannot
    // satisfy this assertion by accident.
    await expect(threadRow(page)).toBeVisible();
    await expect(threadRow(page)).toContainText("2");
  });

  test("opens a conversation when a thread is chosen", async ({ page }) => {
    await installSupabaseStub(page);
    await page.goto("/messages");

    await threadRow(page).click();

    await expect(page.getByText("my reply, the other side")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(DEFAULT_THREAD_ID));
  });
});

test.describe("the conversation", () => {
  test("renders the thread's history, both sides of it", async ({ page }) => {
    await installSupabaseStub(page);
    await page.goto(`/messages/${DEFAULT_THREAD_ID}`);

    await expect(page.getByText(CONVERSATION_READY)).toBeVisible();
    await expect(page.getByText("my reply, the other side")).toBeVisible();
    await expect(page.getByText("third of the same run")).toBeVisible();
  });

  test("holds message bubbles to a readable width", async ({ page }) => {
    await installSupabaseStub(page);
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`/messages/${DEFAULT_THREAD_ID}`);

    const bubble = page.getByText("my reply, the other side").first();
    await expect(bubble).toBeVisible();

    // Structural, not visual: BG-P26 may change a bubble's radius and colour but
    // is told in as many words that its max-width is not its to touch. A bubble
    // that has grown to the full column width is the regression this catches.
    const box = await bubble.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThan(viewport.width * 0.75);
  });
});

test.describe("realtime still delivers", () => {
  test("a message sent elsewhere arrives in the open thread", async ({ page }) => {
    const stub = await installSupabaseStub(page);
    await page.goto(`/messages/${DEFAULT_THREAD_ID}`);
    await expect(page.getByText(CONVERSATION_READY)).toBeVisible();

    // Await the join frame rather than sleeping, then push the INSERT the
    // broker would have pushed. This is BG-P26 acceptance 2: the message is
    // "sent in one context" (here, straight onto the socket) and has to "arrive
    // in another" (the open thread) through the app's own subscription.
    await stub.waitForSubscription();
    await stub.deliver(
      "dm_messages",
      msg(DEFAULT_THREAD_ID, THEM.id, "sent from another context", new Date().toISOString())
    );

    // Scoped to a message body, not to the page. The arriving message is also
    // the thread's newest, so `useThreadListUpdates` refetches and the same text
    // appears in the list's preview a moment later — matching page-wide is a
    // race against that second render. A bubble is a <p>; the list preview is a
    // <span> inside the row button. Asserting on the bubble also says the
    // stronger thing: the message reached the CONVERSATION, not merely the list.
    const inThread = page.locator("p").filter({ hasText: "sent from another context" });
    await expect(inThread.first()).toBeVisible();
  });

  test("the thread list subscribes too, so a new thread's message reaches it", async ({ page }) => {
    const stub = await installSupabaseStub(page);
    await page.goto("/messages");
    await expect(threadRow(page)).toBeVisible();

    await stub.waitForSubscription();

    // useThreadListUpdates opens its own channel; losing it is a silent failure
    // in which the list simply stops moving, so assert the channel is there.
    const topics = stub.joinedTopics();
    expect(topics.some((t) => t.includes("thread-list-updates"))).toBe(true);
  });

  test("the thread view opens a channel scoped to that thread", async ({ page }) => {
    const stub = await installSupabaseStub(page);
    await page.goto(`/messages/${DEFAULT_THREAD_ID}`);
    await expect(page.getByText(CONVERSATION_READY)).toBeVisible();
    await stub.waitForSubscription();

    const topics = stub.joinedTopics();
    expect(topics.some((t) => t.includes(DEFAULT_THREAD_ID))).toBe(true);
  });
});

test.describe("unread counting reaches the frame", () => {
  test("the frame's messages badge carries the unread count", async ({ page }) => {
    await installSupabaseStub(page);
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/");

    // BG-P26 acceptance 3, and the one thing the prompt puts under DO NOT TOUCH
    // twice. useUnreadMessages sums unread_count_a/b across accepted,
    // non-deleted threads; the seed's single thread carries 2.
    // The rail's items are `.fs-nav-item` divs rather than links, so there is no
    // role to select on. `.fs-*` are FlatShell's own frame classes — the ones
    // BG-P14's tier-1 spec already measures the frame through, and not the
    // `.ns-*` classes the e2e skill forbids. Selecting here beats adding a
    // testid to a component BG-P26 lists under DO NOT TOUCH.
    const item = page.locator(".fs-nav-item").filter({ hasText: "Messages" });
    await expect(item).toBeVisible();
    await expect(item).toContainText("2");
  });
});

test.describe("read state still writes", () => {
  test("opening a thread marks it read", async ({ page }) => {
    const stub = await installSupabaseStub(page);
    await page.goto(`/messages/${DEFAULT_THREAD_ID}`);
    await expect(page.getByText(CONVERSATION_READY)).toBeVisible();

    // Two writes, both of which the unread count depends on: the member row's
    // last_read_at (what getThreads counts from) and the thread's denormalised
    // counter (what the frame's badge sums). A repaint that unmounts whatever
    // fires these would leave threads permanently unread.
    await expect
      .poll(() => stub.patched("dm_thread_members").length, { timeout: 15_000 })
      .toBeGreaterThan(0);
    expect(stub.patched("dm_thread_members")[0].body).toHaveProperty("last_read_at");

    await expect
      .poll(() => stub.patched("dm_threads").length, { timeout: 15_000 })
      .toBeGreaterThan(0);
  });
});

test.describe("the composer", () => {
  test("sending a message writes a message row", async ({ page }) => {
    const stub = await installSupabaseStub(page);
    await page.goto(`/messages/${DEFAULT_THREAD_ID}`);
    await expect(page.getByText(CONVERSATION_READY)).toBeVisible();

    // MessageInputBar's textarea, by its placeholder; Enter without shift sends.
    const box = page.getByPlaceholder(/Message/).first();
    await expect(box).toBeVisible();
    await box.fill("a message typed by the test");
    await box.press("Enter");

    await expect
      .poll(() => stub.inserted("dm_messages").length, { timeout: 15_000 })
      .toBeGreaterThan(0);
    const sent = stub.inserted("dm_messages");
    expect(JSON.stringify(sent)).toContain("a message typed by the test");
    expect(sent[0].sender_id).toBe(ME.id);
  });
});

test.describe("both rooms, every width", () => {
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      test(`/messages renders without horizontal overflow at ${width}px on ${theme}`, async ({
        page,
      }) => {
        await withTheme(page, theme);
        await installSupabaseStub(page);
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/messages/${DEFAULT_THREAD_ID}`);
        await expect(page.getByText(CONVERSATION_READY)).toBeVisible();

        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth
        );
        expect(overflow).toBeLessThanOrEqual(1);
      });
    }
  }
});
