// The build graph (UI-P62): the steps both the composer and the build page draw,
// and the writes that change them. design/sandbox/DATA.md is the shape.
//
// A STEP IS A TOP-LEVEL NODE of type prompt, agent_config, team, manual_step or
// code (CA-02 P7), numbered by position from 1. Files, tools, results and the cover's evidence
// node are not steps and are not numbered. Inside an agent, its instructions
// are n.1 and its child prompts n.2 onward; inside a team, its agents are n.1
// onward. There is no third level of numbers.
//
// NOTHING IS STORED THAT CAN BE READ. "Goes into" is derived, a suggestion is
// never written, and a title the maker did not type is null, never filled in.
//
// EVERY WRITE refuses bad input through buildLayerError with a message made of
// identifiers and fixed words only, never the text the maker wrote (CONTRACT §9).

import type { Json } from "@/integrations/supabase/types";
import { nodeRow, placeChildNode, placeTopNode } from "./composeCover";
import { PROMPT_TYPE, REPLY_MAX, swapMoves } from "./composePrompts";
import { toolFor, toolName } from "@/lib/tools/registry";
import { goalOf, LEGACY_SESSION_PREFIX, TYPED_SESSION_PREFIX, toolLabel, type MakingSession, type SessionGoal, type SessionMeta } from "./making";
import { getNodeType } from "./nodeTypes";
import { reorderNodes, upsertNode, type NodeMove } from "./nodes";
import { buildLayerError, type BuildNode, type BuildNodeInsert, type NodeTree } from "./types";
import { modelLabel } from "@/lib/models/registry";
import { HEX_HINT, normaliseHex } from "@/lib/theme/partColour";
import { changesOf, type ChangeRange } from "./changes";
import { modelRunOf, modelRunRefusal, type ModelRun } from "./modelRun";
import { extrasOf, LONG_SESSION_WORDS, type SessionExtras } from "./sessionFacts";
import { buildCostOf, costRefusal, runCostOf, type CostFigures, type RunCost } from "./cost";
import { helpersOf, helpersRefusal, type Helper } from "./helpers";
import { outputShapeOf, shapeRefusal, type OutputShape } from "./answerShape";
import { traceRefusal, traceUrlOf } from "./trace";
import {
  datasetOf,
  parseRepoUrl,
  repoOf,
  scopeOf,
  scopeValue,
  systemPromptOf,
  type DatasetFacts,
  type DatasetUse,
  type RepoFacts,
  type RepoFetched,
  type RepoOwnership,
  type RepoPinKind,
  type RepoUsage,
  type RepoVisibility,
  type SystemPromptFacts,
  type SystemPromptScope,
} from "./sourceTiles";
import { agentExtrasOf, checkExtrasOf, cleanExtras, patternOf, settingsOf, toolExtrasOf, variablesOf, type CheckEvidence, type CheckMethod, type CheckModelTested, type CheckReviewer, type CheckScoring, type AgentPattern, type PromptSettings, type PromptVariable, type ToolPermission } from "./tileExtras";
import { canRunWhen, DECISION_TYPE, decisionOf, questionsRefusal, runsWhenOf, runsWhenRefusal, STATE_SAMPLE_MAX, takesOptions, type DecisionAnswer, type DecisionExample, type DecisionFacts, type DecisionQuestion, type DecisionRef, type LowConfidence, type RunsWhen } from "./decision";

export const AGENT_TYPE = "agent_config";
export const TEAM_TYPE = "team";
export const MANUAL_STEP_TYPE = "manual_step";
export const FILE_TYPE = "document";
export const TOOL_TYPE = "integration";
export const RESULT_TYPE = "result";
/** CA-15 P9: a System prompt, a Dataset and a GitHub repository, as tiles. Existing node types; a node is a tile only when its payload says `step: true`. */
export const SYSTEM_PROMPT_TYPE = "system_prompt";
export const DATASET_TYPE = "dataset";
export const REPO_TYPE = "repo";
/** CA-02 P7: lines of code the maker wrote or ran. Never run here. */
export const CODE_TYPE = "code";
/**
 * CA-03 P5: how the build tested itself. The `eval_run` type that already exists (category evidence); a check is one
 * whose payload says what it tested (`tested`), so an eval run saved before CA-03 reads exactly as it did, not as a step.
 */
export const CHECK_TYPE = "eval_run";

/** CA-04 P2: "file" is a file sent with a step; a file at the top level is the build's, not a step. */
export type StepKind = "prompt" | "agent" | "team" | "manual" | "code" | "check" | "file" | "tool" | "decision" | "system_prompt" | "dataset" | "repo";

export type UseKind = "output" | "file" | "tool";

/** What a step takes in: another step's output, a file, or a tool. */
export interface Use {
  kind: UseKind;
  node_id: string;
}

/** CA-04 P6: "goal" ran until a goal was reached; "script" ran from a script or GitHub, its command or workflow as the detail. */
export type RunsHow = "once" | "parallel" | "until" | "schedule" | "event" | "goal" | "script";

export interface Runs {
  how: RunsHow;
  count?: number;
  detail?: string;
}

/** One of an agent's models and what it does there (CA-02 P5). The first is always "main". */
export interface AgentModel {
  model: string;
  role: string;
}

export interface Step {
  id: string;
  kind: StepKind;
  /** "3", or "3.1" inside an agent or a team. */
  number: string;
  /** The maker's title, or null while it is the default. */
  title: string | null;
  defaultTitle: string;
  text: string;
  words: number;
  model: string | null;
  /** The import session a prompt came from; null for one written by hand. */
  sessionId: string | null;
  /**
   * CA-04 P1: the session a top-level step was recorded in: `payload.session` (a session made here, or an imported one
   * a typed prompt was added to), else the import it came from. Null for a step saved before CA-04 with neither:
   * `sessionGroups` reads those into the session they sit in.
   */
  session?: string | null;
  /** The tool a prompt written by hand, or a manual step, names. */
  tool: string | null;
  runs: Runs | null;
  uses: Use[];
  /** Suggestions the maker dismissed, as "<kind>:<node_id>". */
  dismissed?: string[];
  children: Step[];
  /** A manual step's picture (its `media_id`), when it has one. */
  mediaId?: string | null;
  /** CA-02 P7, code only: its language (the schema's enum) and its file name. */
  language?: string | null;
  filename?: string | null;
  /** CA-02 P7, code only: "start reading here". */
  entrypoint?: boolean;
  /** CA-02 P5, an agent only: the tool it ran in, by name (or as typed); null for its maker's own code. */
  harness?: string | null;
  /** CA-02 P5, an agent only: its models with their roles, when it has more than one. */
  models?: AgentModel[];
  /** CA-02 P5, an agent only: the integration nodes it was allowed to call. */
  toolRefs?: string[];
  /** CA-03 P6, an agent only: what it remembers between runs (`payload.memory`), when it says. */
  memory?: string;
  /** CA-05 P9, an agent only: how it tidies its notes (`payload.memory_tidy`), when it says. */
  memoryTidy?: string;
  /** CA-05 P9, an agent only: what it changes each round of "Again until a condition was met" (`payload.changes_each_round`), when it says. */
  changesEachRound?: string;
  /** CA-05 P8: how its model was run (size, where), when the maker said; for a prompt, an agent or code. */
  modelRun?: ModelRun;
  /** CA-05 P7, a file tile only: the cases in it, when it is a test file and they were counted exactly. */
  rows?: number;
  /** CA-05 P1, a prompt only: the words a reader changes (`payload.changes`), as character ranges of `text`. Absent when none. */
  changes?: ChangeRange[];
  /** CA-03 P5, a check only: what it tested, what counts as passing, when it failed, and its runs. */
  check?: CheckFacts;
  /**
   * CA-04 P2: the tiles sent with this step, at the same time, in the same message: the nodes whose `parent_id` is
   * this step (not an agent or a team, whose children keep their meaning), in position order. Each can hold more.
   * Absent when it holds none.
   */
  sentWith?: Step[];
  /** CA-04 P2, a tile inside another: the step it is sent with, as its eyebrow names it ("prompt 2", "order-form.tsx"). */
  inside?: { id: string; label: string };
  /** CA-06 P4: the maker's colour for this tile (`payload.colour`, "#RRGGBB"). Absent when it has none; never its parent's. */
  colour?: string;
  /** CA-12 P7, a tool tile only: how it was connected and what it did. Its app is `tool`. */
  app?: ToolTileFacts;
  /** CA-12 P8, a file tile only: what kind of file it is, its size and a short preview. */
  fileFacts?: FileTileFacts;
  /** CA-12 P10, a manual step only: where it was done, and its lines (`text` is the same lines joined by line breaks). */
  where?: ManualWhere;
  lines?: string[];
  /** CA-12 P12, a prompt only: what came back (`payload.reply`). */
  reply?: string;
  /** CA-15 P2, a prompt or a system prompt: what it ran with (`payload.settings`), and the descriptions given to its `{variables}` (`payload.variables`). */
  settings?: PromptSettings;
  variables?: PromptVariable[];
  /** CA-15 P9, a system prompt only: where it applies and its version; `appliesTo` is how many of the build's prompts that reaches. */
  systemPrompt?: SystemPromptFacts & { appliesTo: number };
  /** CA-15 P9, a dataset only: what it is, what it was used for and what it holds. */
  dataset?: DatasetFacts;
  /** CA-15 P9, a GitHub repository only: its address, ownership, what GitHub said and what the maker said. */
  repo?: RepoFacts;
  /** CA-12 P12, a check only: its cases, when it has any. */
  cases?: CheckCase[];
  /** CA-13 P2, a decision only: its questions, what it read and one real answer. */
  decision?: DecisionFacts;
  /** CA-13 P3, a runtime tile only (agent, team, code, tool, decision): the decision it runs after, and the value it ran on. */
  runsWhen?: RunsWhen;
  /** CA-13 P6, an agent only: the helper models that kept it on track (at most 12). */
  helpers?: Helper[];
  /** CA-13 P5, an agent only: the Code tiles that define it (`payload.defined_in`, node ids), e.g. the file holding `create_deep_agent(...)`. */
  definedIn?: string[];
  /** CA-13 P5, an agent only: a trace link (https only). */
  traceUrl?: string;
  /** CA-13 P14, an agent only: "Installation command", as the maker gave it. A decision keeps its own in `decision`. */
  install?: string;
  /** CA-15 P7, an agent only: what it must not do (`payload.limits`, one per entry), where its output goes (`payload.output`) and a pasted sample run (`payload.sample`). Each absent when not given. */
  limits?: string[];
  output?: string;
  sample?: string;
  /** CA-15 P7, a team only: how its agents work together (`payload.pattern`). */
  pattern?: AgentPattern;
  /** CA-13 P7, a prompt or an agent: the shape its answer is forced into. */
  outputShape?: OutputShape;
  /** CA-13 P8: what it took to make (any tile) and what it costs to run (a runtime tile): never added together. */
  buildCost?: CostFigures;
  runCost?: RunCost;
}

/** CA-12 P7: a tool tile's facts. */
export interface ToolTileFacts {
  connection: ToolConnection | null;
  runsAt: ToolRunsAt | null;
  /** What it was allowed or used to do: "read issues, open pull requests". */
  scopes: string | null;
  /** CA-15 P4: what the connection let it do (`payload.permissions`), the plan it needed (`payload.plan`), the steps to set it up (`payload.setup`) and the tools it could have been (`payload.alternatives`). Absent when not given. */
  permissions?: ToolPermission;
  plan?: string;
  setup?: string[];
  alternatives?: string[];
}

/** CA-12 P8: the kinds of file a tile draws a mark for. */
export type FileKind = "text" | "code" | "pdf" | "picture" | "spreadsheet" | "other";

export interface FileTileFacts {
  kind: FileKind;
  name: string;
  /** Bytes, when known. */
  size: number | null;
  /** The first lines of a text or code file; empty for the rest. */
  preview: string[];
  mediaId: string | null;
}

/** CA-12 P10: where a manual step was done. */
export type WhereKind = "app" | "terminal" | "phone" | "offline" | "site";
export interface ManualWhere {
  kind: WhereKind;
  /** The app's name, or the site's. */
  name: string | null;
  /** The site's link, for "another website". */
  url: string | null;
}

/** CA-12 P12: one case of a check: what went in, what was expected, what came out, and whether it passed. */
export interface CheckCase {
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
}

/** CA-03 P5: what a check says, read from its payload. */
export interface CheckFacts {
  tested: string;
  passing: string;
  onFail: string | null;
  passed: number | null;
  total: number | null;
  /** The last run, as saved ("2026-10-12"). */
  runAt: string | null;
  /** CA-05 P7: every run it kept, newest first. Absent when it kept none. */
  runs?: CheckRun[];
  /** CA-05 P7: how many cases the test files sent with it hold, when every file could be counted exactly. */
  cases?: number;
  /** CA-12 P12: the cases the maker wrote down, in order. Absent when there are none. */
  caseList?: CheckCase[];
  /** CA-15 P5: how it was tested, who judged it, how it was scored, the model and version tested, and the evidence kept. Each absent when not given. */
  method?: CheckMethod;
  reviewer?: CheckReviewer;
  scoring?: CheckScoring;
  modelTested?: CheckModelTested;
  evidence?: CheckEvidence;
}

/** CA-05 P7: one run of a check: the day and how many passed of how many. */
export interface CheckRun {
  at: string;
  passed: number;
  total: number;
}

export interface SessionGroup {
  /**
   * CA-04 P1: the session's key: its import id, `typed-<uuid>` for one made here, or `typed-legacy-<n>` for a run of an
   * old build's typed prompts (read, never stored). `sessionGroups` always sets it; read it through `groupKey`, which
   * gives a group written by hand (a fixture) the key it had before.
   */
  key?: string;
  /** CA-04 P1: imported, made here, or an old build's run of typed prompts. Read it through `groupKind`. */
  kind?: "import" | "typed" | "legacy";
  /**
   * CA-04 P1: an old build's steps that are not prompts and come before any session. They sit in a group so every
   * step has one, but no head, no number and no lane is drawn for it.
   */
  implicit?: boolean;
  /** null for prompts typed here. */
  sessionId: string | null;
  number: number;
  tool: string | null;
  model: string | null;
  /** The session's date, or "typed here" for prompts with no session. */
  startedAt: string | null;
  /** CA-04 P1: every top-level step in the session, not only its prompts. */
  stepNumbers: string[];
  /** CA-04 P6: what the session worked until, when the maker said. */
  goal?: SessionGoal;
  /** CA-05: what the maker or a result file said of it: cost, tokens, background, started with, at the same time as. Absent when nothing was. */
  extras?: SessionExtras;
  /** CA-05 P2: the session's own text in words, kept only when it is long enough to say so. */
  longWords?: number;
  /** CA-06 P4: the maker's colour for the session (`sessions_meta[key].colour`). Absent when it has none. */
  colour?: string;
  /** CA-14 P1: the maker's title for the session (`sessions_meta[key].title`), 1 to 80 characters. Absent when it has none. */
  title?: string;
  /**
   * CA-12: the session has an entry in `sessions_meta`. A session added the CA-12 way is given one, so its head is always
   * drawn; an old build's lone imported session has none and is drawn as it was, without a head.
   */
  marked?: boolean;
}

/** Where the date would be, for prompts written by hand. */
export const TYPED_HERE = "typed here";

export const TITLE_MAX = 80;
export const RUNS_COUNT_MIN = 2;
export const RUNS_COUNT_MAX = 20;
export const UNTIL_DETAIL_MAX = 80;
export const WHEN_DETAIL_MAX = 60;
export const MANUAL_TOOL_MAX = 40;
/** CA-02 P7: the longest code a step holds, and its file name. */
export const CODE_MAX = 100_000;
export const CODE_FILENAME_MAX = 120;
/** CA-02 P7: the code node type's `language` enum, as seeded in 20260823130000_node_type_registry_seed.sql. */
export const CODE_LANGUAGES = ["ts", "tsx", "js", "jsx", "python", "sql", "json", "yaml", "bash", "html", "css", "other"] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];
/** CA-02 P5: the longest harness name and role a maker can type. */
export const HARNESS_MAX = 40;
export const ROLE_MAX = 40;
/** CA-02 P5: an agent names four models at most. */
export const AGENT_MODELS_MAX = 4;
/** CA-03 P6: the longest "What it remembers". */
export const MEMORY_MAX = 200;
/** CA-05 P9: the longest "How it tidies its notes" and "What it changes each round". */
export const MEMORY_TIDY_MAX = 120;
export const CHANGES_EACH_ROUND_MAX = 120;
export const MANUAL_TEXT_MAX = 140;

const NODE_TYPE_MISSING = "That needs the Deploy queue item from UI-P61.";
/** CA-13 P1: said when Add › Decision is refused because the `decision` node type is not live yet. */
export const DECISION_TYPE_MISSING = "Decisions need the CA-13 database change. Ask Lovable to apply it.";

const USE_KINDS: readonly UseKind[] = ["output", "file", "tool"];
const RUNS_HOWS: readonly RunsHow[] = ["once", "parallel", "until", "schedule", "event", "goal", "script"];

/** CA-04 P6: the longest command or workflow a step that ran from a script keeps. */
export const SCRIPT_DETAIL_MAX = 4000;

type Payload = Record<string, Json | undefined>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const payloadOf = (node: Pick<BuildNode, "payload">): Payload => (isRecord(node.payload) ? (node.payload as Payload) : {});

const stringOf = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);

const refuse = (operation: string, message: string): Error => buildLayerError(operation, new Error(message));

/** Words in a text, split on whitespace. */
export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

// --- reading ------------------------------------------------------------------

