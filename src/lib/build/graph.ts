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
import { PROMPT_TYPE, swapMoves } from "./composePrompts";
import { toolFor, toolName } from "@/lib/tools/registry";
import { goalOf, LEGACY_SESSION_PREFIX, TYPED_SESSION_PREFIX, toolLabel, type MakingSession, type SessionGoal, type SessionMeta } from "./making";
import { getNodeType } from "./nodeTypes";
import { reorderNodes, upsertNode, type NodeMove } from "./nodes";
import { buildLayerError, type BuildNode, type BuildNodeInsert, type NodeTree } from "./types";
import { modelLabel } from "@/lib/models/registry";
import { changesOf, type ChangeRange } from "./changes";
import { extrasOf, LONG_SESSION_WORDS, type SessionExtras } from "./sessionFacts";

export const AGENT_TYPE = "agent_config";
export const TEAM_TYPE = "team";
export const MANUAL_STEP_TYPE = "manual_step";
export const FILE_TYPE = "document";
export const TOOL_TYPE = "integration";
export const RESULT_TYPE = "result";
/** CA-02 P7: lines of code the maker wrote or ran. Never run here. */
export const CODE_TYPE = "code";
/**
 * CA-03 P5: how the build tested itself. The `eval_run` type that already exists (category evidence); a check is one
 * whose payload says what it tested (`tested`), so an eval run saved before CA-03 reads exactly as it did, not as a step.
 */
export const CHECK_TYPE = "eval_run";

/** CA-04 P2: "file" is a file sent with a step; a file at the top level is the build's, not a step. */
export type StepKind = "prompt" | "agent" | "team" | "manual" | "code" | "check" | "file";

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
export const MANUAL_TEXT_MAX = 140;

const NODE_TYPE_MISSING = "That needs the Deploy queue item from UI-P61.";

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

const KIND_OF_TYPE: Record<string, StepKind> = {
  [PROMPT_TYPE]: "prompt",
  [AGENT_TYPE]: "agent",
  [TEAM_TYPE]: "team",
  [MANUAL_STEP_TYPE]: "manual",
  [CODE_TYPE]: "code",
  [CHECK_TYPE]: "check",
};

const KIND_NAME: Record<StepKind, string> = {
  prompt: "Prompt",
  agent: "Agent",
  team: "Team",
  manual: "Manual step",
  code: "Code",
  check: "Check",
  file: "File",
};

/** CA-03 P5: an eval run is a check, and a step, only when it says what it tested. */
const isCheckPayload = (payload: unknown): boolean => isRecord(payload) && typeof payload.tested === "string" && payload.tested.trim().length > 0;

/** CA-04 P4: part of a session's setup (setup.ts): never a step, though a rule is code. */
const isSetupNode = (payload: unknown): boolean => isRecord(payload) && isRecord(payload.setup);

const isStepNode = (node: Pick<BuildNode, "type"> & { payload?: unknown }): boolean =>
  node.type in KIND_OF_TYPE && (node.type !== CHECK_TYPE || isCheckPayload(node.payload)) && !isSetupNode(node.payload);

