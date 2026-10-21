import { describe, expect, it } from "vitest";

import type { SessionGroup, Step } from "./graph";
import { envKeys, NEEDS, runtimeNeeds } from "./runtimeNeeds";

const step = (id: string, kind: Step["kind"], extra: Partial<Step> = {}): Step =>
  ({ id, kind, number: id, title: null, defaultTitle: id, text: "", words: 0, model: null, sessionId: null, tool: null, runs: null, uses: [], children: [], ...extra }) as Step;
const decision = (id: string, provider: string, extra: object = {}): Step =>
  step(id, "decision", { decision: { provider, model: "jev-1.13.0", calledFrom: [], stateFrom: null, questions: [{ id: "q", type: "yesno", instructions: "" }], ...extra } });

describe("What you need (CA-13 P14)", () => {
  it("names a TypeSafe account for a Jev decision, once however many need it, with the steps that do", () => {
    const needs = runtimeNeeds([decision("2", "typesafe-jev"), decision("3", "typesafe-jev")]);
    expect(needs).toEqual([{ title: NEEDS.typesafe, steps: ["2", "3"] }]);
    expect(NEEDS.typesafe).toBe("A TypeSafe account and API key (`TYPESAFE_API_KEY`). Jev is in early access.");
  });

  it("names Python with Deep Agents, a ScaleDown key and LangSmith from the agent, its helpers and its trace link", () => {
    const agent = step("4", "agent", { harness: "LangChain Deep Agents", helpers: [{ provider: "scaledown", job: "summarize" }], traceUrl: "https://smith.langchain.com/o/1" });
    expect(runtimeNeeds([agent]).map((n) => n.title)).toEqual(["Python with LangChain Deep Agents", "A ScaleDown key (`SCALEDOWN_API_KEY`), or a LangSmith key through its gateway", "LangSmith, if you want traces like the original's"]);
  });

  it("names LangSmith for a session's trace link too, and a provider key for an answer shape on one of the three APIs", () => {
    const group: SessionGroup = { sessionId: "s", number: 1, tool: null, model: null, startedAt: null, stepNumbers: [], extras: { traceUrl: "https://smith.langchain.com/o/1" } };
    const prompt = step("1", "prompt", { outputShape: { how: "json-schema", where: "Claude API", schema: "{}" } });
    expect(runtimeNeeds([prompt], [group]).map((n) => n.title)).toEqual(["LangSmith, if you want traces like the original's", "An API key for Claude"]);
    expect(runtimeNeeds([step("1", "prompt", { outputShape: { how: "grammar", where: "llama.cpp" } })])).toEqual([]);
  });

  it("gives an install line exactly as the maker wrote it, and invents none", () => {
    const needs = runtimeNeeds([decision("2", "other", { install: "pip install my-thing==1.2" }), step("3", "agent", { install: "uv add deepagents" })]);
    expect(needs.map((n) => n.title)).toEqual(["Install: pip install my-thing==1.2", "Install: uv add deepagents"]);
    expect(runtimeNeeds([decision("2", "other")])).toEqual([]);
  });

  it("lists nothing for a build with none of these, and names only the keys the build needs for .env.example", () => {
    expect(runtimeNeeds([step("1", "prompt")])).toEqual([]);
    expect(envKeys([decision("2", "typesafe-jev"), step("4", "agent", { helpers: [{ provider: "scaledown", job: "summarize" }] })])).toEqual(["TYPESAFE_API_KEY", "SCALEDOWN_API_KEY"]);
    expect(envKeys([step("1", "prompt")])).toEqual([]);
  });
});
