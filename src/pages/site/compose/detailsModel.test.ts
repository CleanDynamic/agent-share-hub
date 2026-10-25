import { describe, expect, it } from "vitest";

import type { SessionGroup, Step } from "@/lib/build/graph";

import { firstRows, goesIntoRows, inputOptions, insideCounts, isClockTime, RUNS_CHOICES, RUNS_COPY, inputRows, fileSize, scheduleDetail, scheduleParts, type NamedPiece } from "./detailsModel";

const step = (over: Partial<Step> & Pick<Step, "id" | "number">): Step => ({
  kind: "prompt",
  title: null,
  defaultTitle: `Prompt ${over.number}`,
  text: "one two",
  words: 2,
  model: null,
  sessionId: "s1",
  tool: null,
  runs: null,
  uses: [],
  children: [],
  ...over,
});

const groups: SessionGroup[] = [{ sessionId: "s1", number: 1, tool: "Claude", model: "Opus 5.5", startedAt: "2026-03-03T10:00:00", stepNumbers: ["1", "2", "3"] }];
const file: NamedPiece = { id: "f1", name: "menu.pdf", note: "File · added by you" };
const tool: NamedPiece = { id: "t1", name: "Gmail", note: "Tool" };

describe("how it runs", () => {
  it("asks How did it run? with the three always shown, then the four under More ways it ran (CA-03 P3, CA-04 P6)", () => {
    expect(RUNS_COPY.title).toBe("How it ran");
    expect(RUNS_CHOICES.map((choice) => [choice.how, choice.label, choice.more])).toEqual([
      ["once", "When I asked", false],
      ["schedule", "On a schedule", false],
      ["event", "When something happened", false],
      ["until", "Again until a condition was met", true],
      ["parallel", "Several at the same time", true],
      ["goal", "Until a goal was reached", true],
      ["script", "From a script or GitHub", true],
    ]);
    expect(RUNS_CHOICES.map((choice) => choice.field?.kind ?? null)).toEqual([null, "text", "text", "text", "count", null, "code"]);
    expect(RUNS_CHOICES[4].field).toMatchObject({ min: 2, max: 20 });
    expect(RUNS_CHOICES.slice(1, 4).map((choice) => (choice.field as { max: number }).max)).toEqual([60, 60, 80]);
  });

  it("writes a schedule's preset and time as text, and reads them back (CA-03 P3)", () => {
    expect(scheduleDetail("Weekdays", "07:30")).toBe("Weekdays 07:30");
    expect(scheduleDetail("Every day", "")).toBe("Every day");
    expect(scheduleDetail(null, "18:05")).toBe("18:05");
    expect(scheduleDetail("Weekly", "7:30")).toBe("Weekly");
    expect(scheduleDetail("Weekly", "24:00")).toBe("Weekly");
    expect(scheduleParts("Weekdays 07:30")).toEqual({ preset: "Weekdays", time: "07:30" });
    expect(scheduleParts("Weekly")).toEqual({ preset: "Weekly", time: "" });
    expect(isClockTime("23:59")).toBe(true);
    expect(isClockTime("9:00")).toBe(false);
  });

  it("reads an old saved schedule as typed, with no preset (CA-03 P3)", () => {
    for (const saved of ["Mondays 07:00", "every morning", "Weekdays at 7"]) expect(scheduleParts(saved)).toEqual({ preset: null, time: "" });
  });
});