const numberOf = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** A check's facts, read defensively. */
function checkFacts(payload: Payload): CheckFacts {
  return {
    tested: stringOf(payload.tested)?.trim() ?? "",
    passing: stringOf(payload.passing)?.trim() ?? "",
    onFail: stringOf(payload.on_fail)?.trim() || null,
    passed: numberOf(payload.passed),
    total: numberOf(payload.total),
    runAt: stringOf(payload.run_at)?.trim() || null,
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
function agentFacts(payload: Payload): Pick<Step, "harness" | "models" | "toolRefs" | "memory"> {
  const harness = stringOf(payload.harness)?.trim();
  const models = agentModelsOf(payload);
  const toolRefs = toolRefsOf(payload);
  const memory = stringOf(payload.memory)?.trim();
  return {
    harness: harness ? (toolName(harness) ?? harness) : null,
    ...(models.length > 1 ? { models } : null),
    ...(toolRefs.length ? { toolRefs } : null),
    ...(memory ? { memory } : null),
  };
}

const dismissedOf = (payload: Payload): string[] =>
  Array.isArray(payload.dismissed) ? payload.dismissed.filter((key): key is string => typeof key === "string") : [];

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
            : (stringOf(payload.text) ?? "");
  // CA-04 P2: a tile inside another has no number; it is named by its kind, or by its file name.
  const named = kind === "file" ? stringOf(payload.title)?.trim() : kind === "code" ? stringOf(payload.filename)?.trim() : null;
  const defaultTitle = number ? `${KIND_NAME[kind]} ${number}` : (named || KIND_NAME[kind]);
  const import_ = isRecord(node.source_ref) ? node.source_ref.import_session_id : undefined;
  const tool = stringOf(payload.tool);
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
    ...(kind === "manual" ? { mediaId: stringOf(payload.media_id) } : null),
    ...(kind === "prompt" && changesOf(payload, text).length > 0 ? { changes: changesOf(payload, text) } : null),
    ...(kind === "agent" ? agentFacts(payload) : null),
    ...(kind === "code" ? { language: stringOf(payload.language), filename: stringOf(payload.filename)?.trim() || null, entrypoint: payload.entrypoint === true } : null),
    ...(kind === "check" ? { check: checkFacts(payload) } : null),
    ...(kind === "file" ? { filename: stringOf(payload.title)?.trim() || null, mediaId: stringOf(payload.media_id) } : null),
  };
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
    ...readStep(child, "", child.type === FILE_TYPE ? "file" : KIND_OF_TYPE[child.type], depth + 1),
    inside: { id: step.id, label },
  }));
  return sent.length > 0 ? { ...step, sentWith: sent } : step;
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
  return top.map((node, index) => readStep(node, String(index + 1), KIND_OF_TYPE[node.type], 0));
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
 * session made here takes its tool, model and day from it, and one with no steps yet follows the others.
 */
