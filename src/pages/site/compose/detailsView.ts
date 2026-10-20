/* UI-P66 — what is selected, as the Details panel's view of it.

   PURE. `selectedId` is whatever the List, the Sources panel or a chip handed
   to `onSelect`: a step's id, a session's key, or the id of a file, a tool or
   a result. Nothing is guessed: a field the build does not hold is left out,
   and a title the maker did not type stays the default. */

import { promptNodes, promptOrigin } from "@/lib/build/composePrompts";
import {
  FILE_TYPE,
  groupKey,
  groupKind,
  groupOfStep,
  madeByOf,
  madeFilesOf,
  RESULT_TYPE,
  stepTitle,
  TOOL_TYPE,
  toolConnectionOf,
  toolsUsedOf,
  type SessionGroup,
  type Step,
} from "@/lib/build/graph";
import type { SessionPrompt } from "@/lib/build/sessions";
import type { NodeTree } from "@/lib/build/types";
import { modelLabel } from "@/lib/models/registry";
import { toolFor } from "@/lib/tools/registry";

import {
  fileSize,
  goesIntoRows,
  inputOptions,
  insideCounts,
  makesRows,
  promptPlace,
  sessionNumberOf,
  textLabel,
  inputRows,
  usedBy,
  type ChecklistRow,
  type NamedPiece,
} from "./detailsModel";
import { readsOutsideContent } from "@/lib/build/outsideContent";
import { isSetupPayload, SETUP_KIND_LABEL, setupItemsOf, setupOfNode } from "@/lib/build/setup";
import type { AgentView, CheckView, CodeView, DetailsView, FileView, ManualView, PromptView, ResultView, SessionView, ToolView } from "./DetailsPanel";
import { lineCount } from "./codeModel";
import { shortDate, type SourceFile, type SourceSession } from "./sourcesModel";

export interface MediaFacts {
  name: string | null;
  bytes: number | null;
}

export interface ViewContext {
  selectedId: string | null;
  steps: readonly Step[];
  groups: readonly SessionGroup[];
  tree: readonly NodeTree[];
  sources: readonly SourceSession[];
  sourceFiles: readonly SourceFile[];
  /** A session's prompts once read, and whether reading them failed. */
  promptsState: (sessionId: string) => { prompts: readonly SessionPrompt[] | undefined; error: boolean };
  intoResult: ReadonlySet<string>;
  /** What is known of a stored file, by media id. */
  media: (mediaId: string) => MediaFacts | undefined;
}

/** Every step, and (CA-04 P2) every tile sent with one, parents first. */
const flatten = (steps: readonly Step[]): Step[] => steps.flatMap((step) => [step, ...flatten(step.children), ...flatten(step.sentWith ?? [])]);

/** CA-04 P2: what a tile inside another says in its eyebrow. */
const insideOf = (step: Step) => (step.inside ? { sentWithLine: `Sent with ${step.inside.label}` } : null);

/** A node at any depth. */
const findNode = (tree: readonly NodeTree[], id: string): NodeTree | null => {
  for (const node of tree) {
    if (node.id === id) return node;
    const inner = node.children?.length ? findNode(node.children, id) : null;
    if (inner) return inner;
  }
  return null;
};

const payloadOf = (node: Pick<NodeTree, "payload">): Record<string, unknown> =>
  node.payload && typeof node.payload === "object" && !Array.isArray(node.payload) ? (node.payload as Record<string, unknown>) : {};

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** The build's files and tools as the pieces a step may use. */
export function pieces(tree: readonly NodeTree[], files: readonly SourceFile[]): { files: NamedPiece[]; tools: NamedPiece[]; byId: Record<string, NamedPiece> } {
  const notes = new Map(files.map((file) => [file.id, file.note]));
  const fileRows: NamedPiece[] = [];
  const toolRows: NamedPiece[] = [];
  for (const node of tree) {
    // CA-04 P4: a session's setup is not a file or a tool a step uses.
    if (node.parent_id !== null || isSetupPayload(node.payload)) continue;
    const payload = payloadOf(node);
    if (node.type === FILE_TYPE) fileRows.push({ id: node.id, name: text(payload.title) || "Untitled file", note: `File · ${notes.get(node.id) ?? "added by you"}` });
    if (node.type === TOOL_TYPE) toolRows.push({ id: node.id, name: text(payload.service) || "Untitled tool", note: "Tool" });
  }
  const byId: Record<string, NamedPiece> = {};
  for (const piece of [...fileRows, ...toolRows]) byId[piece.id] = piece;
  return { files: fileRows, tools: toolRows, byId };
}

