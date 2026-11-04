// UX-06: the post page's model. Part 1: replies oldest first with pinned ones first, the step filter, two levels drawn and a
// deeper branch counted, and the address.

import { describe, expect, it } from "vitest";

import type { CardBuildFacts } from "@/lib/openbuilds/cardWork";
import type { WallBuildFacts } from "@/lib/openbuilds/postPage";

import { NOW, attachment, entry, postNodes, work } from "./postModel.fixtures";
import { postSearch, wallCards, readPostAddress, repliesByStep, stepsOf, threadItems, threadOrder, type ThreadContext } from "./postModel";

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

/* ── Part 5: the Wall ── */


const cardFacts = (id: string, slug: string, title: string): CardBuildFacts => ({ id, slug, title, madeWith: "Claude Code", status: "published", reproduction_count: 2, last_confirmed_at: "2026-11-01T00:00:00Z", last_confirmed_model: null, published_at: "2026-10-01T00:00:00Z" });
const wallFacts = (id: string, parent: string | null, handle: string | null): WallBuildFacts => ({ id, slug: id, title: id, status: "published", creatorId: "x", parentBuildId: parent, sourceHandle: handle });

describe("the Wall's cards", () => {
  const thread = entry("p1", 200, {
    parentId: null,
    attachments: [attachment("build", { buildId: "b-post" })],
    replies: [
      entry("kit", 90, { attachments: [attachment("build", { buildId: "b-kit" })] }),
      entry("ola", 80, { body: "Words only" }),
      entry("jo", 70, { attachments: [attachment("build", { buildId: "b-jo" })], pinnedBy: "sam", pinnedAt: "2026-11-04T11:00:00Z" }),
      entry("ana", 20, { attachments: [attachment("build", { buildId: "b-ana-draft", snapshot: { type: "build", title: "Ana's screener", children: [{ id: "c1", payload: { session: "s1" } }, { id: "c2", payload: { session: "s2" } }, { id: "c3", payload: { session: "s2" } }] } })] }),
    ],
  });
  const extras = {
    work: { builds: new Map([["b-kit", cardFacts("b-kit", "kits-screener", "Kit's screener")], ["b-jo", cardFacts("b-jo", "jos-screener", "Jo's screener")]]), nodes: new Map() },
    facts: new Map([["b-kit", wallFacts("b-kit", "b-post", "maya")], ["b-jo", wallFacts("b-jo", null, null)]]),
  };

  it("draws only the replies that hold builds, pinned first", () => {
    expect(wallCards(thread, extras, NOW).map((card) => card.replyId)).toEqual(["jo", "kit", "ana"]);
  });

  it("names a rebuild's source and a new build as new", () => {
    const [jo, kit] = wallCards(thread, extras, NOW);
    expect(kit).toMatchObject({ kind: "published", title: "Kit's screener", line: "Claude Code · Rebuilt from @maya", to: "/b2/kits-screener", rebuildTo: "/rebuild/kits-screener", pinned: false });
    expect(jo).toMatchObject({ kind: "published", line: "Claude Code · new build", pinned: true });
    expect(kit.kind === "published" ? kit.plaque?.reproduction_count : null).toBe(2);
  });

  it("draws a build attached from a draft as in progress, with its sessions and when it was updated", () => {
    const ana = wallCards(thread, extras, NOW)[2];
    expect(ana).toMatchObject({ kind: "in-progress", title: "Ana's screener", line: "In progress · 2 sessions", updated: "updated 20m ago" });
  });
});
