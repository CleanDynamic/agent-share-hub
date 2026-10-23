/* CA-18 P2: a tile's window in edit mode: what it starts with, its title, and what Save writes.

   PURE (no React). `…Current` reads a tile's view into the dialog's own starting values, so the dialog opens filled in.
   `save…` turns what the dialog holds into calls on `DetailsHandlers`: the handlers Details used, with the arguments Details
   used, and only for what changed. A dialog that gave a key the Add dialog writes and Details never did (a check's test
   description, a code tile's source) shows it and does not write it: nothing new is stored. */

import type { AgentSetupValue } from "./AgentSetupFields";
import type { AddAgentInput, AgentCurrent } from "./AddAgentDialog";
import type { AddCheckInput, CheckSeed } from "./AddCheckDialog";
import type { AddDatasetInput, DatasetCurrent } from "./AddDatasetDialog";
import type { AddManualStepInput, ManualSeed } from "./AddManualStepDialog";
import type { AddRepoInput, RepoCurrent } from "./AddRepoDialog";
import type { AddResultInput, ResultCurrent } from "./AddResultDialog";
import type { AddSystemPromptInput, SystemPromptCurrent } from "./AddSystemPromptDialog";
import type { AddToolInput } from "./AddToolDialog";
import type { CodeSeed, AddCodeInput } from "./AddCodeDialog";
import type { DetailsHandlers, DetailsView } from "./DetailsPanel";
import { agentRows, checkRows, codeRows, datasetRows, repoRows, resultRows, systemPromptRows, toolRows, type ExtraRow } from "./detailsOptional";
import { keptCases } from "./CheckCasesField";
import { isCodeLanguage } from "./codeModel";
import type { CodeLanguage } from "@/lib/build/graph";
import { toolName } from "@/lib/tools/registry";
import { scopeOf, scopeValue, datasetOf, repoOf, systemPromptOf, type SystemPromptScope } from "@/lib/build/sourceTiles";
import { variableNamesIn, variablesOf } from "@/lib/build/tileExtras";

type Raw = Record<string, unknown>;
/** The view of one kind of tile, with the `payload` and `runtime` every view can carry. */
type V<K extends DetailsView["kind"]> = Extract<DetailsView, { kind: K }>;
const payloadOf = (view: { payload?: Raw }): Raw => view.payload ?? {};
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
/** A list as the Optional rows hold it: one entry a line. */
const listText = (value: string | readonly string[] | undefined): string => (typeof value === "string" ? value : (value ?? []).join("\n"));

/* ── the title: "Tool 11 · Gmail", under the eyebrow "Edit" ── */

/** A tile's own line: its kind and number, then its name. */
export function editTitle(view: DetailsView): string {
  const named = (kind: string, number: string | null | undefined, name: string) => [number ? `${kind} ${number}` : kind, name].filter(Boolean).join(" · ");
  switch (view.kind) {
    case "prompt":
      return named("Prompt", view.number, view.title ?? view.defaultTitle);
    case "manual":
      return named("Manual step", view.number, view.title ?? view.defaultTitle);
    case "code":
      return named("Code", view.number, view.title ?? view.filename ?? view.defaultTitle);
    case "check":
      return named("Check", view.number, view.title ?? view.defaultTitle);
    case "decision":
      return named("Decision", view.number, view.title ?? view.defaultTitle);
    case "tool":
      return named("Tool", view.number, view.service);
    case "file":
      return named("File", view.number, view.name);
    case "agent":
      return named("Agent", view.number, view.name ?? view.defaultName);
    case "team":
      return named("Team", view.number, view.name ?? view.defaultName);
    case "result":
      return named("Result", view.number, view.summary || view.url || "");
    case "system_prompt":
      return named("System prompt", view.number, view.title ?? view.defaultTitle);
    case "dataset":
      return named("Dataset", view.number, view.title ?? view.defaultTitle);
    case "repo":
      return named("GitHub repository", view.number, view.title ?? repoOf(view.payload)?.name ?? view.defaultTitle);
    case "session":
      return named("Session", String(view.number), view.tool);
  }
}