function promptView(step: Step, ctx: ViewContext, all: ReturnType<typeof pieces>): PromptView {
  const instructions = step.id.endsWith(":instructions");
  const group = groupOfStep(ctx.groups, step);
  const number = sessionNumberOf(step, ctx.groups);
  const tool = group?.tool ?? step.tool;
  const typed = !step.sessionId && !instructions;
  // CA-04 P1: a prompt typed into a session (one made here, or an imported one) reads as that session's.
  const inSession = Boolean(group) && groupKind(group as SessionGroup) !== "legacy";
  const model = step.model ? modelLabel(step.model) : null;
  const when = inSession && group ? shortDate(group.startedAt) : "";
  const place = promptPlace(step, ctx.steps);
  return {
    kind: "prompt",
    ...insideOf(step),
    id: step.id,
    number: step.number,
    title: step.title,
    defaultTitle: step.defaultTitle,
    editable: !instructions,
    sessionLine: instructions ? "Instructions" : typed && !inSession ? `Typed here${tool ? ` · ${tool}` : ""}` : [number ? `Session ${number}` : "Session", tool].filter(Boolean).join(" · "),
    detailLine: instructions ? "" : [model, when, place].filter(Boolean).join(" · "),
    typed,
    model,
    // CA-02 P8: the tool a typed prompt names, as saved, for its model menu and the note on a pair that breaks the rules.
    ...(typed ? { tool: step.tool } : null),
    text: step.text,
    words: step.words,
    ...(step.changes ? { changes: step.changes } : null),
    uses: instructions ? [] : inputRows(step, ctx.steps, ctx.groups, all.byId),
    options: instructions ? [] : inputOptions(step, ctx.steps, ctx.groups, all.files, all.tools, madeFilesOf(ctx.tree)),
    goesInto: instructions ? [] : goesIntoRows(ctx.steps, step.id, ctx.intoResult),
    makes: instructions ? [] : makesRows(step.id, ctx.tree),
  };
}

/** "Team 3 · Copy team" for the team an agent sits in; null for anything at the top level. */
function parentLine(id: string, steps: readonly Step[]): string | null {
  const team = steps.find((candidate) => candidate.kind === "team" && candidate.children.some((child) => child.id === id));
  return team ? `Team ${team.number} · ${stepTitle(team)}` : null;
}

function manualView(step: Step, ctx: ViewContext, all: ReturnType<typeof pieces>): ManualView {
  const facts = step.mediaId ? ctx.media(step.mediaId) : undefined;
  return {
    kind: "manual",
    ...insideOf(step),
    id: step.id,
    number: step.number,
    title: step.title,
    defaultTitle: step.defaultTitle,
    tool: step.tool ?? "",
    text: step.text,
    picture: step.mediaId ? { id: step.mediaId, name: facts?.name ?? "Picture" } : null,
    uses: inputRows(step, ctx.steps, ctx.groups, all.byId),
    options: inputOptions(step, ctx.steps, ctx.groups, all.files, all.tools, madeFilesOf(ctx.tree)),
    goesInto: goesIntoRows(ctx.steps, step.id, ctx.intoResult),
    makes: makesRows(step.id, ctx.tree),
  };
}

function codeView(step: Step, ctx: ViewContext, all: ReturnType<typeof pieces>): CodeView {
  return {
    kind: "code",
    ...insideOf(step),
    id: step.id,
    number: step.number,
    title: step.title,
    defaultTitle: step.defaultTitle,
    language: step.language ?? null,
    filename: step.filename ?? null,
    source: step.text,
    lines: lineCount(step.text),
    tool: step.tool,
    model: step.model ? modelLabel(step.model) : null,
    uses: inputRows(step, ctx.steps, ctx.groups, all.byId),
    options: inputOptions(step, ctx.steps, ctx.groups, all.files, all.tools, madeFilesOf(ctx.tree)),
    goesInto: goesIntoRows(ctx.steps, step.id, ctx.intoResult),
    makes: makesRows(step.id, ctx.tree),
  };
}

/** CA-03 P5: a check: what it tested, what counts as passing, when it failed, and its runs. */
function checkView(step: Step, ctx: ViewContext, all: ReturnType<typeof pieces>): CheckView {
  return {
    kind: "check",
    ...insideOf(step),
    id: step.id,
    number: step.number,
    title: step.title,
    defaultTitle: step.defaultTitle,
    check: step.check ?? { tested: step.text, passing: "", onFail: null, passed: null, total: null, runAt: null },
    uses: inputRows(step, ctx.steps, ctx.groups, all.byId),
    options: inputOptions(step, ctx.steps, ctx.groups, all.files, all.tools, madeFilesOf(ctx.tree)),
    goesInto: goesIntoRows(ctx.steps, step.id, ctx.intoResult),
  };
}

