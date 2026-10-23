// CA-18 P1: one list of sections for each kind of tile.
//
// A tile's modal (to change it) and the Details panel (to read it) show the same sections, with the same names, in the same
// order. Both take them from here: the label, the grey line under it, whether the modal needs it, and `read`, which says what
// the tile holds for that section in a form Details can draw, or null when the section is empty (Details leaves it out and
// names it once at the foot).
//
// PURE. No React, no I/O. `read` takes the view the Details panel is given (`DetailsView`, type only) and a `BuildFacts`
// for naming other tiles. Nothing here writes anything.

import type { DetailsView } from "@/pages/site/compose/DetailsPanel";
import { asksHowRun, modelRunLine } from "@/lib/build/modelRun";
import { goalLine } from "@/lib/build/making";
import { HELPER_JOB_LABEL } from "@/lib/build/helpers";
import { QUESTION_TYPE_LABEL } from "@/lib/build/decision";
import { SHAPE_HOW_LABEL } from "@/lib/build/answerShape";
import { modelLabel } from "@/lib/models/registry";
import { toolName } from "@/lib/tools/registry";
import { CONNECTION_LABEL } from "@/lib/build/graph";
import {
  AGENT_PATTERN_LABEL,
  CHECK_METHOD_LABEL,
  CHECK_REVIEWER_LABEL,
  EFFORT_LABEL,
  SCORING_LABEL,
  TOOL_PERMISSION_LABEL,
  agentExtrasOf,
  checkExtrasOf,
  patternOf,
  settingsOf,
  toolExtrasOf,
  variableNamesIn,
  variablesOf,
} from "@/lib/build/tileExtras";
import { DATASET_USE_LABEL, REPO_OWNERSHIP_LABEL, REPO_PIN_LABEL, REPO_USAGE_LABEL, datasetOf, repoOf, scopeOf, systemPromptOf } from "@/lib/build/sourceTiles";

export type TileKind = DetailsView["kind"];

/* ── what a section holds, for reading ── */

/** One tile named in a list: its number, its name, its kind and its session. */
export interface TileRef {
  id: string;
  number: string | null;
  name: string;
  /** "Result", "Prompt", "File"...; null when it is not known. */
  kind: string | null;
  /** "Session 1". */
  session: string | null;
}

export interface BuildFacts {
  /** The tile with this id, or null when the build does not hold it. */
  ref: (id: string) => TileRef | null;
}

export interface ListItem {
  id?: string;
  /** The tile's number in a badge ("3", "3.1"), or a mark ("1", "2") for a plain list. */
  badge: string | null;
  /** A tool's name, drawn as its mark in place of the badge. */
  tool?: string;
  name: string;
  /** "Result": drawn as "· Result". */
  kind?: string | null;
  /** Grey detail after the name. */
  detail?: string | null;
  /** At the right ("Session 1", "Read and write"). */
  value?: string | null;
}

export type SectionValue =
  | { type: "prose"; text: string; count: string | null; muted?: boolean; copy?: boolean; code?: boolean; /** The words a reader changes, as ranges of `text`. */ changes?: readonly { start: number; end: number }[] }
  | { type: "rows"; rows: { label: string; value: string }[]; count: string | null }
  | { type: "list"; items: ListItem[]; count: string | null }
  | { type: "chips"; chips: string[]; count: string | null }
  | { type: "links"; items: ListItem[]; count: string | null };

export interface SectionDef {
  key: string;
  label: string;
  /** The modal's grey line under the label. */
  hint: string;
  required: boolean;
  /** What the tile holds for this section, or null when it holds nothing. */
  read: (tile: DetailsView, build: BuildFacts) => SectionValue | null;
}

export interface ReadSection {
  key: string;
  label: string;
  value: SectionValue;
}

/* ── small readers ── */

type Raw = Record<string, unknown>;
const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const payloadOf = (tile: DetailsView): Raw => (tile.payload ?? {}) as Raw;
const noun = (n: number, one: string, many = `${one}s`): string => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;
export const wordsCount = (n: number): string => noun(n, "word");

const nothing = (value: string | null | undefined): boolean => !value || !value.trim();

const prose = (text: string, count: string | null = null, extra: Partial<Extract<SectionValue, { type: "prose" }>> = {}): SectionValue | null => (nothing(text) ? null : { type: "prose", text: text.trim(), count, ...extra });
const rows = (pairs: readonly (readonly [string, string | null | undefined])[], count: string | null = null): SectionValue | null => {
  const kept = pairs.flatMap(([label, value]) => (nothing(value) ? [] : [{ label, value: (value as string).trim() }]));
  return kept.length === 0 ? null : { type: "rows", rows: kept, count };
};
const one = (label: string, value: string | null | undefined): SectionValue | null => rows([[label, value]]);
const chips = (items: readonly string[], count: string | null = null): SectionValue | null => {
  const kept = items.map((item) => item.trim()).filter(Boolean);
  return kept.length === 0 ? null : { type: "chips", chips: kept, count: count ?? noun(kept.length, "item") };
};

/** A line per entry, as a plain numbered list. */
const numbered = (lines: readonly string[], one_: string): SectionValue | null => {
  const kept = lines.map((line) => line.trim()).filter(Boolean);
  return kept.length === 0 ? null : { type: "list", items: kept.map((name, at) => ({ badge: String(at + 1), name })), count: noun(kept.length, one_) };
};

const refItem = (build: BuildFacts, id: string, fallback: string): ListItem => {
  const ref = build.ref(id);
  if (!ref) return { id, badge: null, name: fallback };
  // A tool is drawn as its mark in place of a number.
  return { id, badge: ref.number, name: ref.name, kind: ref.kind, value: ref.session, ...(ref.kind === "Tool" ? { tool: ref.name, kind: null } : null) };
};

