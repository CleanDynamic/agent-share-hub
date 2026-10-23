// linkRules: what linked text may be (CA-19 P1). PURE.
//
// ONE TO ONE. A stretch of words in the post points at one component (a part, a session or a tile) or one reference
// group, and each of those has at most one piece of linked text. Linking a target that already has a range moves it (the
// old range becomes plain words); linking words that already point at something replaces that link.
//
// ONE CONTINUOUS STRETCH INSIDE ONE POST: a range that would cross a post break, or be split, is refused. Spaces at either
// end are trimmed. If editing later splits a range (a post break typed inside it), the first part keeps the link and the
// rest becomes plain words. Ref marks never overlap (the mark excludes itself), pasted linked text arrives as plain words,
// and pictures and videos can't be linked.
//
// OLD POSTS. A post saved before CA-19 may have several ranges pointing at one target. They are kept as they are and
// never rewritten on load: the first in reading order counts as the target's one link, and the others are "extra links"
// the editor offers to remove in one step.
//
// These work on the editor's ProseMirror document and return transactions the caller dispatches; the JSON readers at the
// end work on the stored thread. Nothing is fetched and nothing is saved here.

import { Fragment, Slice, type Mark, type MarkType, type Node as PMNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";

export const LINK_RULES_COPY = {
  oneStretch: "Linked text has to be one stretch inside one post.",
  pictures: "Pictures and videos can't be linked.",
  alsoLinked: "Also linked here",
  removeExtra: "Remove extra links",
} as const;

/** One stretch of linked words. Positions are the editor's. */
export interface LinkRange {
  to: string;
  from: number;
  end: number;
  /** The post it is in, counting from 1. */
  post: number;
  text: string;
}

/** A run of the post's positions and the link it carries (null for plain words): what the undo history keeps. */
export interface RefRun {
  from: number;
  to: number;
  target: string;
}

const refType = (doc: PMNode): MarkType | undefined => doc.type.schema.marks.ref;

const refOf = (marks: readonly Mark[]): string | null => {
  const mark = marks.find((candidate) => candidate.type.name === "ref");
  const to = mark?.attrs.to;
  return typeof to === "string" && to ? to : null;
};

/** The post a position is in, counting from 1. */
export function postAt(doc: PMNode, pos: number): number {
  let post = 1;
  doc.forEach((node, offset) => {
    if (node.type.name === "postBreak" && offset < pos) post += 1;
  });
  return post;
}

/** Every stretch of linked words, in reading order. Words next to each other with the same link inside one block are one stretch. */
export function linkRanges(doc: PMNode): LinkRange[] {
  const out: LinkRange[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let run: { to: string; from: number; end: number } | null = null;
    const close = () => {
      if (run) out.push({ ...run, post: postAt(doc, run.from), text: doc.textBetween(run.from, run.end, "\n", "\n") });
      run = null;
    };
    node.forEach((child, offset) => {
      const start = pos + 1 + offset;
      const to = refOf(child.marks);
      if (to && run && run.to === to && run.end === start) run.end = start + child.nodeSize;
      else {
        close();
        if (to) run = { to, from: start, end: start + child.nodeSize };
      }
    });
    close();
    return false;
  });
  return out;
}

/** The one range linked to a target: the first in reading order. */
export function linkOf(doc: PMNode, to: string): LinkRange | null {
  return linkRanges(doc).find((range) => range.to === to) ?? null;
}

/** An old post's extra links: every range after the first that points at the same target. */
export function extraLinks(doc: PMNode): LinkRange[] {
  const seen = new Set<string>();
  return linkRanges(doc).filter((range) => {
    if (!seen.has(range.to)) {
      seen.add(range.to);
      return false;
    }
    return true;
  });
}

/** The range with spaces at either end left out. In one text block a position is one character, as textBetween reads it. */
export function trimRange(doc: PMNode, from: number, to: number): { from: number; to: number } {
  const text = doc.textBetween(from, to, "\n", "\n");
  const lead = text.length - text.trimStart().length;
  const trail = text.length - text.trimEnd().length;
  if (lead === text.length) return { from, to: from };
  return { from: from + lead, to: to - trail };
}

/** Why words cannot be linked, or null. An empty range is fine: the target's name goes in there. */
export function rangeRefusal(doc: PMNode, from: number, to: number): string | null {
  if (from === to) return null;
  let picture = false;
  doc.nodesBetween(from, to, (node) => {
    if (node.type.name === "postMedia" || node.type.name === "postMediaGrid" || node.type.name === "postMediaRow") picture = true;
    return !picture;
  });
  if (picture) return LINK_RULES_COPY.pictures;
  const $from = doc.resolve(from);
  const $to = doc.resolve(to);
  if (!$from.sameParent($to) || !$from.parent.isTextblock || !$from.parent.type.allowsMarkType(refType(doc) as MarkType)) return LINK_RULES_COPY.oneStretch;
  return null;
}