function agentView(step: Step, ctx: ViewContext, all: ReturnType<typeof pieces>): AgentView {
  return {
    kind: step.kind === "team" ? "team" : "agent",
    ...insideOf(step),
    id: step.id,
    number: step.number,
    name: step.title,
    defaultName: step.defaultTitle,
    model: step.model ? modelLabel(step.model) : null,
    runs: step.runs,
    uses: inputRows(step, ctx.steps, ctx.groups, all.byId),
    options: inputOptions(step, ctx.steps, ctx.groups, all.files, all.tools, madeFilesOf(ctx.tree)),
    goesInto: goesIntoRows(ctx.steps, step.id, ctx.intoResult),
    inside: insideCounts(step),
    ...(groupOfStep(ctx.groups, step)?.goal ? { sessionGoal: true } : null),
    instructions: step.kind === "agent" ? step.text : "",
    parent: parentLine(step.id, ctx.steps),
    // CA-02 P5: what it ran in, its models and its tools, as the setup controls hold them.
    ...(step.kind === "agent"
      ? {
          setup: {
            harness: step.harness ?? null,
            models: step.models && step.models.length > 1 ? step.models.map((row) => ({ ...row })) : [{ model: step.model, role: "main" }],
            tools: (step.toolRefs ?? []).map((ref) => all.byId[ref]?.name).filter((name): name is string => Boolean(name)),
            ...(step.memory ? { memory: step.memory } : null),
          },
          // CA-03 P7: the tools it can use that read content it doesn't control.
          outside: readsOutsideContent(step, ctx.tree),
        }
      : null),
    // An agent's instructions are its own row; only what can be taken out is listed.
    insideRows: step.children.filter((child) => !child.id.endsWith(":instructions")).map((child) => ({ id: child.id, label: `${child.number} · ${stepTitle(child)}` })),
  };
}

function sessionView(source: SourceSession, ctx: ViewContext): SessionView {
  const group = ctx.groups.find((candidate) => groupKey(candidate) === source.key);
  const real = !source.key.startsWith("typed-");
  const mine = flatten(ctx.steps).filter((step) => step.kind === "prompt" && !step.id.endsWith(":instructions") && (real ? step.sessionId === source.key : source.prompts.some((p) => p.id === step.id)));

  let checklist: ChecklistRow[];
  let total: number | null;
  let status: SessionView["status"] = "ready";
  if (real) {
    const state = ctx.promptsState(source.key);
    const added = new Map<number, string>();
    for (const node of promptNodes(ctx.tree)) {
      const origin = promptOrigin(node);
      if (origin?.importSessionId === source.key) added.set(origin.index, node.id);
    }
    status = state.error ? "error" : state.prompts ? "ready" : "loading";
    checklist = (state.prompts ?? []).map((prompt) => {
      const stepId = added.get(prompt.sourceRef.index) ?? null;
      const step = stepId ? mine.find((candidate) => candidate.id === stepId) : undefined;
      return { ordinal: prompt.ordinal, label: step?.title ?? textLabel(prompt.text), stepId };
    });
    total = state.prompts ? state.prompts.length : null;
  } else {
    checklist = mine.map((step, at) => ({ ordinal: at, label: stepTitle(step), stepId: step.id }));
    total = mine.length;
  }
  const [model, ...rest] = (group ? [group.model ?? ""] : source.detail.split(" · ")) as string[];
  return {
    kind: "session",
    key: source.key,
    number: source.number,
    tool: group?.tool ?? source.tool,
    ...(source.pickTool ? { pickTool: source.pickTool } : null),
    model: model || "",
    date: group ? (groupKind(group) !== "legacy" ? shortDate(group.startedAt) : "") : rest.join(" · "),
    inBuild: checklist.filter((row) => row.stepId !== null).length,
    total,
    status,
    checklist,
    // CA-04 P6: what it worked until.
    ...(group?.goal ? { goal: group.goal } : null),
    // CA-05: cost, background and the rest.
    ...(group?.extras ? { extras: group.extras } : null),
    // CA-04 P4: its setup, in the order it was added.
    setup: setupItemsOf(ctx.tree, source.key).map((item) => ({ id: item.id, kind: SETUP_KIND_LABEL[item.kind], name: item.name, description: item.description, notShared: item.notShared })),
    // CA-04 P1: a session made here, or an old build's typed prompts, can have its tool and day changed.
    ...(group && !real
      ? { editable: { tool: group.tool ? (toolFor(group.tool)?.id ?? group.tool) : null, date: groupKind(group) === "typed" ? (group.startedAt ?? "") : "" } }
      : null),
  };
}

