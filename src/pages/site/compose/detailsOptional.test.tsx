// CA-15 P11: a selected tile's Details match its modal: the same names, the required fields first, then the Optional section
// with closed rows that say what they hold, and a field saves the keys it owns.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildSteps } from "@/lib/build/graph";
import type { NodeTree } from "@/lib/build/types";

import { DetailsPanel, type DetailsPanelProps } from "./DetailsPanel";
import { agentRows, checkRows, codeRows, datasetRows, promptRows, repoRows, resultRows, systemPromptRows, toolRows } from "./detailsOptional";
import { resolveView } from "./detailsView";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

let seq = 0;
const node = (id: string, type: string, payload: Record<string, unknown>, over: Partial<NodeTree> = {}): NodeTree =>
  ({ id, build_id: "b", parent_id: null, position: ++seq, type, title: null, note: null, payload, source_ref: null, event_id: null, is_gap: false, created_at: "", children: [], ...over }) as NodeTree;

function details(tree: NodeTree[], selectedId: string, over: Partial<DetailsPanelProps> = {}) {
  const steps = buildSteps(tree);
  const view = resolveView({ selectedId, steps, groups: [], tree, sources: [], sourceFiles: [], promptsState: () => ({ prompts: [], error: false }), intoResult: new Set<string>(), media: () => undefined });
  const props = { phone: false, view, onRename: vi.fn(), onModel: vi.fn(), onAddUse: vi.fn(), onRemoveUse: vi.fn(), onRuns: vi.fn(), onRemoveInside: vi.fn(), onToggleSessionPrompt: vi.fn(), onDownload: vi.fn(), onFields: vi.fn(), onAddPicture: vi.fn(), onUseAsCover: vi.fn(), onExtras: vi.fn(), ...over } as DetailsPanelProps;
  render(
    <MemoryRouter>
      <DetailsPanel {...props} />
    </MemoryRouter>,
  );
  return { props, view };
}

const rowNames = () => screen.getAllByTestId("optional-field").map((el) => el.querySelector("button span span")?.textContent);
const row = (name: string) => screen.getAllByTestId("optional-field").find((el) => el.querySelector("button span span")?.textContent === name) as HTMLElement;
const openRow = (name: string) => {
  const head = row(name).querySelector("button") as HTMLButtonElement;
  if (head.getAttribute("aria-expanded") !== "true") fireEvent.click(head);
};
const summaryOfRow = (name: string) => row(name).querySelector("button")?.textContent ?? "";