export function sessionGroups(
  steps: readonly Step[],
  sessions: readonly MakingSession[],
  sessionTools: Readonly<Record<string, string>>,
  meta: Readonly<Record<string, SessionMeta>> = {},
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
  // CA-04 P6: what each session worked until, from its entry.
  for (const [key, group] of byKey) {
    const goal = goalOf(meta[key]?.goal);
    if (goal) group.goal = goal;
    // CA-05: what its entry carries beyond that, and how long its own text is.
    const extras = extrasOf(meta[key]);
    if (Object.keys(extras).length > 0) group.extras = extras;
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

  if (runs && runs.how !== "once") {
    if (!RUNS_HOWS.includes(runs.how)) throw refuse("setRuns", "That is not a way to run.");
    const next: Runs = { how: runs.how };
    if (runs.how === "parallel") {
      const count = runs.count;
      if (typeof count !== "number" || !Number.isInteger(count) || count < RUNS_COUNT_MIN || count > RUNS_COUNT_MAX) {
        throw refuse("setRuns", `Several at the same time is ${RUNS_COUNT_MIN} to ${RUNS_COUNT_MAX} at a time.`);
      }
      next.count = count;
    } else if (runs.how === "goal") {
      // The goal is the session's (making.sessions_meta), never repeated here.
    } else {
      const detail = (runs.detail ?? "").trim();
      const max = runs.how === "until" ? UNTIL_DETAIL_MAX : runs.how === "script" ? SCRIPT_DETAIL_MAX : WHEN_DETAIL_MAX;
      if (detail.length > max) throw refuse("setRuns", `That line is at most ${max} characters.`);
      if (detail) next.detail = detail;
    }
    payload.runs = next as unknown as Json;
  }
  return upsertNode(withPayload(node, payload));
}

/** Say once that the type is not in the registry yet, then stop. */
async function requireLiveType(operation: string, key: string): Promise<void> {
  const type = await getNodeType(key);
  if (!type || !type.is_active) throw refuse(operation, NODE_TYPE_MISSING);
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
}

/**
 * The payload keys an agent's setup writes, checked. `model` is the main model and stays required: everything that
 * reads an agent reads it. A row of `models` with no model is refused; so is a fifth row.
 */
function setupPayload(operation: string, model: string, { harness, models, toolRefs, memory }: AgentSetup): Payload {
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
  { name, model, parentId, instructions, session, ...setup }: { name?: string | null; model: string; parentId?: string | null; instructions?: string; session?: string | null } & AgentSetup,
): Promise<BuildNode> {
  const keys = setupPayload("addAgent", model, setup);
  const title = titleOrNull(name);
  if (title && title.length > TITLE_MAX) throw refuse("addAgent", `A title is at most ${TITLE_MAX} characters.`);
  const node = { type: AGENT_TYPE, title, payload: { system_prompt: instructions ?? "", ...keys, ...(session && !parentId ? { session } : null) } as Json };
  return parentId ? placeChildNode(buildId, tree, parentId, node) : placeTopNode(buildId, tree, node);
}

/** A team is never empty: it is made holding one agent, which `model` and the setup describe: the agent that leads it. */
export async function addTeam(
  buildId: string,
  tree: readonly NodeTree[],
  { name, model, instructions, session, ...setup }: { name?: string | null; model: string; instructions?: string; session?: string | null } & AgentSetup,
): Promise<{ team: BuildNode; agent: BuildNode }> {
  await requireLiveType("addTeam", TEAM_TYPE);
  const title = titleOrNull(name);
  if (title && title.length > TITLE_MAX) throw refuse("addTeam", `A title is at most ${TITLE_MAX} characters.`);
  const keys = setupPayload("addTeam", model, setup);
  const team = await placeTopNode(buildId, tree, { type: TEAM_TYPE, title, payload: session ? { session } : {} });
  const agent = await placeChildNode(buildId, [], team.id, { type: AGENT_TYPE, title: null, payload: { system_prompt: instructions ?? "", ...keys } as Json });
  return { team, agent };
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

export async function addManualStep(
  buildId: string,
  tree: readonly NodeTree[],
  { tool, text, media_id, session }: { tool: string; text: string; media_id?: string | null; session?: string | null },
): Promise<BuildNode> {
  await requireLiveType("addManualStep", MANUAL_STEP_TYPE);
  const name = tool.trim();
  const line = text.trim();
  if (!name || name.length > MANUAL_TOOL_MAX) throw refuse("addManualStep", `A tool is 1 to ${MANUAL_TOOL_MAX} characters.`);
  if (!line || line.length > MANUAL_TEXT_MAX) throw refuse("addManualStep", `A manual step is 1 to ${MANUAL_TEXT_MAX} characters.`);
  const payload: Record<string, string> = { tool: name, text: line };
  if (media_id) payload.media_id = media_id;
  if (session) payload.session = session;
  return placeTopNode(buildId, tree, { type: MANUAL_STEP_TYPE, title: null, payload });
}

/**
 * Change a manual step's tool, its line or its picture (DATA §2). The tool is
 * 1 to 40 characters and the line 1 to 140; `media_id: null` takes the picture off.
 */
export async function setManualFields(
  node: BuildNode,
  fields: { tool?: string; text?: string; media_id?: string | null },
): Promise<BuildNode> {
  if (node.type !== MANUAL_STEP_TYPE) throw refuse("setManualFields", "That is not a manual step.");
  const payload = { ...payloadOf(node) };
  if (fields.tool !== undefined) {
    const tool = fields.tool.trim();
    if (!tool || tool.length > MANUAL_TOOL_MAX) throw refuse("setManualFields", `A tool is 1 to ${MANUAL_TOOL_MAX} characters.`);
    payload.tool = tool;
  }
  if (fields.text !== undefined) {
    const text = fields.text.trim();
    if (!text || text.length > MANUAL_TEXT_MAX) throw refuse("setManualFields", `A manual step is 1 to ${MANUAL_TEXT_MAX} characters.`);
    payload.text = text;
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
export function checkRefusal(input: Omit<CheckInput, "testedStep">): string | null {
  const tested = input.tested.trim();
  const passing = input.passing.trim();
  if (!tested) return "Say what it tested.";
  if (tested.length > CHECK_TEXT_MAX) return `What it tested is at most ${CHECK_TEXT_MAX} characters.`;
  if (!passing) return "Say what counts as passing.";
  if (passing.length > CHECK_TEXT_MAX) return `What counts as passing is at most ${CHECK_TEXT_MAX} characters.`;
  if ((input.onFail ?? "").trim().length > CHECK_FAIL_MAX) return `When it failed is at most ${CHECK_FAIL_MAX} characters.`;
  for (const n of [input.passed, input.total]) {
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > CHECK_RUNS_MAX) return "Runs are whole numbers from 0 to 10,000.";
  }
  if (input.passed > input.total) return "Passed can't be more than the total.";
  const day = (input.runAt ?? "").trim();
  if (day && !isIsoDay(day)) return "Last run is a date, written as 2026-10-12.";
  return null;
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

/** CA-03 P5: what a check can test: an agent, a team or code. */
const CHECKABLE: ReadonlySet<StepKind> = new Set(["agent", "team", "code"]);

/** Whether the build has something a check can test, so Add › Check is offered. */
export const canCheck = (steps: readonly Pick<Step, "kind">[]): boolean => steps.some((step) => CHECKABLE.has(step.kind));

/** The step a new check tested: the selected top-level step when it is work (not a check), else the last agent, team or code. */
export function testedStepOf(steps: readonly Step[], selectedTopId: string | null): string | null {
  const selected = steps.find((step) => step.id === selectedTopId);
  if (selected && selected.kind !== "check") return selected.id;
  return [...steps].reverse().find((step) => CHECKABLE.has(step.kind))?.id ?? null;
}

function checkPayload(operation: string, input: CheckInput, tree: readonly NodeTree[]): Json {
  const why = checkRefusal(input);
  if (why) throw refuse(operation, why);
  const out: Payload = { tested: input.tested.trim(), passing: input.passing.trim(), passed: input.passed, total: input.total };
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
  if (type === RESULT_TYPE) return NEST_COPY.result;
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
  { title, url, summary, media_id, parentId }: { title: string; url?: string; summary?: string; media_id?: string; parentId?: string | null },
): Promise<BuildNode> {
  if (!title.trim()) throw refuse("addFile", "A file needs its name.");
  const node = { type: FILE_TYPE, title: null, payload: compact({ title: title.trim(), url, summary, media_id }) };
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

/** The finished thing. */
export async function addResult(
  buildId: string,
  tree: readonly NodeTree[],
  { summary, media_id, url }: { summary: string; media_id?: string; url?: string },
): Promise<BuildNode> {
  if (!summary.trim()) throw refuse("addResult", "A result needs a line saying what it is.");
  return placeTopNode(buildId, tree, { type: RESULT_TYPE, title: null, payload: compact({ summary: summary.trim(), media_id, url }) });
}

/** The payload without the fields left blank. */
function compact(fields: Record<string, string | undefined>): Json {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) if (typeof value === "string" && value.trim()) out[key] = value.trim();
  return out;
}

// --- how a tool was connected (CA-04 P5) ------------------------------------

export type ToolConnection = "app" | "mcp" | "code";
export type ToolRunsAt = "web" | "local";
export const TOOL_CONNECTIONS: readonly ToolConnection[] = ["app", "mcp", "code"];
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
  [RESULT_TYPE]: { keys: ["summary", "url", "media_id"], required: "summary" },
};

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
    } else payload[key] = trimmed;
  }
  return upsertNode(withPayload(node, payload));
}