describe("Add an input offers only what DATA §3 allows", () => {
  const p1 = step({ id: "p1", number: "1" });
  const p2 = step({ id: "p2", number: "2", uses: [{ kind: "output", node_id: "p1" }] });
  const p3 = step({ id: "p3", number: "3" });
  const steps = [p1, p2, p3];

  it("offers earlier outputs, files and tools, never itself, a later step, or what is already listed", () => {
    const keys = inputOptions(p2, steps, groups, [file], [tool]).map((option) => option.key);
    expect(keys).toEqual(["file:f1", "tool:t1"]);
    expect(inputOptions(p3, steps, groups, [file], [tool]).map((option) => option.key)).toEqual(["output:p1", "output:p2", "file:f1", "tool:t1"]);
    expect(inputOptions(p1, steps, groups, [], []).map((option) => option.key)).toEqual([]);
  });

  it("offers a later step only inside the same agent or team, and only when it repeats until a condition is met", () => {
    const checker = step({ id: "c", number: "4.2", kind: "agent", runs: { how: "until", detail: "ok" } });
    const writer = step({ id: "w", number: "4.1", kind: "agent" });
    const loose = step({ id: "l", number: "4.3", kind: "agent" });
    const team = step({ id: "team", number: "4", kind: "team", children: [writer, checker, loose] });
    const all = [p1, team];
    expect(inputOptions(writer, all, groups, [], []).map((option) => option.key)).toEqual(["output:p1", "output:c"]);
    // a plain later step is not offered, and a step does not take in the team holding it
    expect(inputOptions(writer, all, groups, [], []).map((option) => option.key)).not.toContain("output:l");
    expect(inputOptions(writer, all, groups, [], []).map((option) => option.key)).not.toContain("output:team");
    // a step outside the team cannot use one inside
    expect(inputOptions(p1, all, groups, [], []).map((option) => option.key)).toEqual([]);
  });
});

describe("rows", () => {
  const p1 = step({ id: "p1", number: "1", title: "Homepage copy" });
  const p2 = step({ id: "p2", number: "2", uses: [{ kind: "output", node_id: "p1" }, { kind: "file", node_id: "f1" }, { kind: "tool", node_id: "gone" }] });

  it("reads a use as its label over the step's title and session", () => {
    const rows = inputRows(p2, [p1, p2], groups, { f1: file });
    expect(rows.map((row) => [row.label, row.sub])).toEqual([
      ["Output of 1", "Homepage copy · Session 1"],
      ["menu.pdf", "File · added by you"],
    ]);
  });

  it("says where a step goes: the steps that use it, the next in its session, and the result", () => {
    expect(goesIntoRows([p1, p2], "p1", new Set(["p1"])).map((row) => row.label)).toEqual(["2 · Prompt 2", "Result"]);
  });

  it("shows six rows, then holds the rest back", () => {
    expect(firstRows([1, 2, 3, 4, 5, 6, 7, 8])).toEqual({ visible: [1, 2, 3, 4, 5, 6], hidden: 2 });
    expect(firstRows([1, 2])).toEqual({ visible: [1, 2], hidden: 0 });
  });

  it("counts what is inside, and sizes a file", () => {
    expect(insideCounts({ kind: "team", children: [p1, p2] })).toBe("2 agents");
    expect(insideCounts({ kind: "agent", children: [step({ id: "a:instructions", number: "1.1" }), p1] })).toBe("1 prompt");
    expect([fileSize(900), fileSize(2048), fileSize(3 * 1024 * 1024), fileSize(null)]).toEqual(["900 B", "2 KB", "3.0 MB", null]);
  });
});

describe("a file a step makes (TF-07)", () => {
  const p1 = step({ id: "p1", number: "1" });
  const p2 = step({ id: "p2", number: "2" });
  const p3 = step({ id: "p3", number: "3" });
  const steps = [p1, p2, p3];
  const made: NamedPiece = { id: "m1", name: "brand-guide.md", note: "File · made in step 2" };
  const map = new Map([["m1", "p2"]]);

  it("is offered only to the steps after the one that makes it, with its step in the sub", () => {
    expect(inputOptions(p1, steps, groups, [made], [], map).map((option) => option.key)).toEqual([]);
    expect(inputOptions(p2, steps, groups, [made], [], map).map((option) => option.key)).toEqual(["output:p1"]);
    const options = inputOptions(p3, steps, groups, [made], [], map);
    expect(options.map((option) => option.key)).toEqual(["output:p1", "output:p2", "file:m1"]);
    expect(options[2]).toMatchObject({ label: "brand-guide.md", sub: "made in step 2" });
  });

  it("leaves other files as they were", () => {
    expect(inputOptions(p1, steps, groups, [file], [], map)[0]).toMatchObject({ key: "file:f1", sub: "File · added by you" });
  });
});
