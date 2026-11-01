/* CA-16 P3: what a build says about itself, read from its tiles.

   PURE. `deriveClassification(steps, build)` takes the `Step[]` the composer already builds and, in `build`, the node
   tree the steps came from (results, files and tool tiles at the top level are not steps, so only the tree has them)
   and the few build columns that count as evidence. It never writes anything and never reads a secret: a code tile's
   text is only tested for its length and for the words "api key", never stored.

   Each derived facet is `{ values, from }`: list ids, and the ids of the tiles they came from. A name the lists do not
   know becomes `custom:<text>`. The gap questions are questions, never errors; the ones whose id is in
   `questions_dismissed` are left out.

   WHERE A RULE'S EVIDENCE IS NOT BUILT YET (CA-15's Required plan on a Tool tile, a repository's "created here", a
   dataset's use), it is read from the payload key it will use and counts as absent until it is there. */

import { autonomyFromApprovals, engineAndFramework, namesApproval, oversightFromApprovals } from "@/lib/build/agentFields";
import { deploymentStack } from "@/lib/build/deployment";
import { toolFor, toolName } from "@/lib/tools/registry";
import type { Making } from "@/lib/build/making";
import {
  AGENT_TYPE,
  CHECK_TYPE,
  CODE_TYPE,
  FILE_TYPE,
  MANUAL_STEP_TYPE,
  RESULT_TYPE,
  TEAM_TYPE,
  TOOL_TYPE,
  fileKindOf,
  isTrainedModel,
  resultFactsOf,
  type Step,
} from "@/lib/build/graph";
import { PROMPT_TYPE } from "@/lib/build/composePrompts";
import { DECISION_TYPE } from "@/lib/build/decision";
import { RETRIEVAL_TYPE } from "@/lib/build/retrieval";
import type { NodeTree } from "@/lib/build/types";

import { CUSTOM_PREFIX } from "./facets";
import type { DerivedFacet, DerivedMap } from "./types";
import { stackFor, valueByLabel, type Facet } from "./taxonomy";

/** What the derivation reads of the build, beside its steps. */
export interface DeriveBuild {
  /** The placed nodes, nested: the source of results, files and tool tiles. Absent: only the steps are read. */
  tree?: readonly NodeTree[];
  making?: Partial<Making> | null;
  title?: string | null;
  outcome?: string | null;
  repo_url?: string | null;
  live_url?: string | null;
  cost_monthly?: number | null;
  cost_setup?: number | null;
  /** Media id to its kind, so a result's pictures can be told from its videos. A result with media and no entry here reads as an image. */
  mediaKinds?: ReadonlyMap<string, "image" | "video" | "audio" | "file">;
  /** `classification.questions_dismissed`. */
  dismissed?: readonly string[];
}

export type QuestionAction = "add-code" | "add-run" | "add-cost" | "add-tool";

/** A gap question: asked, never a refusal. `id` is what `questions_dismissed` stores. */
export interface GapQuestion {
  id: string;
  text: string;
  action: QuestionAction;
  actionLabel: string;
  /** The tile the question is about, when it is about one: the agent that never ran, the tool with a paid plan. */
  tileId?: string;
}

export interface Derivation {
  derived: DerivedMap;
  questions: GapQuestion[];
}

/** The longest a Code tile may be and still count as short. */
export const SHORT_CODE_LINES = 30;

type TileKind = "prompt" | "agent" | "team" | "manual" | "code" | "check" | "file" | "tool" | "decision" | "result" | "retrieval";

interface Tile {
  id: string;
  kind: TileKind;
  payload: Record<string, unknown>;
  node: NodeTree | null;
  step: Step | null;
  topLevel: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown): string => (typeof value === "string" ? value : "");

const KIND_OF_TYPE: Record<string, TileKind> = {
  [PROMPT_TYPE]: "prompt",
  [AGENT_TYPE]: "agent",
  [TEAM_TYPE]: "team",
  [MANUAL_STEP_TYPE]: "manual",
  [CODE_TYPE]: "code",
  [CHECK_TYPE]: "check",
  [FILE_TYPE]: "file",
  [TOOL_TYPE]: "tool",
  [DECISION_TYPE]: "decision",
  [RESULT_TYPE]: "result",
  [RETRIEVAL_TYPE]: "retrieval",
};

