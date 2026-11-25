/* Prompt 23: the editor on a phone, its words and the pure parts of what it draws.

   The phone editor is one screen: the build list. What a mouse or a keyboard did on a computer is a touch here, and the words
   that are new to the phone live in `PHONE_EDITOR_COPY`. Everything else (the checklist's words, the history's sentences, the
   drop line's "Lands here") is the repo's own and is read from where it lives. */

import type { MobileIconName } from "@/components/brand/mobileIcons";
import type { Checklist, ChecklistItem } from "@/lib/build/publishChecklist";
import type { StepKind } from "@/lib/build/graph";

export const PHONE_EDITOR_COPY = {
  /** The choosing bar's count: "2 chosen". */
  chosen: (count: number): string => `${count} chosen`,
  move: "Move",
  group: "Group",
  colour: "Colour",
  duplicate: "Duplicate",
  remove: "Remove",
  /** The Move sheet's title. */
  moveTo: "Move to",
  /** Sources. */
  sources: "Sources",
  sessionsIn: "Sessions in this build",
  filesIn: "Files in this build",
  chooseFile: "Choose a file",
  importFile: "Import",
  addAtEnd: (session: number): string => `Add Session ${session} at the end`,
  noSessions: "No sessions yet.",
  noFiles: "No files yet.",
  /** The views. */
  list: "List",
  map: "Map",
  views: "Build view",
  mapHint: "Pinch to zoom, drag to move around. Reorder steps in List.",
  zoomIn: "Zoom in",
  fit: "Fit the map",
  /** Recently removed keeps what went for this visit only. */
  keptUntil: "Kept until you leave this page",
  /** The confirmation. */
  publishAsk: (title: string): string => `Publish ${title}?`,
  publishLine: "Visible to anyone with the link.",
  /** The native selection's extra item in a step's text. */
  linkToStep: "Link to a step",
  /** Find. */
  find: "Find",
  findLabel: "Find in build",
  previous: "Previous match",
  next: "Next match",
  cancel: "Cancel",
  /** Preview. */
  preview: "Preview",
  closePreview: "Close preview",
  /** Add. */
  add: "Add",
  /** Swipe: what sits behind a tile. */
  swipeActions: (name: string): string => `${name} actions`,
} as const;

/** A step's kind as its icon in the mobile set. */
export const KIND_ICON: Record<StepKind, MobileIconName> = {
  prompt: "prompt",
  agent: "agent",
  team: "agent",
  manual: "manual",
  code: "code",
  check: "check",
  file: "file",
  tool: "tool",
  decision: "decision",
  system_prompt: "system",
  dataset: "dataset",
  repo: "repo",
  retrieval: "retrieval",
};

/** The phone's toast after a removal: "Removed Prompt 5" reads "Prompt 5 removed". Any other sentence is left as it is. */
export function phoneNoticeWords(sentence: string): string {
  const match = /^Removed (.+)$/.exec(sentence);
  if (!match || match[1].includes(". ")) return sentence;
  return `${match[1]} removed`;
}

/** "2 sessions / 4 prompts / 1 file": the counts under the title, slash-joined on a phone. */
export function phoneCountsLine(counts: { sessions: number; prompts: number; files: number }): string {
  const parts: string[] = [];
  if (counts.sessions > 0) parts.push(`${counts.sessions} ${counts.sessions === 1 ? "session" : "sessions"}`);
  if (counts.prompts > 0) parts.push(`${counts.prompts} ${counts.prompts === 1 ? "prompt" : "prompts"}`);
  if (counts.files > 0) parts.push(`${counts.files} ${counts.files === 1 ? "file" : "files"}`);
  return parts.join(" / ");
}

export interface NotReadyRow {
  key: string;
  item: ChecklistItem;
  /** The step's number for the number box; null for the post or the whole build. */
  number: string | null;
  title: string;
  /** What it still needs, in the checklist's words; null when the words say it all. */
  needs: string | null;
}