/** The uses a node lists, in order. Entries that are not a known kind and an id are skipped, and a repeat is read once. */
export function usesOf(node: Pick<BuildNode, "payload">): Use[] {
  const raw = payloadOf(node).uses;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Use[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const { kind, node_id: nodeId } = entry;
    if (typeof nodeId !== "string" || !nodeId || !USE_KINDS.includes(kind as UseKind)) continue;
    const key = `${kind}:${nodeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ kind: kind as UseKind, node_id: nodeId });
  }
  return out;
}

/** The step that makes a file, or null for a file nobody makes. Read from the file; the step stores nothing. */
export function madeByOf(node: Pick<BuildNode, "payload">): string | null {
  return stringOf(payloadOf(node).made_by);
}

/** Every made file of a tree, as file id to the id of the step that makes it. */
export function madeFilesOf(tree: readonly Pick<BuildNode, "id" | "type" | "parent_id" | "payload">[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const node of tree) {
    if (node.type !== FILE_TYPE || node.parent_id !== null) continue;
    const step = madeByOf(node);
    if (step) out.set(node.id, step);
  }
  return out;
}

/** Every made file of a tree, as file id to its name. */
export function madeFileNamesOf(tree: readonly Pick<BuildNode, "id" | "type" | "parent_id" | "payload">[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const [id] of madeFilesOf(tree)) {
    const node = tree.find((candidate) => candidate.id === id);
    const name = node ? stringOf(payloadOf(node).title) : null;
    if (name) out.set(id, name);
  }
  return out;
}

/** How a step runs, or null for a value that is not a Runs. A null `runs` means "once". */
export function parseRuns(value: unknown): Runs | null {
  if (!isRecord(value) || !RUNS_HOWS.includes(value.how as RunsHow)) return null;
  const runs: Runs = { how: value.how as RunsHow };
  if (runs.how === "parallel" && typeof value.count === "number" && Number.isFinite(value.count)) runs.count = value.count;
  if (runs.how === "until" || runs.how === "schedule" || runs.how === "event" || runs.how === "script") {
    const detail = stringOf(value.detail)?.trim();
    if (detail) runs.detail = detail;
  }
  return runs;
}

/** CA-03 P3: "Again until a condition was met" can say how many times at most, written into its detail. */
export const AT_MOST_MIN = 1;
export const AT_MOST_MAX = 20;

const AT_MOST = /\s*·\s*at most (\d+) times?$/;

/** An "until" detail split into its condition and its "at most" count. A detail saved without one reads as it was. */
export function untilParts(detail: string | null | undefined): { condition: string; atMost: number | null } {
  const text = (detail ?? "").trim();
  const match = AT_MOST.exec(text);
  if (!match) return { condition: text, atMost: null };
  const n = Number(match[1]);
  return { condition: text.slice(0, match.index).trim(), atMost: Number.isInteger(n) ? n : null };
}

/** An "until" detail from its condition and its count: "until the review has no changes · at most 3 times". */
export function untilDetail(condition: string, atMost: number | null): string {
  const said = condition.trim();
  if (atMost === null) return said;
  const times = `at most ${atMost} ${atMost === 1 ? "time" : "times"}`;
  return said ? `${said} · ${times}` : times;
}

/** "until every claim has a source", whether or not the maker typed the "until". */
export function untilClause(detail: string): string {
  const said = detail.trim();
  return /^until\b/i.test(said) ? said : `until ${said}`;
}

/**
 * The words that say how a step ran (CA-03 P3), as the List, the Map and the build page show them. "When I asked"
 * is the normal case and shows nothing: an empty string. Nothing stored changes; only the words.
 */
export function runsLabel(runs: Runs | null | undefined): string {
  const detail = runs?.detail ? ` · ${runs.detail}` : "";
  switch (runs?.how) {
    case "parallel":
      return typeof runs.count === "number" ? `Several at the same time · ${runs.count}` : "Several at the same time";
    case "until":
      return runs.detail ? `Again ${untilClause(runs.detail)}` : "Again until a condition was met";
    case "schedule":
      return `On a schedule${detail}`;
    case "event":
      return `When something happened${detail}`;
    case "goal":
      return "Until a goal was reached";
    case "script":
      return "From a script or GitHub";
    default:
      return "";
  }
}

/** The lead word of "changes its checklist each round": a determiner is lowered so the clause reads on from "changes". */
const DETERMINERS = /^(its|their|his|her|our|my|your|the|this|these|a|an)\b/i;

/** CA-05 P9: "changes its checklist each round", from what the maker typed ("Its checklist"). */
export function changesEachRoundClause(text: string): string {
  const said = text.trim();
  return `changes ${DETERMINERS.test(said) ? said.charAt(0).toLowerCase() + said.slice(1) : said} each round`;
}

/**
 * How a step runs, as its line reads it: the way it runs (`runsLabel`), and for an agent that runs again until a
 * condition was met, what it changes each round: "Again until the review has no changes · at most 3 times · changes
 * its checklist each round".
 */
export function stepRunsLabel(step: Pick<Step, "runs" | "changesEachRound">): string {
  const base = runsLabel(step.runs);
  return base && step.runs?.how === "until" && step.changesEachRound ? `${base} · ${changesEachRoundClause(step.changesEachRound)}` : base;
}

const KIND_OF_TYPE: Record<string, StepKind> = {
  [PROMPT_TYPE]: "prompt",
  [AGENT_TYPE]: "agent",
  [TEAM_TYPE]: "team",
  [MANUAL_STEP_TYPE]: "manual",
  [CODE_TYPE]: "code",
  [CHECK_TYPE]: "check",
  [DECISION_TYPE]: "decision",
};

const KIND_NAME: Record<StepKind, string> = {
  prompt: "Prompt",
  agent: "Agent",
  team: "Team",
  manual: "Manual step",
  code: "Code",
  check: "Check",
  file: "File",
  tool: "Tool",
  decision: "Decision",
  system_prompt: "System prompt",
  dataset: "Dataset",
  repo: "GitHub repository",
};

/** CA-03 P5: an eval run is a check, and a step, only when it says what it tested. */
const isCheckPayload = (payload: unknown): boolean => isRecord(payload) && typeof payload.tested === "string" && payload.tested.trim().length > 0;

/** CA-04 P4: part of a session's setup (setup.ts): never a step, though a rule is code. */
const isSetupNode = (payload: unknown): boolean => isRecord(payload) && isRecord(payload.setup);

/**
 * CA-12 P7, P8: a tool or a file is a step (a tile in a session) only when it was added from Add: its payload says
 * `step: true`. Tools an agent names (`toolRefsFor`), a file dropped into Sources and every tool and file saved before CA-12
 * have no such key, so they are not tiles and nothing numbered moves.
 */
export const isStepTile = (node: Pick<BuildNode, "type"> & { payload?: unknown }): boolean =>
  (node.type === TOOL_TYPE || node.type === FILE_TYPE || node.type in SOURCE_KIND) && isRecord(node.payload) && node.payload.step === true && !isSetupNode(node.payload);

/** CA-15 P9: the node types that are tiles only when added from Add (`step: true`), so every node of these types saved before reads as it did. */
const SOURCE_KIND: Record<string, StepKind> = { [SYSTEM_PROMPT_TYPE]: "system_prompt", [DATASET_TYPE]: "dataset", [REPO_TYPE]: "repo" };

/** The kind a node is drawn as: a step tile's own, else the kind of its type; undefined for a node that is not a step. */
const kindOfNode = (node: Pick<BuildNode, "type"> & { payload?: unknown }): StepKind | undefined =>
  node.type === TOOL_TYPE && isStepTile(node) ? "tool" : node.type === FILE_TYPE ? "file" : node.type in SOURCE_KIND && isStepTile(node) ? SOURCE_KIND[node.type] : KIND_OF_TYPE[node.type];

const isStepNode = (node: Pick<BuildNode, "type"> & { payload?: unknown }): boolean =>
  (node.type in KIND_OF_TYPE && (node.type !== CHECK_TYPE || isCheckPayload(node.payload)) && !isSetupNode(node.payload)) || isStepTile(node);

const numberOf = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** The most runs a check keeps, and the most its line shows. */
export const CHECK_RUNS_KEPT = 20;
export const CHECK_RUNS_SHOWN = 5;

/** A check's runs, read defensively and newest first; an entry that is not a real day and two whole numbers is left out. */
export function checkRunsOf(value: unknown): CheckRun[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((entry) => {
      if (!isRecord(entry) || typeof entry.at !== "string" || !isIsoDay(entry.at)) return [];
      const { passed, total } = entry;
      if (typeof passed !== "number" || typeof total !== "number" || !Number.isInteger(passed) || !Number.isInteger(total)) return [];
      if (passed < 0 || total < 0 || total > CHECK_RUNS_MAX || passed > total) return [];
      return [{ at: entry.at, passed, total }];
    })
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, CHECK_RUNS_KEPT);
}

/** CA-05 P7: "31 of 40 → 37 of 40 → 40 of 40", the latest five runs oldest first; null for fewer than two. */
export function checkHistoryLine(runs: readonly CheckRun[] | undefined): string | null {
  if (!runs || runs.length < 2) return null;
  return [...runs]
    .slice(0, CHECK_RUNS_SHOWN)
    .reverse()
    .map((run) => `${run.passed} of ${run.total}`)
    .join(" → ");
}

/** A check's facts, read defensively. */
function checkFacts(payload: Payload, cases: readonly CheckCase[] = []): CheckFacts {
  const runs = checkRunsOf(payload.runs);
  // CA-12 P12: when cases are given, "passed of total" is worked out from them.
  const counted = cases.length > 0 ? casesTotals(cases) : null;
  return {
    tested: stringOf(payload.tested)?.trim() ?? "",
    passing: stringOf(payload.passing)?.trim() ?? "",
    onFail: stringOf(payload.on_fail)?.trim() || null,
    passed: counted ? counted.passed : numberOf(payload.passed),
    total: counted ? counted.total : numberOf(payload.total),
    runAt: stringOf(payload.run_at)?.trim() || null,
    ...(runs.length > 0 ? { runs } : null),
    ...(cases.length > 0 ? { caseList: [...cases] } : null),
    ...checkExtrasOf(payload),
  };
}

const byPosition = <T extends Pick<BuildNode, "position">>(nodes: readonly T[]): T[] =>
  [...nodes]
    .filter((node) => typeof node.position === "number")
    .sort((a, b) => (a.position as number) - (b.position as number));

/** An agent's models, read defensively: entries without a model are skipped. */
export function agentModelsOf(payload: Record<string, unknown>): AgentModel[] {
  const raw = payload.models;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const model = stringOf(entry.model)?.trim();
    if (!model) return [];
    return [{ model, role: stringOf(entry.role)?.trim() || "main" }];
  });
}

/** The integration nodes an agent's `tools` list names, in order. */
export function toolRefsOf(payload: Record<string, unknown>): string[] {
  const raw = payload.tools;
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const entry of raw) {
    const ref = isRecord(entry) ? stringOf(entry.tool_ref) : null;
    if (ref && !out.includes(ref)) out.push(ref);
  }
  return out;
}

/** The agent-only facts of a step (CA-02 P5, CA-03 P6); an old agent with none of them reads as it always did. */
function agentFacts(payload: Payload): Pick<Step, "harness" | "models" | "toolRefs" | "memory" | "memoryTidy" | "changesEachRound" | "limits" | "output" | "sample"> {
  const harness = stringOf(payload.harness)?.trim();
  const models = agentModelsOf(payload);
  const toolRefs = toolRefsOf(payload);
  const memory = stringOf(payload.memory)?.trim();
  const memoryTidy = stringOf(payload.memory_tidy)?.trim().slice(0, MEMORY_TIDY_MAX);
  const changesEachRound = stringOf(payload.changes_each_round)?.trim().slice(0, CHANGES_EACH_ROUND_MAX);
  return {
    harness: harness ? (toolName(harness) ?? harness) : null,
    ...(models.length > 1 ? { models } : null),
    ...(toolRefs.length ? { toolRefs } : null),
    ...(memory ? { memory } : null),
    ...(memoryTidy ? { memoryTidy } : null),
    ...(changesEachRound ? { changesEachRound } : null),
    ...agentExtrasOf(payload),
  };
}

const dismissedOf = (payload: Payload): string[] =>
  Array.isArray(payload.dismissed) ? payload.dismissed.filter((key): key is string => typeof key === "string") : [];

/** CA-12 P6: the first words of a text, whitespace folded, "…" after them when there were more. */
export function firstWords(value: string, count: number): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.length > count ? `${words.slice(0, count).join(" ")}…` : words.join(" ");
}

/** CA-12 P6: the first line with something on it, trimmed and cut at `max` characters. */
export function firstLineOf(value: string, max = TITLE_MAX): string {
  const line = value.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

/** CA-12 P6/P9: the site's name for a link: "github.com" for "https://www.github.com/a/b". Null when it is not a link. */
export function siteNameOf(url: string | null | undefined): string | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;
  try {
    const host = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`).hostname.replace(/^www\./i, "");
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
}

/**
 * CA-12 P6: what a tile is called when its maker has not named it: what it holds, never its number (the badge has it).
 * A prompt: its first 8 words. Code: its file name, else its first line. A manual step: its first line. An agent: the first
 * line of its instructions (its name is its title, which always wins). A tool: the app. A file: its name. A result: what
 * it is, else its link's site, else "Result". A check: what it tested. Nothing to go on: the kind's name.
 */
export function defaultTitleFor(kind: StepKind, payload: Payload): string {
  const str = (key: string) => stringOf(payload[key])?.trim() ?? "";
  const named = (value: string) => value || KIND_NAME[kind];
  switch (kind) {
    case "prompt":
      return named(firstWords(str("text"), 8));
    case "code":
      return named(str("filename") || firstLineOf(str("source")));
    case "manual":
      return named(firstLineOf(Array.isArray(payload.lines) ? String(payload.lines.find((l) => typeof l === "string" && l.trim()) ?? "") : str("text")));
    case "agent":
      return named(firstLineOf(str("system_prompt")));
    case "tool":
      return named(str("service"));
    case "file":
      return named(str("title"));
    case "check":
      return named(firstLineOf(str("tested")));
    case "system_prompt":
      return named(firstLineOf(str("text")));
    case "dataset":
      return named(firstLineOf(str("description")));
    case "repo": {
      const parsed = parseRepoUrl(str("url"));
      return parsed ? `${parsed.owner}/${parsed.name}` : KIND_NAME[kind];
    }
    case "decision": {
      const ids = (Array.isArray(payload.questions) ? payload.questions : []).flatMap((q) => (isRecord(q) && typeof q.id === "string" && q.id ? [q.id] : []));
      return ids.length ? ids.slice(0, 3).join(", ") : KIND_NAME[kind];
    }
    default:
      return KIND_NAME[kind];
  }
}

/** CA-12 P7: the connection words a Tool tile and its window say. */
export const CONNECTION_LABEL: Record<ToolConnection, string> = {
  mcp: "MCP server",
  app: "Native integration",
  code: "Custom code",
  extension: "Browser extension",
  api_key: "API key",
  automation: "Zapier, Make or n8n",
  plugin: "Plugin or skill",
  cli: "Command-line interface",
  manual: "Manual copy and paste",
};

/** The most lines a manual step has, and the longest each is. */
export const MANUAL_LINES_MAX = 12;

/** CA-12 P10: a manual step's lines: its text split on line breaks, blanks dropped. One line for a step saved before. */
export const manualLinesOf = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

/** CA-12 P10: where a manual step was done, read defensively; a step saved before has only its `tool`, which is an app or a site by name. */
export function manualWhereOf(payload: Payload): ManualWhere | null {
  const raw = payload.where;
  if (isRecord(raw) && ["app", "terminal", "phone", "offline", "site"].includes(raw.kind as string)) {
    return { kind: raw.kind as WhereKind, name: stringOf(raw.name)?.trim() ?? null, url: stringOf(raw.url)?.trim() ?? null };
  }
  const tool = stringOf(payload.tool)?.trim();
  return tool ? { kind: "app", name: toolName(tool) ?? tool, url: null } : null;
}

/** "Terminal", "On a phone", "Offline, in person", the app's or site's name. */
export function manualWhereLabel(where: ManualWhere | null): string {
  if (!where) return "Another tool";
  if (where.kind === "terminal") return "Terminal";
  if (where.kind === "phone") return "On a phone";
  if (where.kind === "offline") return "Offline, in person";
  if (where.kind === "site") return where.name ?? siteNameOf(where.url) ?? "Another website";
  return where.name ?? "Another tool";
}

/** The most of a check's case text, and its most cases. */
export const CASE_TEXT_MAX = 280;
export const CASES_MAX = 50;

/** A check's cases, read defensively. */
export function checkCasesOf(value: unknown): CheckCase[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.passed !== "boolean") return [];
    const text = (key: string) => (typeof entry[key] === "string" ? (entry[key] as string).trim().slice(0, CASE_TEXT_MAX) : "");
    const input = text("input");
    const expected = text("expected");
    if (!input && !expected) return [];
    return [{ input, expected, actual: text("actual"), passed: entry.passed }];
  }).slice(0, CASES_MAX);
}

/** CA-12 P12: when cases are given, "Runs … passed of …" is worked out from them. */
export const casesTotals = (cases: readonly CheckCase[]): { passed: number; total: number } => ({ passed: cases.filter((c) => c.passed).length, total: cases.length });

/** CA-12 P8: the kind of file a name says it is. */
export function fileKindOf(name: string, mime?: string | null): FileKind {
  const type = (mime ?? "").toLowerCase();
  const ext = (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? "").toLowerCase();
  if (type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(ext)) return "picture";
  if (type === "application/pdf" || ext === "pdf") return "pdf";
  if (["csv", "tsv", "xls", "xlsx", "ods"].includes(ext) || type.includes("spreadsheet") || type === "text/csv") return "spreadsheet";
  if (["ts", "tsx", "js", "jsx", "mjs", "py", "sql", "json", "yaml", "yml", "sh", "bash", "html", "css", "rb", "go", "rs", "java", "php", "toml"].includes(ext)) return "code";
  if (type.startsWith("text/") || ["txt", "md", "markdown", "log", "rtf"].includes(ext)) return "text";
  return "other";
}

