// UX-06: the post page's model. Part 1: replies oldest first with pinned ones first, the step filter, two levels drawn and a
// deeper branch counted, and the address.

import { describe, expect, it } from "vitest";

import { NOW, entry, postNodes, work } from "./postModel.fixtures";
import { postSearch, readPostAddress, repliesByStep, stepsOf, threadItems, threadOrder, type ThreadContext } from "./postModel";

const labels = new Map(stepsOf(postNodes).map((step) => [step.id, step.label]));
const context: ThreadContext = { work, signed: new Map(), liked: new Set(["b"]), now: NOW, stepLabels: labels, handleOf: (id) => (id === "maya-id" ? "maya" : null), canPin: false, canHide: false };

describe("the Thread's order", () => {
  it("puts pinned replies first, in the order they were pinned, then the rest oldest first", () => {
    const replies = [
      entry("a", 50),
      entry("b", 40, { pinnedBy: "maya-id", pinnedAt: "2026-11-04T11:30:00Z" }),
      entry("c", 30),
      entry("d", 60, { pinnedBy: "maya-id", pinnedAt: "2026-11-04T11:00:00Z" }),
      entry("e", 70),
    ];
    expect(threadOrder(replies).map((reply) => reply.id)).toEqual(["d", "b", "e", "a", "c"]);
  });

  it("draws two levels and counts what lies deeper", () => {
    const thread = entry("p1", 100, {
      parentId: null,
      replyCount: 4,
      replies: [entry("a", 50, { replyCount: 3, replies: [entry("a1", 40, { parentId: "a", replyCount: 2 }), entry("a2", 30, { parentId: "a" })] })],
    });
    const [first] = threadItems(thread, context, null);
    expect(first.depth).toBe(0);
    expect(first.children.map((child) => [child.id, child.depth, child.more])).toEqual([
      ["a1", 1, 2],
      ["a2", 1, 0],
    ]);
    // Nothing is drawn a third level in.
    expect(first.children.every((child) => child.children.length === 0)).toBe(true);
  });

  it("says who pinned a reply, whether the reader liked it, and the step it is about", () => {
    const thread = entry("p1", 100, { parentId: null, replies: [entry("b", 40, { pinnedBy: "maya-id", pinnedAt: "2026-11-04T11:30:00Z", aboutNodeId: "n4", likeCount: 2 })] });
    const [item] = threadItems(thread, context, null);
    expect(item).toMatchObject({ pinnedBy: "@maya", liked: true, likes: 2, about: "Step 4 · Prompt", age: "40m" });
  });
});

describe("the step filter", () => {
  const thread = entry("p1", 100, {
    parentId: null,
    replies: [
      entry("a", 50, { aboutNodeId: "n4", replies: [entry("a1", 45, { parentId: "a", aboutNodeId: "n4" })] }),
      entry("b", 40, { replies: [entry("b1", 35, { parentId: "b", aboutNodeId: "n4" }), entry("b2", 34, { parentId: "b", aboutNodeId: "n2" })] }),
      entry("c", 30, { aboutNodeId: "n2" }),
    ],
  });

  it("shows each reply about the step once, under a parent about it when it has one", () => {
    const items = threadItems(thread, context, "n4");
    expect(items.map((item) => item.id)).toEqual(["a", "b1"]);
    expect(items[0].children.map((child) => child.id)).toEqual(["a1"]);
  });

  it("counts the replies on each step at every depth", () => {
    expect(Object.fromEntries(repliesByStep(thread))).toEqual({ n4: 3, n2: 2 });
  });
});

describe("the address", () => {
  it("takes the space's default view, and a default leaves the address", () => {
    expect(readPostAddress(new URLSearchParams(""), "wall").tab).toBe("wall");
    expect(readPostAddress(new URLSearchParams("view=thread&step=n4"), "wall")).toMatchObject({ tab: "thread", step: "n4" });
    expect(postSearch(new URLSearchParams("step=n4"), { tab: "wall" }, "thread").toString()).toBe("view=wall");
    expect(postSearch(new URLSearchParams("view=wall&lineup=1"), { tab: "thread" }, "thread").toString()).toBe("");
  });
});
