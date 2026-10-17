// The build graph (UI-P62): the steps both the composer and the build page draw,
// and the writes that change them. design/sandbox/DATA.md is the shape.
//
// A STEP IS A TOP-LEVEL NODE of type prompt, agent_config, team or manual_step,
// numbered by position from 1. Files, tools, results and the cover's evidence
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
import { toolName } from "@/lib/tools/registry";
import { toolLabel, type MakingSession } from "./making";
import { getNodeType } from "./nodeTypes";
import { reorderNodes, upsertNode, type NodeMove } from "./nodes";
import { buildLayerError, type BuildNode, type BuildNodeInsert, type NodeTree } from "./types";
import { modelLabel } from "@/lib/models/registry";

export const AGENT_TYPE = "agent_config";
export const TEAM_TYPE = "team";
export const MANUAL_STEP_TYPE = "manual_step";
export const FILE_TYPE = "document";
export const TOOL_TYPE = "integration";
export const RESULT_TYPE = "result";

export type StepKind = "prompt" | "agent" | "team" | "manual";

export type UseKind = "output" | "file" | "tool";

/** What a step takes in: another step's output, a file, or a tool. */
export interface Use {
  kind: UseKind;
  node_id: string;
}

export type RunsHow = "once" | "parallel" | "until" | "schedule" | "event";

export interface Runs {
  how: RunsHow;
  count?: number;
  detail?: string;
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
  /** The tool a prompt written by hand, or a manual step, names. */
  tool: string | null;
  runs: Runs | null;
  uses: Use[];
  /** Suggestions the maker dismissed, as "<kind>:<node_id>". */
  dismissed?: string[];
  children: Step[];
  /** A manual step's picture (its `media_id`), when it has one. */
  mediaId?: string | null;
}

export interface SessionGroup {
  /** null for prompts typed here. */
  sessionId: string | null;
  number: number;
  tool: string | null;
  model: string | null;
  /** The session's date, or "typed here" for prompts with no session. */
  startedAt: string | null;
  stepNumbers: string[];
}

/** Where the date would be, for prompts written by hand. */
export const TYPED_HERE = "typed here";

export const TITLE_MAX = 80;
export const RUNS_COUNT_MIN = 2;
export const RUNS_COUNT_MAX = 20;
export const UNTIL_DETAIL_MAX = 80;
export const WHEN_DETAIL_MAX = 60;
export const MANUAL_TOOL_MAX = 40;
export const MANUAL_TEXT_MAX = 140;

const NODE_TYPE_MISSING = "That needs the Deploy queue item from UI-P61.";

const USE_KINDS: readonly UseKind[] = ["output", "file", "tool"];
const RUNS_HOWS: readonly RunsHow[] = ["once", "parallel", "until", "schedule", "event"];

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

/** The picture, clip or track a made file shows readers, as a media id; null for none. Read from the file; never a download. */
export function previewMediaIdOf(node: Pick<BuildNode, "payload">): string | null {
  return stringOf(payloadOf(node).preview_media_id);
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
  if (runs.how === "until" || runs.how === "schedule" || runs.how === "event") {
    const detail = stringOf(value.detail)?.trim();
    if (detail) runs.detail = detail;
  }
  return runs;
}

/** The words that say how a step runs. */
export function runsLabel(runs: Runs | null | undefined): string {
  const detail = runs?.detail ? ` · ${runs.detail}` : "";
  switch (runs?.how) {
    case "parallel":
      return typeof runs.count === "number" ? `Runs several at once · ${runs.count}` : "Runs several at once";
    case "until":
      return `Repeats until a condition is met${detail}`;
    case "schedule":
      return `Runs on a schedule${detail}`;
    case "event":
      return `Runs when something happens${detail}`;
    default:
      return "Runs once";
  }
}

const KIND_OF_TYPE: Record<string, StepKind> = {
  [PROMPT_TYPE]: "prompt",
  [AGENT_TYPE]: "agent",
  [TEAM_TYPE]: "team",
  [MANUAL_STEP_TYPE]: "manual",
};

const KIND_NAME: Record<StepKind, string> = {
  prompt: "Prompt",
  agent: "Agent",
  team: "Team",
  manual: "Manual step",
};

const isStepNode = (node: Pick<BuildNode, "type">): boolean => node.type in KIND_OF_TYPE;

const byPosition = <T extends Pick<BuildNode, "position">>(nodes: readonly T[]): T[] =>
  [...nodes]
    .filter((node) => typeof node.position === "number")
    .sort((a, b) => (a.position as number) - (b.position as number));