/** CA-12 P8: the first `count` lines of a file's text, trimmed of trailing space, empty lines at the end dropped. */
export function previewOf(textValue: string, count = 4): string[] {
  const lines = textValue.split(/\r?\n/).slice(0, count).map((line) => line.replace(/\s+$/, "").slice(0, 160));
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** CA-12 P8: a file tile's facts, from its payload. */
function fileFactsOf(payload: Payload): FileTileFacts {
  const name = stringOf(payload.title)?.trim() ?? "Untitled file";
  const preview = Array.isArray(payload.preview) ? payload.preview.filter((line): line is string => typeof line === "string").slice(0, 4) : [];
  return {
    kind: fileKindOf(name, stringOf(payload.mime)),
    name,
    size: typeof payload.size === "number" && Number.isFinite(payload.size) && payload.size >= 0 ? payload.size : null,
    preview,
    mediaId: stringOf(payload.media_id),
  };
}

function stepFor(node: NodeTree, number: string, kind: StepKind, children: Step[] = []): Step {
  const payload = payloadOf(node);
  const text =
    kind === "agent"
      ? (stringOf(payload.system_prompt) ?? "")
      : kind === "code"
        ? (stringOf(payload.source) ?? "")
        : kind === "check"
          ? (stringOf(payload.tested) ?? "")
          : kind === "file"
            ? (stringOf(payload.summary) ?? "")
            : kind === "tool"
              ? (stringOf(payload.scopes) ?? "")
              : kind === "decision"
                ? (stringOf(payload.state_sample) ?? "")
                : kind === "dataset" || kind === "repo"
                  ? (stringOf(payload.description) ?? "")
                  : (stringOf(payload.text) ?? "");
  // CA-12 P6: named from what it holds, never by repeating its number.
  const defaultTitle = defaultTitleFor(kind, payload);
  const import_ = isRecord(node.source_ref) ? node.source_ref.import_session_id : undefined;
  const tool = kind === "tool" ? stringOf(payload.service) : stringOf(payload.tool);
  const where = kind === "manual" ? manualWhereOf(payload) : null;
  const cases = kind === "check" ? checkCasesOf(payload.cases) : [];
  return {
    id: node.id,
    kind,
    number,
    title: stringOf(node.title)?.trim() || null,
    defaultTitle,
    text,
    words: wordCount(text),
    model: stringOf(payload.model),
    sessionId: typeof import_ === "string" && import_ ? import_ : null,
    session: stringOf(payload.session) ?? (typeof import_ === "string" && import_ ? import_ : null),
    tool: tool ? (toolName(tool) ?? tool) : null,
    runs: kind === "agent" || kind === "team" ? parseRuns(payload.runs) : null,
    uses: usesOf(node),
    dismissed: dismissedOf(payload),
    children,
    ...(kind === "manual" ? { mediaId: stringOf(payload.media_id), lines: manualLinesOf(text), ...(where ? { where } : null) } : null),
    ...((kind === "prompt" || kind === "agent" || kind === "code") && modelRunOf(payload.modelRun) ? { modelRun: modelRunOf(payload.modelRun) as ModelRun } : null),
    ...(kind === "prompt" && changesOf(payload, text).length > 0 ? { changes: changesOf(payload, text) } : null),
    ...(kind === "agent" ? agentFacts(payload) : null),
    ...(kind === "team" && patternOf(payload.pattern) ? { pattern: patternOf(payload.pattern) as AgentPattern } : null),
    ...(kind === "code" ? { language: stringOf(payload.language), filename: stringOf(payload.filename)?.trim() || null, entrypoint: payload.entrypoint === true } : null),
    ...(kind === "check" ? { check: checkFacts(payload, cases) } : null),
    ...(kind === "check" && cases.length > 0 ? { cases } : null),
    ...(kind === "prompt" && stringOf(payload.reply)?.trim() ? { reply: (stringOf(payload.reply) as string).trim().slice(0, REPLY_MAX) } : null),
    ...(kind === "prompt" && settingsOf(payload.settings) ? { settings: settingsOf(payload.settings) as PromptSettings } : null),
    ...((kind === "prompt" || kind === "system_prompt") && variablesOf(payload.variables).length > 0 ? { variables: variablesOf(payload.variables) } : null),
    ...(kind === "system_prompt" ? { systemPrompt: { ...systemPromptOf(payload), appliesTo: 0 } } : null),
    ...(kind === "dataset" ? { dataset: datasetOf(payload) } : null),
    ...(kind === "repo" && repoOf(payload) ? { repo: repoOf(payload) as RepoFacts } : null),
    ...(kind === "tool" ? { app: { ...toolConnectionOf(node), scopes: stringOf(payload.scopes)?.trim() ?? null, ...toolExtrasOf(payload) } } : null),
    ...(kind === "file" ? { fileFacts: fileFactsOf(payload) } : null),
    ...(kind === "file" ? { filename: stringOf(payload.title)?.trim() || null, mediaId: stringOf(payload.media_id) } : null),
    ...(kind === "file" && typeof payload.rows === "number" && Number.isInteger(payload.rows) && payload.rows > 0 ? { rows: payload.rows } : null),
    ...(kind === "decision" && decisionOf(payload) ? { decision: decisionOf(payload) as DecisionFacts } : null),
    ...runtimeFactsOf(kind, payload),
    // CA-13 P3: only a runtime tile runs when a decision went a certain way.
    ...(canRunWhen(kind) && runsWhenOf(payload.runs_when) ? { runsWhen: runsWhenOf(payload.runs_when) as RunsWhen } : null),
    // CA-06 P4: the maker's colour, when it reads as one.
    ...(normaliseHex(payload.colour) ? { colour: normaliseHex(payload.colour) as string } : null),
  };
}

/** CA-13: the runtime facts a tile's payload holds, each only on the tiles that can have it. */
function runtimeFactsOf(kind: StepKind, payload: Payload): Partial<Step> {
  const out: Partial<Step> = {};
  if (kind === "agent") {
    const helpers = helpersOf(payload.helpers);
    if (helpers.length) out.helpers = helpers;
    const definedIn = Array.isArray(payload.defined_in) ? payload.defined_in.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
    if (definedIn.length) out.definedIn = definedIn;
    const trace = traceUrlOf(payload.trace_url);
    if (trace) out.traceUrl = trace;
    const install = stringOf(payload.install)?.trim().slice(0, 400);
    if (install) out.install = install;
  }
  if (kind === "prompt" || kind === "agent") {
    const shape = outputShapeOf(payload.output_shape);
    if (shape) out.outputShape = shape;
  }
  const built = buildCostOf(payload.build_cost);
  if (built) out.buildCost = built;
  if (kind === "agent" || kind === "team" || kind === "code" || kind === "tool" || kind === "decision") {
    const run = runCostOf(payload.run_cost);
    if (run) out.runCost = run;
  }
  return out;
}

/** An agent's instructions: its first child, drawn from the agent's own row. */
function instructionsOf(agent: NodeTree, number: string): Step {
  const base = stepFor(agent, number, "agent");
  return {
    ...base,
    id: `${agent.id}:instructions`,
    kind: "prompt",
    title: null,
    defaultTitle: "Instructions",
    runs: null,
    uses: [],
    dismissed: [],
    sessionId: null,
    session: null,
    tool: null,
    children: [],
    harness: undefined,
    models: undefined,
    toolRefs: undefined,
    memory: undefined,
    memoryTidy: undefined,
    changesEachRound: undefined,
    modelRun: undefined,
    runsWhen: undefined,
    helpers: undefined,
    definedIn: undefined,
    traceUrl: undefined,
    install: undefined,
    limits: undefined,
    output: undefined,
    sample: undefined,
    outputShape: undefined,
    buildCost: undefined,
    runCost: undefined,
  };
}

/** CA-04 P2: how deep tiles go inside tiles. The design sets no limit; this is the technical one. */
export const NEST_DEPTH_MAX = 50;

/** CA-04 P2: what can be sent with a step: any step, and a file. */
const isSentWithNode = (node: Pick<BuildNode, "type"> & { payload?: unknown }): boolean => node.type === FILE_TYPE || isStepNode(node);

const sub = (number: string, at: number): string => (number ? `${number}.${at}` : "");

/** How a tile's eyebrow names the step it is sent with: "prompt 2", "order-form.tsx". */
export function sentWithLabel(step: Pick<Step, "kind" | "number" | "title" | "filename">): string {
  if ((step.kind === "code" || step.kind === "file") && step.filename) return step.filename;
  if (step.number) return `${KIND_NAME[step.kind].toLowerCase()} ${step.number}`;
  return step.title ?? KIND_NAME[step.kind].toLowerCase();
}

/**
 * One node read as a step, with what it holds. An agent's children are its instructions then its prompts; a team's
 * are its agents (an agent in a team has children only when it has prompts of its own, numbered one level further,
 * "3.1.2"). Any other step's children are the tiles sent with it (CA-04 P2), unnumbered, read the same way, to
 * `NEST_DEPTH_MAX` levels.
 */
function readStep(node: NodeTree, number: string, kind: StepKind, depth: number, inTeam = false): Step {
  if (kind === "agent") {
    const prompts = byPosition((node.children ?? []).filter((child) => child.type === PROMPT_TYPE));
    if (inTeam && prompts.length === 0) return stepFor(node, number, kind, []);
    return stepFor(node, number, kind, [instructionsOf(node, sub(number, 1)), ...prompts.map((child, i) => stepFor(child, sub(number, i + 2), "prompt"))]);
  }
  if (kind === "team") {
    const agents = byPosition((node.children ?? []).filter((child) => child.type === AGENT_TYPE));
    return stepFor(node, number, kind, agents.map((child, i) => readStep(child, sub(number, i + 1), "agent", depth, true)));
  }
  const step = stepFor(node, number, kind);
  if (depth >= NEST_DEPTH_MAX) return step;
  const label = sentWithLabel(step);
  const sent = byPosition((node.children ?? []).filter(isSentWithNode)).map((child) => ({
    ...readStep(child, "", kindOfNode(child) as StepKind, depth + 1),
    inside: { id: step.id, label },
  }));
  if (sent.length === 0) return step;
  // CA-05 P7: a check's cases are the rows of the test files sent with it, counted only when every one of them was.
  const files = sent.filter((tile) => tile.kind === "file" && /\.(csv|json|jsonl)$/i.test(tile.filename ?? ""));
  const cases = files.length > 0 && files.every((tile) => tile.rows) ? files.reduce((sum, tile) => sum + (tile.rows ?? 0), 0) : 0;
  return { ...step, sentWith: sent, ...(step.kind === "check" && step.check && cases > 0 ? { check: { ...step.check, cases } } : null) };
}

/**
 * The steps in order, numbered (DATA §1). `tree` is the nested placed tree.
 * An agent's children are its instructions then its prompts; a team's are its
 * agents. An agent in a team has children only when it has prompts of its own
 * (its instructions, then those prompts, numbered one level further, "3.1.2"),
 * which show when it is opened. CA-04 P2: any other step carries the tiles sent
 * with it in `sentWith`, recursively; only top-level steps take numbers.
 */
export function buildSteps(tree: readonly NodeTree[]): Step[] {
  const top = byPosition(tree.filter((node) => node.parent_id === null && isStepNode(node)));
  return withReach(top.map((node, index) => readStep(node, String(index + 1), kindOfNode(node) as StepKind, 0)));
}

/**
 * CA-15 P9: how many of the build's prompts each system prompt applies to: every prompt, the prompts of one session, or the
 * ones chosen. A prompt is a top-level prompt step or one inside an agent, never an agent's instructions.
 */
function withReach(steps: Step[]): Step[] {
  const all = flattenSteps(steps);
  if (!all.some((step) => step.kind === "system_prompt")) return steps;
  const prompts = all.filter((step) => step.kind === "prompt" && !step.id.endsWith(":instructions"));
  const reach = (step: Step): number => {
    const scope = step.systemPrompt?.scope;
    if (!scope || scope.kind === "all") return prompts.length;
    if (scope.kind === "session") return prompts.filter((prompt) => prompt.session === scope.key).length;
    return scope.ids.filter((id) => prompts.some((prompt) => prompt.id === id)).length;
  };
  const apply = (step: Step): Step => ({
    ...step,
    ...(step.kind === "system_prompt" && step.systemPrompt ? { systemPrompt: { ...step.systemPrompt, appliesTo: reach(step) } } : null),
    children: step.children.map(apply),
    ...(step.sentWith ? { sentWith: step.sentWith.map(apply) } : null),
  });
  return steps.map(apply);
}

/** CA-04 P2: a step and every tile sent with it, depth first, in order. */
export function withSentWith(step: Step): Step[] {
  return [step, ...(step.sentWith ?? []).flatMap(withSentWith)];
}

/** The title the maker typed, else the default. */
export function stepTitle(step: Pick<Step, "title" | "defaultTitle">): string {
  return step.title ?? step.defaultTitle;
}

/** The tool a maker gave a session: the list's name for it, else as typed. */
function chosenTool(raw: string | undefined): string | null {
  const typed = raw?.trim();
  return typed ? (toolName(typed) ?? typed) : null;
}

/**
 * The sessions that make up the top-level steps, in order of first step (DATA §5; CA-04 P1). Every top-level step is
 * in one group, not only the prompts: a session is one group wherever its steps sit.
 *
 * A step's session is the one it recorded (`step.session`: `payload.session`, else its import). A step saved before
 * CA-04 with neither is read, never written: a prompt typed by hand joins the unbroken run of typed prompts it is in,
 * one session per run as before, keyed `typed-legacy-<n>`, its tool the first tool those prompts name; any other step
 * sits in the session of the step before it. An old build's steps that come before any session are one `implicit`
 * group, which has no number and no head.
 *
 * `sessions` is builds.making.sessions; an entry without an id cannot be matched, and its prompts keep the model they
 * name. `sessionTools` is builds.making.session_tools (TF-13): a session whose client names no tool takes the tool the
 * maker gave it, by `toolName` or as typed. A client's own tool always wins. `meta` is builds.making.sessions_meta: a
 * session made here takes its tool, model and day from it, and one with no steps yet follows the others. `order` (CA-12) is
 * the keys of `build_sessions` in position order; see where it is applied.
 */
export function sessionGroups(
  steps: readonly Step[],
  sessions: readonly MakingSession[],
  sessionTools: Readonly<Record<string, string>>,
  meta: Readonly<Record<string, SessionMeta>> = {},
  order: readonly string[] = [],
): SessionGroup[] {
  const known = new Map<string, MakingSession>();
  for (const session of sessions) if (session.id) known.set(session.id, session);
  const stepsByNumber = new Map(steps.map((step) => [step.number, step]));

  const groups: SessionGroup[] = [];
  const byKey = new Map<string, SessionGroup>();
  let numbered = 0;
  let legacy = 0;
  /** The run of typed prompts the last step was in, while it is unbroken. */
  let run: SessionGroup | null = null;
  let previous: SessionGroup | null = null;

  const open = (group: Omit<SessionGroup, "number" | "stepNumbers"> & { key: string }): SessionGroup => {
    const made: SessionGroup = { ...group, number: group.implicit ? 0 : ++numbered, stepNumbers: [] };
    groups.push(made);
    byKey.set(group.key, made);
    return made;
  };

  const recorded = (key: string, step: Step): SessionGroup => {
    const found = byKey.get(key);
    if (found) return found;
    const session = known.get(key);
    const own = meta[key];
    if (session || !own || !key.startsWith(TYPED_SESSION_PREFIX)) {
      // An import (or a key nothing else names, read as one).
      const model = session?.model ?? own?.model ?? (step.kind === "prompt" ? step.model : null);
      return open({
        key,
        kind: "import",
        sessionId: key,
        tool: (session ? toolLabel(session.client) : null) ?? chosenTool(sessionTools[key]) ?? chosenTool(own?.tool ?? undefined),
        model: model ? modelLabel(model) : null,
        startedAt: session?.started_at ?? null,
      });
    }
    return open({ key, kind: "typed", sessionId: null, tool: chosenTool(own.tool ?? undefined), model: own.model ? modelLabel(own.model) : null, startedAt: own.date });
  };

  for (const step of steps) {
    let group: SessionGroup;
    if (step.session) {
      group = recorded(step.session, step);
      run = null;
    } else if (step.kind === "prompt") {
      if (!run) {
        run = open({
          key: `${LEGACY_SESSION_PREFIX}${++legacy}`,
          kind: "legacy",
          sessionId: null,
          tool: step.tool,
          model: step.model ? modelLabel(step.model) : null,
          startedAt: TYPED_HERE,
        });
      }
      run.tool ??= step.tool;
      group = run;
    } else {
      run = null;
      group =
        previous ??
        open({ key: `${LEGACY_SESSION_PREFIX}0`, kind: "legacy", implicit: true, sessionId: null, tool: step.tool ?? step.harness ?? null, model: null, startedAt: TYPED_HERE });
    }
    group.stepNumbers.push(step.number);
    previous = group;
  }

  // Sessions made here that have no step yet, in the order they were made.
  for (const [key, own] of Object.entries(meta)) {
    if (byKey.has(key) || !key.startsWith(TYPED_SESSION_PREFIX) || key.startsWith(LEGACY_SESSION_PREFIX) || !own.date) continue;
    open({ key, kind: "typed", sessionId: null, tool: chosenTool(own.tool ?? undefined), model: own.model ? modelLabel(own.model) : null, startedAt: own.date });
  }
  // CA-12 P5: sessions are numbered by `build_sessions.position`, the order they were added. `order` lists the keys of a
  // draft that has rows, in position order. Only the places those sessions already hold are refilled, in that order:
  // a session that has no row (an old draft's, or an old build's run of typed prompts) keeps its own place, so a draft
  // with no rows, or rows that agree with where its steps sit, reads exactly as it did.
  if (order.length > 0) {
    const rank = new Map(order.map((key, at) => [key, at]));
    const slots = groups.flatMap((group, at) => (!group.implicit && rank.has(groupKey(group)) ? [at] : []));
    const sorted = slots.map((at) => groups[at]).sort((a, b) => (rank.get(groupKey(a)) as number) - (rank.get(groupKey(b)) as number));
    slots.forEach((at, n) => {
      groups[at] = sorted[n];
    });
    let numberedAgain = 0;
    for (const group of groups) if (!group.implicit) group.number = ++numberedAgain;
  }
  // CA-04 P6: what each session worked until, from its entry.
  for (const [key, group] of byKey) {
    const goal = goalOf(meta[key]?.goal);
    if (goal) group.goal = goal;
    // CA-05: what its entry carries beyond that, and how long its own text is.
    const extras = extrasOf(meta[key]);
    if (Object.keys(extras).length > 0) group.extras = extras;
    if (meta[key]?.colour) group.colour = meta[key].colour;
    if (meta[key]?.title) group.title = meta[key].title;
    if (meta[key]) group.marked = true;
    const words = group.stepNumbers.reduce((sum, number) => sum + (stepsByNumber.get(number) ? sessionWords(stepsByNumber.get(number) as Step) : 0), 0);
    if (words > LONG_SESSION_WORDS) group.longWords = words;
  }
  return groups;
}

/** CA-05 P2: the words a step and everything inside it hold. */
function sessionWords(step: Step): number {
  return step.words + step.children.reduce((sum, child) => sum + sessionWords(child), 0) + (step.sentWith ?? []).reduce((sum, tile) => sum + sessionWords(tile), 0);
}

/** CA-04 P1: a group's key: its own, else the import's id, else "typed-{n}" as before. */
export const groupKey = (group: Pick<SessionGroup, "key" | "sessionId" | "number">): string => group.key ?? group.sessionId ?? `typed-${group.number}`;

/** CA-04 P1: a group's kind: its own, else imported when it has an import and typed by hand when not. */
export const groupKind = (group: Pick<SessionGroup, "kind" | "sessionId">): "import" | "typed" | "legacy" => group.kind ?? (group.sessionId ? "import" : "legacy");

/** CA-04 P1: the session groups a reader is shown: every one but an old build's implicit one. */
export const shownGroups = (groups: readonly SessionGroup[]): SessionGroup[] => groups.filter((group) => !group.implicit);

/** CA-04 P1: the group a top-level step is in, read by its number, else by its import; never an implicit group. */
export function groupOfStep(groups: readonly SessionGroup[], step: Pick<Step, "number"> & Partial<Pick<Step, "sessionId">>): SessionGroup | undefined {
  const found = groups.find((group) => group.stepNumbers.includes(step.number)) ?? (step.sessionId ? groups.find((group) => group.sessionId === step.sessionId) : undefined);
  return found?.implicit ? undefined : found;
}

/** CA-04 P1: the numbers of a group's prompts, in order: a group now holds every kind of step. */
export const promptNumbersOf = (group: Pick<SessionGroup, "stepNumbers">, steps: readonly Pick<Step, "number" | "kind">[]): string[] =>
  group.stepNumbers.filter((number) => steps.find((step) => step.number === number)?.kind === "prompt");

/** Every step, parents before their children. */
function flattenSteps(steps: readonly Step[]): Step[] {
  return steps.flatMap((step) => [step, ...flattenSteps(step.children)]);
}

/**
 * Where a step's work goes (DATA §3): every step whose uses name it as an
 * output, then the next step in the same session. Never stored.
 */
export function goesInto(steps: readonly Step[], id: string): Step[] {
  const out: Step[] = flattenSteps(steps).filter(
    (step) => step.id !== id && step.uses.some((use) => use.kind === "output" && use.node_id === id),
  );
  const index = steps.findIndex((step) => step.id === id);
  const here = steps[index];
  const next = steps[index + 1];
  if (here?.kind === "prompt" && here.sessionId && next?.kind === "prompt" && next.sessionId === here.sessionId) {
    if (!out.some((step) => step.id === next.id)) out.push(next);
  }
  return out;
}

// --- writes -------------------------------------------------------------------

const withPayload = (node: BuildNode, payload: Payload): BuildNodeInsert => ({
  ...nodeRow(node),
  payload: payload as Json,
});

/** Name a step. Trimmed, at most 80 characters; an empty title saves as null. */
export async function setStepTitle(node: BuildNode, title: string): Promise<BuildNode> {
  const trimmed = title.trim();
  if (trimmed.length > TITLE_MAX) throw refuse("setStepTitle", `A title is at most ${TITLE_MAX} characters.`);
  return upsertNode({ ...nodeRow(node), title: trimmed || null });
}

/**
 * CA-04 P1: the session a top-level step sits in (`payload.session`), or none (null), which an old build's step reads
 * as the session it sits in. A key that is only read, never stored (`typed-legacy-<n>`), is refused.
 */
export async function setStepSession(node: BuildNode, session: string | null): Promise<BuildNode> {
  if (session && session.startsWith(LEGACY_SESSION_PREFIX)) throw refuse("setStepSession", "That session is not saved yet.");
  const payload = { ...payloadOf(node) };
  if (session) payload.session = session;
  else delete payload.session;
  return upsertNode(withPayload(node, payload));
}

const useKey = (use: Use): string => `${use.kind}:${use.node_id}`;

/**
 * Why a step cannot take this input, or null when it can (DATA §3). A step
 * never uses itself and the same use is never listed twice. A use of a LATER
 * step is allowed only when that step sits in the same agent or team and its
 * runs is "until": a checker sending work back. Pure, so the Map can say no
 * to a drag before anything is written.
 */
export function inputRefusal(
  nodeId: string,
  current: readonly Use[],
  use: Use,
  steps: readonly Step[],
  made?: ReadonlyMap<string, string>,
  names?: ReadonlyMap<string, string>,
): string | null {
  if (!USE_KINDS.includes(use.kind) || !use.node_id) return "That input is not a step, a file or a tool.";
  if (use.node_id === nodeId) return "A step never uses itself.";
  if (current.some((entry) => useKey(entry) === useKey(use))) return "That input is already listed.";

  if (use.kind === "output") {
    const all = flattenSteps(steps);
    const from = all.findIndex((step) => step.id === nodeId);
    const to = all.findIndex((step) => step.id === use.node_id);
    if (from < 0) return "That is not a step.";
    if (to < 0) return "That step is not in this build.";
    if (to > from) {
      const parentOf = (id: string) => steps.find((step) => step.children.some((child) => child.id === id));
      const parent = parentOf(nodeId);
      const sameContainer = Boolean(parent) && parent === parentOf(use.node_id);
      if (!sameContainer || all[to].runs?.how !== "until") {
        return "Only a step that repeats until a condition is met can be used before it runs.";
      }
    }
  }
  if (use.kind === "file") {
    const maker = made?.get(use.node_id);
    if (maker) {
      const all = flattenSteps(steps);
      const from = all.findIndex((step) => step.id === nodeId);
      const at = all.findIndex((step) => step.id === maker);
      if (from >= 0 && at >= 0 && at >= from) {
        const parentOf = (id: string) => steps.find((step) => step.children.some((child) => child.id === id));
        const parent = parentOf(nodeId);
        const sameContainer = at > from && Boolean(parent) && parent === parentOf(maker);
        if (!sameContainer || all[at].runs?.how !== "until") {
          return `Only a step after step ${all[at].number} can use ${names?.get(use.node_id) ?? "that file"}.`;
        }
      }
    }
  }
  return null;
}

/** Add an input to a step; `inputRefusal` says when it cannot. */
export async function addUse(
  node: BuildNode,
  use: Use,
  steps: readonly Step[],
  made?: ReadonlyMap<string, string>,
  names?: ReadonlyMap<string, string>,
): Promise<BuildNode> {
  const current = usesOf(node);
  const why = inputRefusal(node.id, current, use, steps, made, names);
  if (why) throw refuse("addUse", why);

  const payload = payloadOf(node);
  const dismissed = Array.isArray(payload.dismissed) ? payload.dismissed.filter((key) => key !== useKey(use)) : undefined;
  const next: Payload = { ...payload, uses: [...current, use] as unknown as Json };
  if (dismissed) next.dismissed = dismissed;
  return upsertNode(withPayload(node, next));
}

/** Take an input off a step. Nothing is written if it was not there. */
export async function removeUse(node: BuildNode, use: Use): Promise<BuildNode> {
  const current = usesOf(node);
  const kept = current.filter((entry) => useKey(entry) !== useKey(use));
  if (kept.length === current.length) return node;
  return upsertNode(withPayload(node, { ...payloadOf(node), uses: kept as unknown as Json }));
}

/** Keep a suggestion from being offered again. `key` is "<kind>:<node_id>". */
export async function dismissSuggestion(node: BuildNode, key: string): Promise<BuildNode> {
  const [kind, ...rest] = key.split(":");
  if (!USE_KINDS.includes(kind as UseKind) || !rest.join(":")) throw refuse("dismissSuggestion", "That is not a suggestion.");
  const raw = payloadOf(node).dismissed;
  const dismissed = Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === "string") : [];
  if (dismissed.includes(key)) return node;
  return upsertNode(withPayload(node, { ...payloadOf(node), dismissed: [...dismissed, key] }));
}

