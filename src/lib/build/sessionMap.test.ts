import { describe, expect, it } from "vitest";

import { SESSION_MAP_SIZES as S, joinedSessions, layoutSessionMap, mapSummary, readingOrder, sessionLinksOf, sessionMapModel, sessionOfTiles, tileLinksOf, type MapSession, type SessionLink } from "./sessionMap";
import type { Step } from "./graph";

const step = (over: Partial<Step> & { id: string; kind: Step["kind"]; number: string }): Step =>
  ({ title: null, defaultTitle: `${over.kind} ${over.number}`, text: "", words: 0, model: null, sessionId: null, tool: null, runs: null, uses: [], children: [], ...over }) as Step;

describe("which tiles use something from which", () => {
  const code = step({ id: "c4", kind: "code", number: "4", filename: "src/portal/api.ts" });
  const agent = step({ id: "a9", kind: "agent", number: "9", uses: [{ kind: "file", node_id: "f1" }] });
  const check = step({ id: "k5", kind: "check", number: "5", uses: [{ kind: "output", node_id: "p2" }] });
  const prompt = step({ id: "p2", kind: "prompt", number: "2" });
  const decision = step({ id: "d6", kind: "decision", number: "6", decision: { calledFrom: ["c4"] } as never });
  const steps = [prompt, code, agent, check, decision];
  const files = [{ id: "f1", name: "src/portal/api.ts", madeBy: "c4" }];

  it("reads uses, files a tile makes, checks, and a code tile's call to a decision", () => {
    const links = tileLinksOf(steps, files);
    expect(links.map((link) => link.sentence)).toEqual(["Agent 9 reads Code 4", "Check 5 tests Prompt 2", "Code 4 calls Decision 6"]);
    expect(links[0].what).toBe("src/portal/api.ts");
  });

  it("groups by session pair and leaves out tiles in the same session", () => {
    const sessionOf = sessionOfTiles(steps, (top) => ({ p2: "s1", c4: "s2", a9: "s3", k5: "s1", d6: "s2" })[top.id]);
    const grouped = sessionLinksOf(tileLinksOf(steps, files), sessionOf);
    // Check 5 and Prompt 2 are both in s1: no line. Code 4 and Decision 6 are both in s2: no line.
    expect(grouped.map((link) => link.id)).toEqual(["s2>s3"]);
    expect(grouped[0].tiles).toHaveLength(1);
  });

  it("gives one line to a pair however many tiles join them", () => {
    const more = step({ id: "a10", kind: "agent", number: "10", uses: [{ kind: "file", node_id: "f1" }, { kind: "output", node_id: "c4" }] });
    const all = [...steps, more];
    const sessionOf = sessionOfTiles(all, (top) => ({ p2: "s1", c4: "s2", a9: "s3", k5: "s1", d6: "s2", a10: "s3" })[top.id]);
    const grouped = sessionLinksOf(tileLinksOf(all, files), sessionOf);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].tiles.map((tile) => tile.sentence)).toEqual(["Agent 9 reads Code 4", "Agent 10 reads Code 4", "Agent 10 uses Code 4"]);
  });

  it("counts a tile inside another as its top-level tile's session", () => {
    const inner = step({ id: "in", kind: "prompt", number: "9.1" });
    const team = step({ id: "t9", kind: "team", number: "9", children: [inner] });
    expect(sessionOfTiles([team], () => "s9").get("in")).toBe("s9");
  });
});

/* ── the board's builds: Part A (S1 to S4) and Part B (S5, S6) ── */

const session = (number: number, part: string, over: Partial<MapSession> = {}): MapSession => ({ key: `s${number}`, number, app: "Claude", part, tiles: 1, ...over });
const link = (from: number, to: number): SessionLink => ({ id: `s${from}>s${to}`, session: `s${to}`, from: `s${from}`, tiles: [] });

function two(extra: Partial<Parameters<typeof sessionMapModel>[0]> = {}) {
  return sessionMapModel({
    sessions: [
      session(1, "a", { day: "2026-10-07" }),
      session(2, "a", { app: "Claude Code", day: "2026-10-08" }),
      session(3, "a", { app: "Lovable", day: "2026-10-08" }),
      session(4, "a", { app: "Claude Code", day: "2026-10-12" }),
      session(5, "b", { day: "2026-10-09" }),
      session(6, "b", { app: "n8n", day: "2026-10-10" }),
    ],
    parts: [
      { key: "a", index: 0, name: "Tenant portal", sessions: ["s1", "s2", "s3", "s4"] },
      { key: "b", index: 1, name: "Support agent", sessions: ["s5", "s6"], startsAfter: "s2", startsAfterLine: "Part A · Session 2" },
    ],
    links: [link(1, 2), link(1, 3), link(2, 5), link(5, 6), link(3, 4), link(6, 4)],
    meta: { s3: { withAbove: true, date: "" } },
    labels: "letters",
    ...extra,
  });
}

