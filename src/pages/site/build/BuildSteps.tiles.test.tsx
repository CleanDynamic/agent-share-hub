// CA-15 P12: the build page draws every kind of tile with the type line the composer gives it, the new tile bodies, and only
// the optional details the maker gave: a reader never meets an empty row.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readerSteps } from "@/lib/build/readerSteps";
import type { NodeTree } from "@/lib/build/types";

import { StepsList } from "./BuildSteps";
import type { BuildStepsView } from "./buildModel";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

let seq = 0;
const node = (id: string, type: string, payload: Record<string, unknown>, over: Partial<NodeTree> = {}): NodeTree =>
  ({ id, build_id: "b", parent_id: null, position: ++seq, type, title: null, note: null, payload, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-07T09:00:00.000Z", children: [], ...over }) as NodeTree;

const QUESTIONS = [{ id: "team", type: "choice", instructions: "Which team?", options: [{ key: "billing" }, { key: "support" }] }];

const bare = (): NodeTree[] => [
  node("pr", "prompt", { text: "Write a two-line poem about a fox." }, { title: "Fox poem" }),
  node("ag", "agent_config", { system_prompt: "Review the draft.", model: "Opus 5.5" }, { title: "Reviewer" }),
  node("mn", "manual_step", { text: "Resize the hero image." }, { title: "Resize" }),
  node("cd", "code", { source: "const a = 1;", language: "ts" }, { title: "Constant" }),
  node("ck", "eval_run", { tested: "Places an order", passing: "The total shows £9.00", passed: 1, total: 1 }, { title: "Order check" }),
  node("fl", "document", { step: true, title: "menu.pdf" }),
  node("tl", "integration", { step: true, service: "Slack" }),
  node("dc", "decision", { provider: "typesafe-jev", model: "jev-1.13.0", questions: QUESTIONS }, { title: "Route" }),
  node("sp", "system_prompt", { step: true, text: "Write in plain English." }, { title: "Voice" }),
  node("ds", "dataset", { step: true, description: "Support tickets" }, { title: "Tickets" }),
  node("rp", "repo", { step: true, url: "github.com/acme/shop" }),
];

const full = (): NodeTree[] => [
  node("pr", "prompt", { text: "Hi {name}.", settings: { model: "Opus 5.5", effort: "high", instructions: "Be terse" }, variables: [{ name: "name", description: "First name" }] }, { title: "Fox poem" }),
  node("ag", "agent_config", { system_prompt: "Review the draft.", model: "Opus 5.5", limits: ["Never deploys"], output: "Slack", sample: "User: hi" }, { title: "Reviewer" }),
  node("tm", "team", { pattern: "parallel" }, { title: "Writers", children: [node("tm1", "agent_config", { system_prompt: "Lead.", model: "Opus 5.5" }, { title: "Lead one", parent_id: "tm" })] }),
  node("cd", "code", { source: "a\nb\nc", language: "ts", filename: "src/app.ts", tool: "claude-code", model: "Opus 5.5" }, { title: "Constant" }),
  node("ck", "eval_run", { tested: "Places an order", passing: "The total shows £9.00", method: "automated", reviewer: "client", scoring: { how: "metric", target: "95%" }, model_tested: { model: "Opus 5.5", version: "v1" }, evidence: { url: "https://example.com/results" } }, { title: "Order check" }),
  node("tl", "integration", { step: true, service: "Slack", connection: "mcp", permissions: "write", plan: "Pro", setup: ["Make a token"], alternatives: ["Teams"] }),
  node("sp", "system_prompt", { step: true, text: "Use {tone}.", version: "v2", model: "Opus 5.5", variables: [{ name: "tone", description: "How it sounds" }] }, { title: "Voice" }),
  node("ds", "dataset", { step: true, description: "Support tickets", use: "retrieval", format: "CSV", columns: ["a", "b"], record_count: 1200, source: "Helpdesk", sample: ["1,2"], licence: "CC BY 4.0", chunk_strategy: "By paragraph", chunk_size: 512 }, { title: "Tickets" }),
  node("rp", "repo", { step: true, url: "github.com/acme/shop", ownership: "third_party", description: "A shop", usage: ["copied"], language: "Go", licence_spdx: "MIT", fetched_at: "2026-10-07T09:00:00Z", pushed_at: "2026-09-01T00:00:00Z", pin: { kind: "tag", value: "v1" }, path: "packages/web", modifications: "Changed the build", key_files: ["README.md"], run: ["npm ci"], author: "acme" }),
];

function page(nodes: NodeTree[]) {
  const steps = readerSteps(nodes, null);
  const view = { steps, results: [], need: [], counts: "", map: { groups: [], files: [], tools: [], results: [] }, mapAvailable: false, onCopy: vi.fn(), resolveMedia: () => undefined, otherBody: () => null, focus: null } as unknown as BuildStepsView;
  render(
    <MemoryRouter>
      <StepsList view={view} phone={false} announce={() => undefined} />
    </MemoryRouter>,
  );
  return steps;
}

const cards = () => screen.getAllByTestId("step-card");
const byKind = (kind: string) => cards().find((card) => card.getAttribute("data-kind") === kind || card.querySelector(`[data-testid="${kind}-eyebrow"]`)) as HTMLElement;
const emptyRows = (card: HTMLElement) =>
  Array.from(card.children).filter((child) => !(child.textContent ?? "").trim() && !child.querySelector("svg, img, button, input, textarea, [role='img'], [data-mark], canvas, [aria-hidden]"));

describe("the build page, every kind with its optional details empty (CA-15 P12)", () => {
  it("gives each tile its type line, a title and no empty rows", () => {
    page(bare());
    expect(cards().length).toBeGreaterThanOrEqual(10);
    for (const card of cards()) {
      const name = card.querySelector("h3, h4")?.textContent ?? "";
      expect(card.querySelector('[data-testid$="-eyebrow"]')?.textContent?.trim(), `${name}: type line`).toBeTruthy();
      expect(name.trim(), "title").toBeTruthy();
      expect(emptyRows(card).map((row) => row.outerHTML.slice(0, 80)), `${name}: empty rows`).toEqual([]);
      // SV-30 P8: a Check with no evidence says `Stated, no artefact`; no other bare tile has a fact.
      const facts = within(card).queryByTestId("reader-facts");
      if (card.querySelector('[data-testid="check-eyebrow"]')) expect(facts?.textContent, `${name}: facts`).toContain("Stated, no artefact");
      else expect(facts, `${name}: facts`).toBeNull();
    }
  });

  it("says each kind as the composer says it", () => {
    page(bare());
    const says = (kind: string) => byKind(kind).querySelector('[data-testid$="-eyebrow"]')?.textContent;
    expect(says("prompt")).toBe("Prompt");
    expect(says("manual")).toBe("Manual step · Another tool");
    expect(says("code")).toBe("Code · TypeScript · 1 line");
    expect(says("check")).toBe("Check");
    expect(says("tool")).toBe("Tool");
    expect(says("system_prompt")).toBe("System prompt · Applies to 1 prompt");
    expect(says("dataset")).toBe("Dataset");
    expect(says("repo")).toBe("GitHub repository");
    expect(says("agent")).toBe("Agent · Opus 5.5");
  });

  it("draws the three new tiles from their own bodies", () => {
    page(bare());
    expect(within(byKind("system_prompt")).getByTestId("system-prompt-text").textContent).toBe("Write in plain English.");
    expect(within(byKind("dataset")).getByTestId("dataset-description").textContent).toBe("Support tickets");
    expect(within(byKind("repo")).getByRole("link", { name: "Open on GitHub" }).getAttribute("href")).toBe("https://github.com/acme/shop");
    expect(byKind("repo").querySelector("h3")?.textContent).toBe("acme/shop");
  });

  it("draws a system prompt's whole text, not two lines of it", () => {
    page(bare());
    expect(within(byKind("system_prompt")).getByTestId("system-prompt-text").style.overflow).not.toBe("hidden");
  });
});

describe("the build page, every kind with its optional details given (CA-15 P12)", () => {
  const facts = (card: HTMLElement) => within(card).getAllByTestId("reader-fact").map((fact) => [fact.querySelector("dt")?.textContent, fact.querySelector("dd")?.textContent]);

  it("tells a reader the prompt's settings and variables, and an agent's limits, output and sample", () => {
    page(full());
    expect(facts(byKind("prompt"))).toEqual([["Model settings", "Opus 5.5 · High effort · Be terse"], ["Variables", "{name}: First name"]]);
    expect(facts(byKind("agent")).map((row) => row[0])).toEqual(["Limits", "Output and destination", "Sample run"]);
  });

  it("tells a reader a team's pattern, a check's method, reviewer, scoring, model and evidence", () => {
    page(full());
    expect(facts(byKind("team"))).toEqual([["Orchestration pattern", "Parallel then merged"]]);
    expect(facts(byKind("check"))).toEqual([["Test method", "Automated"], ["Reviewer", "Client"], ["Scoring method", "Metric against a target · 95%"], ["Model tested", "Opus 5.5 · v1"], ["Evidence", "https://example.com/results"]]);
  });

  it("tells a reader a tool's permissions, plan, setup and alternatives, and code's path and what generated it", () => {
    page(full());
    expect(facts(byKind("tool")).map((row) => row[0])).toEqual(["Permissions", "Required plan", "Setup steps", "Alternatives"]);
    expect(facts(byKind("code"))).toEqual([["File path", "src/app.ts"], ["Generated with", "Claude Code · Opus 5.5"]]);
  });

  it("tells a reader a system prompt's model, version and variables, a dataset's details and a repository's", () => {
    page(full());
    expect(facts(byKind("system_prompt")).map((row) => row[0])).toEqual(["Model", "Version", "Variables"]);
    expect(facts(byKind("dataset")).map((row) => row[0])).toEqual(["Format", "Record count", "Columns", "Source", "Sample records", "Licence", "Chunking"]);
    expect(facts(byKind("repo")).map((row) => row[0])).toEqual(["Primary language", "Licence", "Last commit", "Pinned version", "Path", "Modifications", "Key files", "Run instructions"]);
  });

  it("gives every tile a footer of at most three facts", () => {
    page(full());
    for (const card of cards()) {
      for (const foot of within(card).queryAllByTestId("tile-footer-facts")) expect((foot.textContent ?? "").split(" · ").length).toBeLessThanOrEqual(3);
    }
  });

  it("draws code as numbered lines, not as prose", () => {
    page(full());
    expect(within(byKind("code")).getByTestId("code-gutter-numbers").textContent).toBe("1\n2\n3");
  });

  it("copies a system prompt's text", () => {
    page(full());
    expect(within(byKind("system_prompt")).getByRole("button", { name: /Copy/ })).toBeTruthy();
    fireEvent.click(within(byKind("system_prompt")).getByRole("button", { name: /Copy/ }));
  });
});

describe("the reader's words (CA-15 P12)", () => {
  it("says Trigger, Manual, Scheduled and Event for how an agent starts", async () => {
    const { triggerLine } = await import("@/components/build/tileBodies");
    expect(triggerLine({ runs: null })).toBe("Manual");
    expect(triggerLine({ runs: { how: "once" } })).toBe("Manual");
    expect(triggerLine({ runs: { how: "schedule", detail: "Weekdays 07:30" } })).toBe("Scheduled · Weekdays 07:30");
    expect(triggerLine({ runs: { how: "event", detail: "A new email" } })).toBe("Event · A new email");
    expect(triggerLine({ runs: { how: "parallel", count: 3 } })).toBe("Several at the same time · 3");
  });
});