/* ── what each dialog starts with ── */

export function toolCurrent(view: V<"tool">): AddToolInput {
  const rows = toolRows(payloadOf(view));
  const value = (name: string, key: string): string => rows.find((row) => row.name === name)?.values[key] ?? "";
  return {
    service: view.service,
    connection: view.connection ?? null,
    scopes: view.scopes,
    permissions: (value("Permissions", "permissions") || null) as AddToolInput["permissions"],
    plan: value("Required plan", "plan"),
    setup: value("Setup steps", "setup").split("\n").filter(Boolean),
    alternatives: value("Alternatives", "alternatives").split("\n").filter(Boolean),
  };
}

export function manualCurrent(view: V<"manual">): ManualSeed {
  return {
    where: view.where ?? (view.tool ? { kind: "app", name: view.tool, url: null } : null),
    lines: view.text.split(/\r?\n/).filter((line) => line.trim()),
    picture: view.picture?.name ?? null,
  };
}

export function codeCurrent(view: V<"code">): CodeSeed {
  // File path, tool and model are read as their Optional rows read them (the stored values), so Save compares like with like.
  const rows = codeRows(payloadOf(view));
  const value = (name: string, key: string): string => rows.find((row) => row.name === name)?.values[key] ?? "";
  return {
    source: view.source,
    language: view.language && isCodeLanguage(view.language) ? (view.language as CodeLanguage) : null,
    filename: value("File path", "filename") || null,
    tool: value("Generated with", "tool") || null,
    model: value("Generated with", "model") || null,
  };
}

export function checkCurrent(view: V<"check">): CheckSeed {
  const check = view.check;
  // The Optional rows' own values: the stored ones, so Save compares like with like.
  const rows = checkRows(payloadOf(view));
  const value = (name: string, key: string): string => rows.find((row) => row.name === name)?.values[key] ?? "";
  const evidence = rows.find((row) => row.name === "Evidence");
  return {
    tested: check.tested,
    passing: check.passing,
    failed: check.onFail ?? "",
    passed: check.passed,
    total: check.total,
    runAt: check.runAt ?? "",
    cases: check.caseList ?? [],
    method: (value("Test method", "method") || null) as CheckSeed["method"],
    reviewer: (value("Reviewer", "reviewer") || null) as CheckSeed["reviewer"],
    scoring: (value("Scoring method", "how") || null) as CheckSeed["scoring"],
    target: value("Scoring method", "target"),
    model: value("Model tested", "model"),
    version: value("Model tested", "version"),
    evidenceUrl: evidence?.note ? "" : (evidence?.values.url ?? ""),
    evidenceName: evidence?.note ? evidence.note.replace(/ is kept as the evidence\.$/, "") : null,
  };
}

export function agentCurrent(view: V<"agent" | "team">): AgentCurrent {
  const extras = Object.fromEntries(agentRows(payloadOf(view), view.kind === "team").map((row) => [row.name, row.values]));
  const setup: AgentSetupValue = view.setup ?? { harness: null, models: [{ model: view.model ?? "", role: "main" }], tools: [] };
  const flat = Object.assign({}, ...Object.values(extras)) as Record<string, string>;
  return {
    kind: view.kind,
    name: view.name ?? "",
    setup,
    instructions: view.instructions,
    limits: (flat.limits ?? "").split("\n").filter(Boolean),
    output: flat.output ?? "",
    trace: view.runtime?.agent?.traceUrl ?? "",
    transcript: flat.sample ?? "",
    pattern: (flat.pattern || null) as AgentCurrent["pattern"],
    helpers: view.runtime?.agent?.helpers ?? [],
  };
}