/** CA-04 P2: keep a block sent with an imported prompt from being offered again. `key` is "sent:<n>". */
export async function dismissSentWith(node: BuildNode, key: string): Promise<BuildNode> {
  if (!/^sent:\d+$/.test(key)) throw refuse("dismissSentWith", "That is not a suggestion.");
  const dismissed = dismissedOf(payloadOf(node));
  if (dismissed.includes(key)) return node;
  return upsertNode(withPayload(node, { ...payloadOf(node), dismissed: [...dismissed, key] }));
}

/**
 * How an agent or a team runs (CONCEPT §3). "When I asked" (once) is no `runs` at all.
 * Several at the same time needs a count of 2 to 20; the others take one short line.
 */
export async function setRuns(node: BuildNode, runs: Runs | null): Promise<BuildNode> {
  if (node.type !== AGENT_TYPE && node.type !== TEAM_TYPE) throw refuse("setRuns", "Only an agent or a team has a way it runs.");
  const payload = { ...payloadOf(node) };
  delete payload.runs;
  const next = runsPayload("setRuns", runs);
  if (next) payload.runs = next;
  return upsertNode(withPayload(node, payload));
}

/** The `runs` value to store, checked; null for "When I asked", which is no `runs` at all. */
function runsPayload(operation: string, runs: Runs | null | undefined): Json | null {
  if (!runs || runs.how === "once") return null;
  if (!RUNS_HOWS.includes(runs.how)) throw refuse(operation, "That is not a way to run.");
  const next: Runs = { how: runs.how };
  if (runs.how === "parallel") {
    const count = runs.count;
    if (typeof count !== "number" || !Number.isInteger(count) || count < RUNS_COUNT_MIN || count > RUNS_COUNT_MAX) {
      throw refuse(operation, `Several at the same time is ${RUNS_COUNT_MIN} to ${RUNS_COUNT_MAX} at a time.`);
    }
    next.count = count;
  } else if (runs.how === "goal") {
    // The goal is the session's (making.sessions_meta), never repeated here.
  } else {
    const detail = (runs.detail ?? "").trim();
    const max = runs.how === "until" ? UNTIL_DETAIL_MAX : runs.how === "script" ? SCRIPT_DETAIL_MAX : WHEN_DETAIL_MAX;
    if (detail.length > max) throw refuse(operation, `That line is at most ${max} characters.`);
    if (detail) next.detail = detail;
  }
  return next as unknown as Json;
}

/** Say once that the type is not in the registry yet, then stop. */
async function requireLiveType(operation: string, key: string, message: string = NODE_TYPE_MISSING): Promise<void> {
  const type = await getNodeType(key);
  if (!type || !type.is_active) throw refuse(operation, message);
}

const titleOrNull = (value: string | null | undefined): string | null => value?.trim() || null;

/** What an agent ran in, the models it used and the tools it could call (CA-02 P5). Every key is optional. */
export interface AgentSetup {
  /** A tool id or a typed name; null or absent for the maker's own code. */
  harness?: string | null;
  /** Every model with its role, the main one first. Stored only when there is more than one. */
  models?: readonly AgentModel[];
  /** The integration nodes the agent may call. */
  toolRefs?: readonly string[];
  /** CA-03 P6: what it remembers, up to 200 characters; empty leaves the key out. */
  memory?: string | null;
  /** CA-05 P9: how it tidies its notes, up to 120 characters; empty leaves the key out. */
  memoryTidy?: string | null;
  /** CA-05 P9: what it changes each round, up to 120 characters; empty leaves the key out. */
  changesEachRound?: string | null;
}

/**
 * The payload keys an agent's setup writes, checked. `model` is the main model and stays required: everything that
 * reads an agent reads it. A row of `models` with no model is refused; so is a fifth row.
 */
function setupPayload(operation: string, model: string, { harness, models, toolRefs, memory, memoryTidy, changesEachRound }: AgentSetup): Payload {
  const main = model.trim();
  if (!main) throw refuse(operation, "An agent needs a model.");
  const out: Payload = { model: main };
  const named = harness?.trim();
  if (named) {
    if (named.length > HARNESS_MAX) throw refuse(operation, `A harness is at most ${HARNESS_MAX} characters.`);
    out.harness = toolFor(named)?.id ?? named;
  }
  if (models && models.length > 0) {
    if (models.length > AGENT_MODELS_MAX) throw refuse(operation, `An agent names ${AGENT_MODELS_MAX} models at most.`);
    const rows = models.map((row, index) => {
      const name = row.model.trim();
      if (!name) throw refuse(operation, "Each model needs its name.");
      const role = index === 0 ? "main" : row.role.trim();
      if (!role || role.length > ROLE_MAX) throw refuse(operation, `A role is 1 to ${ROLE_MAX} characters.`);
      return { model: name, role };
    });
    if (rows[0].model !== main) throw refuse(operation, "The first model is the agent's main model.");
    if (rows.length > 1) out.models = rows as unknown as Json;
  }
  const refs = [...new Set((toolRefs ?? []).filter((ref) => typeof ref === "string" && ref))];
  if (refs.length) out.tools = refs.map((ref) => ({ tool_ref: ref })) as unknown as Json;
  const remembers = memory?.trim();
  if (remembers) {
    if (remembers.length > MEMORY_MAX) throw refuse(operation, `What it remembers is at most ${MEMORY_MAX} characters.`);
    out.memory = remembers;
  }
  const tidy = memoryTidy?.trim();
  if (tidy) {
    if (tidy.length > MEMORY_TIDY_MAX) throw refuse(operation, `How it tidies its notes is at most ${MEMORY_TIDY_MAX} characters.`);
    out.memory_tidy = tidy;
  }
  const changes = changesEachRound?.trim();
  if (changes) {
    if (changes.length > CHANGES_EACH_ROUND_MAX) throw refuse(operation, `What it changes each round is at most ${CHANGES_EACH_ROUND_MAX} characters.`);
    out.changes_each_round = changes;
  }
  return out;
}

/**
 * An agent: top level, or inside a team when `parentId` names one (UI-P69).
 * A blank name saves as null, so the default "Agent {n}" shows. CA-02 P5: it
 * can name its harness, its models with their roles and the tools it calls.
 */
export async function addAgent(
  buildId: string,
  tree: readonly NodeTree[],
  { name, model, parentId, instructions, session, runs, ...setup }: { name?: string | null; model: string; parentId?: string | null; instructions?: string; session?: string | null; runs?: Runs | null } & AgentSetup,
): Promise<BuildNode> {
  const keys = setupPayload("addAgent", model, setup);
  const title = titleOrNull(name);
  if (title && title.length > TITLE_MAX) throw refuse("addAgent", `A title is at most ${TITLE_MAX} characters.`);
  const start = runsPayload("addAgent", runs);
  const node = { type: AGENT_TYPE, title, payload: { system_prompt: instructions ?? "", ...keys, ...(start ? { runs: start } : null), ...(session && !parentId ? { session } : null) } as Json };
  return parentId ? placeChildNode(buildId, tree, parentId, node) : placeTopNode(buildId, tree, node);
}

/** A team is never empty: it is made holding one agent, which `model` and the setup describe: the agent that leads it. */
export async function addTeam(
  buildId: string,
  tree: readonly NodeTree[],
  { name, model, instructions, session, runs, ...setup }: { name?: string | null; model: string; instructions?: string; session?: string | null; runs?: Runs | null } & AgentSetup,
): Promise<{ team: BuildNode; agent: BuildNode }> {
  await requireLiveType("addTeam", TEAM_TYPE);
  const title = titleOrNull(name);
  if (title && title.length > TITLE_MAX) throw refuse("addTeam", `A title is at most ${TITLE_MAX} characters.`);
  const keys = setupPayload("addTeam", model, setup);
  const start = runsPayload("addTeam", runs);
  const team = await placeTopNode(buildId, tree, { type: TEAM_TYPE, title, payload: { ...(session ? { session } : null), ...(start ? { runs: start } : null) } as Json });
  const agent = await placeChildNode(buildId, [], team.id, { type: AGENT_TYPE, title: null, payload: { system_prompt: instructions ?? "", ...keys } as Json });
  return { team, agent };
}

// --- CA-13: decisions and "Runs when" ----------------------------------------

/** What a Decision holds when it is added or changed. `answer` is one real answer, when the maker has one. */
export interface DecisionInput {
  /** A blank name saves as null, so the default (its question names) shows. */
  name?: string | null;
  provider: string;
  model: string;
  via?: "api" | "adapter";
  /** The Code tiles that make the call (rule 4). */
  calledFrom?: readonly string[];
  /** The step the state came from (writes a Uses link), or null when typed. */
  stateFrom?: string | null;
  stateSample?: string;
  questions: readonly DecisionQuestion[];
  answer?: Record<string, DecisionAnswer>;
  source?: "run" | "maker";
  /** "Installation command", as given. */
  install?: string;
  /** CA-15 P8: input and expected output pairs. */
  examples?: readonly DecisionExample[];
  /** CA-15 P8: what to do when it is not confident. */
  lowConfidence?: LowConfidence;
  session?: string | null;
}

/** The payload keys a Decision writes, checked. */
function decisionPayload(operation: string, input: DecisionInput): Payload {
  const provider = input.provider.trim();
  if (!provider) throw refuse(operation, "A decision needs a model or service.");
  const why = questionsRefusal(input.questions, input.name?.trim() || undefined);
  if (why) throw refuse(operation, why);
  if ((input.stateSample ?? "").length > STATE_SAMPLE_MAX) throw refuse(operation, `The state is at most ${STATE_SAMPLE_MAX.toLocaleString("en-GB")} characters.`);
  const out: Payload = {
    provider: toolFor(provider)?.id ?? provider,
    model: input.model.trim(),
    questions: input.questions.map((q) => ({
      id: q.id.trim(),
      type: q.type,
      instructions: q.instructions.trim(),
      ...(takesOptions(q.type) ? { options: (q.options ?? []).map((o) => ({ key: o.key.trim(), ...(o.line?.trim() ? { line: o.line.trim() } : null) })) } : null),
      ...(q.type === "score" ? { levels: (q.levels ?? []).map((level) => level.trim()) } : null),
      ...(q.type === "extract" ? { field: q.field ?? "text" } : null),
    })) as unknown as Json,
  };
  if (input.via) out.via = input.via;
  const called = [...new Set((input.calledFrom ?? []).filter(Boolean))];
  if (called.length) out.called_from = called;
  if (input.stateFrom) out.state_from = input.stateFrom;
  if (input.stateSample?.trim()) out.state_sample = input.stateSample;
  if (input.answer && Object.keys(input.answer).length) {
    out.answer = input.answer as unknown as Json;
    out.source = input.source ?? "maker";
  }
  if (input.install?.trim()) out.install = input.install.trim();
  const examples = (input.examples ?? []).map((example) => ({ input: example.input.trim(), output: example.output.trim() })).filter((example) => example.input || example.output);
  if (examples.length > 0) out.examples = examples;
  if (input.lowConfidence) out.low_confidence = input.lowConfidence as unknown as Json;
  return out;
}