const tiles = (n: number) => noun(n, "tile");

/** The "Uses" rows: what the tile takes in. */
function usesOf(tile: DetailsView, build: BuildFacts): SectionValue | null {
  if (!("uses" in tile) || tile.uses.length === 0) return null;
  const items = tile.uses.map((row) => ({ ...refItem(build, row.use.node_id, row.label), ...(build.ref(row.use.node_id) ? null : { detail: row.sub }) }));
  return { type: "links", items, count: tiles(items.length) };
}

function goesIntoOf(tile: DetailsView, build: BuildFacts): SectionValue | null {
  if (!("goesInto" in tile) || tile.goesInto.length === 0) return null;
  const items = tile.goesInto.map((row) => (row.id === "result" ? { badge: null, name: "Result" } : refItem(build, row.id, row.label)));
  return { type: "links", items, count: tiles(items.length) };
}

function usedByOf(tile: DetailsView, build: BuildFacts): SectionValue | null {
  if (!("usedBy" in tile) || tile.usedBy.length === 0) return null;
  const items = tile.usedBy.map((row) => refItem(build, row.id, row.label));
  return { type: "links", items, count: tiles(items.length) };
}

function makesOf(tile: DetailsView): SectionValue | null {
  if (!("makes" in tile) || tile.makes.length === 0) return null;
  return { type: "list", items: tile.makes.map((row, at) => ({ id: row.id, badge: String(at + 1), name: row.name, kind: "File" })), count: noun(tile.makes.length, "file") };
}

function modelRunOf(tile: DetailsView): SectionValue | null {
  if (tile.kind === "prompt") return tile.modelRun?.run ? one("How it was run", modelRunLine(tile.model ?? "", tile.modelRun.run)) : null;
  if (tile.kind === "agent" || tile.kind === "team") return tile.modelRun ? one("How it was run", modelRunLine(tile.model ?? "", tile.modelRun)) : null;
  return null;
}

/** Every tile that can run: its answer shape, helpers and so on come from `tile.runtime`. */
const runtimeReaders = {
  runsWhen: (tile: DetailsView): SectionValue | null => one("Runs when", tile.runtime?.runsWhen?.currentLabel ?? null),
  helpers: (tile: DetailsView): SectionValue | null => {
    const helpers = tile.runtime?.agent?.helpers ?? [];
    return helpers.length === 0 ? null : { type: "list", items: helpers.map((helper, at) => ({ badge: String(at + 1), name: HELPER_JOB_LABEL[helper.job] ?? helper.job, detail: [helper.provider, helper.model].filter(Boolean).join(" · ") || null })), count: noun(helpers.length, "supporting model") };
  },
  definedIn: (tile: DetailsView): SectionValue | null => {
    const agent = tile.runtime?.agent;
    if (!agent) return null;
    return chips(agent.codeTiles.filter((entry) => agent.definedIn.includes(entry.id)).map((entry) => entry.label), "");
  },
  trace: (tile: DetailsView): SectionValue | null => one("Trace link", tile.runtime?.agent?.traceUrl),
  install: (tile: DetailsView): SectionValue | null => {
    const install = tile.runtime?.agent?.install ?? tile.runtime?.install;
    return nothing(install) ? null : { type: "prose", text: (install as string).trim(), count: null, code: true, copy: true };
  },
  shape: (tile: DetailsView): SectionValue | null => {
    const shape = tile.runtime?.shape?.shape;
    return shape ? rows([["How", SHAPE_HOW_LABEL[shape.how]], ["Where", shape.where], ["Schema", shape.schema ? "Written out" : null], ["Sample", shape.sample ? "Given" : null]]) : null;
  },
  buildCost: (tile: DetailsView): SectionValue | null => costRows(tile.runtime?.costs?.build ?? null),
  runCost: (tile: DetailsView): SectionValue | null => costRows(tile.runtime?.costs?.run ?? null),
} as const;

const money = (figures: { cost?: number; currency?: string }): string | null => (figures.cost === undefined ? null : `${figures.currency === "USD" ? "$" : "£"}${figures.cost.toLocaleString("en-GB")}`);

function costRows(figures: { ms?: number; tokensIn?: number; tokensOut?: number; cost?: number; currency?: string } | null): SectionValue | null {
  if (!figures) return null;
  return rows([
    ["Time", figures.ms !== undefined ? `${Math.round(figures.ms / 1000).toLocaleString("en-GB")} s` : null],
    ["Tokens in", figures.tokensIn !== undefined ? figures.tokensIn.toLocaleString("en-GB") : null],
    ["Tokens out", figures.tokensOut !== undefined ? figures.tokensOut.toLocaleString("en-GB") : null],
    ["Cost", money(figures)],
  ]);
}

/* ── the words each section uses (the modals' own) ── */

const S = (key: string, label: string, hint: string, read: SectionDef["read"], required = false): SectionDef => ({ key, label, hint, required, read });

const RUNTIME = {
  runsWhen: S("runsWhen", "Runs when", "Only when a decision above it went a certain way", runtimeReaders.runsWhen),
  helpers: S("helpers", "Supporting models", "Models that summarise history or extract fields for the agent", runtimeReaders.helpers),
  definedIn: S("definedIn", "Defined in", "The Code tiles that define it", runtimeReaders.definedIn),
  trace: S("trace", "Trace link", "https only, optional", runtimeReaders.trace),
  install: S("install", "How to install", "Optional, exactly as you would type it", runtimeReaders.install),
  shape: S("shape", "Answer shape", "How the answer was constrained, and the schema", runtimeReaders.shape),
  buildCost: S("buildCost", "What it took to make", "Time, tokens and cost of making it", runtimeReaders.buildCost),
  runCost: S("runCost", "What it costs to run", "Time, tokens and cost of each run", runtimeReaders.runCost),
} as const;