export function resultCurrent(view: V<"result">): ResultCurrent {
  const what = view.what ?? (view.pictures.length > 0 ? "picture" : "link");
  return {
    kind: what === "trained-model" ? "model" : what === "picture" ? "pictures" : what === "file" ? "file" : "link",
    url: view.url,
    baseModel: view.trained?.baseModel ?? "",
    method: view.trained?.method ?? "",
    caption: text(payloadOf(view).caption),
  };
}

export function systemPromptCurrent(view: V<"system_prompt">): SystemPromptCurrent {
  const facts = systemPromptOf(view.payload);
  const scope = scopeOf(view.payload.scope);
  const saved = variablesOf(view.payload.variables);
  return {
    name: view.title ?? view.defaultTitle,
    text: facts.text,
    applies: scope.kind,
    picked: scope.kind === "prompts" ? scope.ids : [],
    model: text(view.payload.model),
    version: facts.version ?? "",
    described: Object.fromEntries(variableNamesIn(facts.text).map((name) => [name, saved.find((entry) => entry.name === name)?.description ?? ""])),
  };
}

export function datasetCurrent(view: V<"dataset">): DatasetCurrent {
  const facts = datasetOf(view.payload);
  return {
    name: view.title ?? view.defaultTitle,
    description: facts.description,
    use: facts.use,
    format: facts.format ?? "",
    records: facts.recordCount === null ? "" : String(facts.recordCount),
    columns: facts.columns,
    source: facts.source ?? "",
    sample: facts.sample,
    licence: facts.licence ?? "",
    strategy: facts.chunkStrategy ?? "",
    size: facts.chunkSize === null ? "" : String(facts.chunkSize),
    overlap: facts.chunkOverlap === null ? "" : String(facts.chunkOverlap),
    embedding: facts.embeddingModel ?? "",
  };
}

export function repoCurrent(view: V<"repo">): RepoCurrent | null {
  const facts = repoOf(view.payload);
  if (!facts) return null;
  return {
    url: facts.url,
    ownership: facts.ownership,
    description: facts.description ?? "",
    author: facts.author ?? "",
    usage: facts.usage,
    visibility: facts.visibility,
    generated: facts.generatedWith,
    deployed: facts.deployedUrl ?? "",
    pinKind: facts.pin?.kind ?? null,
    pinValue: facts.pin?.value ?? "",
    path: facts.path ?? "",
    modifications: facts.modifications ?? "",
    keyFiles: facts.keyFiles,
    run: facts.run,
    fetched: facts.fetched.fetchedAt ? (facts.fetched as NonNullable<RepoCurrent["fetched"]>) : null,
  };
}

/* ── what Save writes ── */

type H = DetailsHandlers;

/** Each Optional row whose fields changed: `onExtras(id, row.toPatch(next))`, as Details wrote it. */
function saveRows(h: H, id: string, rows: readonly ExtraRow[], next: Record<string, Record<string, string>>): void {
  for (const row of rows) {
    const values = next[row.name];
    if (!values) continue;
    const merged = { ...row.values, ...values };
    if (!same(row.toPatch(merged), row.toPatch(row.values))) h.onExtras?.(id, row.toPatch(merged));
  }
}

export function saveTool(view: V<"tool">, input: AddToolInput, runsAt: V<"tool">["runsAt"], h: H): void {
  const id = view.id;
  if (input.service !== view.service) h.onFields(id, { service: input.service });
  if (input.scopes !== view.scopes) h.onFields(id, { scopes: input.scopes });
  const at = input.connection === "mcp" ? (runsAt ?? null) : null;
  if (input.connection !== (view.connection ?? null) || at !== (view.runsAt ?? null)) h.onToolConnection?.(id, input.connection, at);
  saveRows(h, id, toolRows(payloadOf(view)), {
    Permissions: { permissions: input.permissions ?? "" },
    "Required plan": { plan: input.plan },
    "Setup steps": { setup: input.setup.join("\n") },
    Alternatives: { alternatives: input.alternatives.join("\n") },
  });
}