describe("the row builders say what each tile holds, with the modals' words (CA-15 P11)", () => {
  it("a prompt: Model settings and Variables", () => {
    const rows = promptRows({ settings: { model: "Opus 5.5", effort: "high", instructions: "Be terse" } }, "Hi {name}");
    expect(rows.map((r) => r.name)).toEqual(["Model settings", "Variables"]);
    expect(rows[0].summary).toBe("Opus 5.5 · High effort · Be terse");
    expect(rows[1].summary).toBe("{name}");
    expect(rows[1].toPatch({ name: "First name" })).toEqual({ variables: [{ name: "name", description: "First name" }] });
  });

  it("an agent: Limits, Output and destination, Sample run; a team: Orchestration pattern", () => {
    const agent = agentRows({ limits: ["Never deploys"], output: "Slack" }, false);
    expect(agent.map((r) => r.name)).toEqual(["Limits", "Output and destination", "Sample run"]);
    expect(agent[0].summary).toBe("Never deploys");
    expect(agent[2].summary).toBeNull();
    expect(agent[0].toPatch({ limits: "A\n\nB" })).toEqual({ limits: ["A", "B"] });
    const team = agentRows({ pattern: "parallel" }, true);
    expect(team.map((r) => [r.name, r.summary])).toEqual([["Orchestration pattern", "Parallel then merged"]]);
  });

  it("a check: Test method, Reviewer, Scoring method, Model tested, Evidence", () => {
    const rows = checkRows({ method: "review", reviewer: "client", scoring: { how: "metric", target: "95% correct" }, model_tested: { model: "Opus 5.5", version: "2026-09-30" }, evidence: { url: "https://example.com/results" } });
    expect(rows.map((r) => r.name)).toEqual(["Test method", "Reviewer", "Scoring method", "Model tested", "Evidence"]);
    expect(rows.map((r) => r.summary)).toEqual(["Peer review", "A client", "Metric against a target · 95% correct", "Opus 5.5 · 2026-09-30", "https://example.com/results"]);
    expect(rows[2].toPatch({ how: "pass_fail", target: "ignored" })).toEqual({ scoring: { how: "pass_fail", target: "" } });
    expect(rows[2].toPatch({ how: "", target: "" })).toEqual({ scoring: null });
  });

  it("an evidence file is named and not editable here", () => {
    const evidence = checkRows({ evidence: { media_id: "m1", name: "results.csv" } })[4];
    expect(evidence.summary).toBe("results.csv");
    expect(evidence.fields).toEqual([]);
    expect(evidence.note).toBe("results.csv is kept as the evidence.");
  });

  it("a tool: Permissions, Required plan, Setup steps, Alternatives", () => {
    const rows = toolRows({ permissions: "write", plan: "Pro", setup: ["Make a token"], alternatives: ["Linear"] });
    expect(rows.map((r) => [r.name, r.summary])).toEqual([["Permissions", "Read and write"], ["Required plan", "Pro"], ["Setup steps", "Make a token"], ["Alternatives", "Linear"]]);
  });

  it("an API-key tool's setup row says to name the key, never paste its value", () => {
    expect(toolRows({ connection: "api_key" })[2].description).toBe("Name the key, for example GITHUB_TOKEN. Never paste its value.");
    expect(toolRows({ connection: "mcp" })[2].description).toBe("How it was set up, one step per line");
  });

  it("code: File path and Generated with; a result: Caption", () => {
    expect(codeRows({ filename: "src/app.ts", tool: "claude-code", model: "Opus 5.5" }).map((r) => [r.name, r.summary])).toEqual([["File path", "src/app.ts"], ["Generated with", "Claude Code · Opus 5.5"]]);
    expect(resultRows({ caption: "As printed" }).map((r) => [r.name, r.summary])).toEqual([["Caption", "As printed"]]);
  });

  it("a system prompt, a dataset and a repository", () => {
    expect(systemPromptRows({ text: "Use {tone}", version: "v2", model: "Opus 5.5" }).map((r) => [r.name, r.summary])).toEqual([["Model", "Opus 5.5"], ["Version", "v2"], ["Variables", "{tone}"]]);
    expect(datasetRows({ description: "d", format: "CSV", record_count: 1200, columns: ["a", "b"] }).map((r) => [r.name, r.summary]).slice(0, 3)).toEqual([["Format", "CSV"], ["Record count", "1,200"], ["Columns", "a, b"]]);
    expect(datasetRows({ description: "d", use: "retrieval", chunk_strategy: "By paragraph", chunk_size: 512 }).map((r) => r.name)).toContain("Chunking");
    expect(datasetRows({ description: "d", use: "training" }).map((r) => r.name)).not.toContain("Chunking");
    expect(repoRows({ url: "github.com/acme/shop", ownership: "third_party", pin: { kind: "tag", value: "v1" } }).map((r) => r.name)).toEqual(["Pinned version", "Path", "Modifications", "Key files", "Run instructions"]);
    expect(repoRows({ url: "github.com/me/mine", ownership: "owned" }).map((r) => r.name)).not.toContain("Modifications");
    expect(repoRows({ url: "not a url" })).toEqual([]);
  });

  it("a row with nothing in it has no summary", () => {
    for (const rows of [promptRows({}, "x"), agentRows({}, false), checkRows({}), toolRows({}), codeRows({}), resultRows({}), systemPromptRows({ text: "x" }), datasetRows({ description: "d" }), repoRows({ url: "github.com/a/b" })]) {
      for (const r of rows) expect(r.summary, r.name).toBeNull();
    }
  });
});