const USES = S("uses", "Uses", "What it takes in", usesOf);
const MAKES = S("makes", "Makes", "Files it makes", (tile) => makesOf(tile));
const GOES = S("goesInto", "Goes into", "Where its work goes", goesIntoOf);
const MODEL_RUN = S("modelRun", "How it was run", "Where the model ran, and its size", (tile) => modelRunOf(tile));

const textOf = (tile: DetailsView): string => ("text" in tile ? tile.text : "");

const PROMPT: readonly SectionDef[] = [
  S("prompt", "Prompt", "What you sent to the model", (tile) => (tile.kind === "prompt" ? prose(tile.text, wordsCount(tile.words), { copy: true, ...(tile.changes?.length ? { changes: tile.changes } : null) }) : null), true),
  S("response", "Response", "What came back", (tile) => {
    const reply = str(payloadOf(tile).reply);
    return prose(reply, `${reply.length.toLocaleString("en-GB")} characters`, { muted: true });
  }),
  S("model", "Model", "The model that answered", (tile) => (tile.kind === "prompt" && tile.typed ? one("Model", tile.model) : null)),
  MODEL_RUN,
  USES,
  MAKES,
  GOES,
  S("settings", "Model settings", "Model, reasoning effort, custom instructions and project knowledge", (tile) => {
    const settings = settingsOf(payloadOf(tile).settings);
    return settings ? rows([["Model", settings.model ? modelLabel(settings.model) : null], ["Reasoning effort", settings.effort !== "default" ? EFFORT_LABEL[settings.effort] : null], ["Custom instructions", settings.instructions]]) : null;
  }),
  S("variables", "Variables", "Words a copier replaces, such as {company name}", (tile) => {
    const names = variableNamesIn(textOf(tile));
    if (names.length === 0) return null;
    const saved = variablesOf(payloadOf(tile).variables);
    return { type: "rows", rows: names.map((name) => ({ label: `{${name}}`, value: saved.find((entry) => entry.name === name)?.description || "No description" })), count: `${noun(names.length, "word")} a copier replaces` };
  }),
  RUNTIME.shape,
  RUNTIME.buildCost,
];

const MANUAL: readonly SectionDef[] = [
  S("where", "Where was it done?", "An app or website, a terminal, a phone, offline or another website", (tile) => (tile.kind === "manual" ? one("Tool", tile.tool) : null), true),
  S("done", "What was done", "Up to twelve lines", (tile) => {
    if (tile.kind !== "manual") return null;
    const lines = tile.text.split(/\r?\n/).filter((line) => line.trim());
    return numbered(lines, "line");
  }, true),
  S("picture", "Picture, optional", "One picture of the step", (tile) => (tile.kind === "manual" && tile.picture ? { type: "list", items: [{ badge: "1", name: tile.picture.name }], count: noun(1, "picture") } : null)),
  USES,
  MAKES,
  GOES,
  RUNTIME.buildCost,
];

const CODE: readonly SectionDef[] = [
  S("code", "Code", "Source code produced in this step, as it was used", (tile) => (tile.kind === "code" ? prose(tile.source, noun(tile.lines, "line"), { copy: true, code: true }) : null), true),
  S("language", "Language", "The language the code is written in", (tile) => (tile.kind === "code" ? one("Language", tile.language) : null)),
  S("filename", "File path", "Where the file lives in the project", (tile) => (tile.kind === "code" ? one("File path", tile.filename) : null)),
  S("writtenWith", "Generated with", "The tool and model that wrote it", (tile) => (tile.kind === "code" ? rows([["Tool", tile.tool ? (toolName(tile.tool) ?? tile.tool) : null], ["Model", tile.model]]) : null)),
  USES,
  MAKES,
  GOES,
  RUNTIME.runsWhen,
  RUNTIME.install,
  RUNTIME.buildCost,
  RUNTIME.runCost,
];