describe("the model", () => {
  it("works out five stages across two parts", () => {
    const model = two();
    expect(model.stages.stageOf).toEqual({ s1: 1, s2: 2, s3: 2, s4: 5, s5: 3, s6: 4 });
    expect(model.hasParts).toBe(true);
    expect(mapSummary(model)).toBe("5 stages · 7 to 12 Oct");
  });
  it("reads boxes by stage, then by part", () => {
    expect(readingOrder(two())).toEqual(["s1", "s2", "s3", "s5", "s6", "s4"]);
  });
  it("knows what a session is joined to", () => {
    expect([...joinedSessions(two(), "s5")].sort()).toEqual(["s2", "s6"]);
    expect(joinedSessions(two(), null).size).toBe(0);
  });
});

describe("the horizontal map", () => {
  const layout = layoutSessionMap(two(), "horizontal");
  const box = (key: string) => layout.boxes.find((entry) => entry.key === key)!;

  it("puts stages in columns 190 apart and a part's rows 28 under its label, stacked 50 apart", () => {
    expect([box("s1"), box("s2"), box("s3"), box("s4")].map((b) => [b.x, b.y])).toEqual([[0, 28], [190, 28], [190, 78], [760, 28]]);
    expect([box("s5"), box("s6")].map((b) => [b.x, b.y])).toEqual([[380, 176], [570, 176]]);
    expect(layout.boxes.every((b) => b.w === 164 && b.h === 38)).toBe(true);
  });
  it("labels each part at the top of its rows, and the next 12 under the dashed line, which is 20 under the last box", () => {
    expect(layout.partLabels.map((label) => [label.key, label.y, label.label])).toEqual([["a", 0, "Part A"], ["b", 148, "Part B"]]);
    const line = layout.dividers.find((divider) => divider.kind === "part")!;
    expect([line.y1, line.y2]).toEqual([136, 136]);
    expect(layout.partLabels[1].y).toBe(line.y1 + 12);
    expect(layout.partLabels[0].note).toBe("4 sessions");
    expect(layout.partLabels[1].note).toBe("Starts after Part A · Session 2");
  });
  it("draws stage dividers centred in the 26 gap, from 6 above the first label to 12 below the last box", () => {
    const dividers = layout.dividers.filter((divider) => divider.kind === "stage");
    expect(dividers.map((divider) => divider.x1)).toEqual([177, 367, 557, 747]);
    expect(dividers.every((divider) => divider.y1 === -6 && divider.y2 === 214 + 12)).toBe(true);
  });
  it("puts the stage strip 26 under the last box, as wide as the map, 22 tall, with the labels 10 in and 5 down", () => {
    expect(layout.strip).toEqual({ x: 0, y: 240, w: 924, h: 22 });
    expect(layout.width).toBe(924);
    expect(layout.stageLabels.map((label) => [label.x, label.y, label.text])).toEqual([
      [10, 245, "STAGE 1 · 7 OCT"],
      [200, 245, "STAGE 2 · 8 OCT"],
      [390, 245, "STAGE 3 · 9 OCT"],
      [580, 245, "STAGE 4 · 10 OCT"],
      [770, 245, "STAGE 5 · 12 OCT"],
    ]);
  });
  it("with one part has no labels and no dashed line, and the boxes start at the top", () => {
    const one = layoutSessionMap(
      sessionMapModel({ sessions: [session(1, "a"), session(2, "a")], parts: [{ key: "a", index: 0, sessions: ["s1", "s2"] }], links: [link(1, 2)], meta: {}, labels: "numbers" }),
      "horizontal",
    );
    expect(one.partLabels).toEqual([]);
    expect(one.dividers.filter((divider) => divider.kind === "part")).toEqual([]);
    expect(one.boxes.map((b) => [b.x, b.y])).toEqual([[0, 0], [190, 0]]);
  });
});

describe("the vertical map", () => {
  const layout = layoutSessionMap(two(), "vertical");
  const box = (key: string) => layout.boxes.find((entry) => entry.key === key)!;

  it("puts stages in rows 90 apart, the first part 22 after the 72 wide strip, and sessions of a stage side by side 184 apart", () => {
    expect([box("s1"), box("s2"), box("s3"), box("s4")].map((b) => [b.x, b.y])).toEqual([[94, 0], [94, 90], [278, 90], [94, 360]]);
  });
  it("draws a dashed line 32 after the widest column and starts the next part 30 after it", () => {
    const line = layout.dividers.find((divider) => divider.kind === "part")!;
    expect(line.x1).toBe(94 + 184 + 164 + 32);
    expect([box("s5").x, box("s6").x]).toEqual([line.x1 + 30, line.x1 + 30]);
    expect([box("s5").y, box("s6").y]).toEqual([180, 270]);
  });
  it("labels each part 46 above its first row", () => {
    expect(layout.partLabels.map((label) => [label.x, label.y])).toEqual([[94, -46], [504, -46]]);
  });
  it("draws the strip from 16 above the first row to 26 below the last box, with two-line labels", () => {
    expect(layout.strip).toEqual({ x: 0, y: -16, w: 72, h: 16 + 398 + 26 });
    expect(layout.stageLabels[1]).toMatchObject({ x: 10, y: 93, line1: "STAGE 2", line2: "8 OCT" });
  });
  it("puts stage dividers midway between rows, from 12 after the strip to the right edge", () => {
    const dividers = layout.dividers.filter((divider) => divider.kind === "stage");
    expect(dividers.map((divider) => divider.y1)).toEqual([64, 154, 244, 334]);
    expect(dividers.every((divider) => divider.x1 === 84 && divider.x2 === layout.width)).toBe(true);
    expect(layout.width).toBe(504 + 164);
  });
});

