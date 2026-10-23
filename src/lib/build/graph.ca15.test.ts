// CA-15: the writers and readers the tile modals use, checked at the payload they store.

import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertNode = vi.fn();
vi.mock("./nodes", () => ({
  upsertNode: (...a: unknown[]) => upsertNode(...a),
  getNodeTree: vi.fn(),
  reorderNodes: vi.fn(),
  deleteNode: vi.fn(),
}));
const getNodeType = vi.fn();
vi.mock("./nodeTypes", () => ({ getNodeType: (...a: unknown[]) => getNodeType(...a) }));

import { CONNECTION_LABEL, addCheck, addDatasetTile, addRepoTile, addResultTile, addSystemPromptTile, addToolTile, buildSteps, setCheckText, setCodeSource, setExtras } from "./graph";
import type { Json } from "@/integrations/supabase/types";

import type { BuildNode, NodeTree } from "./types";

const BUILD = "33333333-0000-4000-8000-000000000003";
let seq = 0;
const node = (over: Partial<NodeTree>): NodeTree =>
  ({ id: `n${++seq}`, build_id: BUILD, parent_id: null, position: 1, type: "prompt", title: null, note: null, payload: { text: "one two" }, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-07T09:00:00.000Z", children: [], ...over }) as NodeTree;

/** The payload of the last node written. */
const written = (): Record<string, unknown> => (upsertNode.mock.calls.at(-1)?.[0] as { payload: Record<string, Json> }).payload;

beforeEach(() => {
  seq = 0;
  upsertNode.mockReset();
  upsertNode.mockImplementation(async (row: unknown) => row);
  getNodeType.mockReset();
  getNodeType.mockResolvedValue({ key: "x", is_active: true });
});

describe("a result's newer kinds (CA-15 P3)", () => {
  it("stores each kind under its own `kind`, with its required fields and the caption", async () => {
    await addResultTile(BUILD, [], { kind: "text", text: " First line\nsecond ", caption: " A caption " });
    expect(written()).toEqual({ summary: "First line", kind: "text", text: "First line\nsecond", caption: "A caption" });

    await addResultTile(BUILD, [], { kind: "audio", mediaId: "m1", name: "memo.wav", size: 10, mime: "audio/wav", seconds: 82.6 });
    expect(written()).toEqual({ summary: "memo.wav", kind: "audio", media_id: "m1", file_name: "memo.wav", file_size: 10, file_mime: "audio/wav", duration: 83 });

    await addResultTile(BUILD, [], { kind: "deployed", url: "app.example.com/x" });
    expect(written()).toMatchObject({ summary: "app.example.com", kind: "deployed", url: "https://app.example.com/x" });

    await addResultTile(BUILD, [], { kind: "table", csv: "a,b,c\n1,2,3", columns: 3 });
    expect(written()).toEqual({ summary: "Data table", kind: "table", csv: "a,b,c\n1,2,3", columns: 3 });
    await addResultTile(BUILD, [], { kind: "table", mediaId: "m2", name: "orders.csv", size: 5, mime: "text/csv", columns: 6 });
    expect(written()).toEqual({ summary: "orders.csv", kind: "table", media_id: "m2", file_name: "orders.csv", file_size: 5, file_mime: "text/csv", columns: 6 });

    await addResultTile(BUILD, [], { kind: "message", channel: "slack", message: "Ready" });
    expect(written()).toEqual({ summary: "Slack: Ready", kind: "message", channel: "slack", message: "Ready" });

    await addResultTile(BUILD, [], { kind: "external_change", application: "GitHub", change: "Opened a pull request" });
    expect(written()).toEqual({ summary: "GitHub: Opened a pull request", kind: "external_change", application: "GitHub", change: "Opened a pull request" });

    await addResultTile(BUILD, [], { kind: "metric", value: "42", label: "Orders per week", unit: "orders", before: "31" });
    expect(written()).toEqual({ summary: "Orders per week", kind: "metric", value: "42", label: "Orders per week", unit: "orders", before: "31" });
    await addResultTile(BUILD, [], { kind: "metric", value: "42", label: "Orders", unit: "", before: " " });
    expect(written()).toEqual({ summary: "Orders", kind: "metric", value: "42", label: "Orders" });

    await addResultTile(BUILD, [], { kind: "offline", description: "Delivered by hand", photoId: "m3" });
    expect(written()).toEqual({ summary: "Delivered by hand", kind: "offline", description: "Delivered by hand", media_id: "m3" });
  });

  it("keeps the older four exactly as they were stored", async () => {
    await addResultTile(BUILD, [], { kind: "link", url: "plumandrye.example/shop" });
    expect(written()).toEqual({ summary: "plumandrye.example", url: "https://plumandrye.example/shop" });
    await addResultTile(BUILD, [], { kind: "model", baseModel: "Muse", method: "Fine-tuned" });
    expect(written()).toEqual({ summary: "Trained model", kind: "trained-model", base_model: "Muse", method: "Fine-tuned" });
  });

  it("refuses an empty required field, in plain words, and writes nothing", async () => {
    await expect(addResultTile(BUILD, [], { kind: "metric", value: "", label: "x" })).rejects.toThrow("Add the value.");
    await expect(addResultTile(BUILD, [], { kind: "message", channel: "email", message: " " })).rejects.toThrow("Add the message.");
    expect(upsertNode).not.toHaveBeenCalled();
  });
});

describe("setExtras (CA-15)", () => {
  const prompt = (payload: Record<string, Json>) => node({ id: "p", type: "prompt", payload }) as unknown as BuildNode;

  it("writes a prompt's settings and variables, and keeps every other key", async () => {
    await setExtras(prompt({ text: "Hi {name}", model: "Fable 5.1", colour: "#112233" }), {
      settings: { model: "", effort: "low", instructions: "" },
      variables: [{ name: "name", description: "First name" }],
    });
    expect(written()).toEqual({ text: "Hi {name}", model: "Fable 5.1", colour: "#112233", settings: { model: "", effort: "low", instructions: "" }, variables: [{ name: "name", description: "First name" }] });
  });

  it("a null or empty value takes the key off", async () => {
    await setExtras(prompt({ text: "x", settings: { model: "m", effort: "low", instructions: "" }, variables: [{ name: "a", description: "b" }] }), { settings: null, variables: [] });
    expect(written()).toEqual({ text: "x" });
  });

  it("refuses a key the node type does not take, without writing", async () => {
    await expect(setExtras(prompt({ text: "x" }), { colour: "#fff" })).rejects.toThrow(/not a field/);
    expect(upsertNode).not.toHaveBeenCalled();
  });
});

describe("a tool tile (CA-15 P4)", () => {
  it("stores the connection under its key and the new keys only when they were given", async () => {
    await addToolTile(BUILD, [], { service: "GitHub", connection: "api_key", scopes: "read issues", permissions: "delegated", plan: "Team", setup: ["Create a token", "Add GITHUB_TOKEN"], alternatives: ["GitLab", "GitLab", "Bitbucket"], session: "s1" });
    expect(written()).toEqual({
      service: "GitHub",
      step: true,
      connection: "api_key",
      scopes: "read issues",
      session: "s1",
      permissions: "delegated",
      plan: "Team",
      setup: ["Create a token", "Add GITHUB_TOKEN"],
      alternatives: ["GitLab", "Bitbucket"],
    });
    await addToolTile(BUILD, [], { service: "Stripe" });
    expect(written()).toEqual({ service: "Stripe", step: true });
  });

  it("refuses an application that is missing, a connection that is not one, and actions that are too long", async () => {
    await expect(addToolTile(BUILD, [], { service: " " })).rejects.toThrow("A tool needs its application.");
    await expect(addToolTile(BUILD, [], { service: "X", connection: "telepathy" as never })).rejects.toThrow("That is not a way to connect a tool.");
    await expect(addToolTile(BUILD, [], { service: "X", scopes: "x".repeat(201) })).rejects.toThrow(/at most 200/);
    await expect(addToolTile(BUILD, [], { service: "X", plan: "x".repeat(81) })).rejects.toThrow(/at most 80/);
    expect(upsertNode).not.toHaveBeenCalled();
  });

  it("reads a tool saved before as it was: the stored 'app' and 'code' keep their keys and show under their new names", () => {
    const [app, code] = buildSteps([
      node({ id: "a", position: 1, type: "integration", payload: { service: "GitHub", step: true, connection: "app" } }),
      node({ id: "b", position: 2, type: "integration", payload: { service: "Stripe", step: true, connection: "code", scopes: "charged cards" } }),
    ]);
    expect(app.app).toEqual({ connection: "app", runsAt: null, scopes: null });
    expect(code.app).toEqual({ connection: "code", runsAt: null, scopes: "charged cards" });
    expect(CONNECTION_LABEL.app).toBe("Native integration");
    expect(CONNECTION_LABEL.code).toBe("Custom code");
    expect(CONNECTION_LABEL.mcp).toBe("MCP server");
  });

  it("reads the new keys defensively, and reads nothing from ones that are not the shape expected", () => {
    const [step] = buildSteps([node({ type: "integration", payload: { service: "GitHub", step: true, connection: "cli", permissions: "write", plan: "  Pro ", setup: ["a", 3, " ", "b"], alternatives: "GitLab" } })]);
    expect(step.app).toEqual({ connection: "cli", runsAt: null, scopes: null, permissions: "write", plan: "Pro", setup: ["a", "b"] });
    const [bad] = buildSteps([node({ type: "integration", payload: { service: "GitHub", step: true, permissions: "root" } })]);
    expect(bad.app).toEqual({ connection: null, runsAt: null, scopes: null });
  });

  it("setExtras writes a tool's permissions, plan, setup and alternatives, and clears them", async () => {
    const tool = node({ id: "t", type: "integration", payload: { service: "GitHub", step: true } }) as unknown as BuildNode;
    await setExtras(tool, { permissions: "read", plan: " Pro ", setup: "one\n\ntwo", alternatives: ["GitLab", "GitLab"] });
    expect(written()).toEqual({ service: "GitHub", step: true, permissions: "read", plan: "Pro", setup: ["one", "two"], alternatives: ["GitLab"] });
    await setExtras(tool, { permissions: null, plan: "", setup: [], alternatives: [] });
    expect(written()).toEqual({ service: "GitHub", step: true });
  });
});

describe("a check's extras (CA-15 P5)", () => {
  const base = { tested: "Places an order", passing: "Total shows £9.00", passed: 3, total: 4 };

  it("stores method, reviewer, scoring, model tested and evidence only when given", async () => {
    await addCheck(BUILD, [], { ...base, method: "suite", reviewer: "user", scoring: { how: "metric", target: "95% correct" }, modelTested: { model: "Opus 5.5", version: "2026-09-30" }, evidence: { url: "example.com/results" } });
    expect(written()).toEqual({
      tested: "Places an order",
      passing: "Total shows £9.00",
      passed: 3,
      total: 4,
      method: "suite",
      reviewer: "user",
      scoring: { how: "metric", target: "95% correct" },
      model_tested: { model: "Opus 5.5", version: "2026-09-30" },
      evidence: { url: "https://example.com/results" },
    });
    await addCheck(BUILD, [], base);
    expect(written()).toEqual({ tested: "Places an order", passing: "Total shows £9.00", passed: 3, total: 4 });
  });

  it("keeps one evidence file by its id and name, and a target only for a metric", async () => {
    await addCheck(BUILD, [], { ...base, scoring: { how: "rating", target: "ignored" }, evidence: { mediaId: "m1", name: "results.csv" } });
    expect(written()).toMatchObject({ scoring: { how: "rating" }, evidence: { media_id: "m1", name: "results.csv" } });
    expect((written().scoring as Record<string, unknown>).target).toBeUndefined();
  });

  it("refuses evidence that is not a URL, and an over-long target, saying so", async () => {
    await expect(addCheck(BUILD, [], { ...base, evidence: { url: "not a url" } })).rejects.toThrow("Evidence is a URL, like example.com/results.");
    await expect(addCheck(BUILD, [], { ...base, scoring: { how: "metric", target: "x".repeat(81) } })).rejects.toThrow(/at most 80/);
    expect(upsertNode).not.toHaveBeenCalled();
  });

  it("reads them back on the check's facts, and a check saved before reads as it did", () => {
    const [, before, after] = buildSteps([
      node({ id: "a", position: 1, type: "agent_config", payload: { system_prompt: "x", model: "m" } }),
      node({ id: "c1", position: 2, type: "eval_run", payload: { tested: "t", passing: "p", passed: 1, total: 1 } }),
      node({ id: "c2", position: 3, type: "eval_run", payload: { tested: "t", passing: "p", passed: 1, total: 1, method: "review", reviewer: "client", scoring: { how: "ab" }, model_tested: { model: "Opus 5.5", version: "" }, evidence: { url: "https://example.com/r" } } }),
    ]);
    expect(Object.keys(before.check ?? {}).sort()).toEqual(["onFail", "passed", "passing", "runAt", "tested", "total"]);
    expect(after.check).toMatchObject({ method: "review", reviewer: "client", scoring: { how: "ab", target: "" }, modelTested: { model: "Opus 5.5", version: "" }, evidence: { url: "https://example.com/r", mediaId: null, name: null } });
  });

  it("setExtras writes and clears them on a saved check", async () => {
    const check = node({ id: "c", type: "eval_run", payload: { tested: "t", passing: "p", passed: 1, total: 1 } }) as unknown as BuildNode;
    await setExtras(check, { method: "manual", reviewer: "you", scoring: { how: "pass_fail" }, model_tested: { model: "Opus 5.5" } });
    expect(written()).toMatchObject({ method: "manual", reviewer: "you", scoring: { how: "pass_fail" }, model_tested: { model: "Opus 5.5" } });
    await setExtras(check, { method: null, reviewer: "robot", scoring: null, model_tested: { model: "", version: "" } });
    expect(written()).toEqual({ tested: "t", passing: "p", passed: 1, total: 1 });
  });
});

describe("an agent's and a team's extras read back on the step (CA-15 P7)", () => {
  it("reads limits, output and sample on an agent, and the pattern on a team", () => {
    const [agent, team] = buildSteps([
      node({ id: "a", position: 1, type: "agent_config", payload: { system_prompt: "x", model: "m", limits: ["Never deploys", " "], output: "Slack", sample: "User: hi" } }),
      node({ id: "t", position: 2, type: "team", payload: { pattern: "parallel" } }),
    ]);
    expect(agent).toMatchObject({ limits: ["Never deploys"], output: "Slack", sample: "User: hi" });
    expect(team.pattern).toBe("parallel");
  });

  it("an agent and a team saved before read as they did", () => {
    const [agent, team] = buildSteps([
      node({ id: "a", position: 1, type: "agent_config", payload: { system_prompt: "x", model: "m" } }),
      node({ id: "t", position: 2, type: "team", payload: { pattern: "swarm" } }),
    ]);
    expect(agent.limits).toBeUndefined();
    expect(agent.output).toBeUndefined();
    expect(agent.sample).toBeUndefined();
    expect(team.pattern).toBeUndefined();
  });
});

describe("the three source tiles (CA-15 P9)", () => {
  const prompts = [node({ id: "p1", position: 1, payload: { text: "one two", session: "s1" } }), node({ id: "p2", position: 2, payload: { text: "three", session: "s2" } })];

  it("each is refused, saying so, when its node type is not live", async () => {
    getNodeType.mockResolvedValue(null);
    await expect(addSystemPromptTile(BUILD, [], { name: "Voice", text: "Be brief", scope: { kind: "all" } })).rejects.toThrow(/System prompts are not available yet/);
    await expect(addDatasetTile(BUILD, [], { name: "Orders", description: "d" })).rejects.toThrow(/Datasets are not available yet/);
    await expect(addRepoTile(BUILD, [], { url: "github.com/acme/shop", ownership: "owned" })).rejects.toThrow(/GitHub repositories are not available yet/);
    expect(upsertNode).not.toHaveBeenCalled();
  });

  it("a system prompt keeps its name as the title, and its text, scope and optional keys in the payload", async () => {
    await addSystemPromptTile(BUILD, prompts, { name: " Brand voice ", text: " Be brief ", scope: { kind: "prompts", ids: ["p1"] }, model: "Opus 5.5", version: "v2", variables: [{ name: "name", description: "First name" }], session: "s1" });
    const row = upsertNode.mock.calls.at(-1)?.[0] as { type: string; title: string };
    expect(row).toMatchObject({ type: "system_prompt", title: "Brand voice" });
    expect(written()).toMatchObject({ step: true, text: "Be brief", scope: "prompts:p1", model: "Opus 5.5", version: "v2", session: "s1" });
  });

  it("a system prompt writes no optional key it was not given", async () => {
    await addSystemPromptTile(BUILD, prompts, { name: "Voice", text: "Be brief", scope: { kind: "all" } });
    expect(written()).toEqual({ step: true, text: "Be brief", scope: "all" });
  });

  it("a system prompt is refused without a name or text, and for prompts that are not in the build", async () => {
    await expect(addSystemPromptTile(BUILD, prompts, { name: " ", text: "x", scope: { kind: "all" } })).rejects.toThrow("A system prompt needs its name.");
    await expect(addSystemPromptTile(BUILD, prompts, { name: "n", text: " ", scope: { kind: "all" } })).rejects.toThrow("A system prompt needs its text.");
    await expect(addSystemPromptTile(BUILD, prompts, { name: "n", text: "x", scope: { kind: "prompts", ids: ["nope"] } })).rejects.toThrow("Choose prompts that are in this build.");
    await expect(addSystemPromptTile(BUILD, prompts, { name: "n", text: "x", scope: { kind: "prompts", ids: [] } })).rejects.toThrow("Choose prompts that are in this build.");
    expect(upsertNode).not.toHaveBeenCalled();
  });

  it("says how many prompts a system prompt applies to: all, one session's, or the chosen ones", () => {
    const tree = [
      ...prompts,
      node({ id: "sp-all", position: 3, type: "system_prompt", payload: { step: true, text: "a", scope: "all" } }),
      node({ id: "sp-session", position: 4, type: "system_prompt", payload: { step: true, text: "b", scope: "session:s2" } }),
      node({ id: "sp-some", position: 5, type: "system_prompt", payload: { step: true, text: "c", scope: "prompts:p1,gone" } }),
    ];
    const reach = Object.fromEntries(buildSteps(tree).filter((step) => step.kind === "system_prompt").map((step) => [step.id, step.systemPrompt?.appliesTo]));
    expect(reach).toEqual({ "sp-all": 2, "sp-session": 1, "sp-some": 1 });
  });

  it("a dataset keeps its description and what it is given, and the chunking keys only for retrieval", async () => {
    await addDatasetTile(BUILD, [], { name: "Orders", description: " Last year's orders ", use: "evaluation", format: "CSV", recordCount: "1,200", columns: "id\ntotal", chunkStrategy: "paragraph", chunkSize: 512 });
    expect(written()).toEqual({ step: true, description: "Last year's orders", use: "evaluation", format: "CSV", record_count: 1200, columns: ["id", "total"] });
    await addDatasetTile(BUILD, [], { name: "Docs", description: "d", use: "retrieval", chunkStrategy: "paragraph", chunkSize: 512, chunkOverlap: 64, embeddingModel: "text-embedding" });
    expect(written()).toMatchObject({ use: "retrieval", chunk_strategy: "paragraph", chunk_size: 512, chunk_overlap: 64, embedding_model: "text-embedding" });
  });

  it("a dataset is refused without a name or a description, or with a record count that is not a whole number", async () => {
    await expect(addDatasetTile(BUILD, [], { name: "", description: "d" })).rejects.toThrow("A dataset needs its name.");
    await expect(addDatasetTile(BUILD, [], { name: "n", description: " " })).rejects.toThrow("A dataset needs its description.");
    await expect(addDatasetTile(BUILD, [], { name: "n", description: "d", recordCount: "1.5" })).rejects.toThrow("The record count is a whole number, 0 or more.");
    expect(upsertNode).not.toHaveBeenCalled();
  });

  it("a repository needs only a URL: it is stored in its plain form, with the third party's author defaulting to the owner", async () => {
    await addRepoTile(BUILD, [], { url: "www.github.com/acme/shop.git", ownership: "third_party" });
    expect(written()).toEqual({ step: true, url: "https://github.com/acme/shop", ownership: "third_party", author: "acme" });
  });

  it("a repository keeps what GitHub said, and splits the third-party keys from the maker's own", async () => {
    const fetched = { stars: 10, defaultBranch: "main", language: "Go", licenceSpdx: "MIT", licenceName: "MIT License", pushedAt: "2026-09-01T00:00:00Z", fetchedAt: "2026-10-07T09:00:00Z" };
    await addRepoTile(BUILD, [], { url: "github.com/acme/shop", ownership: "third_party", fetched, usage: ["copied"], modifications: "Changed the build", visibility: "private", pin: { kind: "tag", value: "v1" } });
    expect(written()).toMatchObject({ stars: 10, default_branch: "main", language: "Go", licence_spdx: "MIT", fetched_at: "2026-10-07T09:00:00Z", usage: ["copied"], modifications: "Changed the build", pin: { kind: "tag", value: "v1" } });
    expect(written().visibility).toBeUndefined();
    await addRepoTile(BUILD, [], { url: "github.com/me/mine", ownership: "owned", visibility: "private", generatedWith: "Lovable", deployedUrl: "mine.example.com", usage: ["copied"], author: "someone" });
    expect(written()).toMatchObject({ ownership: "owned", visibility: "private", generated_with: "Lovable", deployed_url: expect.stringContaining("mine.example.com") });
    expect(written().usage).toBeUndefined();
    expect(written().author).toBeUndefined();
  });

  it("a repository is refused for a URL that is not GitHub's, and for a run instruction that holds a key's value, which is never stored", async () => {
    await expect(addRepoTile(BUILD, [], { url: "gitlab.com/acme/shop", ownership: "owned" })).rejects.toThrow("A repository URL looks like github.com/owner/name.");
    await expect(addRepoTile(BUILD, [], { url: "github.com/acme/shop", ownership: "owned", run: ["API_KEY=abcdefghijklmnopqrstuvwxyz"] })).rejects.toThrow(/looks as if it holds a key's value/);
    expect(upsertNode).not.toHaveBeenCalled();
  });

  it("reads each back as a tile only when it says step, with its facts", () => {
    const steps = buildSteps([
      node({ id: "sp", position: 1, type: "system_prompt", payload: { step: true, text: "Be brief", scope: "all", version: "v2" } }),
      node({ id: "ds", position: 2, type: "dataset", title: "Orders", payload: { step: true, description: "d", use: "training" } }),
      node({ id: "rp", position: 3, type: "repo", payload: { step: true, url: "github.com/acme/shop", ownership: "owned" } }),
      node({ id: "old", position: 4, type: "dataset", payload: { description: "an older node, not a tile" } }),
    ]);
    expect(steps.map((step) => step.kind)).toEqual(["system_prompt", "dataset", "repo"]);
    expect(steps[0].systemPrompt).toMatchObject({ version: "v2", appliesTo: 0 });
    expect(steps[1].dataset).toMatchObject({ use: "training" });
    expect(steps[2].repo).toMatchObject({ owner: "acme", name: "shop", ownership: "owned" });
  });
});

describe("CA-18: a check's text and a piece of code's lines, updated in place", () => {
  const check = () => node({ type: "eval_run", payload: { tested: "Places an order", passing: "Shows £9", on_fail: "Showed 0", run_at: "2026-10-12", passed: 3, total: 4, method: "automated" } });
  const code = () => node({ type: "code", payload: { source: "a", language: "ts", filename: "a.ts" } });

  it("writes only the keys given and keeps every other key as it was", async () => {
    const row = check();
    await setCheckText(row, { passing: " Shows £10 ", runAt: "2026-10-20" });
    expect(written()).toEqual({ tested: "Places an order", passing: "Shows £10", on_fail: "Showed 0", run_at: "2026-10-20", passed: 3, total: 4, method: "automated" });
    expect(upsertNode.mock.calls.at(-1)?.[0]).toMatchObject({ id: row.id });
  });

  it("takes a failure note and a date off when they are emptied", async () => {
    await setCheckText(check(), { onFail: "", runAt: "" });
    expect(written()).toEqual({ tested: "Places an order", passing: "Shows £9", passed: 3, total: 4, method: "automated" });
  });

  it("holds a check to the rules Add › Check does", async () => {
    await expect(setCheckText(check(), { tested: " " })).rejects.toThrow("Add the test description.");
    await expect(setCheckText(check(), { passing: "x".repeat(281) })).rejects.toThrow("at most 280");
    await expect(setCheckText(check(), { onFail: "x".repeat(601) })).rejects.toThrow("at most 600");
    await expect(setCheckText(check(), { runAt: "12 Oct" })).rejects.toThrow("2026-10-12");
    await expect(setCheckText(code(), { tested: "x" })).rejects.toThrow("Only a check");
    expect(upsertNode).not.toHaveBeenCalled();
  });

  it("changes code's lines and language, and holds them to the rules Add › Code does", async () => {
    await setCodeSource(code(), { source: "b = 1", language: "python" });
    expect(written()).toEqual({ source: "b = 1", language: "python", filename: "a.ts" });
    await expect(setCodeSource(code(), { source: "  " })).rejects.toThrow("Code needs its lines.");
    await expect(setCodeSource(code(), { source: "x".repeat(100_001) })).rejects.toThrow("at most 100,000");
    await expect(setCodeSource(code(), { language: "cobol" })).rejects.toThrow("not a language");
    await expect(setCodeSource(check(), { source: "x" })).rejects.toThrow("Only code");
  });
});