/** A Decision: top level, a runtime tile. Refused until the CA-13 database change is live. */
export async function addDecision(buildId: string, tree: readonly NodeTree[], input: DecisionInput): Promise<BuildNode> {
  await requireLiveType("addDecision", DECISION_TYPE, DECISION_TYPE_MISSING);
  const title = titleOrNull(input.name);
  if (title && title.length > TITLE_MAX) throw refuse("addDecision", `A title is at most ${TITLE_MAX} characters.`);
  const keys = decisionPayload("addDecision", input);
  const uses = input.stateFrom ? [{ kind: "output", node_id: input.stateFrom }] : [];
  return placeTopNode(buildId, tree, { type: DECISION_TYPE, title, payload: { ...keys, ...(uses.length ? { uses } : null), ...(input.session ? { session: input.session } : null) } as Json });
}

/** Change a Decision's settings. Keys it does not write (its place, "Runs when", costs) are kept. */
export async function setDecision(node: BuildNode, input: DecisionInput): Promise<BuildNode> {
  if (node.type !== DECISION_TYPE) throw refuse("setDecision", "That is not a decision.");
  const keys = decisionPayload("setDecision", input);
  const old = payloadOf(node);
  const payload: Payload = { ...old };
  for (const key of ["via", "called_from", "state_from", "state_sample", "answer", "source", "install", "examples", "low_confidence"]) delete payload[key];
  Object.assign(payload, keys);
  // The state's Uses link follows "What it reads": the old output link goes, the new one is added.
  const kept = usesOf(node).filter((use) => !(use.kind === "output" && use.node_id === old.state_from));
  if (input.stateFrom && !kept.some((use) => use.kind === "output" && use.node_id === input.stateFrom)) kept.push({ kind: "output", node_id: input.stateFrom });
  if (kept.length) payload.uses = kept as unknown as Json;
  else delete payload.uses;
  const title = titleOrNull(input.name);
  if (title && title.length > TITLE_MAX) throw refuse("setDecision", `A title is at most ${TITLE_MAX} characters.`);
  return upsertNode({ ...withPayload(node, payload), title });
}

/** What Details can write to a tile beyond its own fields (CA-13). A key left out is kept; `null` takes it off. */
export interface RuntimePatch {
  helpers?: readonly Helper[] | null;
  definedIn?: readonly string[] | null;
  traceUrl?: string | null;
  install?: string | null;
  outputShape?: OutputShape | null;
  buildCost?: CostFigures | null;
  runCost?: RunCost | null;
}

const RUNTIME_TYPES = new Set([AGENT_TYPE, TEAM_TYPE, CODE_TYPE, DECISION_TYPE, TOOL_TYPE]);

/**
 * CA-13: the runtime facts of a tile, checked. Helpers, "defined in" and a trace link belong to an agent; an install line to
 * an agent or a decision; an answer shape to a prompt or an agent; what it took to make to any tile; what it costs to run to a
 * runtime tile only (rule 3).
 */
export async function setRuntimeFields(node: BuildNode, patch: RuntimePatch): Promise<BuildNode> {
  const payload = { ...payloadOf(node) };
  const set = (key: string, value: unknown) => {
    if (value === null || value === undefined) delete payload[key];
    else payload[key] = value as Json;
  };
  const agent = node.type === AGENT_TYPE;
  if ("helpers" in patch) {
    if (!agent) throw refuse("setRuntimeFields", "Only an agent has helpers.");
    const list = patch.helpers ?? [];
    const why = helpersRefusal(list);
    if (why) throw refuse("setRuntimeFields", `${why}.`);
    set("helpers", list.length ? list : null);
  }
  if ("definedIn" in patch) {
    if (!agent) throw refuse("setRuntimeFields", "Only an agent is defined in code.");
    const ids = [...new Set((patch.definedIn ?? []).filter(Boolean))];
    set("defined_in", ids.length ? ids : null);
  }
  if ("traceUrl" in patch) {
    if (!agent) throw refuse("setRuntimeFields", "Only an agent has a trace link.");
    const why = traceRefusal(patch.traceUrl ?? "");
    if (why) throw refuse("setRuntimeFields", why);
    set("trace_url", patch.traceUrl?.trim() ? (traceUrlOf(patch.traceUrl) as string) : null);
  }
  if ("install" in patch) {
    if (!agent && node.type !== DECISION_TYPE) throw refuse("setRuntimeFields", "Only an agent or a decision has an install line.");
    const line = patch.install?.trim() ?? "";
    if (line.length > 400) throw refuse("setRuntimeFields", "An install line is at most 400 characters.");
    set("install", line || null);
  }
  if ("outputShape" in patch) {
    if (!agent && node.type !== PROMPT_TYPE) throw refuse("setRuntimeFields", "Only a prompt or an agent has an answer shape.");
    if (patch.outputShape) {
      const why = shapeRefusal(patch.outputShape);
      if (why) throw refuse("setRuntimeFields", why);
    }
    set("output_shape", patch.outputShape ?? null);
  }
  if ("buildCost" in patch) {
    if (patch.buildCost) {
      const why = costRefusal(patch.buildCost);
      if (why) throw refuse("setRuntimeFields", why);
    }
    set("build_cost", patch.buildCost && buildCostOf(patch.buildCost) ? patch.buildCost : null);
  }
  if ("runCost" in patch) {
    if (!RUNTIME_TYPES.has(node.type)) throw refuse("setRuntimeFields", "Only a runtime tile has a cost to run.");
    if (patch.runCost) {
      const why = costRefusal(patch.runCost);
      if (why) throw refuse("setRuntimeFields", why);
    }
    set("run_cost", patch.runCost && runCostOf(patch.runCost) ? patch.runCost : null);
  }
  return upsertNode(withPayload(node, payload));
}

/** The decisions of a build as `runsWhenRefusal` reads them: id, top-level order and facts. */
export const decisionRefsOf = (steps: readonly Step[]): DecisionRef[] =>
  steps.flatMap((step, index) => (step.kind === "decision" ? [{ id: step.id, index, facts: step.decision ?? null }] : []));

/** The top-level index of a step, or of the team it sits in; -1 when it is not in `steps`. */
export const topIndexOf = (steps: readonly Step[], id: string): number => steps.findIndex((step) => step.id === id || step.children.some((child) => child.id === id));

/**
 * CA-13 P3: set or clear when a runtime tile runs. Refused for a prompt, manual step, file, result or session head, for a
 * decision at or below it, and for a question or value the decision does not have (`runsWhenRefusal`).
 */
export async function setRunsWhen(node: BuildNode, steps: readonly Step[], runsWhen: RunsWhen | null): Promise<BuildNode> {
  const payload = { ...payloadOf(node) };
  delete payload.runs_when;
  if (runsWhen) {
    const kind = node.type === TEAM_TYPE ? "team" : node.type === AGENT_TYPE ? "agent" : node.type === CODE_TYPE ? "code" : node.type === DECISION_TYPE ? "decision" : isStepTile(node) && node.type === TOOL_TYPE ? "tool" : node.type;
    const why = runsWhenRefusal(kind, topIndexOf(steps, node.id), runsWhen, decisionRefsOf(steps));
    if (why) throw refuse("setRunsWhen", why);
    payload.runs_when = runsWhen as unknown as Json;
  }
  return upsertNode(withPayload(node, payload));
}

/**
 * Change what an agent ran in, its models or its tools (CA-02 P5, from Details). The keys given replace the stored
 * ones; a key left out is kept. `model` is the main model, and a single model clears `models`.
 */
export async function setAgentSetup(node: BuildNode, { model, ...setup }: { model: string } & AgentSetup): Promise<BuildNode> {
  if (node.type !== AGENT_TYPE) throw refuse("setAgentSetup", "Only an agent names what ran it.");
  const keys = setupPayload("setAgentSetup", model, setup);
  const payload = { ...payloadOf(node) };
  payload.model = keys.model;
  if ("harness" in setup) {
    if (keys.harness) payload.harness = keys.harness;
    else delete payload.harness;
  }
  if ("models" in setup) {
    if (keys.models) payload.models = keys.models;
    else delete payload.models;
  }
  if ("toolRefs" in setup) {
    if (keys.tools) payload.tools = keys.tools;
    else delete payload.tools;
  }
  if ("memory" in setup) {
    if (keys.memory) payload.memory = keys.memory;
    else delete payload.memory;
  }
  if ("memoryTidy" in setup) {
    if (keys.memory_tidy) payload.memory_tidy = keys.memory_tidy;
    else delete payload.memory_tidy;
  }
  if ("changesEachRound" in setup) {
    if (keys.changes_each_round) payload.changes_each_round = keys.changes_each_round;
    else delete payload.changes_each_round;
  }
  return upsertNode(withPayload(node, payload));
}

/**
 * CA-05 P8: how a model was run (`payload.modelRun = { precision, where }`), beside the model it belongs to. Null, or a
 * run with neither key, takes it off. For a prompt, an agent (its main model) or code.
 */
export async function setModelRun(node: BuildNode, run: ModelRun | null): Promise<BuildNode> {
  if (node.type !== PROMPT_TYPE && node.type !== AGENT_TYPE && node.type !== CODE_TYPE) throw refuse("setModelRun", "Only a prompt, an agent or code has a model that was run.");
  const payload = { ...payloadOf(node) };
  const kept = run ? modelRunOf(run) : null;
  if (run && kept) {
    const why = modelRunRefusal(kept);
    if (why) throw refuse("setModelRun", why);
  }
  if (kept) payload.modelRun = kept as unknown as Json;
  else delete payload.modelRun;
  return upsertNode(withPayload(node, payload));
}

/**
 * CA-05 P9: two optional lines of an agent, each up to 120 characters: how it tidies its notes (`payload.memory_tidy`)
 * and, for one that runs again until a condition was met, what it changes each round (`payload.changes_each_round`).
 * A key left out is kept; an empty one takes its key off.
 */
export async function setAgentNotes(node: BuildNode, notes: { memoryTidy?: string | null; changesEachRound?: string | null }): Promise<BuildNode> {
  if (node.type !== AGENT_TYPE) throw refuse("setAgentNotes", "Only an agent has these lines.");
  const payload = { ...payloadOf(node) };
  const apply = (key: "memory_tidy" | "changes_each_round", value: string | null | undefined, max: number, label: string) => {
    if (value === undefined) return;
    const said = (value ?? "").trim();
    if (said.length > max) throw refuse("setAgentNotes", `${label} is at most ${max} characters.`);
    if (said) payload[key] = said;
    else delete payload[key];
  };
  apply("memory_tidy", notes.memoryTidy, MEMORY_TIDY_MAX, "How it tidies its notes");
  apply("changes_each_round", notes.changesEachRound, CHANGES_EACH_ROUND_MAX, "What it changes each round");
  return upsertNode(withPayload(node, payload));
}

/** The build's integration node for a tool, matched by the registry's tool or by its name in any case; null when there is none. */
export function toolNodeFor(tree: readonly Pick<BuildNode, "id" | "type" | "parent_id" | "payload">[], tool: string): string | null {
  const wanted = tool.trim();
  if (!wanted) return null;
  const known = toolFor(wanted);
  for (const node of tree) {
    if (node.type !== TOOL_TYPE || node.parent_id !== null) continue;
    const service = stringOf(payloadOf(node).service)?.trim();
    if (!service) continue;
    if (known ? toolFor(service)?.id === known.id : service.toLowerCase() === wanted.toLowerCase()) return node.id;
  }
  return null;
}

/** An agent's instructions: `payload.system_prompt`, which is its sub-step n.1. */
export async function setInstructions(agent: BuildNode, text: string): Promise<BuildNode> {
  if (agent.type !== AGENT_TYPE) throw refuse("setInstructions", "Only an agent has instructions.");
  return upsertNode(withPayload(agent, { ...payloadOf(agent), system_prompt: text }));
}

/** A further prompt inside an agent. Refuses empty text. */
export async function addAgentPrompt(agent: BuildNode, tree: readonly NodeTree[], text: string): Promise<BuildNode> {
  if (agent.type !== AGENT_TYPE) throw refuse("addAgentPrompt", "Prompts go inside an agent.");
  if (!text.trim()) throw refuse("addAgentPrompt", "A prompt needs its text.");
  return placeChildNode(agent.build_id, tree, agent.id, { type: PROMPT_TYPE, title: null, payload: { text }, source_ref: null });
}

/**
 * CA-12 P10: the lines and place of a manual step, checked. `lines` is 1 to 12 lines of at most 140 characters; a step saved
 * before this gave one line as `text`. Where it was done is an app (from the apps list), a terminal, a phone, offline or
 * another website with a link; the old `tool` key keeps its name so a reader of an older page still sees where.
 */
function manualKeys(operation: string, input: { tool?: string; text?: string; lines?: readonly string[]; where?: ManualWhere | null }): { tool: string; text: string; where: ManualWhere | null } {
  const lines = (input.lines ?? manualLinesOf(input.text ?? "")).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) throw refuse(operation, `A manual step is 1 to ${MANUAL_LINES_MAX} lines of up to ${MANUAL_TEXT_MAX} characters.`);
  if (lines.length > MANUAL_LINES_MAX) throw refuse(operation, `A manual step is at most ${MANUAL_LINES_MAX} lines.`);
  if (lines.some((line) => line.length > MANUAL_TEXT_MAX)) throw refuse(operation, `Each line is at most ${MANUAL_TEXT_MAX} characters.`);
  let where: ManualWhere | null = null;
  if (input.where) {
    const name = input.where.name?.trim() || null;
    const url = input.where.url?.trim() || null;
    if (name && name.length > MANUAL_TOOL_MAX) throw refuse(operation, `A name is 1 to ${MANUAL_TOOL_MAX} characters.`);
    if (input.where.kind === "app" && !name) throw refuse(operation, "Say which app it was done in.");
    if (input.where.kind === "site" && !name && !url) throw refuse(operation, "Say which website it was done on.");
    where = { kind: input.where.kind, name: input.where.kind === "app" || input.where.kind === "site" ? name : null, url: input.where.kind === "site" ? url : null };
  }
  const tool = where ? manualWhereLabel(where) : (input.tool ?? "").trim();
  if (!tool || tool.length > MANUAL_TOOL_MAX) throw refuse(operation, `A tool is 1 to ${MANUAL_TOOL_MAX} characters.`);
  return { tool, text: lines.join("\n"), where };
}

const wherePayload = (where: ManualWhere): Json => ({ kind: where.kind, ...(where.name ? { name: where.name } : null), ...(where.url ? { url: where.url } : null) }) as Json;

export async function addManualStep(
  buildId: string,
  tree: readonly NodeTree[],
  input: { tool?: string; text?: string; lines?: readonly string[]; where?: ManualWhere | null; media_id?: string | null; session?: string | null },
): Promise<BuildNode> {
  await requireLiveType("addManualStep", MANUAL_STEP_TYPE);
  const { tool, text, where } = manualKeys("addManualStep", input);
  const payload: Payload = { tool, text };
  if (where) payload.where = wherePayload(where);
  if (input.media_id) payload.media_id = input.media_id;
  if (input.session) payload.session = input.session;
  return placeTopNode(buildId, tree, { type: MANUAL_STEP_TYPE, title: null, payload: payload as Json });
}

/**
 * Change a manual step's place, its lines or its picture (DATA §2). `tool` stays for a step edited the old way; `where`
 * and `lines` are CA-12 P10's. `media_id: null` takes the picture off.
 */
export async function setManualFields(
  node: BuildNode,
  fields: { tool?: string; text?: string; lines?: readonly string[]; where?: ManualWhere | null; media_id?: string | null },
): Promise<BuildNode> {
  if (node.type !== MANUAL_STEP_TYPE) throw refuse("setManualFields", "That is not a manual step.");
  const payload = { ...payloadOf(node) };
  const current = manualWhereOf(payload);
  const touches = fields.tool !== undefined || fields.text !== undefined || fields.lines !== undefined || fields.where !== undefined;
  if (touches) {
    const keys = manualKeys("setManualFields", {
      tool: fields.tool ?? stringOf(payload.tool) ?? undefined,
      text: fields.text ?? (fields.lines ? undefined : (stringOf(payload.text) ?? undefined)),
      lines: fields.lines,
      where: fields.where !== undefined ? fields.where : fields.tool !== undefined ? null : current,
    });
    payload.tool = keys.tool;
    payload.text = keys.text;
    if (keys.where) payload.where = wherePayload(keys.where);
    else if (fields.where === null || fields.tool !== undefined) delete payload.where;
  }
  if (fields.media_id !== undefined) {
    if (fields.media_id) payload.media_id = fields.media_id;
    else delete payload.media_id;
  }
  return upsertNode(withPayload(node, payload));
}

/** The longest tool name code is written with, as a prompt's. */
const CODE_TOOL_MAX = 40;

/**
 * Lines of code the maker wrote or ran (CA-02 P7), top level and numbered like any step. Refuses empty source and
 * source over 100,000 characters; `language` is one of the schema's; `tool` and `model` ("Written with") follow a
 * typed prompt's rules and are optional. Nothing here, or anywhere in the composer, runs it.
 */
export async function addCode(
  buildId: string,
  tree: readonly NodeTree[],
  {
    source,
    language,
    filename,
    tool,
    model,
    entrypoint,
    session,
    parentId,
  }: { source: string; language: string; filename?: string | null; tool?: string | null; model?: string | null; entrypoint?: boolean; session?: string | null; parentId?: string | null },
): Promise<BuildNode> {
  if (!source.trim()) throw refuse("addCode", "Code needs its lines.");
  if (source.length > CODE_MAX) throw refuse("addCode", "Code is at most 100,000 characters. Upload it as a file instead.");
  if (!(CODE_LANGUAGES as readonly string[]).includes(language)) throw refuse("addCode", "That is not a language the build knows.");
  const payload: Record<string, string | boolean> = { source, language };
  const name = filename?.trim();
  if (name) {
    if (name.length > CODE_FILENAME_MAX) throw refuse("addCode", `A file name is at most ${CODE_FILENAME_MAX} characters.`);
    payload.filename = name;
  }
  const named = tool?.trim();
  if (named) {
    if (named.length > CODE_TOOL_MAX) throw refuse("addCode", `A tool is at most ${CODE_TOOL_MAX} characters.`);
    payload.tool = toolFor(named)?.id ?? named;
  }
  if (model?.trim()) payload.model = model.trim();
  if (entrypoint) payload.entrypoint = true;
  // CA-04 P2: with `parentId`, the code is sent with that step: a tile inside it, after what it holds.
  if (parentId) {
    const why = nestHomeRefusal(tree, parentId);
    if (why) throw refuse("addCode", why);
    return placeChildNode(buildId, tree as NodeTree[], parentId, { type: CODE_TYPE, title: null, payload });
  }
  if (session) payload.session = session;
  return placeTopNode(buildId, tree, { type: CODE_TYPE, title: null, payload });
}