const CHECK: readonly SectionDef[] = [
  S("tested", "Test description", "What the check tests", (tile) => (tile.kind === "check" ? prose(tile.check.tested) : null), true),
  S("passing", "Pass criteria", "What counts as passing", (tile) => (tile.kind === "check" ? prose(tile.check.passing) : null)),
  S("runs", "Runs", "Or add test cases below", (tile) => {
    if (tile.kind !== "check") return null;
    const runs = tile.check.runs ?? [];
    if (runs.length > 0) return { type: "list", items: runs.map((run, at) => ({ badge: String(at + 1), name: `${run.passed} of ${run.total} passed`, detail: run.at ?? null })), count: noun(runs.length, "run") };
    return tile.check.passed !== null && tile.check.total !== null ? rows([["Passed", `${tile.check.passed} of ${tile.check.total}`]]) : null;
  }),
  S("cases", "Test cases", "Inputs, expected outputs and actual outputs", (tile) => {
    if (tile.kind !== "check") return null;
    const cases = tile.check.caseList ?? [];
    return cases.length === 0 ? null : { type: "list", items: cases.map((entry, at) => ({ badge: String(at + 1), name: entry.input || `Case ${at + 1}`, detail: entry.expected || null, value: entry.passed === true ? "Passed" : entry.passed === false ? "Failed" : null })), count: noun(cases.length, "test case") };
  }),
  S("failed", "Failure notes", "What failed, and what was changed before the next run", (tile) => (tile.kind === "check" ? prose(tile.check.onFail ?? "") : null)),
  S("lastRun", "Last run date", "When the test last ran", (tile) => (tile.kind === "check" ? one("Last run", tile.check.runAt) : null)),
  S("method", "Test method", "Manual, automated, test suite, peer review or comparison", (tile) => {
    const method = checkExtrasOf(payloadOf(tile)).method;
    return method ? one("Test method", CHECK_METHOD_LABEL[method]) : null;
  }),
  S("reviewer", "Reviewer", "You, a user or a client", (tile) => {
    const reviewer = checkExtrasOf(payloadOf(tile)).reviewer;
    return reviewer ? one("Reviewer", CHECK_REVIEWER_LABEL[reviewer]) : null;
  }),
  S("scoring", "Scoring method", "Pass or fail, a metric against a target, a rating, or an A/B comparison", (tile) => {
    const scoring = checkExtrasOf(payloadOf(tile)).scoring;
    return scoring ? rows([["Scoring", SCORING_LABEL[scoring.how]], ["Target", scoring.how === "metric" ? scoring.target : null]]) : null;
  }),
  S("modelTested", "Model tested", "The model and version the test ran against", (tile) => {
    const tested = checkExtrasOf(payloadOf(tile)).modelTested;
    return tested ? rows([["Model", tested.model ? modelLabel(tested.model) : null], ["Version", tested.version]]) : null;
  }),
  S("evidence", "Evidence", "A log, a screenshot, or a link to the test run", (tile) => {
    const evidence = checkExtrasOf(payloadOf(tile)).evidence;
    return evidence ? rows([["File", evidence.mediaId ? (evidence.name ?? "A file") : null], ["Link", evidence.url]]) : null;
  }),
  USES,
  GOES,
];

const DECISION: readonly SectionDef[] = [
  S("provider", "Model or service", "The model or service the application asks", (tile) => (tile.kind === "decision" ? one("Model or service", tile.draft.provider ? (toolName(tile.draft.provider) ?? tile.draft.provider) : null) : null), true),
  S("version", "Version", "The version of the model or service", (tile) => (tile.kind === "decision" ? one("Version", tile.draft.model) : null)),
  S("invocation", "Invocation", "Direct, or through an adapter", (tile) => (tile.kind === "decision" && tile.draft.provider ? one("Invocation", tile.draft.via === "adapter" ? "Through an adapter" : "Direct") : null)),
  S("questions", "Questions", "What the decision asks, and how it is answered", (tile) => {
    if (tile.kind !== "decision") return null;
    const questions = tile.draft.questions.filter((question) => question.id.trim());
    return questions.length === 0 ? null : { type: "list", items: questions.map((question, at) => ({ badge: String(at + 1), name: question.id, detail: QUESTION_TYPE_LABEL[question.type] ?? question.type })), count: noun(questions.length, "question") };
  }, true),
  S("callingCode", "Calling code", "The code that sends the request, added as a Code tile", (tile) => {
    if (tile.kind !== "decision") return null;
    return chips(tile.draft.calledFrom.map((id) => tile.codeTiles.find((code) => code.id === id)?.label ?? id), "");
  }),
  S("input", "Input", "The output of another step, or sample text", (tile) => {
    if (tile.kind !== "decision") return null;
    const draft = tile.draft;
    return draft.reads === "step" ? one("Output of another step", tile.stepChoices.find((step) => step.id === draft.stateFrom)?.label) : prose(draft.stateSample, null);
  }),
  S("recorded", "Recorded answer", "One real answer the model returned", (tile) => {
    if (tile.kind !== "decision") return null;
    const answers = Object.entries(tile.draft.answer).filter(([, answer]) => answer.value.trim());
    return answers.length === 0 ? null : { type: "rows", rows: answers.map(([id, answer]) => ({ label: id, value: answer.sure ? `${answer.value} · ${answer.sure}%` : answer.value })), count: null };
  }),
  S("install", "Installation command", "Exactly as you typed it", (tile) => (tile.kind === "decision" ? prose(tile.draft.install, null, { code: true, copy: true }) : null)),
  S("examples", "Examples", "Real inputs with the output returned for each", (tile) => {
    if (tile.kind !== "decision") return null;
    const examples = tile.draft.examples ?? [];
    return examples.length === 0 ? null : { type: "list", items: examples.map((example, at) => ({ badge: String(at + 1), name: example.input })), count: noun(examples.length, "example") };
  }),
  S("lowConfidence", "Low-confidence handling", "A confidence threshold, or escalation to a person", (tile) => {
    if (tile.kind !== "decision") return null;
    const low = tile.draft.lowConfidence;
    return low.mode === "threshold" && low.threshold.trim() ? one("Confidence threshold", low.threshold) : low.mode === "escalate" ? one("Low confidence", "Escalate to a person") : null;
  }),
  RUNTIME.runsWhen,
  RUNTIME.buildCost,
  RUNTIME.runCost,
];

const FILE: readonly SectionDef[] = [
  S("from", "From", "Where the file came from", (tile) => (tile.kind === "file" ? rows([["From", tile.from], ["Size", tile.size]]) : null)),
  S("usedBy", "Used by", "The steps that take it in", usedByOf),
];

