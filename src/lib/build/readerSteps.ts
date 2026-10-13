// UI-P72 — the build page's data, with no interface (CONCEPT §6, §8; DATA §5).
//
// Pure functions that turn a published build into the steps a reader follows,
// what they need to follow them, and one text that repeats the whole build in
// another AI. Readers cannot read `import_sessions`, so everything here comes
// from the build's own rows and `builds.making`.
//
// READERS NEVER SEE A SUGGESTION: nothing here reads `dismissed` or calls
// suggest.ts. Only the uses the maker accepted are published.

import { modelLabel } from "@/lib/models/registry";
import { EVIDENCE_NODE_TYPES } from "./cover";
import {
  AGENT_TYPE,
  FILE_TYPE,
  MANUAL_STEP_TYPE,
  RESULT_TYPE,
  TEAM_TYPE,
  TOOL_TYPE,
  buildSteps,
  goesInto,
  runsLabel,
  sessionGroups,
  stepTitle,
  type SessionGroup,
  type Step,
} from "./graph";
import type { Making } from "./making";
import { mediaUrl, type MediaRef } from "./media";
import { PROMPT_TYPE } from "./composePrompts";
import type { BuildMedia, NodeTree } from "./types";

/* ── shapes ── */

/** The media a file, a picture or a result points at, by id. A whole `build_media` row satisfies it. */
export type ReaderMedia = Pick<BuildMedia, "id" | "bytes"> & MediaRef;

export type ReaderChat =
  | {
      kind: "new";
      tool: string | null;
      model: string | null;
      /** The session's number in the build; null for prompts typed in by the maker. */
      session: number | null;
      /** "3 Oct", or null when not known. */
      date: string | null;
      /** The session's start, as stored, for ranges. */
      startedAt: string | null;
      typed: boolean;
      /** "New chat in ChatGPT". */
      headline: string;
      /** "GPT-6 Astra · session 1 · 3 Oct". */
      detail: string;
    }
  | {
      kind: "same";
      /** The step before it in the same session, as a number ("4"). */
      step: string;
      /** "Send in the same chat as step 4". */
      text: string;
    };

export interface ReaderPasteIn {
  /** The step it came from. */
  stepId: string;
  number: string;
  title: string;
  /** "what step 1 gave you". */
  text: string;
}

export interface ReaderFile {
  id: string;
  name: string;
  mediaId: string | null;
  bytes: number | null;
  /** "1.2 KB", or null when the size is not known. */
  size: string | null;
  /** The existing media path, or the file's own link; null when there is neither. */
  download: string | null;
}

export interface ReaderTool {
  id: string;
  name: string;
}

export interface ReaderStep {
  step: Step;
  /** The maker's title, or the default, as stepTitle reads it. */
  title: string;
  isDefaultTitle: boolean;
  /** Set on a top-level prompt only. */
  chat: ReaderChat | null;
  /** What a prompt takes in. Read as "Paste in", "Attach {name}" and the tool, outside an agent or a team. */
  pasteIns: ReaderPasteIn[];
  attach: ReaderFile[];
  tools: ReaderTool[];
  /** Inside an agent or a team, and for an agent or a team itself: the same inputs read as "Uses", in the order listed. Never "Paste in". */
  uses: string[];
  /** "By hand in {tool}", its line and its picture. Nothing to copy. */
  manual: { headline: string; line: string; mediaId: string | null } | null;
  /** "Runs on a schedule · Mondays 07:00", for an agent or a team. */
  runs: string | null;
  /** "made in steps 1 and 2", from an agent's or a team's output uses. */
  madeIn: string | null;
  /** "runs by itself · last run 6 Oct, 07:00", when its session's date is known. */
  runsByItself: string | null;
  /** "3.3, until every claim has a source", then "then the result". Only for a step that repeats until a condition is met. */
  goesInto: string[];
  children: ReaderStep[];
}