/** CA-03 P5: the longest answers a check takes, and its largest count of runs. */
export const CHECK_TEXT_MAX = 280;
export const CHECK_FAIL_MAX = 600;
export const CHECK_RUNS_MAX = 10_000;

/** "2026-10-12": a real day, as a check's last run is saved. */
export const isIsoDay = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const day = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === value;
};

export interface CheckInput {
  tested: string;
  passing: string;
  onFail?: string | null;
  passed: number;
  total: number;
  /** "2026-10-12", or nothing. */
  runAt?: string | null;
  /** The step it tested: the check uses its output. */
  testedStep?: string | null;
  /** CA-04 P1: the session it was added to. */
  session?: string | null;
  /** CA-12 P12: individual cases. When there are any, `passed` and `total` are worked out from them. */
  cases?: readonly CheckCase[];
  /** CA-15 P5: the optional fields of the Add dialog; each stored in the check's own payload only when given. */
  method?: CheckMethod | null;
  reviewer?: CheckReviewer | null;
  scoring?: { how: CheckScoring["how"]; target?: string } | null;
  modelTested?: { model: string; version: string } | null;
  /** A URL, or the id and name of one file already stored. */
  evidence?: { url?: string; mediaId?: string; name?: string } | null;
}

/**
 * CA-12 P12: replace a check's cases (none takes them off). With cases, "passed of total" is worked out from them and
 * written beside them, so a reader of an older page sees the same numbers.
 */
export async function setCheckCases(node: BuildNode, cases: readonly CheckCase[]): Promise<BuildNode> {
  if (node.type !== CHECK_TYPE) throw refuse("setCheckCases", "Only a check has cases.");
  const why = casesRefusal(cases);
  if (why) throw refuse("setCheckCases", why);
  const payload = { ...payloadOf(node) };
  const kept = checkCasesOf(cases);
  if (kept.length > 0) {
    const { passed, total } = casesTotals(kept);
    payload.cases = kept as unknown as Json;
    payload.passed = passed;
    payload.total = total;
  } else delete payload.cases;
  return upsertNode(withPayload(node, payload));
}

/**
 * CA-03 P5: how the build tested itself, a step like any other (it takes part in `uses`; it usually uses the step it
 * tested). Saved on `eval_run` with its own keys where they fit (`passed`, `total`, `run_at`) and three text keys:
 * `tested` and `passing` (1 to 280 characters each) and `on_fail` (up to 600). Passed and total are whole numbers
 * from 0 to 10,000, and passed is never more than the total. A check is evidence the maker gives; it never touches
 * `reproduction_count`, the lamp or the plaque.
 */
export async function addCheck(buildId: string, tree: readonly NodeTree[], input: CheckInput): Promise<BuildNode> {
  const payload = checkPayload("addCheck", input, tree);
  await requireLiveType("addCheck", CHECK_TYPE);
  return placeTopNode(buildId, tree, { type: CHECK_TYPE, title: null, payload });
}

/** A check's payload, checked; exported for the dialog, which says the same refusals before anything is written. */
/** CA-12 P12: why a check's cases cannot be saved, or null. A case says what went in or what was expected. */
export function casesRefusal(cases: readonly CheckCase[] | undefined): string | null {
  if (!cases || cases.length === 0) return null;
  if (cases.length > CASES_MAX) return `A check has at most ${CASES_MAX} cases.`;
  for (const c of cases) {
    if (!c.input.trim() && !c.expected.trim()) return "Each case says what went in or what was expected.";
    for (const value of [c.input, c.expected, c.actual]) if (value.trim().length > CASE_TEXT_MAX) return `A case's text is at most ${CASE_TEXT_MAX} characters.`;
  }
  return null;
}

export function checkRefusal(input: Omit<CheckInput, "testedStep">): string | null {
  const tested = input.tested.trim();
  const passing = input.passing.trim();
  if (!tested) return "Add the test description.";
  if (tested.length > CHECK_TEXT_MAX) return `The test description is at most ${CHECK_TEXT_MAX} characters.`;
  if (!passing) return "Add the pass criteria.";
  if (passing.length > CHECK_TEXT_MAX) return `The pass criteria are at most ${CHECK_TEXT_MAX} characters.`;
  if ((input.onFail ?? "").trim().length > CHECK_FAIL_MAX) return `The failure notes are at most ${CHECK_FAIL_MAX} characters.`;
  const why = casesRefusal(input.cases);
  if (why) return why;
  for (const n of input.cases?.length ? [] : [input.passed, input.total]) {
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > CHECK_RUNS_MAX) return "Runs are whole numbers from 0 to 10,000.";
  }
  if (!input.cases?.length && input.passed > input.total) return "Passed can't be more than the total.";
  const day = (input.runAt ?? "").trim();
  if (day && !isIsoDay(day)) return "The last run date is written as 2026-10-12.";
  return null;
}

/** Why a check's runs cannot be kept, or null. Pure, so the composer can say it before anything is written. */
export function checkRunsRefusal(runs: readonly CheckRun[]): string | null {
  if (runs.length > CHECK_RUNS_KEPT) return `A check keeps ${CHECK_RUNS_KEPT} runs at most.`;
  for (const run of runs) {
    if (!isIsoDay(run.at)) return "A run's date is written as 2026-10-12.";
    for (const n of [run.passed, run.total]) {
      if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > CHECK_RUNS_MAX) return "Runs are whole numbers from 0 to 10,000.";
    }
    if (run.passed > run.total) return "Passed can't be more than the total.";
  }
  return null;
}

/**
 * CA-05 P7: the runs of a check (`payload.runs`, newest first, up to 20). The newest run is also the check's last run,
 * so its passed, total and date are written to `passed`, `total` and `run_at` and the status line says the same. No
 * runs takes the key off and leaves the last run as it was.
 */
