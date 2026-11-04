// UX-06: the post page's model. Part 1: replies oldest first with pinned ones first, the step filter, two levels drawn and a
// deeper branch counted, and the address.

import { describe, expect, it } from "vitest";

import type { CardBuildFacts } from "@/lib/openbuilds/cardWork";
import type { WallBuildFacts } from "@/lib/openbuilds/postPage";

import { NOW, attachment, entry, postNodes, work } from "./postModel.fixtures";
import type { LineStepRow } from "@/lib/openbuilds/postPage";

import { lineUpOf, lineUpOffered, rebuildsInReplies, postSearch, wallCards, readPostAddress, repliesByStep, stepsOf, threadItems, threadOrder, type ThreadContext } from "./postModel";

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

/* ── Part 6: Line up steps ── */

const row = (buildId: string, id: string, position: number, type: string, title: string, words: string, extra: Partial<LineStepRow> = {}): LineStepRow => ({
  id,
  build_id: buildId,
  parent_id: null,
  type,
  title,
  position,
  is_gap: false,
  tested: null,
  setup: null,
  step: null,
  text: type === "prompt" ? words : null,
  source: type === "code" ? words : null,
  ...extra,
});

describe("Line up steps", () => {
  const replies = [
    entry("kit", 90, { attachments: [attachment("build", { buildId: "b-kit" })] }),
    entry("ola", 80, { attachments: [attachment("build", { buildId: "b-ola" })] }),
    entry("jo", 70, { attachments: [attachment("build", { buildId: "b-jo" })] }),
    entry("new", 60, { attachments: [attachment("build", { buildId: "b-new" })] }),
  ];
  const thread = entry("p1", 200, { parentId: null, attachments: [attachment("build", { buildId: "b-post" })], replies });
  const facts = new Map([
    ["b-kit", { id: "b-kit", slug: "k", title: "k", status: "published", creatorId: "kit", parentBuildId: "b-post", sourceHandle: "sam" }],
    ["b-ola", { id: "b-ola", slug: "o", title: "o", status: "published", creatorId: "ola", parentBuildId: "b-post", sourceHandle: "sam" }],
    ["b-jo", { id: "b-jo", slug: "j", title: "j", status: "published", creatorId: "jo", parentBuildId: "b-post", sourceHandle: "sam" }],
    ["b-new", { id: "b-new", slug: "n", title: "n", status: "published", creatorId: "x", parentBuildId: null, sourceHandle: null }],
  ]);
  const steps = new Map([
    ["b-post", [row("b-post", "p1s", 0, "prompt", "Take the CV", "Read the CV."), row("b-post", "p2s", 1, "code", "Rubric", "score = 0"), row("b-post", "p3s", 2, "prompt", "Score", "Score it."), row("b-post", "p4s", 3, "prompt", "Summarise", "Sum up.")]],
    // Kit changed Step 4's words; Ola changed Step 2 to a prompt and Step 4's words; Jo has Step 3 still open and changed Step 4.
    ["b-kit", [row("b-kit", "k1", 0, "prompt", "Take the CV", "Read the CV."), row("b-kit", "k2", 1, "code", "Rubric", "score = 0"), row("b-kit", "k3", 2, "prompt", "Score", "Score it."), row("b-kit", "k4", 3, "prompt", "Summarise", "Sum up in three lines."), row("b-kit", "k5", 4, "prompt", "Email", "Send it.")]],
    ["b-ola", [row("b-ola", "o1", 0, "prompt", "Take the CV", "Read the CV."), row("b-ola", "o2", 1, "prompt", "Rubric", "Ask for a score."), row("b-ola", "o3", 2, "prompt", "Score", "Score it."), row("b-ola", "o4", 3, "prompt", "Summarise", "Sum it up briefly.")]],
    ["b-jo", [row("b-jo", "j1", 0, "prompt", "Take the CV", "Read the CV."), row("b-jo", "j2", 1, "code", "Rubric", "score = 0"), row("b-jo", "j3", 2, "prompt", "Score", "", { is_gap: true }), row("b-jo", "j4", 3, "prompt", "Summarise", "Other words.")]],
  ]);

  it("is offered only with two or more rebuilds of the post's build in replies", () => {
    expect(rebuildsInReplies(thread, "b-post", facts).map((entry) => entry.buildId)).toEqual(["b-kit", "b-ola", "b-jo"]);
    expect(lineUpOffered(3)).toBe(true);
    expect(lineUpOffered(1)).toBe(false);
    expect(rebuildsInReplies(thread, null, facts)).toEqual([]);
  });

  it("marks a step changed when its kind or its words differ from the post's build at the same number", () => {
    const lineUp = lineUpOf(thread, "b-post", { steps, facts });
    expect(lineUp.steps).toBe(5);
    expect(lineUp.rows.map((entry) => entry.name)).toEqual(["The post", "@kit", "@ola", "@jo"]);
    const changed = (name: string) => lineUp.rows.find((entry) => entry.name === name)!.cells.map((cell) => (cell === null ? "-" : cell.open ? "open" : cell.changed ? "x" : "."));
    expect(changed("The post")).toEqual([".", ".", ".", ".", "-"]);
    // A step the post's build does not have is a change.
    expect(changed("@kit")).toEqual([".", ".", ".", "x", "x"]);
    expect(changed("@ola")).toEqual([".", "x", ".", "x", "-"]);
    expect(changed("@jo")).toEqual([".", ".", "open", "x", "-"]);
  });

  it("states one fact, from the finished builds only: the step changed by the most of them", () => {
    expect(lineUpOf(thread, "b-post", { steps, facts }).sentence).toBe("2 of 2 finished builds changed Step 4.");
  });

  it("says nothing when no finished build changed a step", () => {
    const same = new Map([...steps, ["b-kit", steps.get("b-post")!.map((entry) => ({ ...entry, build_id: "b-kit" }))], ["b-ola", steps.get("b-post")!.map((entry) => ({ ...entry, build_id: "b-ola" }))]]);
    expect(lineUpOf(thread, "b-post", { steps: same, facts }).sentence).toBeNull();
  });
});