function flattenSteps(steps: readonly Step[], out: Step[] = []): Step[] {
  for (const step of steps) {
    out.push(step);
    flattenSteps(step.children, out);
    flattenSteps(step.sentWith ?? [], out);
  }
  return out;
}

function flattenTree(tree: readonly NodeTree[], out: NodeTree[] = []): NodeTree[] {
  for (const node of tree) {
    out.push(node);
    flattenTree(node.children ?? [], out);
  }
  return out;
}

/** Every tile of the build once: from the tree when there is one, else from the steps. */
function tilesOf(steps: readonly Step[], build: DeriveBuild): Tile[] {
  const flatSteps = flattenSteps(steps);
  const stepById = new Map(flatSteps.map((step) => [step.id, step]));
  if (build.tree) {
    const tiles: Tile[] = [];
    for (const node of flattenTree(build.tree)) {
      const kind = KIND_OF_TYPE[node.type];
      if (!kind) continue;
      const payload = isRecord(node.payload) ? node.payload : {};
      // An eval run with nothing it tested is an old run, not a check.
      if (kind === "check" && !str(payload.tested).trim()) continue;
      // SV-29 P7: a Retrieval tile is a tile only when it says so (`step: true`); a configuration saved before is not one.
      if (kind === "retrieval" && payload.step !== true) continue;
      tiles.push({ id: node.id, kind, payload, node, step: stepById.get(node.id) ?? null, topLevel: node.parent_id === null });
    }
    return tiles;
  }
  return flatSteps.map((step) => ({ id: step.id, kind: step.kind as TileKind, payload: {}, node: null, step, topLevel: !step.inside }));
}

const lines = (source: string): number => source.split(/\r?\n/).filter((line) => line.trim() !== "").length;
const promptTextOf = (tile: Tile): string => str(tile.payload.text) || tile.step?.text || "";

/** An agent's trigger: "schedule", "event", or "manual" for anything else (including none). */
const triggerOf = (tile: Tile): "schedule" | "event" | "manual" => {
  const how = tile.step?.runs?.how ?? str(isRecord(tile.payload.runs) ? tile.payload.runs.how : "");
  // SV-27 P8: a background service and an ongoing goal start on their own too.
  return how === "schedule" ? "schedule" : how === "event" || how === "background" || how === "ongoing" ? "event" : "manual";
};

const truthy = (...values: unknown[]): boolean =>
  values.some((value) => (Array.isArray(value) ? value.length > 0 : isRecord(value) ? Object.keys(value).length > 0 : typeof value === "string" ? value.trim() !== "" : typeof value === "number" ? value > 0 : value === true));

/** CA-15's Required plan on a Tool tile: read from the key it will use. Paid when it says anything but a free plan. */
const requiredPlanOf = (tile: Tile): string => str(tile.payload.required_plan ?? tile.payload.plan).trim();
const isPaidPlan = (plan: string): boolean => plan !== "" && !/^(free|none|no)\b/i.test(plan);

const isRepositoryTool = (tile: Tile): boolean => {
  const id = toolFor(str(tile.payload.service) || tile.step?.tool)?.id;
  return id === "github" || id === "gitlab";
};

const hasCostEntry = (tiles: readonly Tile[], build: DeriveBuild): boolean =>
  (build.cost_monthly ?? 0) > 0 ||
  tiles.some((tile) => isRecord(tile.payload.run_cost) || isRecord(tile.payload.build_cost) || Boolean(tile.step?.runCost) || Boolean(tile.step?.buildCost));

/** A single derived value: the id with the tiles it came from. */
class Collector {
  private readonly map = new Map<Facet, { values: string[]; from: Set<string> }>();

  add(facet: Facet, value: string, from: readonly string[] = []): void {
    const entry = this.map.get(facet) ?? { values: [], from: new Set<string>() };
    if (!entry.values.includes(value)) entry.values.push(value);
    for (const id of from) entry.from.add(id);
    this.map.set(facet, entry);
  }

  has(facet: Facet, value: string): boolean {
    return this.map.get(facet)?.values.includes(value) ?? false;
  }

  result(): DerivedMap {
    const out: DerivedMap = {};
    for (const [facet, entry] of this.map) out[facet] = { values: entry.values, from: [...entry.from] } satisfies DerivedFacet;
    return out;
  }
}

const ids = (tiles: readonly Tile[]): string[] => tiles.map((tile) => tile.id);