export function saveManual(view: V<"manual">, input: AddManualStepInput, h: H): void {
  const id = view.id;
  const before = manualCurrent(view);
  const text_ = input.lines.join("\n");
  const sameWhere = input.where.kind === "app" && (before.where === null || before.where.kind === "app");
  if (sameWhere) {
    if ((input.where.name ?? "") !== view.tool) h.onManual?.(id, { tool: input.where.name ?? "" });
  } else if (!same(input.where, before.where)) h.onManual?.(id, { where: input.where });
  if (text_ !== view.text) h.onManual?.(id, { text: text_ });
  if (input.file) h.onManualPicture?.(id, input.file);
  else if (input.pictureRemoved) h.onManual?.(id, { media_id: null });
}

export function saveCode(view: V<"code">, input: AddCodeInput, h: H): void {
  const step = input.steps[0];
  saveRows(h, view.id, codeRows(payloadOf(view)), {
    "File path": { filename: step?.filename ?? "" },
    "Generated with": { tool: input.tool ?? "", model: input.model ?? "" },
  });
}

export function saveCheck(view: V<"check">, input: AddCheckInput, h: H): void {
  const id = view.id;
  const before = checkCurrent(view);
  const cases = keptCases(input.cases ?? []);
  if (!same(cases, keptCases(before.cases))) h.onCheckCases?.(id, cases);
  saveRows(h, id, checkRows(payloadOf(view)), {
    "Test method": { method: input.method ?? "" },
    Reviewer: { reviewer: input.reviewer ?? "" },
    "Scoring method": { how: input.scoring?.how ?? "", target: input.scoring?.target ?? "" },
    "Model tested": { model: input.modelTested?.model ?? "", version: input.modelTested?.version ?? "" },
    ...(before.evidenceName ? null : { Evidence: { url: input.evidenceUrl ?? "" } }),
  });
}

export function saveAgent(view: V<"agent" | "team">, input: AddAgentInput, h: H): void {
  const id = view.id;
  const now = agentCurrent(view);
  if (input.name !== (view.name ?? null) && (input.name ?? "") !== (view.name ?? "")) h.onRename(id, input.name ?? "");
  if (view.kind === "agent") {
    const next = { model: input.model, harness: input.harness, ...(input.models ? { models: input.models } : null), tools: input.tools, ...(input.memory !== undefined ? { memory: input.memory } : view.setup?.memory ? { memory: "" } : null) };
    const had = view.setup ? { harness: view.setup.harness, models: view.setup.models, tools: view.setup.tools, memory: view.setup.memory ?? undefined } : null;
    const changed = !had || had.harness !== input.harness || !same(had.models.map((row) => [row.model, row.role]), (input.models ?? [{ model: input.model, role: "main" }]).map((row) => [row.model, row.role])) || !same(had.tools, input.tools) || (had.memory ?? "") !== (input.memory ?? "");
    if (changed) h.onAgentSetup?.(id, next);
    if ((input.instructions ?? "") !== view.instructions) h.onInstructions?.(id, input.instructions ?? "");
  }
  const rows = agentRows(payloadOf(view), view.kind === "team");
  saveRows(
    h,
    id,
    rows,
    view.kind === "team"
      ? { "Orchestration pattern": { pattern: input.pattern ?? "" } }
      : { Limits: { limits: listText(input.limits) }, "Output and destination": { output: input.output ?? "" }, "Sample run": { sample: input.sample ?? "" } },
  );
  void now;
}

export function saveResult(view: V<"result">, input: AddResultInput, h: H): void {
  const id = view.id;
  const now = resultCurrent(view);
  const trained = input.kind === "model";
  if (trained !== (now.kind === "model")) h.onFields(id, { kind: trained ? "trained-model" : null });
  if (input.kind === "link" && input.url !== view.url) h.onFields(id, { url: input.url });
  if (input.kind === "model") {
    if (input.baseModel !== now.baseModel) h.onFields(id, { base_model: input.baseModel || null });
    if (input.method !== now.method) h.onFields(id, { method: input.method });
  }
  saveRows(h, id, resultRows(payloadOf(view)), { Caption: { caption: input.caption } });
}

