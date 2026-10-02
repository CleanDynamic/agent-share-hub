// UI-P31 — Rebuild and lineage's view model: the family, its geometry, what
// changed (line for line with serialiseChangeSet) and the gate as a figure.

import { describe, expect, it } from "vitest";

import {
  NO_CHANGES_REASON,
  changeSet,
  rebuildReadiness,
  serialiseChangeSet,
  type BuildRecord,
  type NodeTree,
  type NodeType,
  type RebuildTreeNode,
} from "@/lib/build";

import {
  NODE_GAP,
  NODE_HEIGHT,
  NODE_WIDTH,
  ROW_STEP,
  ROW_TOP,
  changeGroups,
  changesEyebrow,
  familyRows,
  familyStats,
  familySubtitle,
  familyView,
  fieldValue,
  layoutFamily,
  readinessView,
} from "./rebuildModel";

const NOW = Date.parse("2026-09-30T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

function treeNode(id: string, children: RebuildTreeNode[] = [], over: Partial<RebuildTreeNode> = {}): RebuildTreeNode {
  return {
    id,
    parent_build_id: null,
    depth: 0,
    slug: `slug-${id}`,
    title: `Build ${id}`,
    creator_id: `maker-${id}`,
    published_at: daysAgo(30),
    reproduction_count: 1,
    rebuild_note: null,
    maker: { id: `maker-${id}`, username: `m${id}`, display_name: null, avatar_url: null },
    children,
    ...over,
  };
}

describe("the family", () => {
  const root = treeNode("root", [
    treeNode("late", [], { parent_build_id: "root", depth: 1, reproduction_count: 0 }),
    treeNode("early", [], { parent_build_id: "root", depth: 1 }),
  ]);
  const clocks = new Map([
    ["root", { created_at: daysAgo(90), last_confirmed_at: daysAgo(2) }],
    ["late", { created_at: daysAgo(5), last_confirmed_at: null }],
    ["early", { created_at: daysAgo(40), last_confirmed_at: daysAgo(200) }],
  ]);

  it("names makers, counts and lamps from the data, siblings oldest first, and hangs the draft under its source", () => {
    const family = familyView(root, {
      clocks,
      now: NOW,
      draft: { id: "draft", slug: "draft-slug", title: "My rebuild", parentId: "early" },
      currentId: "root",
    });
    expect(family?.children.map((child) => child.id)).toEqual(["early", "late"]);
    expect(family?.lamp).toBe("healthy");
    expect(family?.current).toBe(true);
    expect(family?.children[0].lamp).toBe("stale");
    expect(family?.children[1].lamp).toBe("unreproduced");
    expect(family?.maker).toBe("@mroot");
    const draft = family?.children[0].children[0];
    expect(draft).toMatchObject({ id: "draft", maker: "you · draft", reproduced: 0, lamp: "draft", draft: true, to: "/b2/draft-slug" });
  });

  it("counts builds and generations, and lists them root first, each child and its family", () => {
    const family = familyView(root, { clocks, now: NOW, draft: { id: "d", slug: "d", title: "D", parentId: "late" } });
    expect(familyStats(family)).toEqual({ builds: 4, generations: 3 });
    expect(familySubtitle(family)).toBe("4 builds · 3 generations · lamps show which still work");
    expect(familyRows(family).map((row) => [row.node.id, row.depth])).toEqual([
      ["root", 0],
      ["early", 1],
      ["late", 1],
      ["d", 2],
    ]);
  });

  it("draws nothing for no family, and never draws the draft twice", () => {
    expect(familyView(null)).toBeNull();
    const own = familyView(treeNode("draft"), { draft: { id: "draft", slug: "d", title: "D", parentId: "x" } });
    expect(familyRows(own)).toHaveLength(1);
  });
});

describe("the tree's geometry", () => {
  const view = familyView(
    treeNode("a", [
      treeNode("b", [treeNode("d", [], { depth: 2 }), treeNode("e", [], { depth: 2 })], { depth: 1 }),
      treeNode("c", [], { depth: 1 }),
    ]),
    { now: NOW },
  )!;
  const layout = layoutFamily(view);
  const at = (id: string) => layout.nodes.find((placed) => placed.node.id === id)!;
  const centre = (id: string) => at(id).x + NODE_WIDTH / 2;

  it("stands each generation at 18 + 150·g, and each parent centred over its children", () => {
    expect([at("a").y, at("b").y, at("d").y]).toEqual([ROW_TOP, ROW_TOP + ROW_STEP, ROW_TOP + 2 * ROW_STEP]);
    expect(centre("b")).toBe((centre("d") + centre("e")) / 2);
    expect(centre("a")).toBe((centre("b") + centre("c")) / 2);
  });

  it("keeps nodes in one generation at least 40 apart", () => {
    const rows = new Map<number, number[]>();
    for (const placed of layout.nodes) rows.set(placed.y, [...(rows.get(placed.y) ?? []), placed.x]);
    for (const xs of rows.values()) {
      const sorted = [...xs].sort((p, q) => p - q);
      for (let i = 1; i < sorted.length; i += 1) expect(sorted[i] - (sorted[i - 1] + NODE_WIDTH)).toBeGreaterThanOrEqual(NODE_GAP);
    }
    expect(layout.width).toBe(3 * (NODE_WIDTH + NODE_GAP) - NODE_GAP);
  });

  it("joins parent to child with one curve, bottom centre to top centre", () => {
    const link = layout.links.find((candidate) => candidate.key === "a>c")!;
    const x1 = centre("a");
    const y1 = at("a").y + NODE_HEIGHT;
    const x2 = centre("c");
    const y2 = at("c").y;
    expect(link.d).toBe(`M ${x1} ${y1} C ${x1} ${y1 + 26}, ${x2} ${y2 - 26}, ${x2} ${y2}`);
    expect(layout.links).toHaveLength(4);
  });
});

/* ── what changed ── */

const types = [
  { key: "system_prompt", label: "System prompt", category: "instruction", schema: { fields: [{ key: "text", label: "Text", type: "text" }] } },
  {
    key: "agent_config",
    label: "Agent configuration",
    category: "configuration",
    schema: { fields: [{ key: "model", label: "Model", type: "string" }, { key: "rules", label: "Rules", type: "list" }] },
  },
  { key: "result", label: "Result", category: "evidence", schema: { fields: [{ key: "summary", label: "Summary", type: "text" }] } },
  { key: "dataset", label: "Dataset", category: "data", schema: { fields: [{ key: "rows", label: "Currencies", type: "list" }] } },
] as unknown as NodeType[];

function n(id: string, type: string, title: string, payload: Record<string, unknown> = {}): NodeTree {
  return {
    id, build_id: "b", parent_id: null, position: 0, type, title, note: null, payload,
    source_ref: null, event_id: null, is_gap: false, created_at: "", children: [],
  } as unknown as NodeTree;
}

function record(id: string, title: string, outcome: string, tree: NodeTree[]): BuildRecord {
  return {
    build: { id, title, outcome, hero_node_id: null, cover_media_id: null, forked_from_event_id: null, shape: "agent", made_for: [], made_with: [] },
    tree,
    tray: [],
    events: [],
    nodeTypes: types,
  } as unknown as BuildRecord;
}

const source = record("src", "Invoice triage agent", "Routes invoices.", [
  n("s1", "system_prompt", "System prompt", { text: "You triage invoices." }),
  n("s2", "agent_config", "Routing rules", { model: "sonnet-4.5", rules: ["a", "b"] }),
  n("s3", "result", "Routing sheet", { summary: "It routed them." }),
]);
const draft = record("dr", "Multi-currency triage", "Routes invoices.", [
  n("d1", "system_prompt", "System prompt", { text: "You triage invoices." }),
  n("d2", "agent_config", "Routing rules", { model: "opus-5", rules: ["a", "b", "c"] }),
  n("d4", "dataset", "Currency table", { rows: Array.from({ length: 38 }, (_, i) => i) }),
]);

describe("what changed", () => {
  const changes = changeSet(source, draft);
  const groups = changeGroups(source, draft, changes);

  it("is serialiseChangeSet()'s output, line for line: the same keys in the same order", () => {
    const rows = groups.flatMap((group) => group.rows);
    expect(rows.map((row) => row.key)).toEqual(serialiseChangeSet(changes).map((line) => line.key));
    expect(changesEyebrow(groups)).toBe(`Δ ${rows.length} changes`);
  });

  it("names each part and says how it moved, in columns", () => {
    const rows = groups.flatMap((group) => group.rows);
    expect(groups.map((group) => group.label)).toEqual(["Parts", "Header"]);
    expect(rows.find((row) => row.name === "Routing rules")).toMatchObject({ kind: "changed", value: "sonnet-4.5 → opus-5 · 1 more" });
    expect(rows.find((row) => row.name === "Currency table")).toMatchObject({ kind: "added", value: "data · 38 currencies" });
    expect(rows.find((row) => row.name === "Routing sheet")).toMatchObject({ kind: "removed", value: "evidence" });
    expect(rows.find((row) => row.name === "Title")).toMatchObject({ kind: "changed", value: "Invoice triage agent → Multi-currency triage" });
  });

  it("reads a list's move as counts, a short value as itself, and prose in words", () => {
    expect(fieldValue({ key: "rules", label: "Rules", before: '["a","b"]', after: '["a","b","c"]' })).toBe("2 → 3 rules");
    expect(fieldValue({ key: "model", label: "Model", before: "sonnet-4.5", after: null })).toBe("sonnet-4.5 → —");
    expect(fieldValue({ key: "text", label: "Text", before: "one two three four five six seven eight nine", after: "one two" })).toBe(
      "Text: 9 → 2 w",
    );
  });
});

describe("readiness", () => {
  it("is the share of the gate met, the count of what is left, and the first thing missing", () => {
    const changes = changeSet(source, draft);
    const ready = readinessView(rebuildReadiness(source, draft, changes), changes);
    // Evidence went with the result: one of the three base requirements is open, the rebuild changed things.
    expect(ready).toEqual({ pct: 75, headline: "One thing before it can hang", next: expect.stringMatching(/^Add one piece of evidence/), ready: false });

    const untouched = changeSet(source, source);
    const same = readinessView(rebuildReadiness(source, source, untouched), untouched);
    expect(same).toEqual({ pct: 75, headline: "One thing before it can hang", next: NO_CHANGES_REASON, ready: false });

    const empty = record("e", "Empty", "", []);
    const none = changeSet(empty, empty);
    expect(readinessView(rebuildReadiness(empty, empty, none), none)).toMatchObject({ pct: 0, headline: "4 things before it can hang" });
  });

  it("says it is ready to hang only when the gate is open", () => {
    const withEvidence = record("dr2", "Multi-currency triage", "Routes invoices.", [
      ...draft.tree,
      n("d5", "result", "Run log", { summary: "120 invoices." }),
    ]);
    const changes = changeSet(source, withEvidence);
    expect(readinessView(rebuildReadiness(source, withEvidence, changes), changes)).toEqual({
      pct: 100,
      headline: "Ready to hang",
      next: null,
      ready: true,
    });
  });
});