describe("the lines", () => {
  const horizontal = layoutSessionMap(two(), "horizontal");
  const vertical = layoutSessionMap(two(), "vertical");
  const line = (layout: typeof horizontal, id: string) => layout.lines.find((entry) => entry.id === id)!;

  it("join right edge to left edge horizontally and bottom to top vertically, each end 8 short of its box", () => {
    const h = line(horizontal, "s2>s5");
    expect([h.fromEdge, h.toEdge]).toEqual(["right", "left"]);
    const s2 = horizontal.boxes.find((b) => b.key === "s2")!;
    const s5 = horizontal.boxes.find((b) => b.key === "s5")!;
    expect(h.x1).toBe(s2.x + s2.w + 8);
    expect(h.x2).toBe(s5.x - 8);
    const v = line(vertical, "s2>s5");
    expect([v.fromEdge, v.toEdge]).toEqual(["bottom", "top"]);
    const v2 = vertical.boxes.find((b) => b.key === "s2")!;
    const v5 = vertical.boxes.find((b) => b.key === "s5")!;
    expect(v.y1).toBe(v2.y + v2.h + 8);
    expect(v.y2).toBe(v5.y - 8);
  });
  it("join the nearest edges when two sessions share a stage", () => {
    const sameStage = layoutSessionMap(two({ links: [link(2, 3)] }), "horizontal");
    const l = sameStage.lines[0];
    expect([l.fromEdge, l.toEdge]).toEqual(["bottom", "top"]);
    const side = layoutSessionMap(two({ links: [link(2, 3)] }), "vertical").lines[0];
    expect([side.fromEdge, side.toEdge]).toEqual(["right", "left"]);
  });
  it("spread the ends that meet one edge 14 apart", () => {
    // s1 leaves its right edge for s2 and s3: two ends, 14 apart and centred on the box's middle.
    const a = line(horizontal, "s1>s2");
    const b = line(horizontal, "s1>s3");
    expect(Math.abs(a.y1 - b.y1)).toBe(14);
    expect((a.y1 + b.y1) / 2).toBe(28 + 19);
    // Three ends, 14 apart.
    const three = layoutSessionMap(two({ links: [link(1, 2), link(1, 3), link(1, 5)] }), "horizontal");
    const ys = three.lines.map((entry) => entry.y1).sort((p, q) => p - q);
    expect([ys[1] - ys[0], ys[2] - ys[1]]).toEqual([14, 14]);
  });
  it("leave a loop's line drawn the same way round", () => {
    const loop = layoutSessionMap(two({ links: [link(4, 1)] }), "horizontal");
    expect(loop.lines).toHaveLength(1);
    expect(loop.lines[0].fromEdge).toBe("right");
    expect(loop.lines[0].x1).toBeLessThan(loop.lines[0].x2);
  });
  it("keep a short gap when the faces are too close for 8 on each side", () => {
    const close = layoutSessionMap(two({ links: [link(2, 3)] }), "horizontal").lines[0];
    expect(close.y2 - close.y1).toBeGreaterThanOrEqual(0);
  });
  it("are drawn only between boxes that exist", () => {
    expect(layoutSessionMap(two({ links: [link(1, 9)] }), "horizontal").lines).toEqual([]);
  });
});

describe("no overlaps", () => {
  it.each([["horizontal"], ["vertical"]] as const)("no two boxes overlap and no line ends inside a box (%s)", (direction) => {
    const layout = layoutSessionMap(two(), direction);
    const overlap = (a: (typeof layout.boxes)[number], b: (typeof layout.boxes)[number]) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    for (const [i, a] of layout.boxes.entries()) for (const b of layout.boxes.slice(i + 1)) expect(overlap(a, b), `${a.key} ${b.key}`).toBe(false);
    const inside = (x: number, y: number) => layout.boxes.some((b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h);
    for (const l of layout.lines) {
      expect(inside(l.x1, l.y1)).toBe(false);
      expect(inside(l.x2, l.y2)).toBe(false);
    }
  });
});

void S;