function fileView(node: NodeTree, ctx: ViewContext): FileView {
  const payload = payloadOf(node);
  const mediaId = text(payload.media_id);
  const facts = mediaId ? ctx.media(mediaId) : undefined;
  const source = ctx.sourceFiles.find((file) => file.id === node.id);
  // A file a step makes is made by running the step: it has nothing to download.
  const maker = madeByOf(node);
  const number = maker ? flatten(ctx.steps).find((step) => step.id === maker)?.number : undefined;
  return {
    kind: "file",
    id: node.id,
    name: text(payload.title) || "Untitled file",
    from: number ? `Made in step ${number}` : (source?.note ?? "added by you"),
    size: fileSize(facts?.bytes),
    canDownload: !maker && Boolean(mediaId || text(payload.url)),
    usedBy: usedBy(ctx.steps, { kind: "file", node_id: node.id }),
  };
}

function toolView(node: NodeTree, ctx: ViewContext): ToolView {
  const payload = payloadOf(node);
  return {
    kind: "tool",
    id: node.id,
    service: text(payload.service) || "Untitled tool",
    scopes: text(payload.scopes),
    usedBy: usedBy(ctx.steps, { kind: "tool", node_id: node.id }),
    // CA-04 P5: how it was connected, and the tools it was seen calling.
    ...toolConnectionOf(node),
    toolsUsed: toolsUsedOf(node),
  };
}

function resultView(node: NodeTree, ctx: ViewContext): ResultView {
  const payload = payloadOf(node);
  const mediaId = text(payload.media_id);
  const facts = mediaId ? ctx.media(mediaId) : undefined;
  return {
    kind: "result",
    id: node.id,
    summary: text(payload.summary),
    url: text(payload.url),
    pictures: mediaId ? [{ id: mediaId, name: facts?.name ?? "Picture" }] : [],
  };
}

/** CA-04 P4: a setup item: its file, its server as a tool, or its rule as the code it runs, named in its eyebrow. */
function setupView(node: NodeTree, ctx: ViewContext): DetailsView | null {
  const [item] = setupItemsOf([node]);
  if (!item) return null;
  const eyebrow = `Setup · ${SETUP_KIND_LABEL[item.kind]}`;
  if (node.type === FILE_TYPE) return { ...fileView(node, ctx), name: item.name === "Skill" ? fileView(node, ctx).name : item.name, sentWithLine: eyebrow };
  if (node.type === TOOL_TYPE) return toolView(node, ctx);
  if (!item.rule) return null;
  return {
    kind: "code",
    id: node.id,
    number: "",
    title: node.title,
    defaultTitle: item.rule.when || "Rule",
    sentWithLine: [eyebrow, item.rule.when, item.rule.filter].filter(Boolean).join(" · "),
    language: "bash",
    filename: null,
    source: item.rule.command,
    lines: lineCount(item.rule.command),
    tool: null,
    model: null,
    uses: [],
    options: [],
    goesInto: [],
    makes: [],
  };
}

/** The view of what is selected, or null when nothing is, or what was selected is gone. */
export function resolveView(ctx: ViewContext): DetailsView | null {
  const id = ctx.selectedId;
  if (!id) return null;
  const all = pieces(ctx.tree, ctx.sourceFiles as SourceFile[]);

  // CA-04 P4: a setup item opens as a file, a tool or its rule does.
  const setupNode = ctx.tree.find((candidate) => candidate.id === id && candidate.parent_id === null && setupOfNode(candidate));
  if (setupNode) return setupView(setupNode, ctx);

  const step = flatten(ctx.steps).find((candidate) => candidate.id === id);
  if (step?.kind === "file") {
    const node = findNode(ctx.tree, id);
    return node ? { ...fileView(node, ctx), ...insideOf(step) } : null;
  }
  if (step) {
    if (step.kind === "prompt") return promptView(step, ctx, all);
    if (step.kind === "agent" || step.kind === "team") return agentView(step, ctx, all);
    if (step.kind === "code") return codeView(step, ctx, all);
    if (step.kind === "check") return checkView(step, ctx, all);
    return manualView(step, ctx, all);
  }
  const source = ctx.sources.find((candidate) => candidate.key === id);
  if (source) return sessionView(source, ctx);

  const node = ctx.tree.find((candidate) => candidate.id === id && candidate.parent_id === null);
  if (node?.type === FILE_TYPE) return fileView(node, ctx);
  if (node?.type === TOOL_TYPE) return toolView(node, ctx);
  if (node?.type === RESULT_TYPE) return resultView(node, ctx);
  return null;
}
