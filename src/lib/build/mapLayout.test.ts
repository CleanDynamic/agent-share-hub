import { describe, expect, it } from "vitest";

import type { SessionGroup, Step } from "./graph";
import { joinedTo, layoutMap, MAP_SIZES, type MapLayout } from "./mapLayout";

const step = (over: Partial<Step> & Pick<Step, "id" | "number">): Step => ({
  kind: "prompt",
  title: null,
  defaultTitle: `Prompt ${over.number}`,
  text: "one two three",
  words: 3,
  model: null,
  sessionId: null,
  tool: null,
  runs: null,
  uses: [],
  children: [],
  ...over,
});
const out = (id: string) => ({ kind: "output" as const, node_id: id });

/** The bakery: two chats on two days, a typed prompt, an agent, a result and CLAUDE.md. */
function bakery() {
  const steps: Step[] = [
    step({ id: "p1", number: "1", sessionId: "s1" }),
    step({ id: "p2", number: "2", sessionId: "s1", uses: [out("p1")] }),
    step({ id: "p3", number: "3", sessionId: "s2", uses: [] }),
    step({ id: "p4", number: "4", uses: [out("p3"), { kind: "file", node_id: "claude" }] }),
    step({ id: "a5", number: "5", kind: "agent", uses: [out("p4")] }),
  ];
  const groups: SessionGroup[] = [
    { sessionId: "s1", number: 1, tool: "Claude", model: "Opus 5.5", startedAt: "2026-03-03T10:00:00", stepNumbers: ["1", "2"] },
    { sessionId: "s2", number: 2, tool: "Claude Code", model: "Sonnet 5.5", startedAt: "2026-03-04T10:00:00", stepNumbers: ["3"] },
    { sessionId: null, number: 3, tool: "ChatGPT", model: null, startedAt: "typed here", stepNumbers: ["4"] },
  ];
  const layout = layoutMap(steps, groups, [{ id: "claude", name: "CLAUDE.md" }], [], [{ id: "r1", title: "The site", fromId: "a5" }]);
  return { steps, groups, layout };
}

const col = (layout: MapLayout, id: string) => layout.boxes.find((box) => box.id === id)?.column;

const overlaps = (layout: MapLayout) => {
  const found: string[] = [];
  const list = layout.boxes;
  for (let a = 0; a < list.length; a++) {
    for (let b = a + 1; b < list.length; b++) {
      const p = list[a];
      const q = list[b];
      if (p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h) found.push(`${p.id}/${q.id}`);
    }
  }
  return found;
};

describe("columns", () => {
  it("puts the bakery's prompts in columns 0, 1, 1, 2, then the agent at 3, the result at 4 and CLAUDE.md at 1", () => {
    const { layout } = bakery();
    expect(["p1", "p2", "p3", "p4", "a5", "r1", "claude"].map((id) => col(layout, id))).toEqual([0, 1, 1, 2, 3, 4, 1]);
  });

  it("takes a typed prompt's date from its neighbour", () => {
    const { layout } = bakery();
    expect(layout.columns.map((column) => column.date?.slice(0, 10) ?? null)).toEqual(["2026-03-03", "2026-03-03", "2026-03-04", "2026-03-04", null].slice(0, layout.columns.length));
  });

  it("keeps no column negative when a file comes before the first step", () => {
    const steps = [step({ id: "p1", number: "1", sessionId: "s1", uses: [{ kind: "file", node_id: "f" }] })];
    const groups: SessionGroup[] = [{ sessionId: "s1", number: 1, tool: "Claude", model: null, startedAt: "2026-03-03T10:00:00", stepNumbers: ["1"] }];
    const layout = layoutMap(steps, groups, [{ id: "f", name: "brief.md" }], [], []);
    expect(Math.min(...layout.boxes.map((box) => box.column))).toBe(0);
    expect(col(layout, "f")).toBe(0);
    expect(col(layout, "p1")).toBe(1);
  });
});