const TOOL: readonly SectionDef[] = [
  S("tool", "Application", "An external application the model used during the build", (tile) => (tile.kind === "tool" ? one("Application", tile.service) : null), true),
  S("connected", "Connection method", "MCP server, native integration, custom code and 6 more", (tile) => {
    if (tile.kind !== "tool" || !tile.connection) return null;
    return rows([["Connection method", CONNECTION_LABEL[tile.connection]], ["Where it ran", tile.connection === "mcp" ? (tile.runsAt === "web" ? "At a web address" : tile.runsAt === "local" ? "On my computer" : null) : null]]);
  }),
  S("did", "Actions performed", "What the application did in this build", (tile) => (tile.kind === "tool" ? prose(tile.scopes) : null)),
  S("permissions", "Permissions", "Read only, read and write, or acting on your behalf", (tile) => {
    const permissions = toolExtrasOf(payloadOf(tile)).permissions;
    return permissions ? one("Permissions", TOOL_PERMISSION_LABEL[permissions]) : null;
  }),
  S("plan", "Required plan", "Free, or the name of the paid plan", (tile) => one("Required plan", toolExtrasOf(payloadOf(tile)).plan)),
  S("setup", "Setup steps", "The steps required to connect it", (tile) => numbered(toolExtrasOf(payloadOf(tile)).setup ?? [], "step")),
  S("alternatives", "Alternatives", "Other applications that perform the same function", (tile) => chips(toolExtrasOf(payloadOf(tile)).alternatives ?? [], noun((toolExtrasOf(payloadOf(tile)).alternatives ?? []).length, "application"))),
  S("toolsUsed", "Tools it used", "The tools it was seen calling", (tile) => (tile.kind === "tool" && (tile.toolsUsed ?? []).length > 0 ? { type: "list", items: (tile.toolsUsed ?? []).map((used, at) => ({ badge: String(at + 1), name: used.name, value: String(used.count) })), count: noun(tile.toolsUsed?.length ?? 0, "tool") } : null)),
  S("usedBy", "Used by", "The steps that take it in", usedByOf),
  RUNTIME.runsWhen,
  RUNTIME.runCost,
];

const AGENT_SECTIONS = (team: boolean): readonly SectionDef[] => [
  S("model", team ? "Team" : "Models", team ? "Several agents working together" : "The main model, and up to three more with their roles", (tile) => {
    if (tile.kind !== "agent" && tile.kind !== "team") return null;
    if (tile.kind === "agent" && tile.setup) {
      return rows([["Runs in", tile.setup.harness ? (toolName(tile.setup.harness) ?? tile.setup.harness) : "My own code (API)"], ...tile.setup.models.map((row, at) => [at === 0 ? "Model" : `Model ${at + 1}`, `${row.model ? modelLabel(row.model) : ""} · ${row.role}`] as const)]);
    }
    return rows([["In", tile.parent], ["Model", tile.model]]);
  }, !team),
  S("instructions", "System instructions", "What the agent is told to do", (tile) => (tile.kind === "agent" ? prose(tile.instructions, wordsCount(tile.instructions.split(/\s+/).filter(Boolean).length)) : null)),
  S("tools", "Available tools", "Applications the agent can call", (tile) => (tile.kind === "agent" ? chips(tile.setup?.tools ?? [], noun(tile.setup?.tools.length ?? 0, "application")) : null)),
  S("starts", "Trigger", "Manual, scheduled, or started by an event", (tile) => {
    if (tile.kind !== "agent" && tile.kind !== "team") return null;
    return tile.runs && tile.runs.how !== "once" ? one("How it runs", [tile.runs.how === "parallel" ? `${tile.runs.count ?? ""} at the same time` : tile.runs.detail ?? tile.runs.how].filter(Boolean).join(" ")) : null;
  }),
  S("memory", "Memory", "What the agent keeps between runs, and where", (tile) => (tile.kind === "agent" ? rows([["What it remembers", tile.setup?.memory], ["How it tidies", tile.memoryTidy], ["Changes each round", tile.changesEachRound]]) : null)),
  MODEL_RUN,
  RUNTIME.helpers,
  S("limits", "Limits", "Maximum steps, budget or run time, approvals and prohibited actions", (tile) => numbered(agentExtrasOf(payloadOf(tile)).limits ?? [], "limit")),
  S("output", "Output and destination", "A file, a message or a pull request, and where it is delivered", (tile) => prose(agentExtrasOf(payloadOf(tile)).output ?? "")),
  S("sample", "Sample run", "A transcript or trace of one real run", (tile) => prose(agentExtrasOf(payloadOf(tile)).sample ?? "", null, { code: true, copy: true })),
  S("pattern", "Orchestration pattern", "Sequential, lead with delegates, parallel then merged, or writer and reviewer", (tile) => {
    const pattern = patternOf(payloadOf(tile).pattern);
    return team && pattern ? one("Pattern", AGENT_PATTERN_LABEL[pattern]) : null;
  }),
  S("inside", "Inside", "The prompts or agents it holds", (tile) => {
    if (tile.kind !== "agent" && tile.kind !== "team") return null;
    return tile.insideRows.length === 0 ? null : { type: "links", items: tile.insideRows.map((row) => ({ id: row.id, badge: row.label.split(" · ")[0] ?? null, name: row.label.split(" · ").slice(1).join(" · ") || row.label })), count: tile.inside };
  }),
  USES,
  GOES,
  RUNTIME.runsWhen,
  ...(team ? [] : [RUNTIME.definedIn, RUNTIME.trace, RUNTIME.install, RUNTIME.shape]),
  RUNTIME.buildCost,
  RUNTIME.runCost,
];