export function saveSystemPrompt(view: V<"system_prompt">, input: AddSystemPromptInput, h: H): void {
  const id = view.id;
  const now = systemPromptCurrent(view);
  if (input.name !== now.name && input.name !== (view.title ?? "")) h.onRename(id, input.name);
  if (input.text !== now.text) h.onExtras?.(id, { text: input.text });
  const scope: SystemPromptScope = input.scope;
  if (!same(scope, scopeOf(view.payload.scope))) h.onExtras?.(id, { scope: scopeValue(scope) });
  const names = variableNamesIn(input.text);
  saveRows(h, id, systemPromptRows({ ...view.payload, text: input.text }), {
    Model: { model: input.model ?? "" },
    Version: { version: input.version ?? "" },
    Variables: Object.fromEntries(names.map((name) => [name, input.variables?.find((entry) => entry.name === name)?.description ?? ""])),
  });
}

export function saveDataset(view: V<"dataset">, input: AddDatasetInput, h: H): void {
  const id = view.id;
  const now = datasetCurrent(view);
  if (input.name !== now.name && input.name !== (view.title ?? "")) h.onRename(id, input.name);
  if (input.description !== now.description) h.onExtras?.(id, { description: input.description });
  if ((input.use ?? null) !== now.use) h.onExtras?.(id, { use: input.use });
  saveRows(h, id, datasetRows({ ...view.payload, use: input.use ?? undefined }), {
    Format: { format: input.format ?? "" },
    "Record count": { records: input.recordCount ? String(input.recordCount) : "" },
    Columns: { columns: listText(input.columns) },
    Source: { source: input.source ?? "" },
    "Sample records": { sample: listText(input.sample) },
    Licence: { licence: input.licence ?? "" },
    Chunking: { strategy: input.chunkStrategy ?? "", size: input.chunkSize ? String(input.chunkSize) : "", overlap: input.chunkOverlap ? String(input.chunkOverlap) : "", embedding: input.embeddingModel ?? "" },
  });
}

export function saveRepo(view: V<"repo">, input: AddRepoInput, h: H): void {
  const id = view.id;
  const now = repoCurrent(view);
  if (!now) return;
  const save = (patch: Record<string, unknown>) => h.onExtras?.(id, patch);
  if (input.url !== now.url) save({ url: input.url });
  if (input.ownership !== now.ownership) save({ ownership: input.ownership });
  if ((input.description ?? "") !== now.description) save({ description: input.description ?? "" });
  if (input.ownership === "third_party") {
    if ((input.author ?? "") !== now.author) save({ author: input.author ?? "" });
    if (!same(input.usage ?? [], now.usage)) save({ usage: input.usage ?? [] });
  }
  if (input.ownership === "created" || input.ownership === "owned") {
    if ((input.visibility ?? null) !== now.visibility) save({ visibility: input.visibility ?? null });
    if ((input.generatedWith ?? null) !== now.generated) save({ generated_with: input.generatedWith ?? null });
    if ((input.deployedUrl ?? "") !== now.deployed) save({ deployed_url: input.deployedUrl ?? "" });
  }
  saveRows(h, id, repoRows(view.payload), {
    "Pinned version": { kind: input.pin?.kind ?? "", value: input.pin?.value ?? "" },
    Path: { path: input.path ?? "" },
    Modifications: { modifications: input.modifications ?? "" },
    "Key files": { keyFiles: listText(input.keyFiles) },
    "Run instructions": { run: listText(input.run) },
  });
}

/** A tool's own name for the eyebrow of a tool-less tile; kept here so the title line has one place. */
export const toolLine = (tool: string | null | undefined): string => (tool ? (toolName(tool) ?? tool) : "");