const dismissedOf = (payload: Payload): string[] =>
  Array.isArray(payload.dismissed) ? payload.dismissed.filter((key): key is string => typeof key === "string") : [];

function stepFor(node: NodeTree, number: string, kind: StepKind, children: Step[] = []): Step {
  const payload = payloadOf(node);
  const text = kind === "agent" ? (stringOf(payload.system_prompt) ?? "") : (stringOf(payload.text) ?? "");
  const import_ = isRecord(node.source_ref) ? node.source_ref.import_session_id : undefined;
  const tool = stringOf(payload.tool);
  return {
    id: node.id,
    kind,
    number,
    title: stringOf(node.title)?.trim() || null,
    defaultTitle: `${KIND_NAME[kind]} ${number}`,
    text,
    words: wordCount(text),
    model: stringOf(payload.model),
    sessionId: typeof import_ === "string" && import_ ? import_ : null,
    tool: tool ? (toolName(tool) ?? tool) : null,
    runs: kind === "agent" || kind === "team" ? parseRuns(payload.runs) : null,
    uses: usesOf(node),
    dismissed: dismissedOf(payload),
    children,
    ...(kind === "manual" ? { mediaId: stringOf(payload.media_id) } : null),
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
    tool: null,
    children: [],
  };
}

/**
 * The steps in order, numbered (DATA §1). `tree` is the nested placed tree.
 * An agent's children are its instructions then its prompts; a team's are its
 * agents. An agent in a team has children only when it has prompts of its own
 * (its instructions, then those prompts, numbered one level further, "3.1.2"),
 * which show when it is opened.
 */
export function buildSteps(tree: readonly NodeTree[]): Step[] {
  const top = byPosition(tree.filter((node) => node.parent_id === null && isStepNode(node)));
  return top.map((node, index) => {
    const number = String(index + 1);
    const kind = KIND_OF_TYPE[node.type];
    if (kind === "agent") {
      const prompts = byPosition((node.children ?? []).filter((child) => child.type === PROMPT_TYPE));
      return stepFor(node, number, kind, [
        instructionsOf(node, `${number}.1`),
        ...prompts.map((child, i) => stepFor(child, `${number}.${i + 2}`, "prompt")),
      ]);
    }
    if (kind === "team") {
      const agents = byPosition((node.children ?? []).filter((child) => child.type === AGENT_TYPE));
      return stepFor(
        node,
        number,
        kind,
        agents.map((child, i) => {
          const inner = `${number}.${i + 1}`;
          // An agent in a team shows its instructions in its own row; any prompts of its own show when it is opened.
          const own = byPosition((child.children ?? []).filter((grand) => grand.type === PROMPT_TYPE));
          return stepFor(child, inner, "agent", own.length === 0 ? [] : [instructionsOf(child, `${inner}.1`), ...own.map((grand, k) => stepFor(grand, `${inner}.${k + 2}`, "prompt"))]);
        }),
      );
    }
    return stepFor(node, number, kind);
  });
}

/** The title the maker typed, else the default. */
export function stepTitle(step: Pick<Step, "title" | "defaultTitle">): string {
  return step.title ?? step.defaultTitle;
}

/**
 * The sessions and runs of typed prompts that make up the top-level steps, in
 * order of first step (DATA §5). A session is one group wherever its prompts
 * sit; prompts with no session form one group per run of consecutive steps.
 * `sessions` is builds.making.sessions; an entry without an id cannot be
 * matched, and its prompts keep the model they name.
 */
export function sessionGroups(steps: readonly Step[], sessions: readonly MakingSession[]): SessionGroup[] {
  const known = new Map<string, MakingSession>();
  for (const session of sessions) if (session.id) known.set(session.id, session);

  const groups: SessionGroup[] = [];
  const bySession = new Map<string, SessionGroup>();
  let typed: SessionGroup | null = null;

  for (const step of steps) {
    if (step.kind !== "prompt") {
      typed = null;
      continue;
    }
    if (step.sessionId) {
      typed = null;
      let group = bySession.get(step.sessionId);
      if (!group) {
        const session = known.get(step.sessionId);
        const model = session?.model ?? step.model;
        group = {
          sessionId: step.sessionId,
          number: groups.length + 1,
          tool: session ? toolLabel(session.client) : null,
          model: model ? modelLabel(model) : null,
          startedAt: session?.started_at ?? null,
          stepNumbers: [],
        };
        bySession.set(step.sessionId, group);
        groups.push(group);
      }
      group.stepNumbers.push(step.number);
      continue;
    }
    if (!typed) {
      typed = {
        sessionId: null,
        number: groups.length + 1,
        tool: step.tool,
        model: step.model ? modelLabel(step.model) : null,
        startedAt: TYPED_HERE,
        stepNumbers: [],
      };
      groups.push(typed);
    }
    typed.stepNumbers.push(step.number);
  }
  return groups;
}

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

