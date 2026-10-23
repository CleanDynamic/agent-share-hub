// referenceHistory: one undo history for every colour and link action (CA-19 P2). PURE.
//
// WHAT A STEP IS. Every colour or link action is one step: link, unlink, move and replace; set or clear a single colour;
// make, add to or remove from a group; rename, recolour, notes, order; merge, delete group and clear all. A step holds what
// changed in the thread's ref marks (`refs`) and in the stored colours and groups (`colours`), before and after, so undo
// and redo put both back exactly.
//
// SIZE AND LIFE. Up to 50 steps, kept for the visit. A reload starts empty, and everything is already saved.
//
// KEPT APART FROM THE EDITOR'S UNDO. The composer applies link changes with `addToHistory: false`, so Ctrl or Cmd Z in the
// post's text still undoes typing only. The positions a step holds are the editor's; every other edit of the post moves
// them (`mapHistory`), as the editor's own history does.
//
// Undo takes a step off `done`, applies its inverse, and puts the inverse (positions as they now are) on `undone`; redo
// does the same the other way. Nothing here touches the editor or the database: the hook does (useReferenceHistory).

import type { ColourWrites } from "./referenceGroups";
import type { RefRun } from "./linkRules";

export const HISTORY_LIMIT = 50;

/** One change to the post's ref marks, in the editor's positions after the step. */
export type RefChange =
  /** The links in a region, before and after. */
  | { kind: "runs"; from: number; to: number; before: RefRun[]; after: RefRun[] }
  /** Words written in (a target's name with nothing highlighted). `content` is the inserted fragment's JSON. */
  | { kind: "insert"; at: number; size: number; content: unknown }
  /** The same words taken out again: what undoing an insert leaves, so redo can write them back. */
  | { kind: "remove"; at: number; size: number; content: unknown };

export interface HistoryStep {
  /** The notice's sentence. */
  sentence: string;
  colours?: { writes: ColourWrites; undo: ColourWrites };
  refs?: RefChange[];
}

export interface ReferenceHistory {
  done: HistoryStep[];
  undone: HistoryStep[];
}

export const EMPTY_HISTORY: ReferenceHistory = { done: [], undone: [] };

/** A new step: on top of `done`, the oldest dropped past 50, and nothing left to redo. */
export function record(history: ReferenceHistory, step: HistoryStep): ReferenceHistory {
  return { done: [...history.done, step].slice(-HISTORY_LIMIT), undone: [] };
}

export const canUndo = (history: ReferenceHistory): boolean => history.done.length > 0;
export const canRedo = (history: ReferenceHistory): boolean => history.undone.length > 0;

/** The step to undo, and the history without it. */
export function takeUndo(history: ReferenceHistory): { history: ReferenceHistory; step: HistoryStep } | null {
  const step = history.done.at(-1);
  return step ? { history: { done: history.done.slice(0, -1), undone: history.undone }, step } : null;
}

/** The step to redo, and the history without it. */
export function takeRedo(history: ReferenceHistory): { history: ReferenceHistory; step: HistoryStep } | null {
  const step = history.undone.at(-1);
  return step ? { history: { done: history.done, undone: history.undone.slice(0, -1) }, step } : null;
}

/** After an undo: its inverse waits on `undone`. */
export const afterUndo = (history: ReferenceHistory, inverse: HistoryStep): ReferenceHistory => ({ done: history.done, undone: [...history.undone, inverse].slice(-HISTORY_LIMIT) });

/** After a redo: its inverse goes back on `done`, and what is left to redo stays. */
export const afterRedo = (history: ReferenceHistory, inverse: HistoryStep): ReferenceHistory => ({ done: [...history.done, inverse].slice(-HISTORY_LIMIT), undone: history.undone });

/** A step's colours the other way round: what undo writes is what redo undoes. */
export function invertColours(step: HistoryStep): HistoryStep["colours"] {
  return step.colours ? { writes: step.colours.undo, undo: step.colours.writes } : undefined;
}

/** Moves a position the way the editor's edits moved the text. `assoc` is ProseMirror's: -1 keeps to the left, 1 to the right. */
export type PositionMap = (pos: number, assoc?: number) => number;

function mapRun(run: RefRun, map: PositionMap): RefRun {
  return { ...run, from: map(run.from, 1), to: map(run.to, -1) };
}

function mapChange(change: RefChange, map: PositionMap): RefChange {
  if (change.kind === "runs") {
    return {
      ...change,
      from: map(change.from, 1),
      to: Math.max(map(change.from, 1), map(change.to, -1)),
      before: change.before.map((run) => mapRun(run, map)).filter((run) => run.to > run.from),
      after: change.after.map((run) => mapRun(run, map)).filter((run) => run.to > run.from),
    };
  }
  if (change.kind === "insert") {
    const at = map(change.at, 1);
    return { ...change, at, size: Math.max(0, map(change.at + change.size, -1) - at) };
  }
  return { ...change, at: map(change.at, -1) };
}

/** Every step's positions moved through an edit of the post. */
export function mapHistory(history: ReferenceHistory, map: PositionMap): ReferenceHistory {
  const each = (step: HistoryStep): HistoryStep => (step.refs ? { ...step, refs: step.refs.map((change) => mapChange(change, map)) } : step);
  return { done: history.done.map(each), undone: history.undone.map(each) };
}

/* ── the notice's sentences ── */

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const NOTICE_COPY = {
  linked: (words: string, name: string) => `Linked "${words}" to ${name}`,
  moved: (name: string) => `Moved the link to ${name}`,
  removed: "Removed the link",
  pointsAt: (name: string) => `The link now points at ${name}`,
  removedExtra: (n: number) => `Removed ${plural(n, "extra link", "extra links")}`,
  added: (member: string, group: string) => `Added ${member} to ${group}`,
  removedFrom: (member: string, group: string) => `Removed ${member} from ${group}`,
  deleted: (group: string) => `Deleted ${group}`,
  merged: (from: string, into: string) => `Merged ${from} into ${into}`,
  cleared: (links: number, colours: number) => `Cleared ${plural(links, "link", "links")} and ${plural(colours, "colour", "colours")}`,
  coloured: (name: string, hex: string) => `Coloured ${name} ${hex}`,
  uncoloured: (name: string) => `Took the colour off ${name}`,
  madeGroup: (group: string) => `Made the group ${group}`,
  madeGroupOf: (a: string, b: string) => `Made a group of ${a} and ${b}`,
  savedGroup: (group: string) => `Saved ${group}`,
  renamed: (group: string) => `Renamed the group to ${group}`,
  recoloured: (group: string, hex: string) => `Changed ${group} to ${hex}`,
  notes: (group: string) => `Changed the notes of ${group}`,
  ordered: "Changed the order",
  folded: (group: string, member: string) => `${group} had one component left, so ${member} keeps its colour`,
  trimmed: (group: string) => `Took a deleted component out of ${group}`,
  undo: "Undo",
  redo: "Redo",
  /** A group with no name, wherever a sentence names it. */
  noName: "No name",
} as const;

/** How long the notice stays. */
export const NOTICE_MS = 6000;