const RESULT: readonly SectionDef[] = [
  S("summary", "Summary", "What the result is", (tile) => (tile.kind === "result" ? prose(tile.summary) : null)),
  S("outputType", "Output type", "A link, a picture, a file or a trained model", (tile) => {
    if (tile.kind !== "result") return null;
    const label = { link: "Link", picture: "Image or video", file: "File", "trained-model": "Model" } as const;
    return one("Output type", label[tile.what ?? (tile.pictures.length > 0 ? "picture" : "link")]);
  }, true),
  S("url", "URL", "Where to see it", (tile) => (tile.kind === "result" ? one("URL", tile.url) : null)),
  S("baseModel", "Base model", "The model it was trained from", (tile) => (tile.kind === "result" && tile.trained ? one("Base model", tile.trained.baseModel ? modelLabel(tile.trained.baseModel) : null) : null)),
  S("method", "Training method", "How the model was trained", (tile) => (tile.kind === "result" && tile.trained ? one("Training method", tile.trained.method) : null)),
  S("caption", "Caption", "One line describing what the output shows", (tile) => one("Caption", str(payloadOf(tile).caption))),
  S("pictures", "Images and videos", "Pictures kept with the result", (tile) => (tile.kind === "result" && tile.pictures.length > 0 ? { type: "list", items: tile.pictures.map((picture, at) => ({ id: picture.id, badge: String(at + 1), name: picture.name })), count: noun(tile.pictures.length, "file") } : null)),
  S("trainedOn", "Trained on", "The ratings or examples it learned from", (tile) => {
    if (tile.kind !== "result" || !tile.trained?.trainedOn) return null;
    const on = tile.trained.trainedOn;
    return { type: "list", items: [{ id: on.id, badge: "1", name: on.name, value: on.rows ? `${on.rows.toLocaleString("en-GB")} rows` : null }], count: null };
  }),
];

const SYSTEM_PROMPT: readonly SectionDef[] = [
  S("name", "Name", "What this system prompt is called", (tile) => (tile.kind === "system_prompt" ? one("Name", tile.title ?? tile.defaultTitle) : null), true),
  S("text", "Text", "The instructions", (tile) => (tile.kind === "system_prompt" ? prose(systemPromptOf(tile.payload).text, wordsCount(systemPromptOf(tile.payload).text.split(/\s+/).filter(Boolean).length), { copy: true }) : null), true),
  S("appliesTo", "Applies to", "All prompts, this session or selected prompts", (tile) => {
    if (tile.kind !== "system_prompt") return null;
    const scope = scopeOf(tile.payload.scope);
    return one("Applies to", scope.kind === "all" ? "All prompts" : scope.kind === "session" ? "This session" : `Selected prompts · ${scope.ids.length}`);
  }, true),
  S("model", "Model", "The model the system prompt was written for", (tile) => one("Model", str(payloadOf(tile).model) ? modelLabel(str(payloadOf(tile).model)) : null)),
  S("version", "Version", "A version or date, so a change can be told apart", (tile) => (tile.kind === "system_prompt" ? one("Version", systemPromptOf(tile.payload).version) : null)),
  S("variables", "Variables", "The {names} written in the text, each with a line about it", (tile) => {
    if (tile.kind !== "system_prompt") return null;
    const names = variableNamesIn(systemPromptOf(tile.payload).text);
    if (names.length === 0) return null;
    const saved = variablesOf(tile.payload.variables);
    return { type: "rows", rows: names.map((name) => ({ label: `{${name}}`, value: saved.find((entry) => entry.name === name)?.description || "No description" })), count: `${noun(names.length, "word")} a copier replaces` };
  }),
  USES,
  GOES,
];

const DATASET: readonly SectionDef[] = [
  S("name", "Name", "What this dataset is called", (tile) => (tile.kind === "dataset" ? one("Name", tile.title ?? tile.defaultTitle) : null), true),
  S("description", "Description", "What it holds", (tile) => (tile.kind === "dataset" ? prose(datasetOf(tile.payload).description) : null), true),
  S("use", "Use", "Training, evaluation or retrieval", (tile) => {
    if (tile.kind !== "dataset") return null;
    const use = datasetOf(tile.payload).use;
    return use ? one("Use", DATASET_USE_LABEL[use]) : null;
  }, true),
  S("format", "Format", "The file or data format", (tile) => (tile.kind === "dataset" ? one("Format", datasetOf(tile.payload).format) : null)),
  S("records", "Record count", "How many records it holds", (tile) => {
    if (tile.kind !== "dataset") return null;
    const count = datasetOf(tile.payload).recordCount;
    return count === null ? null : one("Record count", count.toLocaleString("en-GB"));
  }),
  S("columns", "Columns", "One column name per line", (tile) => (tile.kind === "dataset" ? chips(datasetOf(tile.payload).columns, noun(datasetOf(tile.payload).columns.length, "column")) : null)),
  S("source", "Source", "Where the data came from", (tile) => (tile.kind === "dataset" ? one("Source", datasetOf(tile.payload).source) : null)),
  S("sample", "Sample records", "Up to five records, one per line", (tile) => (tile.kind === "dataset" ? numbered(datasetOf(tile.payload).sample, "record") : null)),
  S("licence", "Licence", "The terms it may be used under", (tile) => (tile.kind === "dataset" ? one("Licence", datasetOf(tile.payload).licence) : null)),
  S("chunking", "Chunking", "How it was split for retrieval, and the embedding model", (tile) => {
    if (tile.kind !== "dataset") return null;
    const facts = datasetOf(tile.payload);
    return facts.use === "retrieval" ? rows([["Chunk strategy", facts.chunkStrategy], ["Chunk size", facts.chunkSize === null ? null : String(facts.chunkSize)], ["Chunk overlap", facts.chunkOverlap === null ? null : String(facts.chunkOverlap)], ["Embedding model", facts.embeddingModel]]) : null;
  }),
  USES,
  GOES,
];