export interface NeedRow {
  title: string;
  detail: string;
  /** A file's download. */
  download?: string | null;
  /** An "Other parts" row's node, so the page can open it. */
  id?: string;
}

export type NeedKey = "tools" | "files" | "runs" | "time" | "other";

export interface NeedGroup {
  key: NeedKey;
  label: string;
  rows: NeedRow[];
}

export interface ReaderResult {
  id: string;
  title: string;
  url: string | null;
  mediaId: string | null;
  /** The step it came from, as a number, when known. */
  from: string | null;
}

/* ── words ── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const DAY_MS = 86_400_000;

/** The prerequisite type's key in the registry. Kept here, not imported from the page model, which imports this library back. */
const PREREQUISITE_TYPE = "prerequisite";

/** "27 Sep", in UTC so a server and a browser agree (the same reading as the page model's shortDate). Null for a missing or unreadable date. */
function shortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]}`;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const text = (node: Pick<NodeTree, "payload">, key: string): string | null => {
  const value = isRecord(node.payload) ? node.payload[key] : undefined;
  return typeof value === "string" && value.trim() ? value : null;
};

const isTop = (step: Step): boolean => !step.number.includes(".");

/** "6 Oct, 07:00", in UTC so a server and a browser agree. */
export function dateTime(iso: string | null | undefined): string | null {
  const day = shortDate(iso);
  if (!day || !iso) return null;
  const at = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day}, ${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}`;
}

/** "1.2 KB". Under 100 bytes it says bytes. */
export function formatSize(bytes: number | null | undefined): string | null {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 100) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const join = (items: readonly string[]): string =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/**
 * Step numbers as a reader says them: "step 1", "steps 4–5", "steps 1, 3 and 5",
 * "agent 3.1", "agents 3.2 and 3.4". Whole numbers that run on collapse to a
 * range; numbers inside an agent or a team never do.
 */
export function stepList(numbers: readonly string[], ranges = true): string {
  const unique = [...new Set(numbers)];
  const whole = unique.filter((n) => !n.includes(".")).sort((a, b) => Number(a) - Number(b));
  const inner = unique.filter((n) => n.includes(".")).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

  const spans: string[] = [];
  for (let i = 0; i < whole.length; ) {
    let j = i;
    while (ranges && j + 1 < whole.length && Number(whole[j + 1]) === Number(whole[j]) + 1) j += 1;
    spans.push(j > i ? `${whole[i]}–${whole[j]}` : whole[i]);
    i = j + 1;
  }
  const parts: string[] = [];
  if (whole.length > 0) parts.push(`${whole.length === 1 ? "step" : "steps"} ${join(spans)}`);
  if (inner.length > 0) parts.push(`${inner.length === 1 ? "agent" : "agents"} ${join(inner)}`);
  return join(parts);
}