export async function setCheckRuns(node: BuildNode, runs: readonly CheckRun[]): Promise<BuildNode> {
  if (node.type !== CHECK_TYPE) throw refuse("setCheckRuns", "Only a check has runs.");
  const why = checkRunsRefusal(runs);
  if (why) throw refuse("setCheckRuns", why);
  const payload = { ...payloadOf(node) };
  const sorted = checkRunsOf(runs);
  if (sorted.length === 0) delete payload.runs;
  else {
    payload.runs = sorted as unknown as Json;
    payload.passed = sorted[0].passed;
    payload.total = sorted[0].total;
    payload.run_at = sorted[0].at;
  }
  return upsertNode(withPayload(node, payload));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "12 Oct", from a saved day; the day as saved when it is not one. */
export const checkDay = (day: string): string => (isIsoDay(day) ? `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}` : day);

/**
 * CA-03 P5: a check's one status line, "Passed 14 of 14 runs · since 12 Oct", and whether every run passed (the dot is
 * `--evidence` then, `--cat-breakage` otherwise). Null when it has no runs to count.
 */
export function checkStatus(check: Pick<CheckFacts, "passed" | "total" | "runAt">): { allPassed: boolean; line: string } | null {
  if (check.passed === null || check.total === null) return null;
  const since = check.runAt ? ` · since ${checkDay(check.runAt)}` : "";
  return { allPassed: check.passed === check.total, line: `Passed ${check.passed} of ${check.total} ${check.total === 1 ? "run" : "runs"}${since}` };
}

/** CA-12 P12: what a check can test: any step but another check. It no longer needs an agent or code. */
const CHECKABLE: ReadonlySet<StepKind> = new Set(["prompt", "agent", "team", "manual", "code", "file", "tool"]);

/** Whether the build has something a check can test, so Add › Check is offered. */
export const canCheck = (steps: readonly Pick<Step, "kind">[]): boolean => steps.some((step) => CHECKABLE.has(step.kind));

/** The step a new check tested: the selected top-level step when it is work (not a check), else the last step that is not a check. */
export function testedStepOf(steps: readonly Step[], selectedTopId: string | null): string | null {
  const selected = steps.find((step) => step.id === selectedTopId);
  if (selected && selected.kind !== "check") return selected.id;
  return [...steps].reverse().find((step) => CHECKABLE.has(step.kind))?.id ?? null;
}

function checkPayload(operation: string, input: CheckInput, tree: readonly NodeTree[]): Json {
  const why = checkRefusal(input);
  if (why) throw refuse(operation, why);
  const given = input.cases && input.cases.length > 0 ? checkCasesOf(input.cases) : [];
  const counted = given.length > 0 ? casesTotals(given) : null;
  const out: Payload = { tested: input.tested.trim(), passing: input.passing.trim(), passed: counted ? counted.passed : input.passed, total: counted ? counted.total : input.total };
  if (given.length > 0) out.cases = given as unknown as Json;
  const onFail = (input.onFail ?? "").trim();
  if (onFail) out.on_fail = onFail;
  const day = (input.runAt ?? "").trim();
  if (day) out.run_at = day;
  if (input.testedStep) {
    const isStep = topSteps(tree).some((node) => node.id === input.testedStep);
    if (!isStep) throw refuse(operation, "That is not a step of this build.");
    out.uses = [{ kind: "output", node_id: input.testedStep }] as unknown as Json;
  }
  if (input.session) out.session = input.session;
  let extras: Record<string, Json | null>;
  try {
    extras = cleanExtras(CHECK_TYPE, {
      method: input.method ?? null,
      reviewer: input.reviewer ?? null,
      scoring: input.scoring ?? null,
      model_tested: input.modelTested ?? null,
      evidence: input.evidence ? { url: input.evidence.url, media_id: input.evidence.mediaId, name: input.evidence.name } : null,
    });
  } catch (cause) {
    throw refuse(operation, cause instanceof Error ? cause.message : "That value is not allowed.");
  }
  for (const [key, value] of Object.entries(extras)) if (value !== null) out[key] = value;
  return out as Json;
}

/** The top-level steps of a tree, in order: the rows that are numbered. */
export function topSteps<T extends Pick<BuildNode, "parent_id" | "position" | "type"> & { payload?: unknown }>(tree: readonly T[]): T[] {
  return byPosition(tree.filter((node) => node.parent_id === null && isStepNode(node)));
}

/**
 * The moves that put step `id` straight after step `afterId` (the start when
 * null), handing the steps' own positions out again in order, so files, tools
 * and results keep theirs. None when it is already there.
 */
export function placeAfterMoves(
  tree: readonly Pick<BuildNode, "id" | "parent_id" | "position" | "type">[],
  id: string,
  afterId: string | null,
): NodeMove[] {
  const steps = topSteps(tree);
  const slots = steps.map((step) => step.position as number);
  const order = steps.filter((step) => step.id !== id);
  const moving = steps.find((step) => step.id === id);
  if (!moving) return [];
  const at = afterId === null ? 0 : order.findIndex((step) => step.id === afterId) + 1;
  if (afterId !== null && at === 0) return [];
  order.splice(at, 0, moving);
  return order.flatMap((step, i) => (steps[i].id === step.id ? [] : [{ id: step.id, parent_id: null, position: slots[i] }]));
}

/** Put a step straight after another, in one write. Resolves with the moves written. */
export async function placeStepAfter(
  buildId: string,
  tree: readonly Pick<BuildNode, "id" | "parent_id" | "position" | "type">[],
  id: string,
  afterId: string | null,
): Promise<NodeMove[]> {
  const moves = placeAfterMoves(tree, id, afterId);
  if (moves.length > 0) await reorderNodes(buildId, moves);
  return moves;
}

/** Swap a step with the step before or after it, whatever kind each is. */
export async function moveStep(
  buildId: string,
  tree: readonly Pick<BuildNode, "id" | "parent_id" | "position" | "type">[],
  id: string,
  direction: -1 | 1,
): Promise<NodeMove[]> {
  const steps = topSteps(tree);
  const at = steps.findIndex((step) => step.id === id);
  const moves = swapMoves(steps, at, direction);
  if (moves.length > 0) await reorderNodes(buildId, moves);
  return moves;
}

// --- tiles inside tiles (CA-04 P2) ---------------------------------------------

interface Located {
  node: NodeTree;
  /** 0 at the top level, 1 inside a top-level step, and so on. */
  depth: number;
}

function locate(tree: readonly NodeTree[], id: string, depth = 0): Located | null {
  for (const node of tree) {
    if (node.id === id) return { node, depth };
    const inner = node.children?.length ? locate(node.children, id, depth + 1) : null;
    if (inner) return inner;
  }
  return null;
}

/** The levels a node and what it holds take up: 1 for a tile that holds nothing. */
function heightOf(node: NodeTree): number {
  return 1 + Math.max(0, ...(node.children ?? []).map(heightOf));
}

const holds = (node: NodeTree, id: string): boolean => (node.children ?? []).some((child) => child.id === id || holds(child, id));

export const NEST_COPY = {
  missing: "That tile is not in this build.",
  notATile: "Only a step or a file moves like that.",
  noParent: "That step is not in this build.",
  cycle: "A tile can't go inside itself or anything it holds.",
  result: "Nothing goes inside a result.",
  file: "Nothing goes inside a file.",
  agent: "An agent holds its own prompts only.",
  team: "A team holds its own agents only.",
  depth: `Tiles go ${NEST_DEPTH_MAX} deep at most. Make one of them its own step first.`,
} as const;

/**
 * Why a tile cannot go inside `parentId` (null: its own step at the top level), or null when it can. Pure, so the
 * List can say no to a drop before anything is written. A tile never goes inside itself or anything it holds; a
 * result holds nothing; an agent and a team keep their meaning (an agent's prompts, a team's agents); and nothing
 * goes more than `NEST_DEPTH_MAX` deep.
 */
export function nestRefusal(tree: readonly NodeTree[], id: string, parentId: string | null): string | null {
  const found = locate(tree, id);
  if (!found) return NEST_COPY.missing;
  if (!isSentWithNode(found.node)) return NEST_COPY.notATile;
  if (parentId === null) return null;
  const target = locate(tree, parentId);
  if (!target) return NEST_COPY.noParent;
  if (parentId === id || holds(found.node, parentId)) return NEST_COPY.cycle;
  const type = target.node.type;
  // CA-05 P10: a result that is a trained model holds one thing: the file it was trained on.
  if (type === RESULT_TYPE) {
    if (!(isTrainedModel(target.node) && found.node.type === FILE_TYPE)) return NEST_COPY.result;
    return target.depth + heightOf(found.node) > NEST_DEPTH_MAX ? NEST_COPY.depth : null;
  }
  if (type === FILE_TYPE) return NEST_COPY.file;
  if (!isStepNode(target.node)) return NEST_COPY.noParent;
  if (type === AGENT_TYPE && found.node.type !== PROMPT_TYPE) return NEST_COPY.agent;
  if (type === TEAM_TYPE && found.node.type !== AGENT_TYPE) return NEST_COPY.team;
  if (target.depth + heightOf(found.node) > NEST_DEPTH_MAX) return NEST_COPY.depth;
  return null;
}

/** Why a new file or code tile cannot be made inside `parentId`, or null when it can: a step that is not an agent or a team, not too deep. */
function nestHomeRefusal(tree: readonly NodeTree[], parentId: string): string | null {
  const target = locate(tree, parentId);
  // CA-05 P10: the file a trained model was trained on goes inside its result.
  if (target && isTrainedModel(target.node)) return null;
  if (!target || !isStepNode(target.node)) return NEST_COPY.noParent;
  if (target.node.type === AGENT_TYPE) return NEST_COPY.agent;
  if (target.node.type === TEAM_TYPE) return NEST_COPY.team;
  if (target.depth + 1 > NEST_DEPTH_MAX) return NEST_COPY.depth;
  return null;
}

/**
 * The moves that put tile `id` inside `parentId` at `index` among what it holds, or, with `parentId` null, make it its
 * own step at `index` among the top-level steps. Inside a step its tiles are numbered 1, 2, 3 by position again; at
 * the top level the steps hand their own positions out again in order (a new slot after everything else for a tile
 * coming out), so files, tools and results keep theirs. Only the rows that change are moved. Pure.
 */
export function nestMoves(tree: readonly NodeTree[], id: string, parentId: string | null, index: number): NodeMove[] {
  const found = locate(tree, id);
  if (!found) return [];
  const clampAt = (length: number) => Math.max(0, Math.min(Number.isFinite(index) ? Math.floor(index) : length, length));
  if (parentId !== null) {
    const target = locate(tree, parentId);
    if (!target) return [];
    const siblings = byPosition((target.node.children ?? []).filter((child) => child.id !== id));
    siblings.splice(clampAt(siblings.length), 0, found.node);
    return siblings.flatMap((node, i) => (node.parent_id === parentId && node.position === i + 1 ? [] : [{ id: node.id, parent_id: parentId, position: i + 1 }]));
  }
  const next = Math.max(0, ...tree.filter((node) => node.parent_id === null && typeof node.position === "number").map((node) => node.position as number)) + 1;
  if (!isStepNode(found.node)) return found.node.parent_id === null ? [] : [{ id, parent_id: null, position: next }];
  const steps = topSteps(tree);
  const slots = steps.map((step) => step.position as number);
  if (found.node.parent_id !== null) slots.push(next);
  slots.sort((a, b) => a - b);
  const order = steps.filter((step) => step.id !== id);
  order.splice(clampAt(order.length), 0, found.node);
  return order.flatMap((node, i) => (node.parent_id === null && node.position === slots[i] ? [] : [{ id: node.id, parent_id: null, position: slots[i] }]));
}

/**
 * Put a tile inside another step, sent with it, or make it its own step (CA-04 P2): one `reorderNodes` write, refused
 * by `nestRefusal` (the cycle and depth guards among them) before anything is written. Resolves with the moves.
 */
export async function nestStep(buildId: string, tree: readonly NodeTree[], id: string, parentId: string | null, index: number): Promise<NodeMove[]> {
  const why = nestRefusal(tree, id, parentId);
  if (why) throw refuse("nestStep", why);
  const moves = nestMoves(tree, id, parentId, index);
  if (moves.length > 0) await reorderNodes(buildId, moves);
  return moves;
}

/** A file the AI read. `title` is the file name. CA-04 P2: with `parentId`, a file sent with that step, after what it holds. */
export async function addFile(
  buildId: string,
  tree: readonly NodeTree[],
  {
    title,
    url,
    summary,
    media_id,
    parentId,
    rows,
    tile,
    session,
    size,
    mime,
    preview,
  }: {
    title: string;
    url?: string;
    summary?: string;
    media_id?: string;
    parentId?: string | null;
    rows?: number | null;
    /** CA-12 P8: the file is also a tile in a session (`step: true`), with its type, size and a short preview. */
    tile?: boolean;
    session?: string | null;
    size?: number | null;
    mime?: string | null;
    preview?: readonly string[];
  },
): Promise<BuildNode> {
  if (!title.trim()) throw refuse("addFile", "A file needs its name.");
  // CA-05 P7: a test file kept with the cases it holds, when they were counted exactly.
  const counted = typeof rows === "number" && Number.isInteger(rows) && rows > 0 ? { rows } : null;
  const tileKeys: Record<string, Json> = {};
  if (tile && !parentId) {
    tileKeys.step = true;
    if (session) tileKeys.session = session;
    if (typeof size === "number" && Number.isFinite(size) && size >= 0) tileKeys.size = size;
    if (mime?.trim()) tileKeys.mime = mime.trim();
    const lines = (preview ?? []).slice(0, 4).map((line) => line.slice(0, 160));
    if (lines.length > 0) tileKeys.preview = lines;
  }
  const node = { type: FILE_TYPE, title: null, payload: { ...(compact({ title: title.trim(), url, summary, media_id }) as Record<string, Json>), ...counted, ...tileKeys } as Json };
  if (parentId) {
    const why = nestHomeRefusal(tree, parentId);
    if (why) throw refuse("addFile", why);
    return placeChildNode(buildId, tree as NodeTree[], parentId, node);
  }
  return placeTopNode(buildId, tree, node);
}

export const MADE_FILE_NAME_MAX = 120;

/**
 * A file a step makes, such as brand-guide.md. Only the name and the step that
 * makes it are stored (`made_by`); readers make the file by running the step,
 * so it has no `media_id` and no `url`.
 */
export async function addMadeFile(
  buildId: string,
  tree: readonly NodeTree[],
  { stepId, name, summary }: { stepId: string; name: string; summary?: string },
): Promise<BuildNode> {
  const isStep = flattenSteps(buildSteps(tree)).some((step) => step.id === stepId && !step.id.endsWith(":instructions"));
  if (!isStep) throw refuse("addMadeFile", "That is not a step of this build.");
  const title = name.trim();
  if (!title || title.length > MADE_FILE_NAME_MAX) throw refuse("addMadeFile", `A file name is 1 to ${MADE_FILE_NAME_MAX} characters.`);
  const taken = tree.some(
    (node) =>
      node.type === FILE_TYPE &&
      node.parent_id === null &&
      madeByOf(node) === stepId &&
      (stringOf(payloadOf(node).title) ?? "").trim().toLowerCase() === title.toLowerCase(),
  );
  if (taken) throw refuse("addMadeFile", "That step already makes a file with that name.");
  return placeTopNode(buildId, tree, { type: FILE_TYPE, title: null, payload: compact({ title, made_by: stepId, summary }) });
}

/** An app or connector the AI used. */
export async function addTool(
  buildId: string,
  tree: readonly NodeTree[],
  { service, scopes, notes }: { service: string; scopes?: string; notes?: string },
): Promise<BuildNode> {
  if (!service.trim()) throw refuse("addTool", "A tool needs its name.");
  return placeTopNode(buildId, tree, { type: TOOL_TYPE, title: null, payload: compact({ service: service.trim(), scopes, notes }) });
}

/** CA-12 P7: the longest "What did it do?". */
export const TOOL_SCOPES_MAX = 200;

/**
 * CA-12 P7: a tool as a tile in a session: the app, how it was connected and what it did. `step: true` is what makes it a
 * tile; a tool an agent names (`toolRefsFor`) is added with `addTool` and never is one.
 */
export interface ToolTileInput {
  service: string;
  connection?: ToolConnection | null;
  scopes?: string;
  session?: string | null;
  permissions?: ToolPermission | null;
  plan?: string;
  setup?: readonly string[];
  alternatives?: readonly string[];
}

export async function addToolTile(buildId: string, tree: readonly NodeTree[], { service, connection, scopes, session, permissions, plan, setup, alternatives }: ToolTileInput): Promise<BuildNode> {
  const name = service.trim();
  if (!name) throw refuse("addToolTile", "A tool needs its application.");
  if (connection && !TOOL_CONNECTIONS.includes(connection)) throw refuse("addToolTile", "That is not a way to connect a tool.");
  const did = (scopes ?? "").trim();
  if (did.length > TOOL_SCOPES_MAX) throw refuse("addToolTile", `Actions performed is at most ${TOOL_SCOPES_MAX} characters.`);
  const payload: Payload = { service: name, step: true };
  if (connection) payload.connection = connection;
  if (did) payload.scopes = did;
  if (session) payload.session = session;
  let extras: Record<string, Json | null>;
  try {
    extras = cleanExtras(TOOL_TYPE, { permissions: permissions ?? null, plan: plan ?? "", setup: setup ?? [], alternatives: alternatives ?? [] });
  } catch (cause) {
    throw refuse("addToolTile", cause instanceof Error ? cause.message : "That value is not allowed.");
  }
  for (const [key, value] of Object.entries(extras)) if (value !== null) payload[key] = value;
  return placeTopNode(buildId, tree, { type: TOOL_TYPE, title: null, payload: payload as Json });
}

// --- CA-15 P9: a system prompt, a dataset and a GitHub repository as tiles ------

const sourceTypeMissing = (what: string): string => `${what} are not available yet: their node type is not switched on in the database.`;

/** The payload keys a source tile writes, cleaned by that type's own cleaners; a null value is a key not written. */
function sourcePayload(operation: string, type: string, patch: Record<string, unknown>, session?: string | null): Payload {
  let cleaned: Record<string, Json | null>;
  try {
    cleaned = cleanExtras(type, patch);
  } catch (cause) {
    throw refuse(operation, cause instanceof Error ? cause.message : "That value is not allowed.");
  }
  const payload: Payload = { step: true };
  for (const [key, value] of Object.entries(cleaned)) if (value !== null) payload[key] = value;
  if (session) payload.session = session;
  return payload;
}

export interface SystemPromptInput {
  /** Its name: the tile's title. */
  name: string;
  text: string;
  scope: SystemPromptScope;
  model?: string;
  version?: string;
  variables?: readonly PromptVariable[];
  session?: string | null;
}

/** Instructions that apply across prompts: a tile with a name, its text and where it applies (`scope`: `all`, `session:<key>` or `prompts:<id,id>`). */
export async function addSystemPromptTile(buildId: string, tree: readonly NodeTree[], input: SystemPromptInput): Promise<BuildNode> {
  await requireLiveType("addSystemPromptTile", SYSTEM_PROMPT_TYPE, sourceTypeMissing("System prompts"));
  const name = input.name.trim();
  if (!name) throw refuse("addSystemPromptTile", "A system prompt needs its name.");
  if (name.length > TITLE_MAX) throw refuse("addSystemPromptTile", `A name is at most ${TITLE_MAX} characters.`);
  if (input.scope.kind === "prompts") {
    const known = new Set(flattenSteps(buildSteps(tree)).filter((step) => step.kind === "prompt").map((step) => step.id));
    if (input.scope.ids.length === 0 || input.scope.ids.some((id) => !known.has(id))) throw refuse("addSystemPromptTile", "Choose prompts that are in this build.");
  }
  const payload = sourcePayload("addSystemPromptTile", SYSTEM_PROMPT_TYPE, { text: input.text, scope: scopeValue(input.scope), model: input.model, version: input.version, variables: input.variables ?? [] }, input.session);
  return placeTopNode(buildId, tree, { type: SYSTEM_PROMPT_TYPE, title: name, payload: payload as Json });
}

export interface DatasetInput {
  name: string;
  description: string;
  use?: DatasetUse | null;
  format?: string;
  recordCount?: number | string | null;
  columns?: readonly string[] | string;
  source?: string;
  sample?: readonly string[] | string;
  licence?: string;
  /** Only kept when `use` is retrieval. */
  chunkStrategy?: string;
  chunkSize?: number | string | null;
  chunkOverlap?: number | string | null;
  embeddingModel?: string;
  session?: string | null;
}

/** Data used for training, evaluation or retrieval: a tile with a name, a description and what is known of it. The chunking keys are kept only for retrieval. */
export async function addDatasetTile(buildId: string, tree: readonly NodeTree[], input: DatasetInput): Promise<BuildNode> {
  await requireLiveType("addDatasetTile", DATASET_TYPE, sourceTypeMissing("Datasets"));
  const name = input.name.trim();
  if (!name) throw refuse("addDatasetTile", "A dataset needs its name.");
  if (name.length > TITLE_MAX) throw refuse("addDatasetTile", `A name is at most ${TITLE_MAX} characters.`);
  const retrieval = input.use === "retrieval";
  const payload = sourcePayload(
    "addDatasetTile",
    DATASET_TYPE,
    {
      description: input.description,
      use: input.use ?? null,
      format: input.format,
      record_count: input.recordCount ?? null,
      columns: input.columns ?? [],
      source: input.source,
      sample: input.sample ?? [],
      licence: input.licence,
      ...(retrieval ? { chunk_strategy: input.chunkStrategy, chunk_size: input.chunkSize ?? null, chunk_overlap: input.chunkOverlap ?? null, embedding_model: input.embeddingModel } : null),
    },
    input.session,
  );
  return placeTopNode(buildId, tree, { type: DATASET_TYPE, title: name, payload: payload as Json });
}

export interface RepoInput {
  url: string;
  ownership: RepoOwnership;
  description?: string;
  /** What GitHub said when the URL was entered; absent when it could not be reached. */
  fetched?: RepoFetched | null;
  /** Third-party only. */
  author?: string;
  usage?: readonly RepoUsage[];
  modifications?: string;
  /** Your own repository only (created here, or yours already). */
  visibility?: RepoVisibility | null;
  generatedWith?: string | null;
  deployedUrl?: string;
  pin?: { kind: RepoPinKind; value: string } | null;
  path?: string;
  keyFiles?: readonly string[] | string;
  run?: readonly string[] | string;
  session?: string | null;
}

/**
 * A GitHub repository used in the build, owned by the maker or by a third party. The URL alone makes a valid tile; what GitHub
 * said (`stars`, `default_branch`, `language`, `licence_spdx`, `pushed_at`, `fetched_at`) is kept when it was retrieved. The
 * author, usage and modifications belong to a third party's repository; visibility, "generated with" and the deployed URL to
 * the maker's own. A run instruction that looks as if it holds a key's value is refused.
 */
export async function addRepoTile(buildId: string, tree: readonly NodeTree[], input: RepoInput): Promise<BuildNode> {
  await requireLiveType("addRepoTile", REPO_TYPE, sourceTypeMissing("GitHub repositories"));
  const parsed = parseRepoUrl(input.url);
  if (!parsed) throw refuse("addRepoTile", "A repository URL looks like github.com/owner/name.");
  const third = input.ownership === "third_party";
  const fetched = input.fetched;
  const payload = sourcePayload(
    "addRepoTile",
    REPO_TYPE,
    {
      url: parsed.url,
      ownership: input.ownership,
      description: input.description,
      ...(fetched ? { stars: fetched.stars, default_branch: fetched.defaultBranch, language: fetched.language, licence_spdx: fetched.licenceSpdx, licence_name: fetched.licenceName, pushed_at: fetched.pushedAt, fetched_at: fetched.fetchedAt } : null),
      ...(third ? { author: input.author?.trim() || parsed.owner, usage: input.usage ?? [], modifications: input.modifications } : { visibility: input.visibility ?? null, generated_with: input.generatedWith, deployed_url: input.deployedUrl }),
      pin: input.pin ?? null,
      path: input.path,
      key_files: input.keyFiles ?? [],
      run: input.run ?? [],
    },
    input.session,
  );
  return placeTopNode(buildId, tree, { type: REPO_TYPE, title: null, payload: payload as Json });
}

/** The finished thing. */
export async function addResult(
  buildId: string,
  tree: readonly NodeTree[],
  { summary, media_id, url }: { summary: string; media_id?: string; url?: string },
): Promise<BuildNode> {
  if (!summary.trim()) throw refuse("addResult", "A result needs a line saying what it is.");
  return placeTopNode(buildId, tree, { type: RESULT_TYPE, title: null, payload: compact({ summary: summary.trim(), media_id, url }) });
}

/* ── what a result holds (CA-12 P9) ── */

/** The most pictures a result holds, and the most its tile shows. */
export const RESULT_MEDIA_MAX = 12;
export const RESULT_THUMBS = 4;

/** A result's link, split for its card: the site's name, the path under it, and the host a favicon service is asked for. */
export interface ResultLink {
  url: string;
  site: string;
  path: string;
  host: string;
}

/** What a result holds, read from its payload; at most one of `link`, `mediaIds`, `file` and `model` is set. Nothing set reads "Nothing added yet". */
export interface ResultFacts {
  link: ResultLink | null;
  /** Pictures or video, in order. */
  mediaIds: string[];
  file: { name: string; kind: FileKind; size: number | null; mediaId: string } | null;
  model: { baseModel: string; method: string } | null;
  /** CA-15 P3: what a result of one of the newer kinds holds. Absent for the four above and for a `kind` this build does not know. */
  detail?: ResultDetail | null;
  /** CA-15 P3: the one line under it, for every kind. */
  caption?: string | null;
}

/** CA-15 P3: the output types added to a result, as stored in `payload.kind`. The older four read from what the payload holds. */
export const RESULT_KINDS = ["text", "audio", "deployed", "table", "message", "external_change", "metric", "offline"] as const;
export type ResultKindKey = (typeof RESULT_KINDS)[number];

export const MESSAGE_CHANNELS = ["email", "slack", "text", "other"] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];
export const MESSAGE_CHANNEL_LABEL: Record<MessageChannel, string> = { email: "Email", slack: "Slack", text: "Text message", other: "Other" };

export const RESULT_TEXT_MAX = 4000;
export const RESULT_LINE_MAX = 280;
export const RESULT_CAPTION_MAX = 140;
export const RESULT_CSV_MAX = 20_000;
export const METRIC_VALUE_MAX = 24;
export const METRIC_LABEL_MAX = 80;
export const METRIC_UNIT_MAX = 16;

export type ResultDetail =
  | { kind: "text"; text: string }
  | { kind: "audio"; name: string; mediaId: string | null; seconds: number | null }
  | { kind: "deployed"; link: ResultLink }
  | { kind: "table"; name: string | null; columns: number | null }
  | { kind: "message"; channel: MessageChannel; text: string }
  | { kind: "external_change"; application: string; change: string }
  | { kind: "metric"; value: string; label: string; unit: string; before: string }
  | { kind: "offline"; description: string; mediaId: string | null };

/** A link split for its card, or null when it is not an address. */
export function resultLinkOf(url: string | null | undefined): ResultLink | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    if (!/^https?:$/.test(parsed.protocol)) return null;
    const host = parsed.hostname.replace(/^www\./i, "");
    const path = `${parsed.pathname === "/" ? "" : parsed.pathname}${parsed.search}`;
    return { url: parsed.toString(), site: host, path, host };
  } catch {
    return null;
  }
}

/** The payload's own words for a result's detail, read defensively; null for the four older kinds and for a kind this build does not know. */
function resultDetailOf(payload: Payload): ResultDetail | null {
  const text = (key: string) => stringOf(payload[key])?.trim() ?? "";
  switch (payload.kind) {
    case "text":
      return text("text") ? { kind: "text", text: text("text") } : null;
    case "audio":
      return { kind: "audio", name: text("file_name") || text("summary") || "Audio", mediaId: stringOf(payload.media_id), seconds: numberOf(payload.duration) };
    case "deployed": {
      const link = resultLinkOf(stringOf(payload.url));
      return link ? { kind: "deployed", link } : null;
    }
    case "table":
      return { kind: "table", name: text("file_name") || null, columns: typeof payload.columns === "number" && Number.isInteger(payload.columns) && payload.columns > 0 ? payload.columns : null };
    case "message": {
      const channel = MESSAGE_CHANNELS.includes(payload.channel as MessageChannel) ? (payload.channel as MessageChannel) : "other";
      return text("message") ? { kind: "message", channel, text: text("message") } : null;
    }
    case "external_change":
      return text("application") || text("change") ? { kind: "external_change", application: text("application"), change: text("change") } : null;
    case "metric":
      return text("value") ? { kind: "metric", value: text("value"), label: text("label"), unit: text("unit"), before: text("before") } : null;
    case "offline":
      return text("description") ? { kind: "offline", description: text("description"), mediaId: stringOf(payload.media_id) } : null;
    default:
      return null;
  }
}

/** What a result holds. A model is read from `kind`; a file from `file_name`; pictures from `media_ids` (or the one `media_id` older results keep). The newer kinds are read into `detail`. */
export function resultFactsOf(node: Pick<BuildNode, "payload">): ResultFacts {
  const payload = payloadOf(node);
  const ids = Array.isArray(payload.media_ids) ? payload.media_ids.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
  const one = stringOf(payload.media_id)?.trim() || null;
  const fileName = stringOf(payload.file_name)?.trim() || null;
  const model = payload.kind === TRAINED_MODEL;
  const mediaIds = ids.length > 0 ? ids.slice(0, RESULT_MEDIA_MAX) : one && !fileName ? [one] : [];
  const detail = model ? null : resultDetailOf(payload);
  const caption = stringOf(payload.caption)?.trim().slice(0, RESULT_CAPTION_MAX) || null;
  return {
    link: model ? null : resultLinkOf(stringOf(payload.url)),
    mediaIds: model || fileName ? [] : mediaIds,
    file: !model && fileName && one ? { name: fileName, kind: fileKindOf(fileName, stringOf(payload.file_mime)), size: numberOf(payload.file_size), mediaId: one } : null,
    model: model ? { baseModel: stringOf(payload.base_model)?.trim() ?? "", method: stringOf(payload.method)?.trim() ?? "" } : null,
    ...(detail ? { detail } : null),
    ...(caption ? { caption } : null),
  };
}

/** Whether a result holds something to show. */
export const resultHolds = (facts: ResultFacts): boolean => Boolean(facts.link || facts.mediaIds.length > 0 || facts.file || facts.model || facts.detail);

/** CA-15 P3: the output type's name, as the Add dialog and the tile's type line say it. */
export const RESULT_TYPE_LABEL: Record<"link" | "pictures" | "file" | "model" | ResultKindKey, string> = {
  link: "Link",
  pictures: "Image or video",
  file: "File",
  model: "Model",
  text: "Text",
  audio: "Audio",
  deployed: "Deployed app or website",
  table: "Data table",
  message: "Sent message",
  external_change: "Change in an external app",
  metric: "Metric",
  offline: "Offline outcome",
};

