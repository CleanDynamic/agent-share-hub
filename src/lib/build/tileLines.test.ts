// CA-15 P9/P10: the type line and the footer facts every tile says about itself.

import { describe, expect, it } from "vitest";

import { buildSteps, type Step } from "./graph";
import { counted, footerFactsOf, typeLineOf } from "./tileLines";
import type { NodeTree } from "./types";

let seq = 0;
const node = (over: Partial<NodeTree>): NodeTree =>
  ({ id: `n${++seq}`, build_id: "b", parent_id: null, position: seq, type: "prompt", title: null, note: null, payload: { text: "one two" }, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-07T09:00:00.000Z", children: [], ...over }) as NodeTree;
const step = (over: Partial<NodeTree>): Step => buildSteps([node(over)])[0];

describe("counted", () => {
  it("is a count with its noun, and nothing for none or not a number", () => {
    expect(counted(1, "variable")).toBe("1 variable");
    expect(counted(3, "test case")).toBe("3 test cases");
    expect(counted(1200, "record")).toBe("1,200 records");
    expect(counted(1, "query", "queries")).toBe("1 query");
    expect(counted(2, "query", "queries")).toBe("2 queries");
    for (const none of [0, -1, null, undefined, Number.NaN]) expect(counted(none, "word")).toBeNull();
  });
});

describe("the type line", () => {
  it("is always at least the kind's name", () => {
    expect(typeLineOf(step({ type: "prompt" }))).toBe("Prompt");
    expect(typeLineOf(step({ type: "system_prompt", payload: { step: true, text: "x" } }))).toBe("System prompt · Applies to 0 prompts");
    expect(typeLineOf(step({ type: "dataset", payload: { step: true, description: "d" } }))).toBe("Dataset");
    expect(typeLineOf(step({ type: "repo", payload: { step: true, url: "github.com/a/b" } }))).toBe("GitHub repository");
  });

  it("adds what is known to a repository and a dataset", () => {
    expect(typeLineOf(step({ type: "repo", payload: { step: true, url: "github.com/a/b", ownership: "third_party" } }))).toBe("GitHub repository · Third-party repository");
    expect(typeLineOf(step({ type: "dataset", payload: { step: true, description: "d", use: "finetuning" } }))).toBe("Dataset · Fine-tuning");
  });

  it("says how many prompts a system prompt applies to, in the singular for one", () => {
    const [system] = buildSteps([node({ type: "prompt", payload: { text: "a" } }), node({ type: "system_prompt", payload: { step: true, text: "x", scope: "all" } })]).slice(-1);
    expect(typeLineOf(system)).toBe("System prompt · Applies to 1 prompt");
  });
});

describe("the footer facts", () => {
  it("are at most three, and never an empty fact or a zero", () => {
    expect(footerFactsOf(step({ type: "prompt", payload: { text: "one two three" } }))).toEqual(["3 words"]);
    expect(footerFactsOf(step({ type: "prompt", payload: { text: "Hello {name}, about {topic} and {name} and {more}" } })).some((fact) => /^0 /.test(fact))).toBe(false);
    for (const kind of ["prompt", "agent", "team", "tool", "code", "check", "file", "manual", "decision"] as const) {
      const facts = footerFactsOf({ ...step({ type: "prompt" }), kind });
      expect(facts.length).toBeLessThanOrEqual(3);
      expect(facts.every((fact) => fact.trim().length > 0 && !/^0\b/.test(fact))).toBe(true);
    }
  });

  it("count a prompt's variables, once each", () => {
    expect(footerFactsOf(step({ type: "prompt", payload: { text: "Hi {name}, {name} and {topic}" } }))).toContain("2 variables");
  });

  it("give a system prompt its variables and version", () => {
    expect(footerFactsOf(step({ type: "system_prompt", payload: { step: true, text: "Use {tone}", version: "v2" } }))).toEqual(["1 variable", "v2"]);
    expect(footerFactsOf(step({ type: "system_prompt", payload: { step: true, text: "Plain" } }))).toEqual([]);
  });

  it("give a dataset its format, columns and records, leaving out what is not known", () => {
    expect(footerFactsOf(step({ type: "dataset", payload: { step: true, description: "d", format: "CSV", columns: ["a", "b"], record_count: 1200 } }))).toEqual(["CSV", "2 columns", "1,200 records"]);
    expect(footerFactsOf(step({ type: "dataset", payload: { step: true, description: "d", record_count: 0 } }))).toEqual([]);
  });

  it("give a repository its language, licence and, for a third party, its author, with no 'reuse not granted' tail", () => {
    const retrieved = { step: true, url: "github.com/acme/shop", ownership: "third_party", language: "Go", licence_spdx: "MIT", fetched_at: "2026-10-07T09:00:00Z" };
    expect(footerFactsOf(step({ type: "repo", payload: { ...retrieved, author: "acme" } }))).toEqual(["Go", "MIT", "Author acme"]);
    expect(footerFactsOf(step({ type: "repo", payload: { ...retrieved, author: "acme", licence_spdx: null } }))).toEqual(["Go", "No licence", "Author acme"]);
    expect(footerFactsOf(step({ type: "repo", payload: { step: true, url: "github.com/acme/shop", ownership: "owned" } }))).toEqual([]);
  });
});
