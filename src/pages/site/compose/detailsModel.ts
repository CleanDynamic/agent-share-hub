/* UI-P66 — what the Details panel draws, from the steps the build already has.

   PURE. `buildSteps` and `sessionGroups` (UI-P62) give the steps and their
   numbers; this works out the rows that need more than one step to decide:
   the inputs a step uses, the ones it may add (DATA §3), where its work goes,
   and the five ways an agent runs (CONCEPT §3). */

import {
  goesInto,
  inputRefusal,
  madeFileNamesOf,
  madeFilesOf,
  RUNS_COUNT_MAX,
  RUNS_COUNT_MIN,
  stepTitle,
  UNTIL_DETAIL_MAX,
  WHEN_DETAIL_MAX,
  type RunsHow,
  type SessionGroup,
  type Step,
  type Use,
} from "@/lib/build/graph";
import type { NodeTree } from "@/lib/build/types";

/** Rows shown in any list before "Show {n} more" (CONCEPT §7). */
export const DETAILS_ROWS = 6;

/** The field a way of running needs, if it needs one. */
export type RunsField =
  | { kind: "count"; label: string; min: number; max: number }
  | { kind: "text"; label: string; max: number; placeholder: string };

export interface RunsChoice {
  how: RunsHow;
  label: string;
  field: RunsField | null;
}

/** CONCEPT §3: five choices, in this order. */
export const RUNS_CHOICES: readonly RunsChoice[] = [
  { how: "once", label: "Runs once", field: null },
  { how: "parallel", label: "Runs several at once", field: { kind: "count", label: "How many", min: RUNS_COUNT_MIN, max: RUNS_COUNT_MAX } },
  { how: "until", label: "Repeats until a condition is met", field: { kind: "text", label: "The condition", max: UNTIL_DETAIL_MAX, placeholder: "until every claim has a source" } },
  { how: "schedule", label: "Runs on a schedule", field: { kind: "text", label: "When", max: WHEN_DETAIL_MAX, placeholder: "Mondays 07:00" } },
  { how: "event", label: "Runs when something happens", field: { kind: "text", label: "What", max: WHEN_DETAIL_MAX, placeholder: "When a new email arrives" } },
];

/** "3 at once", for the count beside the number field. */
export const atOnce = (count: number): string => `${count} at once`;

/** A name for a file, tool or result row: the node's text fields. */
export interface NamedPiece {
  id: string;
  name: string;
  /** "File · opened in session 2" and the like, under the name. */
  note: string;
}

/** One input a step uses, as a row. */
export interface UseRow {
  use: Use;
  label: string;
  sub: string;
}

/** One input a step may add. */
export interface InputOption extends UseRow {
  key: string;
}

export interface GoesRow {
  id: string;
  label: string;
}

const flatten = (steps: readonly Step[]): Step[] => steps.flatMap((step) => [step, ...flatten(step.children)]);

/** The agent's instructions are drawn from the agent's own row and are not a step of their own. */
const isInstructions = (step: Pick<Step, "id">): boolean => step.id.endsWith(":instructions");

const keyOf = (use: Use): string => `${use.kind}:${use.node_id}`;

/** The step that holds `id` as a child, if it is one. */
function parentOf(steps: readonly Step[], id: string): Step | undefined {
  return steps.find((step) => step.children.some((child) => child.id === id));
}

/** The session number a step belongs to, when it has one. */
export function sessionNumberOf(step: Step, groups: readonly SessionGroup[]): number | null {
  const group = step.sessionId
    ? groups.find((candidate) => candidate.sessionId === step.sessionId)
    : groups.find((candidate) => candidate.sessionId === null && candidate.stepNumbers.includes(step.number));
  return group?.number ?? null;
}

/** An input a step has, as a row: "Output of 1" over "Homepage copy · Session 2". */
export function inputRow(use: Use, steps: readonly Step[], groups: readonly SessionGroup[], pieces: Readonly<Record<string, NamedPiece>>): UseRow | null {
  if (use.kind === "output") {
    const from = flatten(steps).find((step) => step.id === use.node_id);
    if (!from) return null;
    const session = sessionNumberOf(from, groups);
    return { use, label: `Output of ${from.number}`, sub: [stepTitle(from), session ? `Session ${session}` : null].filter(Boolean).join(" · ") };
  }
  const piece = pieces[use.node_id];
  return piece ? { use, label: piece.name, sub: piece.note } : null;
}

/** The inputs a step lists, in order; one whose target is gone is left out. */
export function inputRows(step: Step, steps: readonly Step[], groups: readonly SessionGroup[], pieces: Readonly<Record<string, NamedPiece>>): UseRow[] {
  return step.uses.flatMap((use) => {
    const row = inputRow(use, steps, groups, pieces);
    return row ? [row] : [];
  });
}

/**
 * What a step may add as an input (DATA §3): the outputs of earlier steps, the
 * build's files and its tools. Never itself, its own container, or what it
 * already lists. A later step's output is offered only when that step sits in
 * the same agent or team and its runs is "until" (a checker sending work back).
 * A file a step makes is offered only to the steps it may go into.
 */