/** The languages in the Languages list that a prompt's text names. Ambiguous words must be capitalised, and Go, R and C must follow "in", "using" or "with". */
const OPEN_LANGUAGES: readonly [RegExp, string][] = [
  [/\bpython\b/i, "Python"],
  [/\btypescript\b/i, "TypeScript"],
  [/\bjavascript\b/i, "JavaScript"],
  [/\bsql\b/i, "SQL"],
  [/\bkotlin\b/i, "Kotlin"],
  [/\bsolidity\b/i, "Solidity"],
  [/(?<![\w])c\+\+(?![\w+])/i, "C++"],
  [/(?<![\w])c#(?![\w])/i, "C#"],
  [/\bRust\b/, "Rust"],
  [/\bSwift\b/, "Swift"],
  [/\bJava\b/, "Java"],
  [/\bJulia\b/, "Julia"],
  [/\b(?:in|using|with|written in)\s+Go\b/, "Go"],
  [/\b(?:in|using|with|written in)\s+R\b(?![\w.])/, "R"],
  [/\b(?:in|using|with|written in)\s+C\b(?![\w+#])/, "C"],
];

/** The first language a text names, or null. */
export function languageNamedIn(text: string): string | null {
  for (const [pattern, name] of OPEN_LANGUAGES) if (pattern.test(text)) return name;
  return null;
}

const AUDIO_EXT = /\.(mp3|wav|m4a|ogg|flac|aac)$/i;

/** What a result holds, as the facts the derivation needs. */
interface ResultRead {
  tile: Tile;
  link: boolean;
  deployed: boolean;
  media: string[];
  file: ReturnType<typeof resultFactsOf>["file"];
  model: boolean;
  textOnly: boolean;
  metric: boolean;
  fromPrompt: boolean;
}

function readResult(tile: Tile, promptIds: ReadonlySet<string>): ResultRead {
  const facts = resultFactsOf({ payload: tile.payload as never });
  const deployed = str(tile.payload.kind) === "deployed";
  const uses = Array.isArray(tile.payload.uses) ? tile.payload.uses : [];
  const link = Boolean(facts.link) || deployed;
  const metric = isRecord(tile.payload.metrics) || typeof tile.payload.metric === "string" || str(tile.payload.kind) === "metric";
  return {
    tile,
    link,
    deployed,
    media: facts.mediaIds,
    file: facts.file,
    model: Boolean(facts.model) || isTrainedModel({ type: RESULT_TYPE, payload: tile.payload as never }),
    textOnly: !link && facts.mediaIds.length === 0 && !facts.file && !facts.model && !metric && str(tile.payload.summary).trim() !== "",
    metric,
    fromPrompt: uses.some((use) => isRecord(use) && use.kind === "output" && typeof use.node_id === "string" && promptIds.has(use.node_id)),
  };
}

export function deriveClassification(steps: readonly Step[], build: DeriveBuild = {}): Derivation {
  const tiles = tilesOf(steps, build);
  const of = (...kinds: TileKind[]) => tiles.filter((tile) => kinds.includes(tile.kind));

  const prompts = of("prompt");
  const agents = of("agent");
  const teams = of("team");
  const codes = of("code");
  const checks = of("check");
  const decisions = of("decision");
  const files = of("file");
  const toolTiles = of("tool");
  const resultTiles = of("result");

  const promptIds = new Set(prompts.map((tile) => tile.id));
  const results = resultTiles.map((tile) => readResult(tile, promptIds));
  const mediaKind = (id: string) => build.mediaKinds?.get(id) ?? "image";

  const hasLive = Boolean(build.live_url?.trim());
  const deployed = results.filter((result) => result.link);
  const hasDeployed = deployed.length > 0 || hasLive;
  const scheduled = [...agents, ...teams].filter((tile) => triggerOf(tile) !== "manual");

  const out = new Collector();

  /* ── What was built ── */
  if (hasDeployed) out.add("built", "web-app", ids(deployed.map((result) => result.tile)));
  const imageResults = results.filter((result) => result.media.some((id) => mediaKind(id) === "image"));
  const videoResults = results.filter((result) => result.media.some((id) => mediaKind(id) === "video"));
  const audioResults = results.filter((result) => result.media.some((id) => mediaKind(id) === "audio"));
  if (imageResults.length > 0) out.add("built", "image-set", ids(imageResults.map((result) => result.tile)));
  if (videoResults.length > 0) out.add("built", "video", ids(videoResults.map((result) => result.tile)));
  if (audioResults.length > 0) out.add("built", "audio", ids(audioResults.map((result) => result.tile)));
  const documentResults = results.filter((result) => result.textOnly || (result.file && ["pdf", "text"].includes(result.file.kind)));
  if (documentResults.length > 0) out.add("built", "document-or-report", ids(documentResults.map((result) => result.tile)));
  const tableResults = results.filter((result) => result.metric || result.file?.kind === "spreadsheet");
  if (tableResults.length > 0) out.add("built", "spreadsheet-or-data-model", ids(tableResults.map((result) => result.tile)));
  const modelResults = results.filter((result) => result.model);
  if (modelResults.length > 0) out.add("built", "fine-tuned-model", ids(modelResults.map((result) => result.tile)));

  const isDataset = (tile: Tile): boolean => {
    const name = tile.step?.fileFacts?.name ?? str(tile.payload.title);
    return str(tile.payload.role) === "dataset" || str(tile.payload.kind) === "dataset" || /\.(csv|tsv|parquet|jsonl|ndjson)$/i.test(name);
  };
  const datasets = files.filter(isDataset);
  if (datasets.length > 0) out.add("built", "dataset", ids(datasets));

  const standaloneAgents = agents.filter((tile) => tile.topLevel);
  if (teams.length > 0) out.add("built", "multi-agent-system", ids(teams));
  else if (standaloneAgents.length > 1) out.add("built", "multi-agent-system", ids(standaloneAgents));
  else if (agents.length === 1) out.add("built", "autonomous-agent", ids(agents));
  if (decisions.length > 0) out.add("built", "ai-feature-in-a-product", ids(decisions));

  const repository = toolTiles.filter(isRepositoryTool);
  const repoCreated = repository.filter((tile) => tile.payload.created === true || tile.payload.repo_created === true || str(tile.payload.repository) === "created");
  const mcpTools = toolTiles.filter((tile) => (tile.step?.app?.connection ?? str(tile.payload.connection)) === "mcp");
  if (mcpTools.length > 0 && repoCreated.length > 0) out.add("built", "mcp-server", ids([...mcpTools, ...repoCreated]));

  const workflowTriggers = scheduled.length > 0 && toolTiles.length > 0;
  if (workflowTriggers) out.add("built", "automation-workflow", ids([...scheduled, ...toolTiles]));

  const onlyPrompts = tiles.length > 0 && prompts.length > 0 && tiles.every((tile) => tile.kind === "prompt" || tile.kind === "result");
  const hasSystemPrompt = agents.some((tile) => str(tile.payload.system_prompt).trim() !== "" || (tile.step?.text ?? "") !== "") || prompts.some((tile) => str(tile.payload.role) === "system");
  const variableTiles = prompts.filter((tile) => truthy(tile.payload.variables) || /\{\{\s*[\w.-]+\s*\}\}/.test(promptTextOf(tile)));
  const systemTiles = prompts.filter((tile) => str(tile.payload.role) === "system");
  if (onlyPrompts && (systemTiles.length > 0 || variableTiles.length > 0)) out.add("built", "prompt-library", ids([...systemTiles, ...variableTiles]));

  if (codes.length > 0 && !hasDeployed) out.add("built", "script-or-tool", ids(codes));

  /* ── Role of AI ── */
  const decisionOrAgent = decisions.length > 0 || agents.length > 0 || teams.length > 0;
  const runsOnAi = decisions.length > 0 || scheduled.length > 0 || (hasDeployed && decisionOrAgent);
  const madeResults = results.some((result) => result.fromPrompt);
  const anyAiWork = prompts.length + agents.length + teams.length + decisions.length > 0 || (build.making?.sessions?.length ?? 0) > 0;
  if (runsOnAi) {
    const evidence = [...decisions, ...scheduled, ...(hasDeployed && decisionOrAgent ? [...agents, ...teams] : [])];
    out.add("role", madeResults ? "both" : "runs-on-ai", ids(evidence));
  } else if (anyAiWork) {
    out.add("role", "made-with-ai", ids(prompts));
  }

  /* ── Techniques ── */
  if (prompts.length >= 2) out.add("technique", "prompt-chain", ids(prompts));
  const withSystemInstructions = [...agents.filter((tile) => (tile.step?.text ?? str(tile.payload.system_prompt)).trim() !== ""), ...systemTiles];
  if (withSystemInstructions.length > 0) out.add("technique", "system-prompt", ids(withSystemInstructions));
  // SV-29 P7: a Decision that says how it was adapted is read by that; one that does not keeps the older reading of its examples.
  const adaptationOf = (tile: Tile): string => (isRecord(tile.payload.adaptation) ? str(tile.payload.adaptation.kind) : str(tile.payload.adaptation));
  const fewShot = decisions.filter((tile) => (adaptationOf(tile) ? adaptationOf(tile) === "few_shot" : truthy(tile.payload.examples)));
  if (fewShot.length > 0) out.add("technique", "few-shot-examples", ids(fewShot));
  const zeroShot = decisions.filter((tile) => adaptationOf(tile) === "zero_shot");
  if (zeroShot.length > 0) out.add("technique", "zero-shot", ids(zeroShot));
  const tuned = decisions.filter((tile) => adaptationOf(tile) === "fine_tuned");
  if (variableTiles.length > 0) out.add("technique", "prompt-variables", ids(variableTiles));
  const retrieval = datasets.filter((tile) => ["retrieval", "rag"].includes(str(tile.payload.use).toLowerCase()) || truthy(tile.payload.chunking, tile.payload.chunk_size));
  if (retrieval.length > 0) out.add("technique", "retrieval-rag", ids(retrieval));
  // SV-29 P7: a Retrieval tile is Embeddings; it is Retrieval (RAG) only when what it finds feeds a prompt or an agent that writes text.
  const retrievals = of("retrieval");
  if (retrievals.length > 0) out.add("technique", "embeddings", ids(retrievals));
  const retrievalIds = new Set(retrievals.map((tile) => tile.id));
  const generating = flattenSteps(steps).filter((step) => (step.kind === "prompt" || step.kind === "agent" || step.kind === "team") && step.uses.some((use) => retrievalIds.has(use.node_id)));
  if (generating.length > 0) out.add("technique", "retrieval-rag", [...retrievalIds, ...generating.map((step) => step.id)]);
  const reranking = decisions.filter((tile) => isRecord(tile.payload.candidates_from));
  if (reranking.length > 0) out.add("technique", "reranking", ids(reranking));
  const attached = flattenSteps(steps).flatMap((step) => (step.kind === "prompt" ? (step.sentWith ?? []).filter((child) => child.kind === "file") : []));
  if (attached.length > 0) out.add("technique", "long-documents", attached.map((step) => step.id));
  const remembering = agents.filter((tile) => Boolean(tile.step?.memory) || truthy(tile.payload.memory));
  if (remembering.length > 0) out.add("technique", "memory", ids(remembering));
  const agentsWithTools = agents.filter((tile) => (tile.step?.toolRefs?.length ?? 0) > 0 || truthy(tile.payload.tools));
  if (toolTiles.length > 0 || agentsWithTools.length > 0) out.add("technique", "tool-use", ids([...toolTiles, ...agentsWithTools]));
  if (mcpTools.length > 0) out.add("technique", "mcp", ids(mcpTools));
  if (agents.length > 1 || teams.length > 0) out.add("technique", "multi-agent-orchestration", ids([...agents, ...teams]));
  const approvals = [...agents, ...teams].filter((tile) => truthy(tile.payload.approvals, tile.payload.approval, tile.payload.needs_approval));
  const suggestsOnly = agents.filter((tile) => triggerOf(tile) === "manual");
  if (approvals.length > 0 || suggestsOnly.length > 0) out.add("technique", "human-approval-steps", ids([...approvals, ...suggestsOnly]));
  const shaped = [...decisions, ...[...prompts, ...agents].filter((tile) => Boolean(tile.step?.outputShape) || isRecord(tile.payload.output_shape))];
  if (shaped.length > 0) out.add("technique", "structured-output", ids(shaped));
  // SV-29 P7: Classification is a Decision with a single or multiple choice question (the question's `type`).
  const classifying = decisions.filter((tile) => (Array.isArray(tile.payload.questions) ? tile.payload.questions : []).some((question) => isRecord(question) && (str(question.type) === "choice" || str(question.type) === "multi")));
  if (classifying.length > 0) out.add("technique", "classification", ids(classifying));
  const extracting = decisions.filter((tile) => {
    const questions = Array.isArray(tile.payload.questions) ? tile.payload.questions : [];
    return questions.some((question) => isRecord(question) && (str(question.type) === "extract" || str(question.kind) === "extract" || /\bextract/i.test(str(question.instructions))));
  });
  if (extracting.length > 0) out.add("technique", "extraction", ids(extracting));
  if (modelResults.length > 0 || tuned.length > 0) out.add("technique", "fine-tuning", [...ids(modelResults.map((result) => result.tile)), ...ids(tuned)]);
  if (checks.length > 0) out.add("technique", "evaluations", ids(checks));
  const limited = agents.filter((tile) => truthy(tile.payload.limits, tile.payload.limit, tile.payload.max_steps, tile.payload.max_turns, tile.payload.budget));
  if (limited.length > 0) out.add("technique", "guardrails", ids(limited));

  /* ── Modality ── */
  const sentFiles = flattenSteps(steps).filter((step) => step.kind === "file" && step.inside);
  const imageFiles = sentFiles.filter((step) => step.fileFacts?.kind === "picture");
  const audioFiles = sentFiles.filter((step) => AUDIO_EXT.test(step.fileFacts?.name ?? ""));
  const documentFiles = files.filter((tile) => ["pdf", "text"].includes(tile.step?.fileFacts?.kind ?? fileKindOf(str(tile.payload.title), str(tile.payload.mime))));
  if (prompts.length > 0) out.add("modality", "text-to-text", ids(prompts));
  if (codes.length > 0) out.add("modality", "text-to-code", ids(codes));
  if (imageResults.length > 0) out.add("modality", "text-to-image", ids(imageResults.map((result) => result.tile)));
  if (videoResults.length > 0) out.add("modality", "text-to-video", ids(videoResults.map((result) => result.tile)));
  if (imageFiles.length > 0) out.add("modality", "image-to-text", imageFiles.map((step) => step.id));
  if (audioFiles.length > 0) out.add("modality", "speech-to-text", audioFiles.map((step) => step.id));
  if (audioResults.length > 0) out.add("modality", "text-to-speech", ids(audioResults.map((result) => result.tile)));
  if (tableResults.length > 0 && documentFiles.length > 0) out.add("modality", "document-to-data", ids([...tableResults.map((result) => result.tile), ...documentFiles]));
  if (documentResults.length > 0 && (datasets.length > 0 || tableResults.length > 0)) out.add("modality", "data-to-report", ids([...documentResults.map((result) => result.tile), ...datasets]));
  const media = [imageFiles.length + imageResults.length > 0, videoResults.length > 0, audioFiles.length + audioResults.length > 0, documentFiles.length > 0].filter(Boolean).length;
  if (media >= 2) out.add("modality", "multimodal", [...imageFiles.map((step) => step.id), ...ids(documentFiles)]);

  /* ── Build method ── */
  const sessionApps = new Map<string, string[]>();
  const noteApp = (name: string | null | undefined, from: string[]) => {
    const tool = toolFor(name);
    const method = tool?.buildMethod;
    if (method) out.add("method", method, from);
    if (name) sessionApps.set(name, from);
  };
  const making = build.making ?? {};
  const fromSession = (key: string | undefined): string[] => (key ? flattenSteps(steps).filter((step) => step.sessionId === key || step.session === key).map((step) => step.id) : []);
  for (const session of making.sessions ?? []) noteApp(session.client, fromSession(session.id));
  for (const [key, tool] of Object.entries(making.session_tools ?? {})) noteApp(tool, fromSession(key));
  for (const [key, meta] of Object.entries(making.sessions_meta ?? {})) noteApp(meta?.tool, fromSession(key));
  for (const step of flattenSteps(steps)) {
    if (step.kind === "prompt" && step.tool) noteApp(step.tool, [step.id]);
    if (step.kind === "agent" && step.harness) noteApp(step.harness, [step.id]);
  }
  // SV-27: only an agent the maker said is built in code; Not said says nothing about a harness.
  const ownCode = [...agents.filter((tile) => !tile.step?.harness && !str(tile.payload.harness).trim() && (tile.step?.builtInCode === true || tile.payload.built_in_code === true)), ...toolTiles.filter((tile) => (tile.step?.app?.connection ?? str(tile.payload.connection)) === "code")];
  if (ownCode.length > 0) out.add("method", "direct-api", ids(ownCode));

  /* ── Autonomy ── */
  // SV-28 P4: an Approval step (a manual step holding a gate) is an approval gate; the step is the source.
  const gates = tiles.filter((t) => t.kind === "manual" && t.payload.gate && typeof t.payload.gate === "object");
  const approvalAutonomy = autonomyFromApprovals([...agents, ...teams]);
  if (prompts.length + agents.length + teams.length + codes.length + decisions.length + tiles.filter((t) => t.kind === "manual").length > 0) {
    const everyAgent = [...agents, ...teams];
    if (everyAgent.length === 0) {
      out.add("autonomy", "you-do-each-step", ids(prompts));
    } else if (approvalAutonomy) {
      // SV-27 P8: an agent's approval mode says how it is guarded; the least guarded agent decides, its tiles the source.
      if (approvalAutonomy.value === "fully-autonomous" && gates.length > 0) out.add("autonomy", "ai-acts-with-approval-gates", ids(gates));
      else out.add("autonomy", approvalAutonomy.value, approvalAutonomy.ids);
    } else if (scheduled.length === 0) {
      out.add("autonomy", "ai-suggests-and-you-approve", ids(everyAgent));
    } else {
      // SV-27 P8: a Limits line is a gate only when it names approvals; a budget or a step cap is not one.
      const guarded = (tile: Tile) => truthy(tile.payload.approvals, tile.payload.approval, tile.payload.needs_approval) || namesApproval(tile.payload.limits) || namesApproval(tile.payload.limit);
      const unguarded = gates.length > 0 ? [] : scheduled.filter((tile) => !guarded(tile));
      out.add("autonomy", unguarded.length > 0 ? "fully-autonomous" : "ai-acts-with-approval-gates", ids(gates.length > 0 ? gates : scheduled));
    }
  }

  /* ── Human oversight ── */
  // SV-27 P8: an AI reviewer is a spot check, from the agent's tile; asking before every action is every output reviewed.
  for (const said of oversightFromApprovals([...agents, ...teams])) out.add("oversight", said.value, said.ids);
  if (gates.length > 0) out.add("oversight", "approved-before-continuing", ids(gates));
  const autonomy = out.result().autonomy?.values[0];
  if (autonomy === "you-do-each-step" || autonomy === "ai-suggests-and-you-approve") out.add("oversight", "every-output-reviewed", ids(prompts));
  else if (checks.length > 0) out.add("oversight", "spot-checks", ids(checks));
  else if (autonomy === "fully-autonomous") out.add("oversight", "no-review", ids(scheduled));

  /* ── Skill needed ── */
  const longCode = codes.filter((tile) => lines(str(tile.payload.source) || tile.step?.text || "") > SHORT_CODE_LINES);
  const shortCode = codes.filter((tile) => !longCode.includes(tile));
  const commandLine = toolTiles.filter((tile) => /^(cli|command-line|command line)/i.test(str(tile.payload.connection)) || /command.line|\bcli\b/i.test(str(tile.payload.service)));
  const owned = repository.filter((tile) => tile.payload.owned === true || tile.payload.created === true || tile.payload.repo_created === true);
  const writing = [...owned, ...longCode, ...ownCode.filter((tile) => tile.kind === "tool"), ...commandLine];
  const hasRepoUrl = Boolean(build.repo_url?.trim());
  if (writing.length > 0 || hasRepoUrl) out.add("skill", "writing-code", ids(writing));
  else {
    const apiKeys = tiles.filter((tile) => tile.payload.api_key_needed === true || tile.step?.decision?.via === "api" || (tile.kind === "code" && /api[_ -]?key/i.test(str(tile.payload.source))));
    const automation = out.has("method", "automation-platform");
    const setup = [...apiKeys, ...mcpTools, ...shortCode];
    if (setup.length > 0 || automation) out.add("skill", "some-setup", ids(setup));
    else out.add("skill", "no-coding");
  }

  /* ── Cost to run ── */
  const monthly = build.cost_monthly ?? null;
  const dayCost = tiles.map((tile) => tile.step?.runCost).filter((cost): cost is NonNullable<Step["runCost"]> => Boolean(cost));
  const perMonth = (cost: NonNullable<Step["runCost"]>): number | null => (cost.cost === undefined ? null : cost.per === "day" ? cost.cost * 30 : cost.per === "hour" ? cost.cost * 24 * 30 : null);
  const estimates = [monthly, ...dayCost.map(perMonth)].filter((value): value is number => value !== null && value > 0);
  const paid = toolTiles.filter((tile) => isPaidPlan(requiredPlanOf(tile)));
  if (paid.length > 0) out.add("cost", "needs-a-paid-plan", ids(paid));
  if (estimates.length > 0) {
    const total = estimates.reduce((sum, value) => sum + value, 0);
    out.add("cost", total < 10 ? "extra-usage-under-10-a-month" : total <= 50 ? "extra-usage-10-to-50-a-month" : "extra-usage-over-50-a-month", ids(tiles.filter((tile) => Boolean(tile.step?.runCost))));
  }
  if (paid.length === 0 && estimates.length === 0) out.add("cost", "cost-not-stated");

  /* ── Tools and stack ── */
  const stackFrom = new Map<string, { value: string; from: Set<string> }>();
  const noteStack = (name: string | null | undefined, prefer: "app" | "model" | "language", from: string[]) => {
    const clean = (name ?? "").trim();
    if (!clean) return;
    const match = stackFor(clean, prefer);
    const value = match ? match.id : `${CUSTOM_PREFIX}${clean.slice(0, 60)}`;
    const entry = stackFrom.get(value) ?? { value, from: new Set<string>() };
    for (const id of from) entry.from.add(id);
    stackFrom.set(value, entry);
  };
  for (const [name, from] of sessionApps) noteStack(name, "app", from);
  for (const tile of toolTiles) noteStack(str(tile.payload.service) || tile.step?.tool, "app", [tile.id]);
  for (const tile of agents) {
    for (const model of tile.step?.models ?? []) noteStack(model.model, "model", [tile.id]);
    if (tile.step?.model) noteStack(tile.step.model, "model", [tile.id]);
  }
  for (const tile of codes) noteStack(tile.step?.language ?? str(tile.payload.language), "language", [tile.id]);
  // SV-27 P8: deployment providers, inference engines and agent frameworks, each from its tiles.
  for (const entry of deploymentStack(build.tree ?? [])) noteStack(entry.name, "app", [entry.id]);
  for (const tile of [...agents, ...teams, ...prompts, ...codes]) for (const name of engineAndFramework(tile.payload, tile.step?.modelRun?.engine)) noteStack(toolName(name) ?? name, "app", [tile.id]);
  for (const [value, entry] of stackFrom) out.add("stack", value, [...entry.from]);

  /* ── The gap questions ── */
  const dismissed = new Set(build.dismissed ?? []);
  const questions: GapQuestion[] = [];
  const ask = (question: GapQuestion) => {
    if (!dismissed.has(question.id)) questions.push(question);
  };
  if (hasDeployed && codes.length === 0 && toolTiles.length === 0 && !hasRepoUrl && repository.length === 0) {
    ask({ id: "deployed-no-source", text: "This build is deployed, but it shows no code, tool or GitHub repository. Where does it come from?", action: "add-code", actionLabel: "Add code" });
  }
  const hasRunEvidence = resultTiles.length > 0 || checks.some((tile) => (tile.step?.check?.runs?.length ?? 0) > 0 || truthy(tile.payload.runs, tile.payload.cases));
  for (const tile of scheduled) {
    if (!hasRunEvidence) ask({ id: `trigger-no-run:${tile.id}`, text: "An agent runs on a schedule or an event, but nothing shows it ran. Add a result or a check.", action: "add-run", actionLabel: "Add a result", tileId: tile.id });
  }
  for (const tile of paid) {
    if (!hasCostEntry(tiles, build)) ask({ id: `paid-plan-no-cost:${tile.id}`, text: "A tool names a paid plan, but no cost is given. What does it cost to run?", action: "add-cost", actionLabel: "Add a cost", tileId: tile.id });
  }
  if (codes.length === 0) {
    for (const tile of prompts) {
      const named = languageNamedIn(promptTextOf(tile));
      if (named) {
        ask({ id: `language-no-code:${valueByLabel("stack", named)?.id.split(".").pop() ?? named.toLowerCase()}`, text: `A prompt names ${named}, but there is no Code tile. Add the code it made.`, action: "add-code", actionLabel: "Add code" });
        break;
      }
    }
  }

  return { derived: out.result(), questions };
}
