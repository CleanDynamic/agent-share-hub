import { describe, expect, it } from "vitest";

import { dayRange, stageDays, stagesOf, stagesRange, withAboveOf } from "./stages";

const parts = (...lists: { sessions: string[]; startsAfter?: string }[]) => lists.map((list, at) => ({ key: `p${at}`, ...list }));
const order = (...ps: { sessions: string[] }[]) => ps.flatMap((p) => p.sessions);
const run = (ps: ReturnType<typeof parts>, extra: Partial<Parameters<typeof stagesOf>[0]> = {}) => stagesOf({ workstreams: ps, order: order(...ps), meta: {}, uses: [], ...extra });

describe("stages", () => {
  it("count one after another in order", () => {
    const result = run(parts({ sessions: ["a", "b", "c"] }));
    expect(result.stageOf).toEqual({ a: 1, b: 2, c: 3 });
    expect(result.stages.map((stage) => stage.number)).toEqual([1, 2, 3]);
  });
  it("share a stage with the session above when asked", () => {
    const result = run(parts({ sessions: ["a", "b", "c"] }), { meta: { b: { withAbove: true, date: "" } } });
    expect(result.stageOf).toEqual({ a: 1, b: 1, c: 2 });
  });
  it("ignore withAbove on a part's first session", () => {
    const result = run(parts({ sessions: ["a", "b"] }, { sessions: ["c"] }), { meta: { c: { withAbove: true, date: "" } } });
    expect(result.stageOf.c).toBe(1);
  });
  it("are flat when every session shares the stage above", () => {
    const meta = { b: { withAbove: true, date: "" }, c: { withAbove: true, date: "" } };
    expect(run(parts({ sessions: ["a", "b", "c"] }), { meta }).stages).toHaveLength(1);
  });
  it("start a part after a session of another", () => {
    const result = run(parts({ sessions: ["a", "b", "c"] }, { sessions: ["d", "e"], startsAfter: "b" }));
    expect(result.stageOf).toMatchObject({ d: 3, e: 4 });
  });
  it("put a part's first session in stage 1 when it starts nowhere", () => {
    expect(run(parts({ sessions: ["a", "b"] }, { sessions: ["c"] })).stageOf.c).toBe(1);
  });
  it("push a whole part along when a session uses something across parts", () => {
    const ps = parts({ sessions: ["a", "b", "c"] }, { sessions: ["d", "e"] });
    const result = run(ps, { uses: [{ session: "d", from: "c" }] });
    expect(result.stageOf).toMatchObject({ c: 3, d: 4, e: 5 });
    expect(result.loops).toBe(0);
  });
  it("ignore a use inside one part", () => {
    const result = run(parts({ sessions: ["a", "b"] }), { uses: [{ session: "a", from: "b" }] });
    expect(result.stageOf).toEqual({ a: 1, b: 2 });
    expect(result.loops).toBe(0);
  });
  it("count a loop and do not hang", () => {
    const ps = parts({ sessions: ["a", "b"] }, { sessions: ["c", "d"] });
    const result = run(ps, { uses: [{ session: "c", from: "b" }, { session: "a", from: "d" }] });
    expect(result.loops).toBe(1);
    expect(result.stageOf.a).toBeGreaterThan(result.stageOf.d);
    expect(Object.keys(result.stageOf)).toHaveLength(4);
  });
  it("count a start-after that loops", () => {
    const ps = parts({ sessions: ["a"], startsAfter: "b" }, { sessions: ["b"], startsAfter: "a" });
    expect(run(ps).loops).toBe(1);
  });
  it("hold the earliest day of each stage", () => {
    const result = run(parts({ sessions: ["a", "b"] }), { meta: { a: { date: "2026-10-09" }, b: { date: "2026-10-10" } } });
    expect(result.stages[0].date).toBe("2026-10-09");
    expect(stagesRange(result.stages)).toBe("9 to 10 Oct");
  });
  it("say nothing without days, and use an imported session's own", () => {
    expect(run(parts({ sessions: ["a"] })).stages[0].date).toBeUndefined();
    expect(run(parts({ sessions: ["a"] }), { days: { a: "2026-10-07" } }).stages[0].date).toBe("2026-10-07");
  });
});

describe("parallelWith", () => {
  it("counts as the stage above only for the session directly above", () => {
    expect(withAboveOf({ parallelWith: ["a"], date: "" }, "a")).toBe(true);
    expect(withAboveOf({ parallelWith: ["z"], date: "" }, "a")).toBe(false);
    expect(withAboveOf({ date: "" }, undefined)).toBe(false);
  });
  it("is ignored for stages otherwise", () => {
    const result = run(parts({ sessions: ["a", "b", "c"] }), { meta: { c: { parallelWith: ["a"], date: "" } } });
    expect(result.stageOf.c).toBe(3);
    const together = run(parts({ sessions: ["a", "b", "c"] }), { meta: { c: { parallelWith: ["b"], date: "" } } });
    expect(together.stageOf).toEqual({ a: 1, b: 2, c: 2 });
  });
});

describe("day labels", () => {
  it("reads ranges", () => {
    expect(dayRange("2026-10-07", "2026-10-08")).toBe("7 to 8 Oct");
    expect(dayRange("2026-10-09")).toBe("9 Oct");
    expect(dayRange("2026-09-30", "2026-10-02")).toBe("30 Sep to 2 Oct");
    expect(dayRange(undefined)).toBe("");
    expect(stageDays({ date: "2026-10-07", until: "2026-10-08" })).toBe("7 to 8 Oct");
  });
});
