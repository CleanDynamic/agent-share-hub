/* UI-P66 — what is selected, as the Details panel's view of it.

   PURE. `selectedId` is whatever the List, the Sources panel or a chip handed
   to `onSelect`: a step's id, a session's key, or the id of a file, a tool or
   a result. Nothing is guessed: a field the build does not hold is left out,
   and a title the maker did not type stays the default. */

import { promptNodes, promptOrigin } from "@/lib/build/composePrompts";
import {
  FILE_TYPE,
  RESULT_TYPE,
  stepTitle,
  TOOL_TYPE,
  type SessionGroup,
  type Step,
} from "@/lib/build/graph";
import type { SessionPrompt } from "@/lib/build/sessions";
import type { NodeTree } from "@/lib/build/types";
import { modelLabel } from "@/lib/models/registry";

import {
  fileSize,
  goesIntoRows,
  inputOptions,
  insideCounts,
  promptPlace,
  sessionNumberOf,
  textLabel,
  inputRows,
  usedBy,
  type ChecklistRow,
  type NamedPiece,
} from "./detailsModel";
import type { AgentView, DetailsView, FileView, PromptView, ResultView, SessionView, ToolView } from "./DetailsPanel";
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

const flatten = (steps: readonly Step[]): Step[] => steps.flatMap((step) => [step, ...flatten(step.children)]);

const payloadOf = (node: Pick<NodeTree, "payload">): Record<string, unknown> =>
  node.payload && typeof node.payload === "object" && !Array.isArray(node.payload) ? (node.payload as Record<string, unknown>) : {};

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** The build's files and tools as the pieces a step may use. */
export function pieces(tree: readonly NodeTree[], files: readonly SourceFile[]): { files: NamedPiece[]; tools: NamedPiece[]; byId: Record<string, NamedPiece> } {
  const notes = new Map(files.map((file) => [file.id, file.note]));
  const fileRows: NamedPiece[] = [];
  const toolRows: NamedPiece[] = [];
  for (const node of tree) {
    if (node.parent_id !== null) continue;
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
  const group = step.sessionId
    ? ctx.groups.find((candidate) => candidate.sessionId === step.sessionId)
    : ctx.groups.find((candidate) => candidate.sessionId === null && candidate.stepNumbers.includes(step.number));
  const number = sessionNumberOf(step, ctx.groups);
  const tool = group?.tool ?? step.tool;
  const typed = !step.sessionId && !instructions;
  const model = step.model ? modelLabel(step.model) : null;
  const when = group?.sessionId ? shortDate(group.startedAt) : "";
  const place = promptPlace(step, ctx.steps);
  return {
    kind: "prompt",
    id: step.id,
    number: step.number,
    title: step.title,
    defaultTitle: step.defaultTitle,
    editable: !instructions,
    sessionLine: instructions ? "Instructions" : typed ? `Typed here${tool ? ` · ${tool}` : ""}` : [number ? `Session ${number}` : "Session", tool].filter(Boolean).join(" · "),
    detailLine: instructions ? "" : [model, when, place].filter(Boolean).join(" · "),
    typed,
    model,
    text: step.text,
    words: step.words,
    uses: instructions ? [] : inputRows(step, ctx.steps, ctx.groups, all.byId),
    options: instructions ? [] : inputOptions(step, ctx.steps, ctx.groups, all.files, all.tools),
    goesInto: instructions ? [] : goesIntoRows(ctx.steps, step.id, ctx.intoResult),
  };
}

function agentView(step: Step, ctx: ViewContext, all: ReturnType<typeof pieces>): AgentView {
  return {
    kind: step.kind === "team" ? "team" : "agent",
    id: step.id,
    number: step.number,
    name: step.title,
    defaultName: step.defaultTitle,
    model: step.model ? modelLabel(step.model) : null,
    runs: step.runs,
    uses: inputRows(step, ctx.steps, ctx.groups, all.byId),
    options: inputOptions(step, ctx.steps, ctx.groups, all.files, all.tools),
    goesInto: goesIntoRows(ctx.steps, step.id, ctx.intoResult),
    inside: insideCounts(step),
    // An agent's instructions are its own row; only what can be taken out is listed.
    insideRows: step.children.filter((child) => !child.id.endsWith(":instructions")).map((child) => ({ id: child.id, label: `${child.number} · ${stepTitle(child)}` })),
  };
}

function sessionView(source: SourceSession, ctx: ViewContext): SessionView {
  const group = ctx.groups.find((candidate) => (candidate.sessionId ?? `typed-${candidate.number}`) === source.key);
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
    model: model || "",
    date: group ? (group.sessionId ? shortDate(group.startedAt) : "") : rest.join(" · "),
    inBuild: checklist.filter((row) => row.stepId !== null).length,
    total,
    status,
    checklist,
  };
}

function fileView(node: NodeTree, ctx: ViewContext): FileView {
  const payload = payloadOf(node);
  const mediaId = text(payload.media_id);
  const facts = mediaId ? ctx.media(mediaId) : undefined;
  const source = ctx.sourceFiles.find((file) => file.id === node.id);
  return {
    kind: "file",
    id: node.id,
    name: text(payload.title) || "Untitled file",
    from: source?.note ?? "added by you",
    size: fileSize(facts?.bytes),
    canDownload: Boolean(mediaId || text(payload.url)),
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

/** The view of what is selected, or null when nothing is, or what was selected is gone. */
export function resolveView(ctx: ViewContext): DetailsView | null {
  const id = ctx.selectedId;
  if (!id) return null;
  const all = pieces(ctx.tree, ctx.sourceFiles as SourceFile[]);

  const step = flatten(ctx.steps).find((candidate) => candidate.id === id);
  if (step) {
    if (step.kind === "prompt") return promptView(step, ctx, all);
    if (step.kind === "agent" || step.kind === "team") return agentView(step, ctx, all);
    return null; // a manual step: UI-P70
  }
  const source = ctx.sources.find((candidate) => candidate.key === id);
  if (source) return sessionView(source, ctx);

  const node = ctx.tree.find((candidate) => candidate.id === id && candidate.parent_id === null);
  if (node?.type === FILE_TYPE) return fileView(node, ctx);
  if (node?.type === TOOL_TYPE) return toolView(node, ctx);
  if (node?.type === RESULT_TYPE) return resultView(node, ctx);
  return null;
}