describe("the Optional section in Details (CA-15 P11)", () => {
  const checkTree = () => [node("ck", "eval_run", { tested: "Places an order", passing: "Total shows £9", method: "automated", scoring: { how: "metric", target: "95%" } })];

  it("draws closed rows, each saying what it holds, after the required fields", () => {
    details(checkTree(), "ck");
    expect(rowNames()).toEqual(["Test method", "Reviewer", "Scoring method", "Model tested", "Evidence"]);
    expect(summaryOfRow("Test method")).toContain("Automated");
    expect(summaryOfRow("Scoring method")).toContain("Metric against a target · 95%");
    expect(row("Reviewer").getAttribute("data-open")).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Target" })).toBeNull();
    expect(screen.getByTestId("optional-count").textContent).toBe("5 fields");
  });

  it("is not drawn at all where nothing can change it", () => {
    details(checkTree(), "ck", { onExtras: undefined });
    expect(screen.queryByTestId("optional-section")).toBeNull();
  });

  it("saves a choice as soon as it is made, and only the keys it owns", () => {
    const { props } = details(checkTree(), "ck");
    openRow("Reviewer");
    fireEvent.click(within(row("Reviewer")).getByRole("button", { name: "A client" }));
    expect(props.onExtras).toHaveBeenCalledWith("ck", { reviewer: "client" });
  });

  it("a second press on the chosen one takes the key off", () => {
    const { props } = details(checkTree(), "ck");
    openRow("Test method");
    fireEvent.click(within(row("Test method")).getByRole("button", { name: "Automated" }));
    expect(props.onExtras).toHaveBeenCalledWith("ck", { method: null });
  });

  it("saves a text field when it is left, and not when it has not changed", () => {
    const { props } = details([node("tl", "integration", { step: true, service: "Slack", plan: "Pro" })], "tl");
    openRow("Required plan");
    const field = screen.getByRole("textbox", { name: "Required plan" });
    fireEvent.blur(field);
    expect(props.onExtras).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: "Business" } });
    fireEvent.blur(field);
    expect(props.onExtras).toHaveBeenCalledWith("tl", { plan: "Business" });
  });

  it("a metric's Target shows only once Metric is the scoring method", () => {
    details([node("ck", "eval_run", { tested: "t", passing: "p" })], "ck");
    openRow("Scoring method");
    expect(screen.queryByRole("textbox", { name: "Target" })).toBeNull();
    fireEvent.click(within(row("Scoring method")).getByRole("button", { name: "Metric against a target" }));
    expect(screen.getByRole("textbox", { name: "Target" })).toBeTruthy();
  });

  it("a team has Orchestration pattern, an agent Limits, Output and destination and Sample run", () => {
    details([node("tm", "team", { pattern: "lead" }, { children: [node("tm1", "agent_config", { system_prompt: "Lead", model: "Opus 5.5" }, { parent_id: "tm" })] })], "tm");
    expect(rowNames()).toEqual(["Orchestration pattern"]);
    cleanup();
    const { props } = details([node("ag", "agent_config", { system_prompt: "Review", model: "Opus 5.5", limits: ["Never deploys"] })], "ag");
    expect(rowNames()).toEqual(["Limits", "Output and destination", "Sample run"]);
    openRow("Limits");
    const limits = screen.getByRole("textbox", { name: "Limits" });
    fireEvent.change(limits, { target: { value: "Never deploys\nNever emails" } });
    fireEvent.blur(limits);
    expect(props.onExtras).toHaveBeenCalledWith("ag", { limits: ["Never deploys", "Never emails"] });
  });

  it("a prompt has Model settings and Variables, and variables are found in its text", () => {
    const { props } = details([node("pr", "prompt", { text: "Hi {name}, write about {topic}." })], "pr");
    expect(rowNames()).toEqual(["Model settings", "Variables"]);
    expect(summaryOfRow("Variables")).toContain("{name}, {topic}");
    openRow("Variables");
    const field = screen.getByRole("textbox", { name: "{name}" });
    fireEvent.change(field, { target: { value: "First name" } });
    fireEvent.blur(field);
    expect(props.onExtras).toHaveBeenCalledWith("pr", { variables: [{ name: "name", description: "First name" }, { name: "topic", description: "" }] });
  });

  it("code has File path and Generated with, and saves the file path when it is left", () => {
    const { props } = details([node("cd", "code", { source: "const a = 1;", language: "ts" })], "cd");
    expect(rowNames()).toEqual(["File path", "Generated with"]);
    openRow("File path");
    const field = screen.getByRole("textbox", { name: "File path" });
    fireEvent.change(field, { target: { value: "src/a.ts" } });
    fireEvent.blur(field);
    expect(props.onExtras).toHaveBeenCalledWith("cd", { filename: "src/a.ts" });
  });

  it("a tool says Application and Actions performed, and has no Service or What it was used for", () => {
    details([node("tl", "integration", { step: true, service: "Slack", scopes: "Posted" })], "tl");
    expect(screen.getByLabelText("Application")).toBeTruthy();
    expect(screen.getByLabelText("Actions performed")).toBeTruthy();
    expect(screen.queryByLabelText("Service")).toBeNull();
    expect(screen.queryByLabelText("What it was used for")).toBeNull();
    expect(rowNames()).toEqual(["Permissions", "Required plan", "Setup steps", "Alternatives"]);
  });

  it("the placeholders of its fields start e.g.", () => {
    details([node("tl", "integration", { step: true, service: "Slack" })], "tl");
    openRow("Required plan");
    expect((screen.getByRole("textbox", { name: "Required plan" }) as HTMLInputElement).placeholder).toMatch(/^e\.g\. /);
  });
});

