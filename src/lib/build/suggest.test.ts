import { describe, expect, it } from "vitest";

import type { Step } from "./graph";
import { suggestFromProposal, suggestUses } from "./suggest";

const step = (id: string, text: string, over: Partial<Step> = {}): Step => ({
  id,
  kind: "prompt",
  number: "1",
  title: null,
  defaultTitle: "Prompt 1",
  text,
  words: text.split(/\s+/).length,
  model: null,
  sessionId: null,
  tool: null,
  runs: null,
  uses: [],
  children: [],
  ...over,
});

const files = [{ id: "f1", name: "CLAUDE.md" }];
const ids = (steps: Step[], f = files) => suggestUses(steps, f).map((s) => `${s.stepId}>${s.use.node_id}`);

describe("suggestUses", () => {
  it("offers a file named word for word, with a trailing full stop", () => {
    expect(ids([step("p1", "Follow CLAUDE.md.")])).toEqual(["p1>f1"]);
    expect(suggestUses([step("p1", "Follow CLAUDE.md.")], files)[0].reason).toBe("named in the prompt");
  });
  it("ignores case", () => expect(ids([step("p1", "use claude.md now")])).toEqual(["p1>f1"]));
  it("does not match a longer or prefixed name", () => {
    expect(ids([step("p1", "CLAUDE.mdx")])).toEqual([]);
    expect(ids([step("p1", "myCLAUDE.md")])).toEqual([]);
    expect(ids([step("p1", "CLAUDE.md.bak")])).toEqual([]);
  });
  it("does not offer a used, dismissed or refused input", () => {
    expect(ids([step("p1", "CLAUDE.md", { uses: [{ kind: "file", node_id: "f1" }] })])).toEqual([]);
    expect(ids([step("p1", "CLAUDE.md", { dismissed: ["file:f1"] })])).toEqual([]);
  });
  it("offers a name in an agent's instructions on the agent", () => {
    const agent = step("a1", "Read CLAUDE.md first", {
      kind: "agent",
      children: [step("a1:instructions", "Read CLAUDE.md first")],
    });
    expect(ids([agent])).toEqual(["a1>f1"]);
  });
  it("never suggests for a manual step", () => {
    expect(ids([step("m1", "CLAUDE.md", { kind: "manual" })])).toEqual([]);
  });
});

describe("suggestFromProposal", () => {
  it("is empty until the parser fields exist", () => expect(suggestFromProposal({}, [])).toEqual([]));
});

describe("a file a step makes (TF-07)", () => {
  const made = [{ id: "m1", name: "brand-guide.md" }];
  const map = new Map([["m1", "p2"]]);
  const steps = [
    step("p1", "Read brand-guide.md first.", { number: "1" }),
    step("p2", "Write the guide.", { number: "2" }),
    step("p3", "Check brand-guide.md again.", { number: "3" }),
  ];
  it("is suggested only to steps after the one that makes it", () => {
    expect(ids(steps, made)).toEqual(["p1>m1", "p3>m1"]);
    expect(suggestUses(steps, made, map).map((s) => s.stepId)).toEqual(["p3"]);
  });
  it("the step that makes it is not offered its own file", () => {
    expect(suggestUses([step("p2", "Write brand-guide.md.", { number: "2" })], made, map)).toEqual([]);
  });
});