/** What the ready-to-publish sheet lists: every open item, required first, in the checklist's own words. */
export function notReadyRows(checklist: Pick<Checklist, "required" | "recommended">, numberOf: (stepId: string) => string | null): NotReadyRow[] {
  return [...checklist.required, ...checklist.recommended]
    .filter((item) => !item.done)
    .map((item) => ({ key: item.key, item, number: item.stepId ? numberOf(item.stepId) : null, title: item.words, needs: item.detail }));
}

/**
 * The sessions a phone folds as the page arrives: every session but the one holding the chosen step (the first session when
 * nothing is chosen), so a long build starts as a short list of sessions. Returns the keys to fold; none for one session.
 */
export function foldOnArrival(sessions: readonly { key: string | null; tiles: readonly string[] }[], chosen: string | null): string[] {
  const keyed = sessions.filter((session): session is { key: string; tiles: readonly string[] } => session.key !== null);
  if (keyed.length < 2) return [];
  const holding = (chosen ? keyed.find((session) => session.tiles.includes(chosen)) : undefined) ?? keyed[0];
  return keyed.filter((session) => session !== holding).map((session) => session.key);
}

/* ── the map, read only ── */

export interface PhoneMapStep {
  id: string;
  number: string;
  kind: StepKind;
  title: string;
}

export interface PhoneMapSession {
  key: string;
  number: number;
  steps: readonly PhoneMapStep[];
}

export interface PhoneMapModel {
  sessions: readonly PhoneMapSession[];
}

export interface PlacedNode extends PhoneMapStep {
  x: number;
  y: number;
}

export interface PlacedLink {
  from: string;
  to: string;
  /** The path, in the map's own pixels. */
  d: string;
}

/** Node measures on a phone: 150 wide on Card, 8 10 padding, two lines (the kind row 16, the title 18): 58 tall. */
export const MAP_NODE = { width: 150, height: 58, column: 190, row: 82, pad: 24 } as const;

/** Sessions stand in columns, their steps down each column; a link joins each step to the next, and a session's last to the next session's first. */
export function layoutPhoneMap(model: PhoneMapModel): { nodes: PlacedNode[]; links: PlacedLink[]; width: number; height: number } {
  const nodes: PlacedNode[] = [];
  const links: PlacedLink[] = [];
  let previous: PlacedNode | null = null;
  let tallest = 0;
  model.sessions.forEach((session, column) => {
    session.steps.forEach((step, row) => {
      const node: PlacedNode = { ...step, x: MAP_NODE.pad + column * MAP_NODE.column, y: MAP_NODE.pad + row * MAP_NODE.row };
      nodes.push(node);
      if (previous) links.push({ from: previous.id, to: node.id, d: linkPath(previous, node) });
      previous = node;
    });
    tallest = Math.max(tallest, session.steps.length);
  });
  const columns = Math.max(1, model.sessions.length);
  return {
    nodes,
    links,
    width: MAP_NODE.pad * 2 + (columns - 1) * MAP_NODE.column + MAP_NODE.width,
    height: MAP_NODE.pad * 2 + Math.max(0, tallest - 1) * MAP_NODE.row + MAP_NODE.height,
  };
}

function linkPath(from: PlacedNode, to: PlacedNode): string {
  if (from.x === to.x) {
    const x = from.x + MAP_NODE.width / 2;
    return `M ${x} ${from.y + MAP_NODE.height} L ${x} ${to.y}`;
  }
  const x1 = from.x + MAP_NODE.width;
  const y1 = from.y + MAP_NODE.height / 2;
  const x2 = to.x;
  const y2 = to.y + MAP_NODE.height / 2;
  const mid = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
}

/** The scale that fits the whole map in a well `width` by `height`, never above 1. */
export function fitScale(map: { width: number; height: number }, well: { width: number; height: number }): number {
  if (map.width <= 0 || map.height <= 0 || well.width <= 0 || well.height <= 0) return 1;
  return Math.min(1, well.width / map.width, well.height / map.height);
}

/** Zoom stays between a quarter and twice the size. */
export const clampZoom = (scale: number): number => Math.min(2, Math.max(0.25, scale));
