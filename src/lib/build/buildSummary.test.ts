// CA-03 P8 — one line that says what kind of build it is.

import { describe, expect, it } from "vitest";

import { SHAPES } from "@/dev/fixtures/shapes";

import { buildSummary } from "./buildSummary";
import { buildSteps, type Runs, type Step, type StepKind } from "./graph";

type Part = Pick<Step, "kind" | "children" | "runs">;

const step = (kind: StepKind, extra: { runs?: Runs | null; children?: Part[] } = {}): Part => ({ kind, runs: extra.runs ?? null, children: (extra.children ?? []) as Step[] });
const team = (agents: number, runs: Runs | null = null) => step("team", { runs, children: Array.from({ length: agents }, () => step("agent")) });

describe("buildSummary", () => {
  it("names the kind by the biggest thing in the build", () => {
    expect(buildSummary([step("prompt")])).toBe("One prompt");
    expect(buildSummary([step("prompt"), step("prompt")])).toBe("2 prompts");
    expect(buildSummary([step("prompt"), step("agent")])).toBe("An agent");
    expect(buildSummary([step("agent"), step("agent"), step("agent")])).toBe("3 agents");
    expect(buildSummary([step("agent"), team(3)])).toBe("A team of 3 agents");
    expect(buildSummary([team(1)])).toBe("A team of 1 agent");
    expect(buildSummary([team(2), team(4)])).toBe("2 teams");
  });

  it("says how it ran only when it is not When I asked, reading the top-level agents and teams", () => {
    expect(buildSummary([step("agent", { runs: { how: "once" } })])).toBe("An agent");
    expect(buildSummary([step("agent", { runs: { how: "parallel", count: 3 } })])).toBe("An agent");
    expect(buildSummary([step("agent", { runs: { how: "schedule", detail: "every Monday at 09:00" } })])).toBe("An agent · runs on a schedule");
    expect(buildSummary([step("agent", { runs: { how: "event" } })])).toBe("An agent · runs when something happens");
    expect(buildSummary([team(2, { how: "until", detail: "the review has no changes" })])).toBe("A team of 2 agents · repeats until a condition is met");
    const inside = step("team", { children: [step("agent", { runs: { how: "until" } }), step("agent")] });
    expect(buildSummary([inside])).toBe("A team of 2 agents");
  });

  it("says a check, code files and manual steps, each counted", () => {
    expect(buildSummary([step("prompt"), step("check")])).toBe("One prompt · checks its own work");
    expect(buildSummary([step("prompt"), step("code")])).toBe("One prompt · 1 code file");
    expect(buildSummary([step("prompt"), step("code"), step("code")])).toBe("One prompt · 2 code files");
    expect(buildSummary([step("prompt"), step("manual")])).toBe("One prompt · 1 manual step");
    expect(buildSummary([step("prompt"), step("manual"), step("manual")])).toBe("One prompt · 2 manual steps");
  });

  it("keeps the order: kind, how it ran, a check, code, manual steps", () => {
    const steps = [
      step("manual"),
      step("code"),
      step("check"),
      step("agent", { runs: { how: "event" } }),
      step("agent", { runs: { how: "schedule" } }),
      step("code"),
    ];
    expect(buildSummary(steps)).toBe("2 agents · runs on a schedule · runs when something happens · checks its own work · 2 code files · 1 manual step");
  });

  it("is empty for a build with nothing but a title", () => {
    expect(buildSummary([])).toBe("");
  });

  it("reads each of CA-02's five shapes", () => {
    const of = (key: keyof typeof SHAPES) => buildSummary(buildSteps(SHAPES[key].tree));
    expect(of("alone")).toBe("One prompt");
    expect(of("retrieval")).toBe("One prompt");
    expect(of("agent")).toBe("An agent · runs when something happens");
    expect(of("team")).toBe("A team of 4 agents");
    expect(of("code")).toBe("2 prompts · 2 code files · 1 manual step");
  });
});