const REPO: readonly SectionDef[] = [
  S("url", "Repository URL", "The address of the repository", (tile) => (tile.kind === "repo" ? one("Repository URL", repoOf(tile.payload)?.url) : null), true),
  S("ownership", "Ownership", "Created by you, owned by you or a third party's", (tile) => {
    if (tile.kind !== "repo") return null;
    const ownership = repoOf(tile.payload)?.ownership;
    return ownership ? one("Ownership", REPO_OWNERSHIP_LABEL[ownership]) : null;
  }, true),
  S("description", "Description", "What the repository is for", (tile) => (tile.kind === "repo" ? prose(repoOf(tile.payload)?.description ?? "") : null)),
  S("thirdParty", "Third-party repository", "Who wrote it, and how it was used", (tile) => {
    if (tile.kind !== "repo") return null;
    const facts = repoOf(tile.payload);
    return facts?.ownership === "third_party" ? rows([["Author", facts.author], ["Usage", facts.usage.map((use) => REPO_USAGE_LABEL[use]).join(", ")]]) : null;
  }),
  S("own", "Yours", "Visibility, the tool that generated it, and where it is deployed", (tile) => {
    if (tile.kind !== "repo") return null;
    const facts = repoOf(tile.payload);
    return facts && (facts.ownership === "created" || facts.ownership === "owned")
      ? rows([["Visibility", facts.visibility === "public" ? "Public" : facts.visibility === "private" ? "Private" : null], ["Generated with", facts.generatedWith ? (toolName(facts.generatedWith) ?? facts.generatedWith) : null], ["Deployed URL", facts.deployedUrl]])
      : null;
  }),
  S("retrieved", "Retrieved from GitHub", "What GitHub said when the address was entered", (tile) => {
    if (tile.kind !== "repo") return null;
    const fetched = repoOf(tile.payload)?.fetched;
    return fetched?.fetchedAt ? rows([["Primary language", fetched.language], ["Licence", fetched.licenceName ?? fetched.licenceSpdx]]) : null;
  }),
  S("pinned", "Pinned version", "A branch, tag or commit, so copies stay identical", (tile) => {
    if (tile.kind !== "repo") return null;
    const pin = repoOf(tile.payload)?.pin;
    return pin ? one("Pinned version", `${REPO_PIN_LABEL[pin.kind]} ${pin.value}`) : null;
  }),
  S("path", "Path", "A folder or file, when only part of the repository was used", (tile) => (tile.kind === "repo" ? one("Path", repoOf(tile.payload)?.path) : null)),
  S("modifications", "Modifications", "What was changed from the original", (tile) => (tile.kind === "repo" ? prose(repoOf(tile.payload)?.modifications ?? "") : null)),
  S("keyFiles", "Key files", "README, CLAUDE.md, agent configuration, skills folder", (tile) => (tile.kind === "repo" ? chips(repoOf(tile.payload)?.keyFiles ?? [], noun(repoOf(tile.payload)?.keyFiles.length ?? 0, "file")) : null)),
  S("run", "Run instructions", "Clone command, dependencies, start command, and environment variable names only", (tile) => (tile.kind === "repo" ? numbered(repoOf(tile.payload)?.run ?? [], "command") : null)),
  USES,
  GOES,
];

const SESSION: readonly SectionDef[] = [
  S("app", "App and model", "The app the session ran in, and the model", (tile) => (tile.kind === "session" ? rows([["App", tile.tool], ["Model", tile.model ? modelLabel(tile.model) : null]]) : null), true),
  S("date", "Date", "The day the session ran", (tile) => (tile.kind === "session" ? one("Date", tile.date) : null)),
  S("goal", "Worked until", "A condition, and how many turns at most", (tile) => (tile.kind === "session" && tile.goal ? one("Worked until", goalLine(tile.goal).replace(/^Worked until /, "")) : null)),
  S("extras", "Cost and tokens", "What it cost, how many tokens, whether it ran in the background", (tile) => {
    if (tile.kind !== "session") return null;
    const extras = tile.extras ?? {};
    return rows([["Cost", extras.cost !== undefined ? `about ${money(extras)}` : null], ["Tokens", extras.tokens !== undefined ? extras.tokens.toLocaleString("en-GB") : null], ["Background", extras.background ? "Ran in the background" : null]]);
  }),
  S("started", "Started with", "The command that opened the session", (tile) => (tile.kind === "session" ? prose(tile.extras?.startedWith ?? "", null, { code: true, copy: true }) : null)),
  S("own", "Own copy of the code", "The branch or folder it worked in", (tile) => (tile.kind === "session" ? one("Own copy of the code", tile.extras?.ownCopy) : null)),
  S("together", "At the same time as", "The sessions it ran beside", (tile) => {
    if (tile.kind !== "session") return null;
    const keys = tile.extras?.parallelWith ?? [];
    const names = keys.map((key) => tile.others?.find((other) => other.key === key)?.label).filter((label): label is string => Boolean(label));
    return chips(names, noun(names.length, "session"));
  }),
  S("setup", "Setup", "What the AI was given before the first prompt", (tile) => {
    if (tile.kind !== "session") return null;
    const setup = tile.setup ?? [];
    return setup.length === 0 ? null : { type: "list", items: setup.map((entry, at) => ({ id: entry.id, badge: String(at + 1), name: entry.name, kind: entry.kind, value: entry.notShared ? "Not shared" : null })), count: noun(setup.length, "application") };
  }),
  S("prompts", "Prompts shared", "The session's prompts that are in the build", (tile) => {
    if (tile.kind !== "session") return null;
    const shared = tile.checklist.filter((row) => row.stepId !== null);
    return shared.length === 0 ? null : { type: "list", items: shared.map((row) => ({ id: row.stepId ?? undefined, badge: String(row.ordinal + 1), name: row.label })), count: tile.total === null ? String(tile.inBuild) : `${tile.inBuild} of ${tile.total}` };
  }),
];

