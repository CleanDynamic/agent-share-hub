import { describe, expect, it } from "vitest";

import type { SessionGroup, Step } from "./graph";
import { containsLine, joinedTo, layoutMap, layoutOpened, MAP_SIZES, sideBySideGroups, togetherSets, type MapLayout } from "./mapLayout";

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
  it("puts the bakery's prompts in columns 0, 1, 1, 2, then the agent at 3 (it spans 3 and 4), the result at 5 and CLAUDE.md at 1", () => {
    const { layout } = bakery();
    expect(["p1", "p2", "p3", "p4", "a5", "r1", "claude"].map((id) => col(layout, id))).toEqual([0, 1, 1, 2, 3, 5, 1]);
  });

  it("takes a typed prompt's date from its neighbour", () => {
    const { layout } = bakery();
    expect(layout.columns.map((column) => column.date?.slice(0, 10) ?? null)).toEqual(["2026-03-03", "2026-03-03", "2026-03-04", "2026-03-04", null, null].slice(0, layout.columns.length));
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
  it("lists sessions in order, a typed lane between them, the agent's lane, and the dashed files lane last", () => {
    const { layout } = bakery();
    expect(layout.lanes.map((lane) => [lane.label, lane.dashed])).toEqual([
      ["Session 1", false],
      ["Session 2", false],
      ["Written here", false],
      ["Agent 5", false],
      ["Files and tools", true],
    ]);
    expect(layout.lanes[0].sub).toBe("Claude · Opus 5.5");
    const ys = layout.lanes.map((lane) => lane.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
  });

  it("gives an agent a lane of its own, and has no files lane without files or tools", () => {
    const { steps, groups } = bakery();
    const layout = layoutMap(steps, groups, [], [], []);
    expect(layout.lanes.map((lane) => lane.label)).toEqual(["Session 1", "Session 2", "Written here", "Agent 5"]);
    expect(layout.lanes[3]).toMatchObject({ kind: "agent", sub: "runs by itself" });
    expect(layout.boxes.find((box) => box.id === "a5")?.lane).toBe(3);
  });

  it("labels a team's lane \"Team {n}\"", () => {
    const layout = layoutMap([step({ id: "t1", number: "1", kind: "team" })], [], [], [], []);
    expect(layout.lanes.map((lane) => lane.label)).toEqual(["Team 1"]);
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

describe("an agent or a team in the Map (UI-P69)", () => {
  it("makes an agent's box span two columns, 112 tall, and starts what follows after both", () => {
    const { layout } = bakery();
    const agent = layout.boxes.find((box) => box.id === "a5")!;
    const result = layout.boxes.find((box) => box.id === "r1")!;
    expect(agent.span).toBe(2);
    expect(agent.w).toBe(2 * MAP_SIZES.column + MAP_SIZES.gap);
    expect(agent.inputs).toHaveLength(1);
    expect(agent.h).toBe(112);
    expect(result.column).toBe(agent.column + 2);
    expect(result.x).toBeGreaterThanOrEqual(agent.x + agent.w + MAP_SIZES.gap);
  });

  it("is 112 tall with up to three inputs, and grows only past that", () => {
    const others = ["a", "b", "c", "d"].map((id, at) => step({ id, number: String(at + 1) }));
    const agentWith = (count: number) => {
      const uses = others.slice(0, count).map((other) => out(other.id));
      const layout = layoutMap([...others, step({ id: "ag", number: "5", kind: "agent", uses })], [], [], [], []);
      return layout.boxes.find((box) => box.id === "ag")!.h;
    };
    expect([0, 1, 3].map(agentWith)).toEqual([112, 112, 112]);
    expect(agentWith(4)).toBeGreaterThan(112);
  });

  it("counts prompts, files and tools, leaving zeros out", () => {
    const agent = step({
      id: "a1",
      number: "1",
      kind: "agent",
      uses: [{ kind: "file", node_id: "f" }],
      children: [
        step({ id: "a1:instructions", number: "1.1" }),
        step({ id: "c2", number: "1.2", uses: [{ kind: "file", node_id: "f" }, { kind: "tool", node_id: "t" }] }),
        step({ id: "c3", number: "1.3" }),
      ],
    });
    expect(containsLine(agent)).toBe("2 prompts · 1 file · 1 tool");
    expect(containsLine(step({ id: "a2", number: "2", kind: "agent" }))).toBe("");
  });
});

/** The S5 team: a researcher run several at once, a writer, a checker that sends work back, and one more. */
function team() {
  const researcher = step({ id: "t3a", number: "3.1", kind: "agent", defaultTitle: "Agent 3.1", model: "Opus 5.5", uses: [{ kind: "file", node_id: "brief" }] });
  const writer = step({ id: "t3b", number: "3.2", kind: "agent", model: "Opus 5.5", runs: { how: "parallel", count: 3 }, uses: [out("t3a")] });
  const checker = step({ id: "t3c", number: "3.3", kind: "agent", model: "Opus 5.5", uses: [out("t3b")] });
  const loopBack = { ...writer, uses: [out("t3a"), out("t3c")] };
  const finisher = step({ id: "t3d", number: "3.4", kind: "agent", model: "Opus 5.5", uses: [out("t3c")] });
  const container = step({ id: "t3", number: "3", kind: "team", uses: [out("p2")], children: [researcher, loopBack, { ...checker, runs: { how: "until", detail: "approved" } }, finisher] });
  const steps = [step({ id: "p1", number: "1" }), step({ id: "p2", number: "2", uses: [out("p1")] }), container, step({ id: "p4", number: "4", uses: [out("t3")] })];
  const results = [{ id: "r1", title: "The site", fromId: "t3" }];
  return { container, steps, results, layout: layoutOpened(container, steps, [{ id: "brief", name: "brief.md" }], [], results) };
}

describe("an opened team (V5)", () => {
  it("puts 3.1 to 3.4 in columns 0 to 3, left to right on one row", () => {
    const { layout } = team();
    expect(layout.boxes.map((box) => box.number)).toEqual(["3.1", "3.2", "3.3", "3.4"]);
    expect(layout.boxes.map((box) => box.column)).toEqual([0, 1, 2, 3]);
    expect(new Set(layout.boxes.map((box) => box.y)).size).toBe(1);
    const xs = layout.boxes.map((box) => box.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });

  it("draws the several-at-once agent stacked, and an input fed by it reads \"Output of 3.2 × 3\"", () => {
    const { layout } = team();
    expect(layout.boxes.map((box) => box.stack)).toEqual([null, 3, null, null]);
    expect(layout.boxes[2].inputs.map((input) => input.label)).toEqual(["Output of 3.2 × 3"]);
  });

  it("names a loop's input \"Sent back by 3.3\", routes its wire above, and labels it", () => {
    const { layout } = team();
    expect(layout.boxes[1].inputs.map((input) => input.label)).toEqual(["Output of 3.1", "Sent back by 3.3"]);
    const loop = layout.wires.find((wire) => wire.loop && wire.to === "t3b");
    expect(loop?.label).toBe("sent back until approved");
    const rowTop = layout.boxes[0].y;
    expect(Number(loop?.d.match(/V (-?[\d.]+) H/)?.[1])).toBeLessThan(rowTop);
  });

  it("puts what the team uses and goes into outside the frame, on the right, the result among them", () => {
    const { layout } = team();
    expect(layout.outside.map((box) => box.id)).toEqual(["p2", "p4", "r1"]);
    expect(layout.outside.map((box) => box.kind)).toEqual(["step", "step", "result"]);
    for (const box of layout.outside) expect(box.x).toBeGreaterThanOrEqual(layout.frame.x + layout.frame.w);
  });

  it("keeps the files used inside in a band along the bottom of the frame", () => {
    const { layout } = team();
    expect(layout.band.map((box) => box.title)).toEqual(["brief.md"]);
    for (const box of layout.band) {
      expect(box.y).toBeGreaterThan(layout.boxes[0].y + layout.boxes[0].h);
      expect(box.y + box.h).toBeLessThanOrEqual(layout.frame.y + layout.frame.h);
    }
  });

  it("keeps every box inside the frame and no two boxes on one another", () => {
    const { layout } = team();
    for (const box of layout.boxes) {
      expect(box.x).toBeGreaterThanOrEqual(layout.frame.x);
      expect(box.x + box.w).toBeLessThanOrEqual(layout.frame.x + layout.frame.w);
      expect(box.y + box.h).toBeLessThanOrEqual(layout.frame.y + layout.frame.h);
    }
    const all = [...layout.boxes, ...layout.band, ...layout.outside];
    for (let a = 0; a < all.length; a++) {
      for (let b = a + 1; b < all.length; b++) {
        const p = all[a];
        const q = all[b];
        expect(p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h).toBe(false);
      }
    }
  });

  it("opens an agent onto its instructions and prompts, each following the one before", () => {
    const agent = step({
      id: "a1",
      number: "1",
      kind: "agent",
      children: [step({ id: "a1:instructions", number: "1.1", defaultTitle: "Instructions" }), step({ id: "c2", number: "1.2" }), step({ id: "c3", number: "1.3" })],
    });
    const layout = layoutOpened(agent, [agent], [], []);
    expect(layout.boxes.map((box) => box.column)).toEqual([0, 1, 2]);
    expect(layout.wires.filter((wire) => !wire.named).map((wire) => wire.id)).toEqual(["a1:instructions>c2:next", "c2>c3:next"]);
  });
});

describe("a manual step in the Map (UI-P70)", () => {
  const groups: SessionGroup[] = [
    { sessionId: "s1", number: 1, tool: "Claude", model: null, startedAt: "2026-03-03T10:00:00", stepNumbers: ["1", "4"] },
  ];
  const steps = [
    step({ id: "p1", number: "1", sessionId: "s1" }),
    step({ id: "m2", number: "2", kind: "manual", tool: "Figma", text: "Laid out the hero" }),
    step({ id: "m3", number: "3", kind: "manual", tool: "Lovable", text: "Deployed it" }),
    step({ id: "p4", number: "4", sessionId: "s1", uses: [out("m3")] }),
  ];

  it("takes a 'By hand' lane, one per run of manual steps", () => {
    const layout = layoutMap(steps, groups, [], [], []);
    expect(layout.lanes.map((lane) => [lane.label, lane.kind])).toEqual([["Session 1", "session"], ["By hand", "hand"]]);
    expect(layout.boxes.filter((box) => box.stepKind === "manual").map((box) => box.lane)).toEqual([1, 1]);
    const split = layoutMap([steps[0], steps[1], step({ id: "p3", number: "3", sessionId: "s1" }), { ...steps[2], number: "4" }], groups, [], [], []);
    expect(split.lanes.map((lane) => lane.label)).toEqual(["Session 1", "By hand", "By hand"]);
  });

  it("carries its tool and line, and a later step can use its output", () => {
    const layout = layoutMap(steps, groups, [], [], []);
    const box = layout.boxes.find((candidate) => candidate.id === "m2")!;
    expect(box).toMatchObject({ tool: "Figma", text: "Laid out the hero", span: 1, w: MAP_SIZES.column });
    const p4 = layout.boxes.find((candidate) => candidate.id === "p4")!;
    expect(p4.inputs.map((input) => input.label)).toEqual(["Output of 3"]);
    expect(layout.wires.some((wire) => wire.from === "m3" && wire.to === "p4" && wire.named)).toBe(true);
    expect(p4.column).toBeGreaterThan(layout.boxes.find((candidate) => candidate.id === "m3")!.column);
  });
});

describe("a file a step makes (TF-08)", () => {
  /** Step 2 makes brand-guide.md, step 4 uses it; step 3 is a chat on the next day, so only the file pushes step 4 right. */
  function made() {
    const steps: Step[] = [
      step({ id: "p1", number: "1", sessionId: "s1" }),
      step({ id: "p2", number: "2", sessionId: "s1" }),
      step({ id: "p3", number: "3", sessionId: "s2" }),
      step({ id: "p4", number: "4", sessionId: "s2", uses: [{ kind: "file", node_id: "bg" }] }),
    ];
    const groups: SessionGroup[] = [
      { sessionId: "s1", number: 1, tool: "Claude", model: "Opus 5.5", startedAt: "2026-03-03T10:00:00", stepNumbers: ["1", "2"] },
      { sessionId: "s2", number: 2, tool: "Claude Code", model: "Sonnet 5.5", startedAt: "2026-03-04T10:00:00", stepNumbers: ["3", "4"] },
    ];
    const layout = layoutMap(steps, groups, [{ id: "bg", name: "brand-guide.md", madeBy: "p2" }], [], []);
    return { steps, groups, layout };
  }
  const box = (layout: MapLayout, id: string) => layout.boxes.find((candidate) => candidate.id === id)!;

  it("sits in the files band one column after the step that makes it, and the step that uses it one more after that", () => {
    const { layout } = made();
    expect(col(layout, "p2")).toBe(1);
    expect(col(layout, "bg")).toBe(2);
    expect(col(layout, "p4")).toBe(3);
    expect(layout.lanes[box(layout, "bg").lane].kind).toBe("files");
    expect(box(layout, "p2").x).toBeLessThan(box(layout, "bg").x);
    expect(box(layout, "bg").x).toBeLessThan(box(layout, "p4").x);
    expect(overlaps(layout)).toEqual([]);
  });

  it("wires the step's output dot to the file's left edge, unnamed, and the file to the step that uses it, named", () => {
    const { layout } = made();
    const maker = box(layout, "p2");
    const file = box(layout, "bg");
    const wire = layout.wires.find((candidate) => candidate.from === "p2" && candidate.to === "bg");
    expect(wire).toMatchObject({ named: false, loop: false, suggested: false, x1: maker.x + maker.w, y1: maker.y + MAP_SIZES.head / 2, x2: file.x, y2: file.y + MAP_SIZES.head / 2 });
    const use = layout.wires.find((candidate) => candidate.from === "bg" && candidate.to === "p4");
    expect(use).toMatchObject({ named: true });
  });

  it("is where a file nobody makes already was: one column before its first user", () => {
    const { steps, groups } = made();
    const layout = layoutMap(steps, groups, [{ id: "bg", name: "brand-guide.md" }], [], []);
    expect(col(layout, "bg")).toBe(col(layout, "p4") - 1);
    expect(layout.wires.some((candidate) => candidate.to === "bg")).toBe(false);
  });

  it("is drawn after an agent or a team that makes it, from that box, when a step inside makes it", () => {
    const inner = step({ id: "a2:p", number: "2.1" });
    const steps: Step[] = [
      step({ id: "p1", number: "1", sessionId: "s1" }),
      step({ id: "a2", number: "2", kind: "agent", uses: [out("p1")], children: [inner] }),
      step({ id: "p3", number: "3", sessionId: "s1", uses: [{ kind: "file", node_id: "bg" }] }),
    ];
    const groups: SessionGroup[] = [{ sessionId: "s1", number: 1, tool: "Claude", model: null, startedAt: "2026-03-03T10:00:00", stepNumbers: ["1", "3"] }];
    const layout = layoutMap(steps, groups, [{ id: "bg", name: "brand-guide.md", madeBy: "a2:p" }], [], []);
    expect(col(layout, "bg")).toBe(col(layout, "a2") + 2);
    expect(col(layout, "p3")).toBeGreaterThan(col(layout, "bg"));
    expect(layout.wires.some((candidate) => candidate.from === "a2" && candidate.to === "bg" && !candidate.named)).toBe(true);
  });

  it("is dimmed with the step and the users it joins when it is selected", () => {
    const { layout } = made();
    const { boxes, wires } = joinedTo(layout, "bg");
    expect([...boxes].sort()).toEqual(["bg", "p2", "p4"]);
    expect(wires.size).toBe(2);
  });
});

/* ── CA-03 P4: agents side by side ── */

describe("agents side by side in an opened team (CA-03 P4)", () => {
  const agent = (id: string, number: string, uses: string[] = []) => step({ id, number, kind: "agent", model: "Opus 5.5", uses: uses.map(out) });
  const teamOf = (children: Step[], runs: Step["runs"] = null) => step({ id: "t1", number: "1", kind: "team", runs, children });
  const open = (container: Step, after: Step[] = []) => layoutOpened(container, [container, ...after], [], [], []);
  /** No two boxes on one another. */
  const apart = (layout: ReturnType<typeof open>) => {
    for (const a of layout.boxes)
      for (const b of layout.boxes) {
        if (a === b) continue;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${a.id} and ${b.id}`).toBe(false);
      }
  };

  it("fans out from one box to three: the three in one column, their wires leaving one point on the lead", () => {
    const lead = agent("lead", "1.1");
    const helpers = ["a", "b", "c"].map((id, i) => agent(id, `1.${i + 2}`, ["lead"]));
    const layout = open(teamOf([lead, ...helpers], { how: "parallel", count: 3 }));
    expect(sideBySideGroups(teamOf([lead, ...helpers], { how: "parallel", count: 3 }))).toEqual([["a", "b", "c"]]);
    const [l, a, b, c] = layout.boxes;
    expect([a.column, b.column, c.column]).toEqual([1, 1, 1]);
    expect(l.column).toBe(0);
    expect(new Set([a.x, b.x, c.x]).size).toBe(1);
    expect(a.y).toBeLessThan(b.y);
    expect(b.y).toBeLessThan(c.y);
    const out = layout.wires.filter((wire) => wire.from === "lead");
    expect(out.map((wire) => wire.to)).toEqual(["a", "b", "c"]);
    expect(new Set(out.map((wire) => `${wire.x1},${wire.y1}`)).size).toBe(1);
    expect(layout.sideBySide).toEqual([{ ids: ["a", "b", "c"], x: a.x, y: a.y - MAP_SIZES.sideLabel }]);
    apart(layout);
  });

  it("fans in from three to one: the three in one column, each wire joining at the step they feed", () => {
    const a = agent("a", "1.1");
    const b = agent("b", "1.2");
    const c = agent("c", "1.3");
    const join = agent("join", "1.4", ["a", "b", "c"]);
    const layout = open(teamOf([a, b, c, join]));
    expect(layout.boxes.map((box) => box.column)).toEqual([0, 0, 0, 1]);
    const into = layout.wires.filter((wire) => wire.to === "join");
    expect(into.map((wire) => wire.from)).toEqual(["a", "b", "c"]);
    const joinBox = layout.boxes[3];
    for (const wire of into) {
      expect(wire.x2).toBe(joinBox.x);
      expect(wire.loop).toBe(false);
    }
    expect(layout.sideBySide.map((group) => group.ids)).toEqual([["a", "b", "c"]]);
    apart(layout);
  });

  it("does both: a lead fans out to three side by side, which fan in to one", () => {
    const lead = agent("lead", "1.1");
    const helpers = ["a", "b", "c"].map((id, i) => agent(id, `1.${i + 2}`, ["lead"]));
    const join = agent("join", "1.5", ["a", "b", "c"]);
    const layout = open(teamOf([lead, ...helpers, join]));
    expect(layout.boxes.map((box) => box.column)).toEqual([0, 1, 1, 1, 2]);
    expect(layout.wires.filter((wire) => wire.from === "lead").map((wire) => wire.to)).toEqual(["a", "b", "c"]);
    expect(layout.wires.filter((wire) => wire.to === "join").map((wire) => wire.from)).toEqual(["a", "b", "c"]);
    // Every box inside the frame, and the frame tall enough for the column.
    for (const box of layout.boxes) expect(box.y + box.h).toBeLessThanOrEqual(layout.frame.y + layout.frame.h);
    apart(layout);
  });

  it("joins the last column side by side at what the team goes into, outside the frame", () => {
    const lead = agent("lead", "1.1");
    const helpers = ["a", "b", "c"].map((id, i) => agent(id, `1.${i + 2}`, ["lead"]));
    const container = teamOf([lead, ...helpers], { how: "parallel", count: 3 });
    const next = step({ id: "p2", number: "2", uses: [out("t1")] });
    const layout = layoutOpened(container, [container, next], [], [], []);
    expect(layout.wires.filter((wire) => wire.to === "p2").map((wire) => wire.from)).toEqual(["a", "b", "c"]);
  });

  it("leaves a chain, a loop sent back and a team of one as they were", () => {
    const chain = teamOf([agent("a", "1.1"), agent("b", "1.2", ["a"]), agent("c", "1.3", ["b"])]);
    expect(sideBySideGroups(chain, [step({ id: "r", number: "2", uses: [out("a"), out("b"), out("c")] })])).toEqual([]);
    const one = teamOf([agent("solo", "1.1")]);
    const layout = open(one);
    expect(layout.boxes.map((box) => [box.column, box.y])).toEqual([[0, MAP_SIZES.outerRise + MAP_SIZES.frameCaption + MAP_SIZES.framePad]]);
    expect(layout.sideBySide).toEqual([]);
    expect(sideBySideGroups(teamOf([agent("lead", "1.1"), agent("a", "1.2", ["lead"])], { how: "parallel", count: 2 }))).toEqual([]);
  });

  it("routes a loop inside a team above the row, by the same rise as before", () => {
    const a = agent("a", "1.1", ["c"]);
    const b = agent("b", "1.2", ["a"]);
    const c = { ...agent("c", "1.3", ["b"]), runs: { how: "until" as const, detail: "approved" } };
    const layout = open(teamOf([a, b, c]));
    const loop = layout.wires.find((wire) => wire.loop);
    expect(loop?.label).toBe("sent back until approved");
    expect(Number(loop?.d.match(/V (-?[\d.]+) H/)?.[1])).toBe(layout.boxes[0].y - MAP_SIZES.loopRise / 2);
  });
});

describe("sessions at the same time (CA-05 P5)", () => {
  /** A and B ran at the same time (A on the 3rd, B on the 4th, so apart by date), C came after and used both. */
  function together(mark: boolean) {
    const steps: Step[] = [
      step({ id: "p1", number: "1", sessionId: "a" }),
      step({ id: "p2", number: "2", sessionId: "a", uses: [out("p1")] }),
      step({ id: "p3", number: "3", sessionId: "c" }),
      step({ id: "p4", number: "4", sessionId: "b" }),
      step({ id: "p5", number: "5", sessionId: "d", uses: [out("p2"), out("p4")] }),
    ];
    const extras = mark ? { parallelWith: ["b"] } : undefined;
    const groups: SessionGroup[] = [
      { sessionId: "a", number: 1, tool: "Claude Code", model: null, startedAt: "2026-03-03T10:00:00", stepNumbers: ["1", "2"], ...(extras ? { extras } : null) },
      { sessionId: "c", number: 2, tool: "Claude", model: null, startedAt: "2026-03-03T11:00:00", stepNumbers: ["3"] },
      { sessionId: "b", number: 3, tool: "Claude Code", model: null, startedAt: "2026-03-05T10:00:00", stepNumbers: ["4"] },
      { sessionId: "d", number: 4, tool: "Claude", model: null, startedAt: "2026-03-06T10:00:00", stepNumbers: ["5"] },
    ];
    return { steps, groups, layout: layoutMap(steps, groups, [], [], []) };
  }

  it("changes nothing when no session is marked", () => {
    const { layout } = together(false);
    expect(layout.lanes.map((lane) => lane.label)).toEqual(["Session 1", "Session 2", "Session 3", "Session 4"]);
    expect(layout.lanes.every((lane) => lane.together === undefined)).toBe(true);
    expect(col(layout, "p1")).toBe(0);
  });

  it("puts the sessions next to each other, whatever order they came in", () => {
    const { layout } = together(true);
    expect(layout.lanes.map((lane) => lane.label)).toEqual(["Session 1", "Session 3", "Session 2", "Session 4"]);
    expect(layout.lanes.map((lane) => lane.together)).toEqual([0, 0, undefined, undefined]);
    expect(layout.lanes[0].sub).toContain("at the same time");
  });

  it("starts them in one column, stacked, and puts what uses both after both", () => {
    const { layout } = together(true);
    expect(col(layout, "p1")).toBe(col(layout, "p4"));
    const [a, b] = [layout.boxes.find((box) => box.id === "p1"), layout.boxes.find((box) => box.id === "p4")];
    expect(a?.y).toBeLessThan(b?.y ?? 0);
    expect(col(layout, "p5")).toBeGreaterThan(Math.max(col(layout, "p2") ?? 0, col(layout, "p4") ?? 0));
    expect(overlaps(layout)).toEqual([]);
  });

  it("joins their arrows where their work does", () => {
    const { layout } = together(true);
    const into = layout.wires.filter((wire) => wire.to === "p5");
    expect(into.map((wire) => wire.from).sort()).toEqual(["p2", "p4"]);
    expect(new Set(into.map((wire) => Math.round(wire.x2))).size).toBe(1);
  });

  it("reads a pairing named by either session, and ignores a key that is not in the build", () => {
    const { groups } = together(true);
    const named = groups.map((group) => (group.sessionId === "a" ? { ...group, extras: undefined } : group.sessionId === "b" ? { ...group, extras: { parallelWith: ["a", "gone"] } } : group));
    expect([...togetherSets(named)].sort()).toEqual([["a", 0], ["b", 0]]);
    expect(togetherSets(together(false).groups).size).toBe(0);
  });
});
