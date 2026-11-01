// CA-15 P11, CA-18 P2: the Optional rows of each tile, in the modals' words. The row builders say what each tile holds (they
// are what the modal's Edit mode saves through); the tile's own window draws the rows, closed, each saying what it holds, and
// writes the keys each owns when Save is pressed. Details only reads them now (CA-18 P3).

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildSteps } from "@/lib/build/graph";
import type { NodeTree } from "@/lib/build/types";

import type { DetailsHandlers } from "./DetailsPanel";
import { agentRows, checkRows, codeRows, datasetRows, promptRows, repoRows, resultRows, systemPromptRows, toolRows } from "./detailsOptional";
import { resolveView } from "./detailsView";
import { TileEditDialog } from "./TileEditDialog";
import { fieldNames, fieldNamed } from "./optionalKit";

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

type Mocks = DetailsHandlers & { onExtras: ReturnType<typeof vi.fn>; onRename: ReturnType<typeof vi.fn> };

/** A tile's own window, in edit mode, on the tile of this id. */
function windowFor(tree: NodeTree[], selectedId: string) {
  const steps = buildSteps(tree);
  const view = resolveView({ selectedId, steps, groups: [], tree, sources: [], sourceFiles: [], promptsState: () => ({ prompts: [], error: false }), intoResult: new Set<string>(), media: () => undefined });
  const props = { onRename: vi.fn(), onModel: vi.fn(), onAddUse: vi.fn(), onRemoveUse: vi.fn(), onRuns: vi.fn(), onRemoveInside: vi.fn(), onToggleSessionPrompt: vi.fn(), onDownload: vi.fn(), onFields: vi.fn(), onAddPicture: vi.fn(), onUseAsCover: vi.fn(), onExtras: vi.fn() } as unknown as Mocks;
  render(<TileEditDialog view={view} handlers={props} inBuild={[]} onClose={vi.fn()} />);
  return { props, view };
}
const save = () => fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }));

const rowNames = () => fieldNames();
const row = (name: string) => fieldNamed(name);
const openRow = (name: string) => void fieldNamed(name);