export function inputOptions(
  step: Step,
  steps: readonly Step[],
  groups: readonly SessionGroup[],
  files: readonly NamedPiece[],
  tools: readonly NamedPiece[],
  made: ReadonlyMap<string, string> = new Map(),
): InputOption[] {
  const all = flatten(steps).filter((candidate) => !isInstructions(candidate));
  const at = all.findIndex((candidate) => candidate.id === step.id);
  const taken = new Set(step.uses.map(keyOf));
  const mine = parentOf(steps, step.id);
  const out: InputOption[] = [];

  all.forEach((from, index) => {
    if (from.id === step.id) return;
    // A step does not take in the agent or team that holds it.
    if (mine && from.id === mine.id) return;
    if (index > at) {
      const sameContainer = Boolean(mine) && parentOf(steps, from.id) === mine;
      if (!sameContainer || from.runs?.how !== "until") return;
    }
    const use: Use = { kind: "output", node_id: from.id };
    if (taken.has(keyOf(use))) return;
    const session = sessionNumberOf(from, groups);
    out.push({ key: keyOf(use), use, label: `Output of ${from.number}`, sub: [stepTitle(from), session ? `Session ${session}` : null].filter(Boolean).join(" · ") });
  });
  for (const file of files) {
    const use: Use = { kind: "file", node_id: file.id };
    if (taken.has(keyOf(use))) continue;
    const maker = made.get(file.id);
    if (maker) {
      if (inputRefusal(step.id, [], use, steps, made) !== null) continue;
      const number = all.find((candidate) => candidate.id === maker)?.number;
      out.push({ key: keyOf(use), use, label: file.name, sub: number ? `made in step ${number}` : file.note });
      continue;
    }
    out.push({ key: keyOf(use), use, label: file.name, sub: file.note });
  }
  for (const tool of tools) {
    const use: Use = { kind: "tool", node_id: tool.id };
    if (!taken.has(keyOf(use))) out.push({ key: keyOf(use), use, label: tool.name, sub: tool.note });
  }
  return out;
}

/** Where a step's work goes: its derived "Goes into" rows (DATA §3), with the result when it feeds one. */
export function goesIntoRows(steps: readonly Step[], id: string, intoResult: ReadonlySet<string>): GoesRow[] {
  const rows = goesInto(steps, id).map((step) => ({ id: step.id, label: `${step.number} · ${stepTitle(step)}` }));
  if (intoResult.has(id)) rows.push({ id: "result", label: "Result" });
  return rows;
}

/** The first `shown` rows, and how many are held back. */
export function firstRows<T>(rows: readonly T[], shown = DETAILS_ROWS): { visible: T[]; hidden: number } {
  return { visible: rows.slice(0, shown), hidden: Math.max(0, rows.length - shown) };
}

/** "3 prompts", "1 agent": what is inside an agent or a team. */
export function insideCounts(step: Pick<Step, "kind" | "children">): string {
  const count = step.kind === "agent" ? step.children.filter((child) => !isInstructions(child)).length : step.children.length;
  const noun = step.kind === "agent" ? (count === 1 ? "prompt" : "prompts") : count === 1 ? "agent" : "agents";
  return `${count} ${noun}`;
}

/** "prompt 2 of 5": a prompt's place among the build's prompts. */
export function promptPlace(step: Step, steps: readonly Step[]): string {
  const prompts = flatten(steps).filter((candidate) => candidate.kind === "prompt" && !isInstructions(candidate));
  const at = prompts.findIndex((candidate) => candidate.id === step.id);
  return at < 0 ? "" : `prompt ${at + 1} of ${prompts.length}`;
}

/** One line of a session's checklist. */
export interface ChecklistRow {
  ordinal: number;
  /** The prompt's title if it is in the build, else the start of its text. */
  label: string;
  /** The step that has it, when ticked. */
  stepId: string | null;
}

/** The start of a prompt's text as a checklist label. */
export function textLabel(text: string, max = 60): string {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** "{n} B", "{n} KB", "{n.n} MB". */
export function fileSize(bytes: number | null | undefined): string | null {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The steps that name a file, a tool or an output in their uses, as "Used by" rows. */
export function usedBy(steps: readonly Step[], use: Use): GoesRow[] {
  return flatten(steps)
    .filter((step) => !isInstructions(step) && step.uses.some((entry) => keyOf(entry) === keyOf(use)))
    .map((step) => ({ id: step.id, label: `${step.number} · ${stepTitle(step)}` }));
}

/** A file a step makes, as a row of its Makes list. */
export interface MakesRow {
  id: string;
  name: string;
}

/** The files `stepId` makes, in the order the build holds them. */
export function makesRows(stepId: string, tree: readonly NodeTree[]): MakesRow[] {
  const names = madeFileNamesOf(tree);
  return [...madeFilesOf(tree)].filter(([, maker]) => maker === stepId).map(([id]) => ({ id, name: names.get(id) ?? "Untitled file" }));
}