describe("lanes", () => {
  it("lists sessions in order, a typed lane between them, and the dashed files lane last", () => {
    const { layout } = bakery();
    expect(layout.lanes.map((lane) => [lane.label, lane.dashed])).toEqual([
      ["Session 1", false],
      ["Session 2", false],
      ["Typed here", false],
      ["Files and tools", true],
    ]);
    expect(layout.lanes[0].sub).toBe("Claude · Opus 5.5");
    const ys = layout.lanes.map((lane) => lane.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
  });

  it("puts an agent in the lane of the step before it, and has no files lane without files or tools", () => {
    const { steps, groups } = bakery();
    const layout = layoutMap(steps, groups, [], [], []);
    expect(layout.lanes.map((lane) => lane.label)).toEqual(["Session 1", "Session 2", "Typed here"]);
    expect(layout.boxes.find((box) => box.id === "a5")?.lane).toBe(2);
  });

  it("puts a typed prompt between two sessions in its own lane", () => {
    const steps = [step({ id: "a", number: "1", sessionId: "s1" }), step({ id: "b", number: "2" }), step({ id: "c", number: "3", sessionId: "s2" })];
    const groups: SessionGroup[] = [
      { sessionId: "s1", number: 1, tool: "Claude", model: null, startedAt: "2026-03-03T10:00:00", stepNumbers: ["1"] },
      { sessionId: null, number: 2, tool: null, model: null, startedAt: "typed here", stepNumbers: ["2"] },
      { sessionId: "s2", number: 3, tool: "Claude", model: null, startedAt: "2026-03-05T10:00:00", stepNumbers: ["3"] },
    ];
    const layout = layoutMap(steps, groups, [], [], []);
    expect(layout.lanes.map((lane) => lane.kind)).toEqual(["session", "typed", "session"]);
    expect(layout.boxes.map((box) => box.lane)).toEqual([0, 1, 2]);
  });
});

describe("sizes", () => {
  it("makes a box 132 wide, or 156 with three inputs, and as tall as its parts", () => {
    const steps = [
      step({ id: "p1", number: "1", sessionId: "s1" }),
      step({ id: "p2", number: "2", sessionId: "s1", uses: [out("p1")] }),
      step({ id: "p3", number: "3", sessionId: "s1", uses: [out("p1"), out("p2"), { kind: "file", node_id: "f" }] }),
    ];
    const groups: SessionGroup[] = [{ sessionId: "s1", number: 1, tool: "Claude", model: null, startedAt: "2026-03-03T10:00:00", stepNumbers: ["1", "2", "3"] }];
    const layout = layoutMap(steps, groups, [{ id: "f", name: "f.md" }], [], []);
    const size = (id: string) => layout.boxes.find((box) => box.id === id)!;
    expect([size("p1").w, size("p2").w, size("p3").w]).toEqual([132, 132, 156]);
    const { head, row, state, body, foot } = MAP_SIZES;
    expect(size("p1").h).toBe(head + body + foot);
    expect(size("p2").h).toBe(head + row + state + body + foot);
    expect(size("p3").h).toBe(head + 3 * row + state + body + foot);
  });

  it("lists a suggestion as a dashed input after the accepted ones", () => {
    const steps = [step({ id: "p1", number: "1", sessionId: "s1" }), step({ id: "p2", number: "2", sessionId: "s1" })];
    const groups: SessionGroup[] = [{ sessionId: "s1", number: 1, tool: "Claude", model: null, startedAt: "2026-03-03T10:00:00", stepNumbers: ["1", "2"] }];
    const layout = layoutMap(steps, groups, [], [], [], [{ stepId: "p2", use: out("p1"), label: "Output of 1 · Prompt 1" }]);
    const box = layout.boxes.find((candidate) => candidate.id === "p2")!;
    expect(box.inputs.map((input) => input.suggested)).toEqual([true]);
    expect([box.accepted, box.suggested]).toEqual([0, 1]);
    expect(layout.wires.find((wire) => wire.to === "p2" && wire.named)?.suggested).toBe(true);
  });
});

describe("wires", () => {
  it("leaves an output dot on the right edge and ends on the named input row, with the curve of the rule", () => {
    const { layout } = bakery();
    const from = layout.boxes.find((box) => box.id === "p1")!;
    const to = layout.boxes.find((box) => box.id === "p2")!;
    const wire = layout.wires.find((candidate) => candidate.from === "p1" && candidate.to === "p2")!;
    const { head, row, arrow } = MAP_SIZES;
    expect(wire.named).toBe(true);
    expect([wire.x1, wire.y1]).toEqual([from.x + from.w, from.y + head / 2]);
    expect([wire.x2, wire.y2]).toEqual([to.x, to.y + head + row / 2]);
    const dx = wire.x2 - wire.x1;
    expect(wire.d).toBe(`M ${wire.x1} ${wire.y1} C ${wire.x1 + 0.6 * dx} ${wire.y1}, ${wire.x2 - 0.6 * dx} ${wire.y2}, ${wire.x2 - arrow} ${wire.y2}`);
  });

  it("joins the next step in the same session level with the header, once", () => {
    const steps = [step({ id: "a", number: "1", sessionId: "s1" }), step({ id: "b", number: "2", sessionId: "s1" })];
    const groups: SessionGroup[] = [{ sessionId: "s1", number: 1, tool: "Claude", model: null, startedAt: "2026-03-03T10:00:00", stepNumbers: ["1", "2"] }];
    const layout = layoutMap(steps, groups, [], [], []);
    expect(layout.wires).toHaveLength(1);
    expect(layout.wires[0]).toMatchObject({ named: false, from: "a", to: "b" });
    const to = layout.boxes[1];
    expect(layout.wires[0].y2).toBe(to.y + MAP_SIZES.head / 2);
  });

  it("routes a loop back 36 above both boxes", () => {
    const steps = [
      step({ id: "w", number: "1", kind: "agent", uses: [out("c")] }),
      step({ id: "c", number: "2", kind: "agent", uses: [out("w")], runs: { how: "until", detail: "ok" } }),
    ];
    const layout = layoutMap(steps, [], [], [], []);
    const loop = layout.wires.find((wire) => wire.loop)!;
    expect([loop.from, loop.to]).toEqual(["c", "w"]);
    const top = Math.min(...layout.boxes.map((box) => box.y));
    expect(loop.d).toContain(`V ${top - MAP_SIZES.loopRise}`);
    expect(top - MAP_SIZES.loopRise).toBeGreaterThanOrEqual(MAP_SIZES.top);
  });
});

describe("no two boxes overlap", () => {
  it("in the bakery (S3)", () => {
    expect(overlaps(bakery().layout)).toEqual([]);
  });

  it("in a build with an agent (S4)", () => {
    const steps = [
      step({ id: "p1", number: "1", sessionId: "s1" }),
      step({ id: "a2", number: "2", kind: "agent", uses: [out("p1")], runs: { how: "parallel", count: 3 } }),
    ];
    const groups: SessionGroup[] = [{ sessionId: "s1", number: 1, tool: "Claude", model: null, startedAt: "2026-03-03T10:00:00", stepNumbers: ["1"] }];
    const layout = layoutMap(steps, groups, [{ id: "f", name: "a.md" }, { id: "g", name: "b.md" }], [{ id: "t", name: "Gmail" }], [{ id: "r", title: "Done", fromId: "a2" }, { id: "r2", title: "Also done", fromId: "a2" }]);
    expect(overlaps(layout)).toEqual([]);
  });

  it("in a team (S5), with several files and results stacking in one cell", () => {
    const steps = [
      step({ id: "t1", number: "1", kind: "team", uses: [{ kind: "file", node_id: "f" }, { kind: "file", node_id: "g" }] }),
      step({ id: "p2", number: "2", uses: [out("t1")] }),
    ];
    const layout = layoutMap(steps, [], [{ id: "f", name: "a.md" }, { id: "g", name: "b.md" }], [], [{ id: "r1", title: "A", fromId: "p2" }, { id: "r2", title: "B", fromId: "p2" }]);
    expect(overlaps(layout)).toEqual([]);
    expect(layout.height).toBeGreaterThan(0);
  });

  it("in a 60-step build", () => {
    const steps = Array.from({ length: 60 }, (_, at) => step({ id: `p${at}`, number: String(at + 1), sessionId: `s${at % 6}`, uses: at > 0 ? [out(`p${at - 1}`)] : [] }));
    const groups: SessionGroup[] = Array.from({ length: 6 }, (_, at) => ({
      sessionId: `s${at}`,
      number: at + 1,
      tool: "Claude",
      model: null,
      startedAt: `2026-03-0${at + 1}T10:00:00`,
      stepNumbers: steps.filter((candidate) => candidate.sessionId === `s${at}`).map((candidate) => candidate.number),
    }));
    expect(overlaps(layoutMap(steps, groups, [], [], []))).toEqual([]);
  });
});

describe("dimming", () => {
  it("leaves exactly the selected box and the boxes and wires joined to it at full strength", () => {
    const { layout } = bakery();
    const { boxes, wires } = joinedTo(layout, "p2");
    expect([...boxes].sort()).toEqual(["p1", "p2"]);
    expect(wires.size).toBe(1);
    const p4 = joinedTo(layout, "p4");
    expect([...p4.boxes].sort()).toEqual(["a5", "claude", "p3", "p4"]);
    expect(joinedTo(layout, null).boxes.size).toBe(0);
  });
});