/**
 * How an agent or a team runs (CONCEPT §3). "Runs once" is no `runs` at all.
 * Several at once needs a count of 2 to 20; the others take one short line.
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
        throw refuse("setRuns", `Several at once runs ${RUNS_COUNT_MIN} to ${RUNS_COUNT_MAX} at a time.`);
      }
      next.count = count;
    } else {
      const detail = (runs.detail ?? "").trim();
      const max = runs.how === "until" ? UNTIL_DETAIL_MAX : WHEN_DETAIL_MAX;
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

/**
 * An agent: top level, or inside a team when `parentId` names one (UI-P69).
 * A blank name saves as null, so the default "Agent {n}" shows.
 */
export async function addAgent(
  buildId: string,
  tree: readonly NodeTree[],
  { name, model, parentId }: { name?: string | null; model: string; parentId?: string | null },
): Promise<BuildNode> {
  if (!model.trim()) throw refuse("addAgent", "An agent needs a model.");
  const title = titleOrNull(name);
  if (title && title.length > TITLE_MAX) throw refuse("addAgent", `A title is at most ${TITLE_MAX} characters.`);
  const node = { type: AGENT_TYPE, title, payload: { system_prompt: "", model: model.trim() } };
  return parentId ? placeChildNode(buildId, tree, parentId, node) : placeTopNode(buildId, tree, node);
}

/** A team is never empty: it is made holding one agent, which `model` names. */
export async function addTeam(
  buildId: string,
  tree: readonly NodeTree[],
  { name, model }: { name?: string | null; model: string },
): Promise<{ team: BuildNode; agent: BuildNode }> {
  await requireLiveType("addTeam", TEAM_TYPE);
  const title = titleOrNull(name);
  if (title && title.length > TITLE_MAX) throw refuse("addTeam", `A title is at most ${TITLE_MAX} characters.`);
  if (!model.trim()) throw refuse("addTeam", "An agent needs a model.");
  const team = await placeTopNode(buildId, tree, { type: TEAM_TYPE, title, payload: {} });
  const agent = await placeChildNode(buildId, [], team.id, { type: AGENT_TYPE, title: null, payload: { system_prompt: "", model: model.trim() } });
  return { team, agent };
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
  { tool, text, media_id }: { tool: string; text: string; media_id?: string | null },
): Promise<BuildNode> {
  await requireLiveType("addManualStep", MANUAL_STEP_TYPE);
  const name = tool.trim();
  const line = text.trim();
  if (!name || name.length > MANUAL_TOOL_MAX) throw refuse("addManualStep", `A tool is 1 to ${MANUAL_TOOL_MAX} characters.`);
  if (!line || line.length > MANUAL_TEXT_MAX) throw refuse("addManualStep", `A manual step is 1 to ${MANUAL_TEXT_MAX} characters.`);
  const payload: Record<string, string> = { tool: name, text: line };
  if (media_id) payload.media_id = media_id;
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

/** The top-level steps of a tree, in order: the rows that are numbered. */
export function topSteps<T extends Pick<BuildNode, "parent_id" | "position" | "type">>(tree: readonly T[]): T[] {
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

/** A file the AI read. `title` is the file name. */
export async function addFile(
  buildId: string,
  tree: readonly NodeTree[],
  { title, url, summary, media_id }: { title: string; url?: string; summary?: string; media_id?: string },
): Promise<BuildNode> {
  if (!title.trim()) throw refuse("addFile", "A file needs its name.");
  return placeTopNode(buildId, tree, { type: FILE_TYPE, title: null, payload: compact({ title: title.trim(), url, summary, media_id }) });
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

/**
 * Set, or with null clear, what a made file shows readers (`preview_media_id`):
 * a picture, a clip or a track that someone can view and not download. Only a
 * file a step makes has one.
 */
export async function setMadeFilePreview(node: BuildNode, mediaId: string | null): Promise<BuildNode> {
  if (node.type !== FILE_TYPE || !madeByOf(node)) throw refuse("setMadeFilePreview", "Only a file a step makes can have a preview.");
  const payload = { ...payloadOf(node) };
  const id = mediaId?.trim() ?? "";
  if (id) payload.preview_media_id = id;
  else delete payload.preview_media_id;
  return upsertNode(withPayload(node, payload));
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