describe("a system prompt, a dataset and a GitHub repository in Details (CA-15 P11)", () => {
  const prompts = () => [node("p1", "prompt", { text: "One", session: "s1" }, { title: "First" }), node("p2", "prompt", { text: "Two", session: "s1" }, { title: "Second" })];

  it("resolves each to its own view, with its payload, and without a runtime", () => {
    const tree = [...prompts(), node("sp", "system_prompt", { step: true, text: "Be brief" }), node("ds", "dataset", { step: true, description: "d" }), node("rp", "repo", { step: true, url: "github.com/acme/shop" })];
    for (const [id, kind] of [["sp", "system_prompt"], ["ds", "dataset"], ["rp", "repo"]] as const) {
      const { view } = details(tree, id);
      expect(view?.kind).toBe(kind);
      expect(view?.payload).toBeTruthy();
      expect(view?.runtime).toBeUndefined();
      cleanup();
    }
  });

  it("a system prompt asks Text and Applies to first, then the Optional rows Model, Version and Variables", () => {
    const { props } = details([...prompts(), node("sp", "system_prompt", { step: true, text: "Use {tone}", scope: "all" }, { title: "Voice" })], "sp");
    expect(screen.getByTestId("details-eyebrow").textContent).toContain("System prompt");
    const text = screen.getByLabelText("Text") as HTMLTextAreaElement;
    expect(text.value).toBe("Use {tone}");
    expect(screen.getByRole("group", { name: "Applies to" })).toBeTruthy();
    const position = (a: Element, b: Element) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(position(text, screen.getByTestId("optional-section"))).toBeTruthy();
    expect(rowNames()).toEqual(["Model", "Version", "Variables"]);
    fireEvent.change(text, { target: { value: "Use {tone} and {voice}" } });
    fireEvent.blur(text);
    expect(props.onExtras).toHaveBeenCalledWith("sp", { text: "Use {tone} and {voice}" });
  });

  it("a system prompt's Applies to saves all, this session or the prompts ticked, and not an empty choice", () => {
    const { props, view } = details([...prompts(), node("sp", "system_prompt", { step: true, text: "x", scope: "prompts:p1" }, { title: "Voice" })], "sp");
    expect(view?.kind === "system_prompt" ? view.prompts.map((prompt) => prompt.id) : []).toEqual(["p1", "p2"]);
    fireEvent.click(screen.getByRole("radio", { name: "All prompts" }));
    expect(props.onExtras).toHaveBeenLastCalledWith("sp", { scope: "all" });
    fireEvent.click(screen.getByRole("radio", { name: "Selected prompts" }));
    expect(props.onExtras).toHaveBeenLastCalledWith("sp", { scope: "prompts:p1" });
    fireEvent.click(screen.getByRole("checkbox", { name: /Second/ }));
    expect(props.onExtras).toHaveBeenLastCalledWith("sp", { scope: "prompts:p1,p2" });
    fireEvent.click(screen.getByRole("checkbox", { name: /First/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Second/ }));
    expect(screen.getByText("Choose at least one prompt for it to apply to.")).toBeTruthy();
    expect(props.onExtras).toHaveBeenLastCalledWith("sp", { scope: "prompts:p2" });
  });

  it("a dataset asks Description and Use first, then Format, Record count, Columns, Source, Sample records and Licence", () => {
    const { props } = details([node("ds", "dataset", { step: true, description: "Tickets", use: "evaluation", format: "CSV" }, { title: "Tickets" })], "ds");
    expect((screen.getByLabelText("Description") as HTMLTextAreaElement).value).toBe("Tickets");
    expect(screen.getByRole("button", { name: "Evaluation" }).getAttribute("aria-pressed")).toBe("true");
    expect(rowNames()).toEqual(["Format", "Record count", "Columns", "Source", "Sample records", "Licence"]);
    expect(summaryOfRow("Format")).toContain("CSV");
    fireEvent.click(screen.getByRole("button", { name: "Retrieval" }));
    expect(props.onExtras).toHaveBeenCalledWith("ds", { use: "retrieval" });
  });

  it("a dataset's record count takes digits only and is saved as a number", () => {
    const { props } = details([node("ds", "dataset", { step: true, description: "d" })], "ds");
    openRow("Record count");
    const field = screen.getByRole("textbox", { name: "Record count" });
    fireEvent.change(field, { target: { value: "1,2x00" } });
    fireEvent.blur(field);
    expect(props.onExtras).toHaveBeenCalledWith("ds", { record_count: 1200 });
  });

  it("a repository asks URL, Ownership and Description first, and what GitHub said is read, not asked", () => {
    details([node("rp", "repo", { step: true, url: "github.com/acme/shop", ownership: "third_party", language: "Go", licence_spdx: "MIT", pushed_at: "2020-01-01T00:00:00Z", fetched_at: "2026-10-07T09:00:00Z", author: "acme" })], "rp");
    expect((screen.getByLabelText("Repository URL") as HTMLInputElement).value).toBe("https://github.com/acme/shop");
    expect(screen.getByRole("button", { name: "Third-party repository" }).getAttribute("aria-pressed")).toBe("true");
    const retrieved = screen.getByTestId("repo-retrieved");
    expect(retrieved.textContent).toContain("Go");
    expect(retrieved.textContent).toContain("MIT · reuse permitted");
    expect(retrieved.textContent).toContain("Possibly unmaintained");
    expect((screen.getByLabelText("Author") as HTMLInputElement).value).toBe("acme");
    expect(screen.queryByText("Visibility")).toBeNull();
    expect(rowNames()).toEqual(["Pinned version", "Path", "Modifications", "Key files", "Run instructions"]);
  });

  it("a repository of your own asks Visibility, Generated with and the Deployed URL, not an author", () => {
    const { props } = details([node("rp", "repo", { step: true, url: "github.com/me/mine", ownership: "owned" })], "rp");
    expect(screen.getByText("Visibility")).toBeTruthy();
    expect(screen.getByLabelText("Deployed URL")).toBeTruthy();
    expect(screen.queryByLabelText("Author")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Private" }));
    expect(props.onExtras).toHaveBeenCalledWith("rp", { visibility: "private" });
  });

  it("a repository's usage ticks save the whole list", () => {
    const { props } = details([node("rp", "repo", { step: true, url: "github.com/acme/shop", ownership: "third_party", usage: ["copied"] })], "rp");
    fireEvent.click(screen.getByRole("checkbox", { name: "Followed its documentation" }));
    expect(props.onExtras).toHaveBeenCalledWith("rp", { usage: ["copied", "docs"] });
  });

  it("a repository's run instructions say to name keys, never paste values", () => {
    details([node("rp", "repo", { step: true, url: "github.com/acme/shop", ownership: "owned" })], "rp");
    openRow("Run instructions");
    expect(screen.getByText("One command per line. Name keys, never paste their values.")).toBeTruthy();
  });

  it("each can be renamed from its title", () => {
    const { props } = details([node("ds", "dataset", { step: true, description: "d" }, { title: "Tickets" })], "ds");
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    const field = screen.getByRole("textbox", { name: "Title of dataset 1" });
    fireEvent.change(field, { target: { value: "Support tickets" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(props.onRename).toHaveBeenCalledWith("ds", "Support tickets");
  });
});
