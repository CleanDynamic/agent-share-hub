// CA-03 P7 — which outside tools an agent can use, and how their names are joined.

import { describe, expect, it } from "vitest";

import type { Step } from "./graph";
import { joinNames, readsOutsideContent } from "./outsideContent";

const agent = (over: Partial<Step>): Pick<Step, "kind" | "harness" | "toolRefs"> => ({ kind: "agent", harness: null, ...over });
const tool = (id: string, service: string) => ({ id, type: "integration", payload: { service } });
const tree = [tool("t-gmail", "Gmail"), tool("t-notion", "notion"), tool("t-vercel", "Vercel"), tool("t-sheets", "Google Sheets"), { id: "f1", type: "document", payload: { title: "Gmail" } }];

describe("readsOutsideContent", () => {
  it("names the harness when it reads outside content", () => {
    expect(readsOutsideContent(agent({ harness: "Hermes Agent" }), tree)).toEqual(["Hermes Agent"]);
    expect(readsOutsideContent(agent({ harness: "Claude Code" }), tree)).toEqual([]);
  });

  it("names each of its tools that does, by the registry's name, in order", () => {
    expect(readsOutsideContent(agent({ toolRefs: ["t-vercel", "t-gmail", "t-notion"] }), tree)).toEqual(["Gmail", "Notion"]);
  });

  it("names both, the harness first, each once", () => {
    expect(readsOutsideContent(agent({ harness: "Notion", toolRefs: ["t-gmail", "t-notion"] }), tree)).toEqual(["Notion", "Gmail"]);
  });

  it("names none for an agent with neither, a step that is not an agent, or a reference to something not a tool", () => {
    expect(readsOutsideContent(agent({}), tree)).toEqual([]);
    expect(readsOutsideContent({ kind: "team", harness: "Hermes Agent" }, tree)).toEqual([]);
    expect(readsOutsideContent(agent({ toolRefs: ["f1", "gone"] }), tree)).toEqual([]);
  });

  it("does not count a typed tool the registry does not know", () => {
    expect(readsOutsideContent(agent({ harness: "My mail robot", toolRefs: ["t-sheets"] }), tree)).toEqual([]);
  });
});

describe("joinNames", () => {
  it("joins two with and, three or more with commas and a final and", () => {
    expect(joinNames([])).toBe("");
    expect(joinNames(["Gmail"])).toBe("Gmail");
    expect(joinNames(["Gmail", "Notion"])).toBe("Gmail and Notion");
    expect(joinNames(["Gmail", "Notion", "Zapier"])).toBe("Gmail, Notion and Zapier");
    expect(joinNames(["Gmail", "Notion", "Zapier", "Make"])).toBe("Gmail, Notion, Zapier and Make");
  });
});