export type LinkResult =
  | { ok: true; tr: Transaction; from: number; to: number; moved: LinkRange | null; replaced: string | null }
  | { ok: false; refusal: string };

/**
 * Link the words from `from` to `to` to `target`, trimmed. The target's old range becomes plain words (moved), and any link
 * the words were part of becomes plain words (replaced), so links stay one to one and never overlap.
 */
export function linkWords(tr: Transaction, from: number, to: number, target: string): LinkResult {
  const type = refType(tr.doc);
  if (!type) return { ok: false, refusal: LINK_RULES_COPY.oneStretch };
  const refusal = rangeRefusal(tr.doc, from, to);
  if (refusal) return { ok: false, refusal };
  const trimmed = trimRange(tr.doc, from, to);
  if (trimmed.from >= trimmed.to) return { ok: false, refusal: LINK_RULES_COPY.oneStretch };
  const ranges = linkRanges(tr.doc);
  const inside = (range: LinkRange) => range.from >= trimmed.from && range.end <= trimmed.to;
  const moved = ranges.filter((range) => range.to === target && !inside(range));
  const overlapping = ranges.filter((range) => range.from < trimmed.to && range.end > trimmed.from);
  for (const range of [...moved, ...overlapping]) tr.removeMark(range.from, range.end, type);
  tr.addMark(trimmed.from, trimmed.to, type.create({ to: target }));
  return { ok: true, tr, from: trimmed.from, to: trimmed.to, moved: moved[0] ?? null, replaced: overlapping.find((range) => range.to !== target)?.to ?? null };
}

/** Write `text` at `at` as words linked to `target`, then a space. The target's old range becomes plain words. */
export function insertLinked(tr: Transaction, at: number, text: string, target: string): { tr: Transaction; from: number; to: number; moved: LinkRange | null } {
  const type = refType(tr.doc);
  const ranges = linkRanges(tr.doc).filter((range) => range.to === target);
  if (type) for (const range of ranges) tr.removeMark(range.from, range.end, type);
  const schema = tr.doc.type.schema;
  const nodes = [schema.text(text, type ? [type.create({ to: target })] : []), schema.text(" ")];
  tr.insert(at, nodes);
  return { tr, from: at, to: at + text.length, moved: ranges[0] ?? null };
}

/** Every link to `target` becomes plain words. */
export function unlinkTarget(tr: Transaction, target: string): LinkRange[] {
  const type = refType(tr.doc);
  const ranges = linkRanges(tr.doc).filter((range) => range.to === target);
  if (type) for (const range of ranges) tr.removeMark(range.from, range.end, type);
  return ranges;
}

/** The link the words from `from` to `to` are part of becomes plain words. */
export function unlinkAt(tr: Transaction, from: number, to: number = from): LinkRange[] {
  const type = refType(tr.doc);
  const ranges = linkRanges(tr.doc).filter((range) => (from === to ? range.from <= from && range.end >= to : range.from < to && range.end > from));
  if (type) for (const range of ranges) tr.removeMark(range.from, range.end, type);
  return ranges;
}

/**
 * A move's instructions, applied: every link to a `drop` target becomes plain words, then every link to a `retarget.from`
 * points at its `to`. A retarget onto a target that still has linked text drops instead, so links stay one to one.
 */
export function applyLinkInstructions(tr: Transaction, links: { drop?: readonly string[]; retarget?: readonly { from: string; to: string }[] } | undefined): void {
  const type = refType(tr.doc);
  if (!links || !type) return;
  for (const to of links.drop ?? []) unlinkTarget(tr, to);
  for (const { from, to } of links.retarget ?? []) {
    const ranges = linkRanges(tr.doc);
    const moving = ranges.filter((range) => range.to === from);
    const taken = ranges.some((range) => range.to === to);
    moving.forEach((range, at) => {
      tr.removeMark(range.from, range.end, type);
      if (!taken && at === 0) tr.addMark(range.from, range.end, type.create({ to }));
    });
  }
}

/** Remove extra links: every range after a target's first becomes plain words, in one step. */
export function removeExtraLinks(tr: Transaction): number {
  const type = refType(tr.doc);
  const extras = extraLinks(tr.doc);
  if (type) for (const range of extras) tr.removeMark(range.from, range.end, type);
  return extras.length;
}

/**
 * The ranges an edit split, to make plain: each range that was one stretch before the edit and is several after keeps its
 * first part. `map` carries an old position into the new document (`tr.mapping.map`). An old post's extra links are
 * separate ranges before the edit, so they are never touched here.
 */
export function splitRepairs(before: PMNode, after: PMNode, map: (pos: number, assoc?: number) => number): LinkRange[] {
  const out: LinkRange[] = [];
  const now = linkRanges(after);
  for (const range of linkRanges(before)) {
    const from = map(range.from, 1);
    const end = map(range.end, -1);
    const parts = now.filter((candidate) => candidate.to === range.to && candidate.from >= from && candidate.end <= end);
    out.push(...parts.slice(1));
  }
  return out;
}