describe("the row builders say what each tile holds, with the modals' words (CA-15 P11)", () => {
  it("a prompt: Model settings and Variables", () => {
    const rows = promptRows({ settings: { model: "Opus 5.5", effort: "high", instructions: "Be terse" } }, "Hi {name}");
    expect(rows.map((r) => r.name)).toEqual(["Model settings", "How it was sent", "Asks for", "Variables"]);
    expect(rows[0].summary).toBe("Opus 5.5 · High effort · Be terse");
    expect(rows[3].summary).toBe("{name}");
    expect(rows[3].toPatch({ name: "First name" })).toEqual({ variables: [{ name: "name", description: "First name" }] });
  });

  it("a prompt: how it was sent and what it asks for are the maker's, and typed by the maker is not stored (SV-30 P3)", () => {
    const rows = promptRows({ sent_by: "heartbeat", interval: "daily 09:00", asks_for: "outcome" }, "Check");
    expect(rows[1].summary).toBe("Heartbeat · daily 09:00");
    expect(rows[2].summary).toBe("Asks for an outcome");
    expect(rows[1].toPatch({ sent_by: "maker" })).toEqual({ sent_by: null, interval: null, event: null });
    expect(rows[1].toPatch({ sent_by: "event", event: "a deploy finished" })).toEqual({ sent_by: "event", interval: null, event: "a deploy finished" });
    expect(promptRows({}, "Hi")[1].summary).toBeNull();
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
    expect(rows.map((r) => r.summary)).toEqual(["Peer review", "Client", "Metric against a target · 95% correct", "Opus 5.5 · 2026-09-30", "Link · https://example.com/results"]);
    expect(rows[2].toPatch({ how: "pass_fail", target: "ignored" })).toEqual({ scoring: { how: "pass_fail", target: "" } });
    expect(rows[2].toPatch({ how: "", target: "" })).toEqual({ scoring: null });
  });

  it("an evidence file is named, and reads as test output when it has no kind; an address reads as a link (SV-30 P8)", () => {
    const evidence = checkRows({ evidence: { media_id: "m1", name: "results.csv" } })[4];
    expect(evidence.summary).toBe("Test run output · results.csv");
    expect(JSON.parse(evidence.values.evidence)).toMatchObject({ kind: "test_output", mediaId: "m1", name: "results.csv" });
    expect(evidence.toPatch(evidence.values)).toEqual({ evidence: { kind: "test_output", media_id: "m1", name: "results.csv" } });
    expect(JSON.parse(checkRows({ evidence: { url: "https://example.com/r" } })[4].values.evidence).kind).toBe("link");
  });

  it("a tool: Permissions, Required plan, Setup steps, Alternatives", () => {
    const rows = toolRows({ permissions: "write", plan: "Pro", setup: ["Make a token"], alternatives: ["Linear"] });
    expect(rows.map((r) => [r.name, r.summary])).toEqual([["Permissions", "Read and write"], ["Required plan", "Pro"], ["Setup steps", "Make a token"], ["Alternatives", "Linear"]]);
  });

  it("an API-key tool's setup row says to name the key, never paste its value", () => {
    expect(toolRows({ connection: "api_key" })[2].description).toBe("Key names only, like GITHUB_TOKEN");
    expect(toolRows({ connection: "mcp" })[2].description).toBe("");
  });

  it("code: File path and Generated with; a result: Caption", () => {
    expect(codeRows({ filename: "src/app.ts", tool: "claude-code", model: "Opus 5.5" }).map((r) => [r.name, r.summary])).toEqual([["File path", "src/app.ts"], ["What it belongs to", null], ["Generated with", "Claude Code · Opus 5.5"]]);
    // SV-30 P9: what it belongs to, and where it runs.
    expect(codeRows({ part_of: "eval_harness", runs_where: "Terminal 2" })[1].summary).toBe("Part of the eval harness · Terminal 2");
    expect(codeRows({ part_of: "eval_harness" })[1].toPatch({ part_of: "", runs_where: "" })).toEqual({ part_of: null, runs_where: "" });
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

describe("the Optional section in a tile's window (CA-15 P11, CA-18 P2)", () => {
  const checkTree = () => [node("ck", "eval_run", { tested: "Places an order", passing: "Total shows £9", method: "automated", scoring: { how: "metric", target: "95%" } })];

  it("draws its fields after the required ones, open because some hold a value, and shows what each holds", () => {
    windowFor(checkTree(), "ck");
    expect(screen.getByTestId("optional-toggle").getAttribute("aria-expanded")).toBe("true");
    expect(rowNames()).toEqual(expect.arrayContaining(["Test method", "Reviewer", "Scoring method", "Model tested", "Evidence"]));
    expect(within(row("Test method")).getByRole("radio", { name: "Automated" }).getAttribute("aria-checked")).toBe("true");
    expect(within(row("Scoring method")).getByRole("radio", { name: "Metric against a target" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByDisplayValue("95%")).toBeTruthy();
  });

  it("saves a choice on Save, and only the keys it owns", () => {
    const { props } = windowFor(checkTree(), "ck");
    openRow("Reviewer");
    fireEvent.click(within(row("Reviewer")).getByRole("radio", { name: "Client" }));
    expect(props.onExtras).not.toHaveBeenCalled();
    save();
    expect(props.onExtras).toHaveBeenCalledWith("ck", { reviewer: "client" });
    expect(props.onExtras).toHaveBeenCalledTimes(1);
  });

  it("a second press on the chosen one takes the key off", () => {
    const { props } = windowFor(checkTree(), "ck");
    openRow("Test method");
    fireEvent.click(within(row("Test method")).getByRole("radio", { name: "Automated" }));
    save();
    expect(props.onExtras).toHaveBeenCalledWith("ck", { method: null });
  });

  it("saves a text field on Save, and not when it has not changed", () => {
    const { props } = windowFor([node("tl", "integration", { step: true, service: "Slack", plan: "Pro" })], "tl");
    openRow("Required plan");
    save();
    expect(props.onExtras).not.toHaveBeenCalled();
    cleanup();
    const again = windowFor([node("tl", "integration", { step: true, service: "Slack", plan: "Pro" })], "tl");
    openRow("Required plan");
    fireEvent.change(screen.getByRole("textbox", { name: "Required plan" }), { target: { value: "Business" } });
    save();
    expect(again.props.onExtras).toHaveBeenCalledWith("tl", { plan: "Business" });
  });

  it("a metric's Target shows only once Metric is the scoring method", () => {
    windowFor([node("ck", "eval_run", { tested: "t", passing: "p" })], "ck");
    openRow("Scoring method");
    expect(screen.queryByRole("textbox", { name: "Target" })).toBeNull();
    fireEvent.click(within(row("Scoring method")).getByRole("radio", { name: "Metric against a target" }));
    expect(screen.getByRole("textbox", { name: "Target" })).toBeTruthy();
  });

  it("a team has Orchestration pattern, an agent Limits, Output and destination and Sample run", () => {
    windowFor([node("tm", "team", { pattern: "lead" }, { children: [node("tm1", "agent_config", { system_prompt: "Lead", model: "Opus 5.5" }, { parent_id: "tm" })] })], "tm");
    // SV-28 P1: a team's window also edits the team's own instructions.
    expect(rowNames().map((name) => name?.replace("Multi-agent only", ""))).toEqual(["Team instructions", "Trigger", "Orchestration pattern"]);
    cleanup();
    const { props } = windowFor([node("ag", "agent_config", { system_prompt: "Review", model: "Opus 5.5", limits: ["Never deploys"] })], "ag");
    expect(rowNames()).toEqual(expect.arrayContaining(["Limits", "Output and destination", "Sample run"]));
    openRow("Limits");
    fireEvent.change(screen.getByRole("textbox", { name: "Limits" }), { target: { value: "Never deploys\nNever emails" } });
    save();
    expect(props.onExtras).toHaveBeenCalledWith("ag", { limits: ["Never deploys", "Never emails"] });
  });

  it("a tool says Application and Actions performed, and has no Service or What it was used for", () => {
    windowFor([node("tl", "integration", { step: true, service: "Slack", scopes: "Posted" })], "tl");
    expect(screen.getByRole("button", { name: "App" })).toBeTruthy();
    openRow("Actions performed");
    expect(screen.getAllByLabelText("Actions performed").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Service")).toBeNull();
    expect(screen.queryByLabelText("What it was used for")).toBeNull();
    expect(rowNames()).toEqual(expect.arrayContaining(["Permissions", "Required plan", "Setup steps", "Alternatives"]));
  });

  it("the placeholders of its fields are the example alone", () => {
    windowFor([node("tl", "integration", { step: true, service: "Slack" })], "tl");
    openRow("Required plan");
    expect((screen.getByRole("textbox", { name: "Required plan" }) as HTMLInputElement).placeholder).not.toMatch(/^e\.g\./);
  });
});

describe("a system prompt, a dataset and a GitHub repository in their windows (CA-15 P11, CA-18 P2)", () => {
  const prompts = () => [node("p1", "prompt", { text: "One", session: "s1" }, { title: "First" }), node("p2", "prompt", { text: "Two", session: "s1" }, { title: "Second" })];

  it("resolves each to its own view, with its payload, and without a runtime", () => {
    const tree = [...prompts(), node("sp", "system_prompt", { step: true, text: "Be brief" }), node("ds", "dataset", { step: true, description: "d" }), node("rp", "repo", { step: true, url: "github.com/acme/shop" })];
    for (const [id, kind] of [["sp", "system_prompt"], ["ds", "dataset"], ["rp", "repo"]] as const) {
      const { view } = windowFor(tree, id);
      expect(view?.kind).toBe(kind);
      expect(view?.payload).toBeTruthy();
      expect(view?.runtime).toBeUndefined();
      cleanup();
    }
  });

  it("a system prompt asks Name, Text and Applies to first, then Model, Version and Variables, and writes the text on Save", () => {
    const { props } = windowFor([...prompts(), node("sp", "system_prompt", { step: true, text: "Use {tone}", scope: "all" }, { title: "Voice" })], "sp");
    const text = screen.getByLabelText("Text") as HTMLTextAreaElement;
    expect(text.value).toBe("Use {tone}");
    expect(screen.getByRole("group", { name: "Applies to" })).toBeTruthy();
    expect(text.compareDocumentPosition(screen.getByTestId("optional-section")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rowNames()).toEqual(expect.arrayContaining(["Model", "Version", "Variables"]));
    fireEvent.change(text, { target: { value: "Use {tone} and {voice}" } });
    save();
    expect(props.onExtras).toHaveBeenCalledWith("sp", { text: "Use {tone} and {voice}" });
  });

  it("a system prompt's Applies to saves all, this session or the prompts ticked", () => {
    const { props } = windowFor([...prompts(), node("sp", "system_prompt", { step: true, text: "x", scope: "prompts:p1" }, { title: "Voice" })], "sp");
    fireEvent.click(within(screen.getByRole("group", { name: "Applies to" })).getByRole("radio", { name: "All prompts" }));
    save();
    expect(props.onExtras).toHaveBeenLastCalledWith("sp", { scope: "all" });
  });

  it("a dataset asks Description and Use first, then Format, Record count, Columns, Source, Sample records and Licence", () => {
    const { props } = windowFor([node("ds", "dataset", { step: true, description: "Tickets", use: "evaluation", format: "CSV" }, { title: "Tickets" })], "ds");
    expect((screen.getByLabelText(/^Description/) as HTMLTextAreaElement).value).toBe("Tickets");
    expect(screen.getByRole("button", { name: "Evaluation" }).getAttribute("aria-pressed")).toBe("true");
    expect(rowNames()).toEqual(["Format", "Record count", "Columns", "Source", "Sample records", "Licence"]);
    expect(within(row("Format")).getByDisplayValue("CSV")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retrieval" }));
    save();
    expect(props.onExtras).toHaveBeenCalledWith("ds", { use: "retrieval" });
  });

  it("a dataset's record count takes digits only and is saved as a number", () => {
    const { props } = windowFor([node("ds", "dataset", { step: true, description: "d" })], "ds");
    openRow("Record count");
    fireEvent.change(screen.getByRole("textbox", { name: "Record count" }), { target: { value: "1,2x00" } });
    save();
    expect(props.onExtras).toHaveBeenCalledWith("ds", { record_count: 1200 });
  });

  it("a repository asks URL, Ownership and Description first, and what GitHub said is read, not asked", () => {
    windowFor([node("rp", "repo", { step: true, url: "github.com/acme/shop", ownership: "third_party", language: "Go", licence_spdx: "MIT", pushed_at: "2020-01-01T00:00:00Z", fetched_at: "2026-10-07T09:00:00Z", author: "acme" })], "rp");
    expect((screen.getByLabelText("Repository URL") as HTMLInputElement).value).toBe("https://github.com/acme/shop");
    expect(screen.getByRole("radio", { name: "Third-party repository" }).getAttribute("aria-checked")).toBe("true");
    const retrieved = screen.getByTestId("repo-retrieved");
    expect(retrieved.textContent).toContain("Go");
    expect(retrieved.textContent).toContain("MIT · reuse permitted");
    expect(retrieved.textContent).toContain("Possibly unmaintained");
    expect((screen.getByLabelText("Author") as HTMLInputElement).value).toBe("acme");
    expect(screen.queryByText("Visibility")).toBeNull();
    expect(rowNames()).toEqual(["Pinned version", "Path", "Modifications", "Key files", "Run instructions"]);
  });

  it("a repository of your own asks Visibility, Generated with and the Deployed URL, not an author", () => {
    const { props } = windowFor([node("rp", "repo", { step: true, url: "github.com/me/mine", ownership: "owned" })], "rp");
    expect(screen.getByText("Visibility")).toBeTruthy();
    expect(screen.getByLabelText("Deployed URL")).toBeTruthy();
    expect(screen.queryByLabelText("Author")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Private" }));
    save();
    expect(props.onExtras).toHaveBeenCalledWith("rp", { visibility: "private" });
  });

  it("a repository's usage ticks save the whole list", () => {
    const { props } = windowFor([node("rp", "repo", { step: true, url: "github.com/acme/shop", ownership: "third_party", usage: ["copied"] })], "rp");
    fireEvent.click(screen.getByRole("button", { name: "Followed its documentation" }));
    save();
    expect(props.onExtras).toHaveBeenCalledWith("rp", { usage: ["copied", "docs"] });
  });

  it("a repository's run instructions say to name keys, never paste values", () => {
    windowFor([node("rp", "repo", { step: true, url: "github.com/acme/shop", ownership: "owned" })], "rp");
    openRow("Run instructions");
    expect(screen.getByText("One per line. Key names only")).toBeTruthy();
  });

  it("each is renamed from its Name field, through onRename", () => {
    const { props } = windowFor([node("ds", "dataset", { step: true, description: "d" }, { title: "Tickets" })], "ds");
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Support tickets" } });
    save();
    expect(props.onRename).toHaveBeenCalledWith("ds", "Support tickets");
  });
});