const BY_KIND: Record<TileKind, readonly SectionDef[]> = {
  prompt: PROMPT,
  manual: MANUAL,
  code: CODE,
  check: CHECK,
  decision: DECISION,
  file: FILE,
  tool: TOOL,
  agent: AGENT_SECTIONS(false),
  team: AGENT_SECTIONS(true),
  result: RESULT,
  system_prompt: SYSTEM_PROMPT,
  dataset: DATASET,
  repo: REPO,
  session: SESSION,
};

export const TILE_KINDS = Object.keys(BY_KIND) as TileKind[];

/** The modal's sections for a kind of tile, in the modal's order. */
export function sectionsOf(kind: TileKind): readonly SectionDef[] {
  return BY_KIND[kind];
}

/** What a tile holds, section by section, in order; an empty section is left out and named in `notSet`. */
export function readSections(tile: DetailsView, build: BuildFacts): { sections: ReadSection[]; notSet: string[] } {
  const sections: ReadSection[] = [];
  const notSet: string[] = [];
  for (const def of sectionsOf(tile.kind)) {
    const value = def.read(tile, build);
    if (value) sections.push({ key: def.key, label: def.label, value });
    else notSet.push(def.label);
  }
  return { sections, notSet };
}

/** "Not set: Host platform, Memory, Sample run. Edit to add them." Nothing when nothing is empty. */
export function notSetLine(notSet: readonly string[]): string | null {
  if (notSet.length === 0) return null;
  return `Not set: ${notSet.join(", ")}. Edit to add them.`;
}

/* ── the head ── */

export interface TileHead {
  /** The tile's own title, or its default while the maker has not named it. */
  title: string;
  /** True while the title is the default. */
  untitled: boolean;
  /** The modal's header line: "Session 2 · Claude Code · 8 Oct 2026 · Prompt 3, 1 of 1 in session". */
  line: string;
  /** The tool whose mark leads the head, when the tile has one. */
  tool: string | null;
  model: string | null;
}

const join = (...parts: (string | null | undefined | false)[]): string => parts.filter(Boolean).join(" · ");

/** The head Details draws: the mark's tool, the title and the line under it. */
export function headOf(tile: DetailsView): TileHead {
  const named = (title: string | null, fallback: string) => ({ title: title ?? fallback, untitled: !title });
  switch (tile.kind) {
    case "prompt":
      return { ...named(tile.title, tile.defaultTitle), line: join(tile.sessionLine, tile.detailLine), tool: tile.sessionLine.split(" · ").pop() || null, model: tile.model };
    case "manual":
      return { ...named(tile.title, tile.defaultTitle), line: join(`Manual step ${tile.number}`, tile.tool), tool: tile.tool || null, model: null };
    case "code":
      return { ...named(tile.title ?? tile.filename, tile.defaultTitle), line: join(`Code ${tile.number}`, tile.language, noun(tile.lines, "line")), tool: tile.tool, model: tile.model };
    case "check":
      return { ...named(tile.title, tile.defaultTitle), line: join(`Check ${tile.number}`, tile.check.passed !== null && tile.check.total !== null ? `${tile.check.passed} of ${tile.check.total} passed` : null), tool: null, model: null };
    case "decision":
      return { ...named(tile.title, tile.defaultTitle), line: join(`Decision ${tile.number}`, "runs in the app"), tool: null, model: null };
    case "file":
      return { title: tile.name, untitled: false, line: join("File", tile.size), tool: null, model: null };
    case "tool":
      return { title: tile.service, untitled: false, line: join(tile.number ? `Tool ${tile.number}` : "Tool", tile.connection ? CONNECTION_LABEL[tile.connection] : null), tool: tile.service, model: null };
    case "agent":
    case "team":
      return { ...named(tile.name, tile.defaultName), line: join(`${tile.kind === "team" ? "Team" : "Agent"} ${tile.number}`, tile.parent ?? tile.model), tool: tile.kind === "agent" ? (tile.setup?.harness ?? null) : null, model: null };
    case "result":
      return { title: tile.summary || tile.url || "Result", untitled: !(tile.summary || tile.url), line: join(tile.number ? `Result ${tile.number}` : "Result"), tool: null, model: null };
    case "system_prompt":
      return { ...named(tile.title, tile.defaultTitle), line: join(`System prompt ${tile.number}`, `Applies to ${noun(tile.appliesTo, "prompt")}`), tool: null, model: null };
    case "dataset": {
      const use = datasetOf(tile.payload).use;
      return { ...named(tile.title, tile.defaultTitle), line: join(`Dataset ${tile.number}`, use ? DATASET_USE_LABEL[use] : null), tool: null, model: null };
    }
    case "repo": {
      const ownership = repoOf(tile.payload)?.ownership;
      return { ...named(tile.title, tile.defaultTitle), line: join(`GitHub repository ${tile.number}`, ownership ? REPO_OWNERSHIP_LABEL[ownership] : null), tool: null, model: null };
    }
    case "session":
      return { title: `Session ${tile.number}`, untitled: false, line: join(tile.tool, tile.model ? modelLabel(tile.model) : null, tile.date), tool: tile.tool, model: tile.model || null };
  }
}