/** The fragment with every ref mark taken off: pasted linked text arrives as plain words. */
function withoutRefs(fragment: Fragment): Fragment {
  const nodes: PMNode[] = [];
  fragment.forEach((node) => {
    const marks = node.marks.filter((mark) => mark.type.name !== "ref");
    const content = node.content.size ? withoutRefs(node.content) : node.content;
    nodes.push(node.isText ? node.mark(marks) : node.type.create(node.attrs, content, marks));
  });
  return Fragment.fromArray(nodes);
}

/** A pasted slice with its links taken off. */
export function stripRefMarks(slice: Slice): Slice {
  return new Slice(withoutRefs(slice.content), slice.openStart, slice.openEnd);
}

/** The links between two positions, as runs: what the undo history keeps of a region. */
export function refRuns(doc: PMNode, from: number, to: number): RefRun[] {
  return linkRanges(doc)
    .filter((range) => range.end > from && range.from < to)
    .map((range) => ({ from: Math.max(from, range.from), to: Math.min(to, range.end), target: range.to }));
}

/** Puts a region's links back as `runs` held them: every link in it taken off, then the runs written. */
export function setRuns(tr: Transaction, from: number, to: number, runs: readonly RefRun[]): void {
  const type = refType(tr.doc);
  if (!type) return;
  const size = tr.doc.content.size;
  const clamp = (pos: number) => Math.max(0, Math.min(size, pos));
  if (to > from) tr.removeMark(clamp(from), clamp(to), type);
  for (const run of runs) if (run.to > run.from) tr.addMark(clamp(run.from), clamp(run.to), type.create({ to: run.target }));
}

/** One place a phrase is found in the post: the picker's "Find words in the post". */
export interface FoundWords {
  from: number;
  to: number;
  post: number;
  before: string;
  match: string;
  after: string;
}

/** Where `query` is in the post's words, case aside, in reading order, at most `limit`. Code and pictures are not searched. */
export function findWords(doc: PMNode, query: string, limit = 8): FoundWords[] {
  const asked = query.trim().toLowerCase();
  if (!asked) return [];
  const out: FoundWords[] = [];
  doc.descendants((node, pos) => {
    if (out.length >= limit) return false;
    if (!node.isTextblock) return true;
    if (node.type.name === "codeBlock") return false;
    const text = doc.textBetween(pos + 1, pos + node.nodeSize - 1, "\n", "\n");
    const lower = text.toLowerCase();
    for (let at = lower.indexOf(asked); at >= 0 && out.length < limit; at = lower.indexOf(asked, at + asked.length)) {
      const from = pos + 1 + at;
      out.push({
        from,
        to: from + asked.length,
        post: postAt(doc, from),
        before: text.slice(Math.max(0, at - 24), at),
        match: text.slice(at, at + asked.length),
        after: text.slice(at + asked.length, at + asked.length + 24),
      });
    }
    return false;
  });
  return out;
}

/* ── the stored thread (JSON) ── */

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** A stored link: its target, its post (from 1) and its words. */
export interface StoredLink {
  to: string;
  post: number;
  text: string;
}

/** Every stretch of linked words in a stored thread, in reading order. */
export function threadLinks(doc: unknown): StoredLink[] {
  const out: StoredLink[] = [];
  if (!isRecord(doc) || !Array.isArray(doc.content)) return out;
  let post = 1;
  const block = (node: unknown) => {
    if (!isRecord(node)) return;
    const children = Array.isArray(node.content) ? node.content : [];
    const inline = children.some((child) => isRecord(child) && (child.type === "text" || child.type === "hardBreak"));
    if (!inline) {
      children.forEach(block);
      return;
    }
    let run: StoredLink | null = null;
    for (const child of children) {
      const marks = isRecord(child) && Array.isArray(child.marks) ? child.marks : [];
      const mark = marks.find((candidate) => isRecord(candidate) && candidate.type === "ref") as { attrs?: { to?: unknown } } | undefined;
      const to = typeof mark?.attrs?.to === "string" ? mark.attrs.to : null;
      const text = isRecord(child) && typeof child.text === "string" ? child.text : "\n";
      if (to && run && run.to === to) run.text += text;
      else {
        if (run) out.push(run);
        run = to ? { to, post, text } : null;
      }
    }
    if (run) out.push(run);
  };
  for (const node of doc.content) {
    if (isRecord(node) && node.type === "postBreak") post += 1;
    else block(node);
  }
  return out;
}

/** How many targets a stored thread links more than once: an old post's extra links. */
export function targetsLinkedMoreThanOnce(doc: unknown): number {
  const counts = new Map<string, number>();
  for (const link of threadLinks(doc)) counts.set(link.to, (counts.get(link.to) ?? 0) + 1);
  return [...counts.values()].filter((count) => count > 1).length;
}