/** "3–6 Oct", "30 Sep–3 Oct", "3 Oct": the span of some dates, or null when none is readable. */
export function dateRange(dates: readonly (string | null | undefined)[]): string | null {
  const times = dates
    .map((iso) => (iso ? new Date(iso) : null))
    .filter((at): at is Date => at !== null && !Number.isNaN(at.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (times.length === 0) return null;
  const first = times[0];
  const last = times[times.length - 1];
  const day = (at: Date) => `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]}`;
  if (day(first) === day(last)) return day(first);
  if (first.getUTCMonth() === last.getUTCMonth() && first.getUTCFullYear() === last.getUTCFullYear()) {
    return `${first.getUTCDate()}–${day(last)}`;
  }
  return `${day(first)}–${day(last)}`;
}

/* ── reading the tree ── */

interface Context {
  all: Step[];
  byId: Map<string, Step>;
  index: Map<string, number>;
  files: Map<string, ReaderFile>;
  tools: Map<string, ReaderTool>;
  groups: SessionGroup[];
  sessions: Map<string, { startedAt: string | null }>;
  topSteps: Step[];
  resultFrom: Set<string>;
}

const walk = (steps: readonly Step[], out: Step[] = []): Step[] => {
  for (const step of steps) {
    out.push(step);
    walk(step.children, out);
  }
  return out;
};

function readFiles(tree: readonly NodeTree[], media: ReadonlyMap<string, ReaderMedia>): Map<string, ReaderFile> {
  const files = new Map<string, ReaderFile>();
  const visit = (nodes: readonly NodeTree[]) => {
    for (const node of nodes) {
      if (node.type === FILE_TYPE) {
        const mediaId = text(node, "media_id");
        const found = mediaId ? media.get(mediaId) : undefined;
        const bytes = found?.bytes ?? null;
        files.set(node.id, {
          id: node.id,
          name: text(node, "title") ?? "Untitled file",
          mediaId,
          bytes,
          size: formatSize(bytes),
          download: found ? mediaUrl(found, { width: "original" }) : text(node, "url"),
        });
      }
      visit(node.children ?? []);
    }
  };
  visit(tree);
  return files;
}

function readTools(tree: readonly NodeTree[]): Map<string, ReaderTool> {
  const tools = new Map<string, ReaderTool>();
  const visit = (nodes: readonly NodeTree[]) => {
    for (const node of nodes) {
      if (node.type === TOOL_TYPE) tools.set(node.id, { id: node.id, name: text(node, "service") ?? "Tool" });
      visit(node.children ?? []);
    }
  };
  visit(tree);
  return tools;
}

function contextFor(tree: readonly NodeTree[], making: Making | null | undefined, media: ReadonlyMap<string, ReaderMedia>): Context {
  const topSteps = buildSteps(tree);
  const all = walk(topSteps);
  const sessions = making?.sessions ?? [];
  const resultFrom = new Set<string>();
  for (const node of tree) {
    if (node.type !== RESULT_TYPE) continue;
    const uses = isRecord(node.payload) && Array.isArray(node.payload.uses) ? node.payload.uses : [];
    for (const use of uses) {
      if (isRecord(use) && use.kind === "output" && typeof use.node_id === "string") resultFrom.add(use.node_id);
    }
  }
  return {
    all,
    byId: new Map(all.map((step) => [step.id, step])),
    index: new Map(all.map((step, i) => [step.id, i])),
    files: readFiles(tree, media),
    tools: readTools(tree),
    groups: sessionGroups(topSteps, sessions),
    sessions: new Map(sessions.filter((s) => s.id).map((s) => [s.id as string, { startedAt: s.started_at ?? null }])),
    topSteps,
    resultFrom,
  };
}

/* ── the chat each prompt starts or joins ── */

function chatFor(step: Step, context: Context): ReaderChat | null {
  if (step.kind !== "prompt" || !isTop(step)) return null;
  const group = context.groups.find((candidate) => candidate.stepNumbers.includes(step.number));
  if (!group) return null;
  const at = group.stepNumbers.indexOf(step.number);
  if (at > 0) {
    const previous = group.stepNumbers[at - 1];
    return { kind: "same", step: previous, text: `Send in the same chat as step ${previous}` };
  }
  const typed = group.sessionId === null;
  const startedAt = typed ? null : group.startedAt;
  const date = shortDate(startedAt);
  const detail = typed
    ? `${group.model ?? "model not recorded"} · typed in by the maker`
    : [group.model ?? "model not recorded", `session ${group.number}`, date].filter(Boolean).join(" · ");
  return {
    kind: "new",
    tool: group.tool,
    model: group.model,
    session: typed ? null : group.number,
    date,
    startedAt,
    typed,
    headline: group.tool ? `New chat in ${group.tool}` : "New chat",
    detail,
  };
}

/* ── one step ── */

/** The step as readers get it: a suggestion the maker dismissed is the maker's, never published. */
function publicStep(step: Step): Step {
  const { dismissed: _dismissed, ...rest } = step;
  return { ...rest, children: step.children.map(publicStep) };
}

function readerStep(step: Step, context: Context, inside: boolean): ReaderStep {
  const container = inside || step.kind === "agent" || step.kind === "team";
  const here = context.index.get(step.id) ?? -1;
  const pasteIns: ReaderPasteIn[] = [];
  const attach: ReaderFile[] = [];
  const tools: ReaderTool[] = [];
  const uses: string[] = [];
  const madeIn: string[] = [];

  for (const use of step.uses) {
    if (use.kind === "output") {
      const from = context.byId.get(use.node_id);
      if (!from) continue;
      pasteIns.push({ stepId: from.id, number: from.number, title: stepTitle(from), text: `what step ${from.number} gave you` });
      if (isTop(from)) madeIn.push(from.number);
      const later = (context.index.get(from.id) ?? -1) > here;
      const times = from.runs?.how === "parallel" && typeof from.runs.count === "number" ? ` × ${from.runs.count}` : "";
      const label = isTop(from) ? `step ${from.number}` : from.number;
      uses.push(later ? `what ${label} sends back` : `what ${label} gives it${times}`);
    } else if (use.kind === "file") {
      const file = context.files.get(use.node_id);
      if (!file) continue;
      attach.push(file);
      uses.push(file.name);
    } else {
      const tool = context.tools.get(use.node_id);
      if (!tool) continue;
      tools.push(tool);
      uses.push(`${tool.name} · tool`);
    }
  }

  const isContainer = step.kind === "agent" || step.kind === "team";
  const startedAt = step.sessionId ? (context.sessions.get(step.sessionId)?.startedAt ?? null) : null;
  const lastRun = isContainer ? dateTime(startedAt) : null;

  let loop: string[] = [];
  if (step.runs?.how === "until" && !isTop(step)) {
    const targets = goesInto(context.topSteps, step.id).filter((target) => (context.index.get(target.id) ?? -1) < here);
    loop = targets.map((target) => (step.runs?.detail ? `${target.number}, until ${step.runs.detail}` : target.number));
    if (context.resultFrom.has(step.id)) loop.push("then the result");
  }

  return {
    step: publicStep(step),
    title: stepTitle(step),
    isDefaultTitle: step.title === null,
    chat: chatFor(step, context),
    pasteIns,
    attach,
    tools,
    uses: container ? uses : [],
    manual:
      step.kind === "manual"
        ? { headline: `By hand in ${step.tool ?? "another tool"}`, line: step.text, mediaId: step.mediaId ?? null }
        : null,
    runs: isContainer ? runsLabel(step.runs) : null,
    madeIn: isContainer && madeIn.length > 0 ? `made in ${stepList(madeIn, false)}` : null,
    runsByItself: lastRun ? `runs by itself · last run ${lastRun}` : null,
    goesInto: loop,
    children: step.children.map((child) => readerStep(child, context, container)),
  };
}

/**
 * The steps in order, each with what the reader does (CONCEPT §6). `making` is
 * `builds.making`; `media` holds the sizes and downloads of the files, by media
 * id, and is optional.
 */
export function readerSteps(
  tree: readonly NodeTree[],
  making: Making | null | undefined,
  media: ReadonlyMap<string, ReaderMedia> = new Map(),
): ReaderStep[] {
  const context = contextFor(tree, making, media);
  return context.topSteps.map((step) => readerStep(step, context, false));
}

/** The build's results, in order, for the last card and the end of Copy for AI. */
export function readerResults(tree: readonly NodeTree[], media: ReadonlyMap<string, ReaderMedia> = new Map()): ReaderResult[] {
  const steps = walk(buildSteps(tree));
  const numberOf = new Map(steps.map((step) => [step.id, step.number]));
  return tree
    .filter((node) => node.type === RESULT_TYPE && node.parent_id === null)
    .map((node) => {
      const from = (isRecord(node.payload) && Array.isArray(node.payload.uses) ? node.payload.uses : []).find(
        (use): use is { kind: string; node_id: string } => isRecord(use) && use.kind === "output" && typeof use.node_id === "string",
      );
      const mediaId = text(node, "media_id");
      const found = mediaId ? media.get(mediaId) : undefined;
      return {
        id: node.id,
        title: text(node, "summary") ?? text(node, "url") ?? "Result",
        url: text(node, "url") ?? (found ? mediaUrl(found, { width: "original" }) : null),
        mediaId,
        from: from ? (numberOf.get(from.node_id) ?? null) : null,
      };
    });
}

/* ── What you need ── */

const HOW_WORDS: Record<string, string> = {
  once: "Runs once",
  parallel: "Runs several at once",
  until: "Repeats until a condition is met",
  schedule: "On a schedule",
  event: "When something happens",
};

/** The agents a run starts: one for each, and several for one that runs several at once. */
function agentsPerRun(step: Step): number {
  const own = step.kind === "agent" ? (step.runs?.how === "parallel" && typeof step.runs.count === "number" ? step.runs.count : 1) : 0;
  return own + step.children.reduce((sum, child) => sum + agentsPerRun(child), 0);
}

/** Which steps use what: node id → step numbers, in step order. */
function usedBy(all: readonly Step[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const step of all) {
    for (const use of step.uses) out.set(use.node_id, [...(out.get(use.node_id) ?? []), step.number]);
  }
  return out;
}

/**
 * The column of what a reader needs (DATA §5, CONCEPT §6), each group left out
 * when it is empty: tools and models, files, how it runs, time, other parts.
 */
export function whatYouNeed(
  steps: readonly ReaderStep[],
  tree: readonly NodeTree[],
  making: Making | null | undefined,
  media: ReadonlyMap<string, ReaderMedia> = new Map(),
): NeedGroup[] {
  const context = contextFor(tree, making, media);
  const used = usedBy(context.all);
  const groups: NeedGroup[] = [];

  /* Tools and models */
  const tools: NeedRow[] = [];
  const byTool = new Map<string, { models: string[]; steps: string[]; named: boolean }>();
  for (const group of context.groups) {
    const key = group.tool ?? group.model ?? "";
    if (!key) continue;
    const entry = byTool.get(key) ?? { models: [], steps: [], named: Boolean(group.tool) };
    const model = group.tool ? group.model : null;
    if (model && !entry.models.includes(model)) entry.models.push(model);
    entry.steps.push(...group.stepNumbers);
    byTool.set(key, entry);
  }
  for (const [tool, entry] of byTool) {
    // A client with no label names no tool: the row is the model, with nothing to say about a tool.
    const model = entry.models.length > 0 ? join(entry.models) : "model not recorded";
    tools.push({ title: tool, detail: [entry.named ? model : null, stepList(entry.steps)].filter(Boolean).join(" · ") });
  }

  const byModel = new Map<string, string[]>();
  for (const step of context.all) {
    if (step.kind !== "agent" || !step.model) continue;
    const label = modelName(step.model);
    byModel.set(label, [...(byModel.get(label) ?? []), step.number]);
  }
  for (const [model, numbers] of byModel) tools.push({ title: model, detail: stepList(numbers) });

  for (const tool of context.tools.values()) {
    const numbers = used.get(tool.id) ?? [];
    tools.push({ title: tool.name, detail: numbers.length > 0 ? `tool · ${stepList(numbers)}` : "tool" });
  }
  for (const node of walkTree(tree)) {
    if (node.type !== PREREQUISITE_TYPE || node.is_gap) continue;
    const numbers = used.get(node.id) ?? [];
    tools.push({
      title: (node.title ?? "").trim() || "Prerequisite",
      detail: [text(node, "requirement"), stepList(numbers)].filter(Boolean).join(" · ") || "prerequisite",
    });
  }
  if (tools.length > 0) groups.push({ key: "tools", label: "Tools and models", rows: tools });

  /* Files */
  const files: NeedRow[] = [...context.files.values()].map((file) => ({
    title: file.name,
    detail: [stepList(used.get(file.id) ?? []), file.size].filter(Boolean).join(" · "),
    download: file.download,
  }));
  if (files.length > 0) groups.push({ key: "files", label: "Files", rows: files });

  /* How it runs */
  const runs: NeedRow[] = steps
    .filter((entry) => entry.step.kind === "agent" || entry.step.kind === "team")
    .map((entry) => {
      const how = entry.step.runs;
      const when = how?.how === "parallel" && how.count ? `${how.count} at once` : (how?.detail ?? null);
      const n = agentsPerRun(entry.step);
      return {
        title: HOW_WORDS[how?.how ?? "once"],
        detail: [when, `${n} ${n === 1 ? "agent" : "agents"} a run`].filter(Boolean).join(" · "),
      };
    });
  if (runs.length > 0) groups.push({ key: "runs", label: "How it runs", rows: runs });

  /* Time */
  const dated = (making?.sessions ?? []).map((session) => session.started_at).filter((iso): iso is string => Boolean(shortDate(iso)));
  if ((making?.sessions.length ?? 0) > 1 && dated.length > 1) {
    const stamps = dated.map((iso) => new Date(iso).getTime());
    const days = Math.round((Math.max(...stamps) - Math.min(...stamps)) / DAY_MS);
    const span = dateRange(dated);
    groups.push({
      key: "time",
      label: "Time",
      rows: [
        {
          title: `${making?.sessions.length} sessions ${days === 0 ? "in one day" : `over ${days} ${days === 1 ? "day" : "days"}`}`,
          detail: span ?? "",
        },
      ],
    });
  }

  /* Other parts */
  const handled = new Set<string>([PROMPT_TYPE, AGENT_TYPE, TEAM_TYPE, MANUAL_STEP_TYPE, FILE_TYPE, TOOL_TYPE, RESULT_TYPE, PREREQUISITE_TYPE]);
  const other: NeedRow[] = tree
    .filter((node) => node.parent_id === null && !handled.has(node.type) && !EVIDENCE_NODE_TYPES.has(node.type))
    .map((node) => ({ id: node.id, title: (node.title ?? "").trim() || node.type, detail: node.type }));
  if (other.length > 0) groups.push({ key: "other", label: "Other parts", rows: other });

  return groups;
}

function walkTree(tree: readonly NodeTree[], out: NodeTree[] = []): NodeTree[] {
  for (const node of tree) {
    out.push(node);
    walkTree(node.children ?? [], out);
  }
  return out;
}

const modelName = (raw: string): string => modelLabel(raw) || raw;

/* ── the heading ── */

/**
 * "4 sessions · 1 team · 4 agents · 6 prompts · 1 file · 3–6 Oct": zeros left
 * out, "1 prompt" for one. Prompts count each agent's own prompts too.
 */
export function buildCounts(steps: readonly ReaderStep[]): string {
  const flat: ReaderStep[] = [];
  const visit = (list: readonly ReaderStep[]) => {
    for (const entry of list) {
      flat.push(entry);
      visit(entry.children);
    }
  };
  visit(steps);

  const chats = flat.filter((entry): entry is ReaderStep & { chat: Extract<ReaderChat, { kind: "new" }> } => entry.chat?.kind === "new");
  const sessions = chats.filter((entry) => !entry.chat.typed).length;
  const teams = flat.filter((entry) => entry.step.kind === "team").length;
  const agents = flat.filter((entry) => entry.step.kind === "agent").length;
  const prompts = flat.filter((entry) => entry.step.kind === "prompt").length;
  const files = new Set(flat.flatMap((entry) => entry.attach.map((file) => file.id))).size;
  const span = dateRange(chats.map((entry) => entry.chat.startedAt));

  const part = (n: number, one: string, many: string) => (n > 0 ? `${n} ${n === 1 ? one : many}` : null);
  return [
    part(sessions, "session", "sessions"),
    part(teams, "team", "teams"),
    part(agents, "agent", "agents"),
    part(prompts, "prompt", "prompts"),
    part(files, "file", "files"),
    span,
  ]
    .filter(Boolean)
    .join(" · ");
}

/* ── Copy for AI ── */

/** A code fence longer than any run of backticks inside the text, so the text appears whole. */
function fenced(body: string): string {
  const longest = Math.max(2, ...(body.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longest + 1);
  return `${fence}\n${body}\n${fence}`;
}

function chatSentence(chat: ReaderChat): string {
  if (chat.kind === "same") return `${chat.text}.`;
  const where = chat.tool ? `New chat in ${chat.tool}` : "New chat";
  return chat.model ? `${where} (${chat.model}).` : `${where}.`;
}

function inputSentences(entry: ReaderStep): string[] {
  const out: string[] = [];
  for (const paste of entry.pasteIns) out.push(`Paste in what step ${paste.number} gave you (${paste.title}).`);
  for (const file of entry.attach) out.push(file.download ? `Attach ${file.name}: ${file.download}.` : `Attach ${file.name}.`);
  for (const tool of entry.tools) out.push(`Use ${tool.name}.`);
  return out;
}

function subSteps(entry: ReaderStep, lines: string[]): void {
  const children = entry.children;
  for (const child of children) {
    const instructions = child.step.id.endsWith(":instructions");
    const model = !instructions && child.step.model ? ` · ${modelName(child.step.model)}` : "";
    lines.push(`### ${child.step.number} ${child.title}${model}`, "");
    if (child.runs && child.step.runs) lines.push(`${child.runs}.`, "");
    if (child.uses.length > 0) lines.push(`Uses ${join(child.uses)}.`, "");
    if (child.goesInto.length > 0) lines.push(`Goes into ${child.goesInto.join(", ")}.`, "");
    if (child.step.text) lines.push(fenced(child.step.text), "");
    // An agent inside a team shows its instructions in its own row; what follows is its own prompts.
    const own = { ...child, children: child.children.filter((grand) => !grand.step.id.endsWith(":instructions")) };
    subSteps(own, lines);
  }
}

/**
 * The Copy for AI text: the whole build in order, each new chat and each
 * paste-in written out (CONCEPT §6). Download is `toPortable` and `toMarkdown`,
 * and they are not touched by this.
 */
export function stepsMarkdown(
  build: { title: string; outcome?: string | null; live_url?: string | null },
  steps: readonly ReaderStep[],
  results: readonly ReaderResult[] = [],
): string {
  const lines: string[] = [`# ${build.title}`, ""];
  if (build.outcome?.trim()) lines.push(build.outcome.trim(), "");
  lines.push(`Repeat this build in ${steps.length} ${steps.length === 1 ? "step" : "steps"}.`, "");

  for (const entry of steps) {
    const { step } = entry;
    lines.push(`## Step ${step.number} · ${entry.title}`, "");

    if (entry.manual) {
      lines.push(`${entry.manual.headline}: ${entry.manual.line}`.replace(/\.?$/, "."), "");
      continue;
    }
    if (step.kind === "agent" || step.kind === "team") {
      const how = [entry.runs, entry.madeIn].filter(Boolean).join(" · ");
      if (how) lines.push(`${how}.`, "");
      if (entry.uses.length > 0) lines.push(`Uses ${join(entry.uses)}.`, "");
      subSteps(entry, lines);
      continue;
    }
    if (entry.chat) lines.push(chatSentence(entry.chat), "");
    const inputs = inputSentences(entry);
    if (inputs.length > 0) lines.push(...inputs, "");
    if (step.text) lines.push(fenced(step.text), "");
  }

  lines.push("## Result", "");
  if (results.length === 0) lines.push(build.live_url ?? "No result is listed.", "");
  for (const result of results) {
    lines.push(`${result.url ?? result.title}${result.from ? ` (from step ${result.from})` : ""}`, "");
  }
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}