/** The output type a result is, for its tile's type line; null when it holds nothing yet. */
export function resultTypeLabel(facts: ResultFacts): string | null {
  if (facts.detail) return RESULT_TYPE_LABEL[facts.detail.kind];
  if (facts.model) return RESULT_TYPE_LABEL.model;
  if (facts.link) return RESULT_TYPE_LABEL.link;
  if (facts.file) return RESULT_TYPE_LABEL.file;
  if (facts.mediaIds.length > 0) return RESULT_TYPE_LABEL.pictures;
  return null;
}

/** One line for what a result holds, for the rows that name it: never "text". */
export function resultHoldsWord(facts: ResultFacts): string {
  if (facts.detail) {
    const words: Record<ResultKindKey, string> = { text: "some text", audio: "an audio file", deployed: "a deployed app", table: "a data table", message: "a sent message", external_change: "a change in another app", metric: "a metric", offline: "an offline outcome" };
    return words[facts.detail.kind];
  }
  if (facts.model) return "a trained model";
  if (facts.link) return "a link";
  if (facts.file) return "a file";
  if (facts.mediaIds.length > 1) return `${facts.mediaIds.length} pictures`;
  if (facts.mediaIds.length === 1) return "a picture";
  return "Nothing added yet";
}

export type ResultInput = (
  | { kind: "link"; url: string }
  | { kind: "media"; mediaIds: readonly string[]; names: readonly string[] }
  | { kind: "file"; mediaId: string; name: string; size: number | null; mime: string | null }
  | { kind: "model"; baseModel: string; method: string }
  | { kind: "text"; text: string }
  | { kind: "audio"; mediaId: string; name: string; size: number | null; mime: string | null; seconds?: number | null }
  | { kind: "deployed"; url: string }
  | { kind: "table"; mediaId?: string | null; name?: string | null; size?: number | null; mime?: string | null; csv?: string; columns?: number | null }
  | { kind: "message"; channel: MessageChannel; message: string }
  | { kind: "external_change"; application: string; change: string }
  | { kind: "metric"; value: string; label: string; unit?: string; before?: string }
  | { kind: "offline"; description: string; photoId?: string | null }
) & { /** CA-15 P3: one line under the result; optional for every kind. */ caption?: string };

/** What a new result is called until its maker names it: the site, the file's name, "Trained model". */
export function resultSummaryOf(input: ResultInput): string {
  if (input.kind === "link") return resultLinkOf(input.url)?.site ?? input.url.trim();
  if (input.kind === "media") return input.names.length > 1 ? `${input.names[0]} and ${input.names.length - 1} more` : (input.names[0] ?? "Picture");
  if (input.kind === "file") return input.name;
  if (input.kind === "text") return firstLineOf(input.text) || "Text";
  if (input.kind === "audio") return input.name;
  if (input.kind === "deployed") return resultLinkOf(input.url)?.site ?? input.url.trim();
  if (input.kind === "table") return input.name?.trim() || "Data table";
  if (input.kind === "message") return `${MESSAGE_CHANNEL_LABEL[input.channel]}: ${firstLineOf(input.message, 60)}`;
  if (input.kind === "external_change") return `${input.application.trim()}: ${firstLineOf(input.change, 60)}`;
  if (input.kind === "metric") return input.label.trim() || "Metric";
  if (input.kind === "offline") return firstLineOf(input.description) || "Offline outcome";
  return "Trained model";
}

/** Why a result cannot be added, or null. */
export function resultRefusal(input: ResultInput): string | null {
  if ((input.caption ?? "").trim().length > RESULT_CAPTION_MAX) return `A caption is at most ${RESULT_CAPTION_MAX} characters.`;
  if (input.kind === "link") return resultLinkOf(input.url) ? null : "Add a URL, like example.com/page.";
  if (input.kind === "media") return input.mediaIds.length === 0 ? "Add an image or a video." : input.mediaIds.length > RESULT_MEDIA_MAX ? `A result holds at most ${RESULT_MEDIA_MAX} images or videos.` : null;
  if (input.kind === "file") return input.name.trim() && input.mediaId ? null : "Add a file.";
  if (input.kind === "text") return !input.text.trim() ? "Add the text." : input.text.length > RESULT_TEXT_MAX ? `The text is at most ${RESULT_TEXT_MAX} characters.` : null;
  if (input.kind === "audio") return input.name.trim() && input.mediaId ? null : "Add an audio file.";
  if (input.kind === "deployed") return resultLinkOf(input.url) ? null : "Add the URL of the deployed app or website.";
  if (input.kind === "table") {
    if ((input.csv ?? "").length > RESULT_CSV_MAX) return `Pasted CSV is at most ${RESULT_CSV_MAX.toLocaleString("en-GB")} characters. Upload it as a file instead.`;
    return (input.mediaId && input.name?.trim()) || (input.csv ?? "").trim() ? null : "Add a CSV file or paste the CSV.";
  }
  if (input.kind === "message") return !MESSAGE_CHANNELS.includes(input.channel) ? "Choose the channel." : !input.message.trim() ? "Add the message." : input.message.length > RESULT_TEXT_MAX ? `The message is at most ${RESULT_TEXT_MAX} characters.` : null;
  if (input.kind === "external_change") return !input.application.trim() ? "Say which application." : !input.change.trim() ? "Say what changed." : input.change.length > RESULT_LINE_MAX ? `What changed is at most ${RESULT_LINE_MAX} characters.` : null;
  if (input.kind === "metric") {
    if (!input.value.trim()) return "Add the value.";
    if (!input.label.trim()) return "Add the label.";
    if (input.value.trim().length > METRIC_VALUE_MAX || (input.before ?? "").trim().length > METRIC_VALUE_MAX) return `A value is at most ${METRIC_VALUE_MAX} characters.`;
    if (input.label.trim().length > METRIC_LABEL_MAX) return `The label is at most ${METRIC_LABEL_MAX} characters.`;
    return (input.unit ?? "").trim().length > METRIC_UNIT_MAX ? `The unit is at most ${METRIC_UNIT_MAX} characters.` : null;
  }
  if (input.kind === "offline") return !input.description.trim() ? "Add a description." : input.description.length > RESULT_TEXT_MAX ? `The description is at most ${RESULT_TEXT_MAX} characters.` : null;
  if (input.baseModel.trim().length > BASE_MODEL_MAX) return `The base model is at most ${BASE_MODEL_MAX} characters.`;
  if (input.method.trim().length > TRAINED_METHOD_MAX) return `The training method is at most ${TRAINED_METHOD_MAX} characters.`;
  return input.baseModel.trim() || input.method.trim() ? null : "Say what it is based on, or how it was trained.";
}

/** CA-12 P9, CA-15 P3: add a result that holds the thing itself: a link, pictures or video, a file, a model, or one of the newer kinds. */
export async function addResultTile(buildId: string, tree: readonly NodeTree[], input: ResultInput): Promise<BuildNode> {
  const why = resultRefusal(input);
  if (why) throw refuse("addResultTile", why);
  const out: Record<string, Json> = { summary: resultSummaryOf(input) };
  const put = (key: string, value: string | null | undefined) => {
    if (value && value.trim()) out[key] = value.trim();
  };
  if (input.kind === "link") out.url = resultLinkOf(input.url)?.url ?? input.url.trim();
  else if (input.kind === "media") {
    out.media_id = input.mediaIds[0];
    out.media_ids = [...input.mediaIds];
  } else if (input.kind === "file") {
    out.media_id = input.mediaId;
    out.file_name = input.name.trim();
    if (input.size !== null) out.file_size = input.size;
    if (input.mime) out.file_mime = input.mime;
  } else if (input.kind === "text") {
    out.kind = "text";
    out.text = input.text.trim();
  } else if (input.kind === "audio") {
    out.kind = "audio";
    out.media_id = input.mediaId;
    out.file_name = input.name.trim();
    if (input.size !== null) out.file_size = input.size;
    if (input.mime) out.file_mime = input.mime;
    if (typeof input.seconds === "number" && Number.isFinite(input.seconds) && input.seconds > 0) out.duration = Math.round(input.seconds);
  } else if (input.kind === "deployed") {
    out.kind = "deployed";
    out.url = resultLinkOf(input.url)?.url ?? input.url.trim();
  } else if (input.kind === "table") {
    out.kind = "table";
    if (input.mediaId && input.name?.trim()) {
      out.media_id = input.mediaId;
      out.file_name = input.name.trim();
      if (typeof input.size === "number") out.file_size = input.size;
      if (input.mime) out.file_mime = input.mime;
    } else put("csv", input.csv);
    if (typeof input.columns === "number" && Number.isInteger(input.columns) && input.columns > 0) out.columns = input.columns;
  } else if (input.kind === "message") {
    out.kind = "message";
    out.channel = input.channel;
    out.message = input.message.trim();
  } else if (input.kind === "external_change") {
    out.kind = "external_change";
    out.application = input.application.trim();
    out.change = input.change.trim();
  } else if (input.kind === "metric") {
    out.kind = "metric";
    out.value = input.value.trim();
    out.label = input.label.trim();
    put("unit", input.unit);
    put("before", input.before);
  } else if (input.kind === "offline") {
    out.kind = "offline";
    out.description = input.description.trim();
    if (input.photoId) out.media_id = input.photoId;
  } else {
    out.kind = TRAINED_MODEL;
    if (input.baseModel.trim()) out.base_model = input.baseModel.trim();
    if (input.method.trim()) out.method = input.method.trim();
  }
  put("caption", input.caption);
  return placeTopNode(buildId, tree, { type: RESULT_TYPE, title: null, payload: out as Json });
}

/** The payload without the fields left blank. */
function compact(fields: Record<string, string | undefined>): Json {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) if (typeof value === "string" && value.trim()) out[key] = value.trim();
  return out;
}

// --- how a tool was connected (CA-04 P5) ------------------------------------

/** CA-15 P4: nine ways a tool was connected. `app`, `mcp` and `code` keep their stored keys; `app` now reads "Native integration" and `code` "Custom code". */
export type ToolConnection = "app" | "mcp" | "code" | "extension" | "api_key" | "automation" | "plugin" | "cli" | "manual";
export type ToolRunsAt = "web" | "local";
export const TOOL_CONNECTIONS: readonly ToolConnection[] = ["mcp", "app", "code", "extension", "api_key", "automation", "plugin", "cli", "manual"];
export const TOOL_RUNS_AT: readonly ToolRunsAt[] = ["web", "local"];

/** How a tool was connected, and where an MCP server ran, as saved; null for what was never said. */
export function toolConnectionOf(node: Pick<BuildNode, "payload">): { connection: ToolConnection | null; runsAt: ToolRunsAt | null } {
  const payload = payloadOf(node);
  const connection = TOOL_CONNECTIONS.includes(payload.connection as ToolConnection) ? (payload.connection as ToolConnection) : null;
  const runsAt = connection === "mcp" && TOOL_RUNS_AT.includes(payload.runs_at as ToolRunsAt) ? (payload.runs_at as ToolRunsAt) : null;
  return { connection, runsAt };
}

/** The tools an MCP server's tool was seen calling, with how many times (`payload.tools_used`), most used first. Never typed. */
export function toolsUsedOf(node: Pick<BuildNode, "payload">): { name: string; count: number }[] {
  const raw = payloadOf(node).tools_used;
  if (!isRecord(raw)) return [];
  return Object.entries(raw)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]) && entry[1] > 0)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Say how a tool was connected: built into the app, an MCP server, or the maker's own code (`payload.connection`), and
 * for an MCP server whether it ran at a web address or on the maker's computer (`payload.runs_at`). Null takes the
 * answer off; `runs_at` goes when the tool is not an MCP server.
 */
export async function setToolConnection(node: BuildNode, connection: ToolConnection | null, runsAt: ToolRunsAt | null = null): Promise<BuildNode> {
  if (node.type !== TOOL_TYPE) throw refuse("setToolConnection", "Only a tool is connected.");
  if (connection !== null && !TOOL_CONNECTIONS.includes(connection)) throw refuse("setToolConnection", "That is not a way to connect a tool.");
  if (runsAt !== null && !TOOL_RUNS_AT.includes(runsAt)) throw refuse("setToolConnection", "That is not where a server runs.");
  const payload = { ...payloadOf(node) };
  if (connection) payload.connection = connection;
  else delete payload.connection;
  if (connection === "mcp" && runsAt) payload.runs_at = runsAt;
  else delete payload.runs_at;
  return upsertNode(withPayload(node, payload));
}

// --- fields of a file, a tool and a result (UI-P66) ---------------------------

const FIELDS: Record<string, { keys: readonly string[]; required: string }> = {
  [FILE_TYPE]: { keys: ["title", "summary", "url"], required: "title" },
  [TOOL_TYPE]: { keys: ["service", "scopes", "notes"], required: "service" },
  // CA-05 P10: a result can be a trained model: `kind`, the model it is based on, and how it was trained.
  [RESULT_TYPE]: { keys: ["summary", "url", "media_id", "kind", "base_model", "method"], required: "summary" },
};

/** CA-05 P10: the one kind a result states outright; a link, a picture and a file are read from what the result holds. */
export const TRAINED_MODEL = "trained-model";
export const BASE_MODEL_MAX = 80;
export const TRAINED_METHOD_MAX = 200;

/** The longest each result key may be, for the keys that are not free text. */
const RESULT_LIMITS: Record<string, number> = { base_model: BASE_MODEL_MAX, method: TRAINED_METHOD_MAX };

export interface TrainedModel {
  /** The model it is based on, as saved; empty while not chosen. */
  baseModel: string;
  /** How it was trained: one line. */
  method: string;
  /** The file sent with it: the ratings or the examples. */
  trainedOn: { id: string; name: string; rows: number | null } | null;
}

/** Whether a result is a trained model. */
export const isTrainedModel = (node: Pick<BuildNode, "type" | "payload">): boolean => node.type === RESULT_TYPE && payloadOf(node).kind === TRAINED_MODEL;

/** A trained-model result's facts, read from the node and the file sent with it; null for any other node. */
export function trainedModelOf(node: Pick<NodeTree, "type" | "payload"> & { children?: readonly NodeTree[] }): TrainedModel | null {
  if (!isTrainedModel(node)) return null;
  const payload = payloadOf(node);
  const file = (node.children ?? []).find((child) => child.type === FILE_TYPE);
  const filePayload = file ? payloadOf(file) : {};
  return {
    baseModel: stringOf(payload.base_model)?.trim() ?? "",
    method: stringOf(payload.method)?.trim() ?? "",
    trainedOn: file
      ? {
          id: file.id,
          name: stringOf(filePayload.title)?.trim() ?? "Untitled file",
          rows: typeof filePayload.rows === "number" && Number.isInteger(filePayload.rows) && filePayload.rows > 0 ? filePayload.rows : null,
        }
      : null,
  };
}

/**
 * "A trained model, based on Muse Spark Open, trained on 1,200 rows of ratings.csv": the parts that exist. The file's
 * rows are said only when they were counted exactly; the model is said as `modelName` gives it.
 */
export function trainedModelLine(trained: TrainedModel, modelName: (raw: string) => string = (raw) => raw): string {
  const parts = ["A trained model"];
  if (trained.baseModel) parts.push(`based on ${modelName(trained.baseModel)}`);
  if (trained.trainedOn) parts.push(`trained on ${trained.trainedOn.rows ? `${trained.trainedOn.rows.toLocaleString("en-GB")} rows of ` : ""}${trained.trainedOn.name}`);
  return parts.join(", ");
}

/**
 * Change the text fields of a file, a tool or a result (DATA §2). A blank value
 * takes the field off; the one field the type requires cannot go blank.
 */
export async function setNodeFields(node: BuildNode, fields: Record<string, string | null>): Promise<BuildNode> {
  const allowed = FIELDS[node.type];
  if (!allowed) throw refuse("setNodeFields", "That has no fields to change.");
  const payload = { ...payloadOf(node) };
  for (const [key, value] of Object.entries(fields)) {
    if (!allowed.keys.includes(key)) throw refuse("setNodeFields", "That is not a field of this piece.");
    const trimmed = value?.trim() ?? "";
    if (!trimmed) {
      if (key === allowed.required) throw refuse("setNodeFields", "That field cannot be empty.");
      delete payload[key];
    } else {
      if (node.type === RESULT_TYPE && key === "kind" && trimmed !== TRAINED_MODEL) throw refuse("setNodeFields", "That is not a kind of result.");
      const limit = node.type === RESULT_TYPE ? RESULT_LIMITS[key] : undefined;
      if (limit && trimmed.length > limit) throw refuse("setNodeFields", `That field is at most ${limit} characters.`);
      if (node.type === RESULT_TYPE && key === "method" && /\n/.test(trimmed)) throw refuse("setNodeFields", "How it was trained is one line.");
      payload[key] = trimmed;
    }
  }
  return upsertNode(withPayload(node, payload));
}

/**
 * CA-06 P4: give a tile its colour ("#RRGGBB", any case or the short form, as `normaliseHex` reads it), or take it
 * off (null). Only `payload.colour` changes; the rest of the payload is written back as it was read.
 */
export async function setNodeColour(node: BuildNode, colour: string | null): Promise<BuildNode> {
  const payload = { ...payloadOf(node) };
  if (colour === null) delete payload.colour;
  else {
    const hex = normaliseHex(colour);
    if (!hex) throw refuse("setNodeColour", `${HEX_HINT}.`);
    payload.colour = hex;
  }
  return upsertNode(withPayload(node, payload));
}

/**
 * CA-15: set or clear the optional keys a tile's modal and Details write: a model's settings, a tool's permissions, a check's
 * method. Only the keys `cleanExtras` knows for the node's type are accepted; each is cleaned and range-checked there. A null
 * value takes the key off; every other key of the payload is written back as it was read.
 */
export async function setExtras(node: BuildNode, patch: Record<string, unknown>): Promise<BuildNode> {
  let cleaned: Record<string, Json | null>;
  try {
    cleaned = cleanExtras(node.type, patch);
  } catch (cause) {
    throw refuse("setExtras", cause instanceof Error ? cause.message : "That value is not allowed.");
  }
  const payload = { ...payloadOf(node) };
  for (const [key, value] of Object.entries(cleaned)) {
    if (value === null) delete payload[key];
    else payload[key] = value;
  }
  return upsertNode(withPayload(node, payload));
}
