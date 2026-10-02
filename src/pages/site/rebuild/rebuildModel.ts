/* UI-P31 — Rebuild and lineage: the shapes the views take, and the pure
   functions that build them from what the data layer returns.

   NOTHING HERE FETCHES. `RebuildPage` and `LineagePage` load, these map, the
   views draw; the dev compare page builds the same shapes from the sample. */

import type { CSSProperties } from "react";

import { plaqueState } from "@/components/brand/Plaque";
import {
  MINIMUM_PUBLISHABLE_KEYS,
  NO_CHANGES_REASON,
  changeCount,
  serialiseChangeSet,
  type BuildClock,
  type BuildRecord,
  type ChangeSet,
  type FieldChange,
  type NodeChange,
  type NodeRef,
  type NodeTree,
  type NodeType,
  type PublishReadiness,
  type RebuildTreeNode,
} from "@/lib/build";
import { partMeta } from "@/pages/site/build/buildModel";

/* ══ the family ══════════════════════════════════════════════════════════════ */

/** A node's lamp: plaqueState's three, and the viewer's own draft, which has no lamp yet — only its outline. */
export type FamilyLamp = "healthy" | "stale" | "unreproduced" | "draft";

export interface FamilyNodeView {
  id: string;
  /** The node's build: `/b2/:slug`. */
  to: string;
  title: string;
  /** "@kofi", or "you · draft". */
  maker: string;
  /** How many reproduced it. */
  reproduced: number;
  lamp: FamilyLamp;
  /** Seeds the cover's sky. */
  seed: string;
  /** A fixed sky (the sample's), else the seed decides. */
  sky?: number;
  /** The viewer's own draft: dashed `--action`. */
  draft: boolean;
  /** The build the page is about (the lineage page's address). */
  current: boolean;
  children: FamilyNodeView[];
}

/** The viewer's draft, drawn into the family under the build it rebuilds. */
export interface FamilyDraft {
  id: string;
  slug: string;
  title: string;
  /** The source: the node the draft hangs under. */
  parentId: string;
}

function makerOf(node: RebuildTreeNode): string {
  const handle = (node.maker?.username ?? "").trim();
  if (handle) return `@${handle}`;
  return (node.maker?.display_name ?? "").trim() || "a maker";
}

const timeOf = (iso: string | null | undefined): number => {
  const at = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(at) ? at : Number.POSITIVE_INFINITY;
};

/**
 * The family as the views draw it: each build with its maker, its count and
 * its lamp (plaqueState, read from the clocks), siblings oldest first by
 * created_at, and the viewer's draft — which rebuild_tree never returns below
 * the root — hung under the build it rebuilds, newest of its siblings.
 */
export function familyView(
  root: RebuildTreeNode | null,
  {
    clocks = new Map(),
    now,
    draft = null,
    currentId = null,
  }: { clocks?: ReadonlyMap<string, BuildClock>; now?: number; draft?: FamilyDraft | null; currentId?: string | null } = {},
): FamilyNodeView | null {
  if (!root) return null;

  const convert = (node: RebuildTreeNode): FamilyNodeView => {
    const clock = clocks.get(node.id);
    const children = [...node.children]
      .map((child, index) => ({ child, index }))
      .sort(
        (a, b) =>
          timeOf(clocks.get(a.child.id)?.created_at ?? a.child.published_at) -
            timeOf(clocks.get(b.child.id)?.created_at ?? b.child.published_at) || a.index - b.index,
      )
      .map(({ child }) => convert(child));
    return {
      id: node.id,
      to: `/b2/${node.slug}`,
      title: (node.title ?? "").trim() || "Untitled build",
      maker: makerOf(node),
      reproduced: node.reproduction_count ?? 0,
      lamp: plaqueState(
        {
          reproduction_count: node.reproduction_count,
          last_confirmed_at: clock?.last_confirmed_at ?? null,
          /* The lamp reads the clock, not the model: plaqueState never looks at this. */
          last_confirmed_model: null,
          published_at: node.published_at,
        },
        now,
      ),
      seed: node.id,
      draft: false,
      current: node.id === currentId,
      children,
    };
  };

  const tree = convert(root);
  if (draft && !findNode(tree, draft.id)) {
    const parent = findNode(tree, draft.parentId) ?? tree;
    parent.children.push({
      id: draft.id,
      to: `/b2/${draft.slug}`,
      title: (draft.title ?? "").trim() || "Untitled build",
      maker: "you · draft",
      reproduced: 0,
      lamp: "draft",
      seed: draft.id,
      draft: true,
      current: draft.id === currentId,
      children: [],
    });
  }
  return tree;
}

export function findNode(root: FamilyNodeView, id: string): FamilyNodeView | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const hit = findNode(child, id);
    if (hit) return hit;
  }
  return null;
}

/** The root, then each child and its family: the indented list's order. */
export function familyRows(root: FamilyNodeView | null): { node: FamilyNodeView; depth: number; parentId: string | null }[] {
  const out: { node: FamilyNodeView; depth: number; parentId: string | null }[] = [];
  const walk = (node: FamilyNodeView, depth: number, parentId: string | null) => {
    out.push({ node, depth, parentId });
    node.children.forEach((child) => walk(child, depth + 1, node.id));
  };
  if (root) walk(root, 0, null);
  return out;
}

/** "{n} builds · {g} generations". */
export function familyStats(root: FamilyNodeView | null): { builds: number; generations: number } {
  const rows = familyRows(root);
  return { builds: rows.length, generations: rows.reduce((deepest, row) => Math.max(deepest, row.depth + 1), 0) };
}

export function familySubtitle(root: FamilyNodeView | null): string {
  const { builds, generations } = familyStats(root);
  const count = (n: number, one: string, many: string) => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;
  return `${count(builds, "build", "builds")} · ${count(generations, "generation", "generations")} · lamps show which still work`;
}

/** The list is the default above this many builds; a tree that wide is read better as a list. */
export const TREE_MAX_NODES = 12;

/* ── the tree's geometry ── */

export const NODE_WIDTH = 140;
/** Siblings stand at least this far apart. */
export const NODE_GAP = 40;
/** Generation g stands at y = ROW_TOP + ROW_STEP · g. */
export const ROW_TOP = 18;
export const ROW_STEP = 150;
/** From a node's top to where its connectors leave it. */
export const NODE_HEIGHT = 110;
/** The canvas's height on the board. */
export const CANVAS_HEIGHT = 460;

export interface PlacedNode {
  node: FamilyNodeView;
  /** The node's left edge. */
  x: number;
  /** The node's top edge. */
  y: number;
  depth: number;
}

export interface FamilyLayout {
  nodes: PlacedNode[];
  /** One path per parent → child, parent's bottom centre to child's top centre. */
  links: { key: string; d: string }[];
  width: number;
  /** What the deepest generation needs; the view takes at least CANVAS_HEIGHT. */
  height: number;
}

/**
 * Where every node stands: leaves left to right, a slot of NODE_WIDTH +
 * NODE_GAP each, and each parent centred over its first and last child. Two
 * subtrees never share a slot, so nodes in one generation always stand at least
 * NODE_GAP apart.
 */
export function layoutFamily(root: FamilyNodeView): FamilyLayout {
  const slot = NODE_WIDTH + NODE_GAP;
  const centres = new Map<string, number>();
  let leaves = 0;

  const place = (node: FamilyNodeView): number => {
    if (node.children.length === 0) {
      const centre = leaves * slot + NODE_WIDTH / 2;
      leaves += 1;
      centres.set(node.id, centre);
      return centre;
    }
    const childCentres = node.children.map(place);
    const centre = (childCentres[0] + childCentres[childCentres.length - 1]) / 2;
    centres.set(node.id, centre);
    return centre;
  };
  place(root);

  const nodes: PlacedNode[] = [];
  const links: { key: string; d: string }[] = [];
  let deepest = 0;
  const walk = (node: FamilyNodeView, depth: number) => {
    deepest = Math.max(deepest, depth);
    const centre = centres.get(node.id) ?? 0;
    const y = ROW_TOP + ROW_STEP * depth;
    nodes.push({ node, x: centre - NODE_WIDTH / 2, y, depth });
    for (const child of node.children) {
      const x2 = centres.get(child.id) ?? 0;
      const y1 = y + NODE_HEIGHT;
      const y2 = ROW_TOP + ROW_STEP * (depth + 1);
      links.push({ key: `${node.id}>${child.id}`, d: `M ${centre} ${y1} C ${centre} ${y1 + 26}, ${x2} ${y2 - 26}, ${x2} ${y2}` });
      walk(child, depth + 1);
    }
  };
  walk(root, 0);

  return {
    nodes,
    links,
    width: Math.max(leaves, 1) * slot - NODE_GAP,
    height: ROW_TOP + ROW_STEP * deepest + NODE_HEIGHT + ROW_TOP,
  };
}

/* ══ what changed ════════════════════════════════════════════════════════════ */

export type ChangeRowKind = "added" | "changed" | "removed";

export interface ChangeRowView {
  /** serialiseChangeSet's own key for the line. */
  key: string;
  kind: ChangeRowKind;
  name: string;
  value: string;
}

export interface ChangeGroupView {
  key: string;
  label: string;
  rows: ChangeRowView[];
}

/** How long a value runs before the line clips it (the row also ellipsises). */
const SHORT = 32;

const flat = (value: string | null): string | null => {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
};

/** A list field's length, when the value is one (FieldChange holds structures as canonical JSON). */
function listLength(value: string | null): number | null {
  const text = (value ?? "").trim();
  if (!text.startsWith("[")) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.length : null;
  } catch {
    return null;
  }
}

const words = (value: string | null): number => {
  const text = flat(value);
  return text ? text.split(" ").length : 0;
};

/** One field's move: "18 → 22 rules", "sonnet-4.5 → opus 5", or "Text: 120 → 164 w" for prose. */
export function fieldValue(field: FieldChange): string {
  const before = listLength(field.before);
  const after = listLength(field.after);
  if (before !== null || after !== null) return `${before ?? 0} → ${after ?? 0} ${field.label.toLowerCase()}`;
  const a = flat(field.before);
  const b = flat(field.after);
  if ((a ?? "").length <= SHORT && (b ?? "").length <= SHORT) return `${a ?? "—"} → ${b ?? "—"}`;
  return `${field.label}: ${words(field.before).toLocaleString("en-GB")} → ${words(field.after).toLocaleString("en-GB")} w`;
}

/** A changed part's line: the model swap when there is one to name (as serialiseChangeSet names it), else the first field. */
function changedValue(change: NodeChange): string {
  const model = change.fields.find((field) => field.key === "model");
  const lead = model && model.before && model.after ? model : change.fields[0];
  if (!lead) return "edited";
  const more = change.fields.length - 1;
  return `${fieldValue(lead)}${more > 0 ? ` · ${more} more` : ""}`;
}

const nodeName = (node: Pick<NodeRef, "title" | "type_label">): string => node.title ?? node.type_label;

function flatTree(tree: readonly NodeTree[]): NodeTree[] {
  return tree.flatMap((node) => [node, ...flatTree(node.children ?? [])]);
}

/**
 * A part's kind as a reader says it: its category, and — for a part that was
 * added, which the reader has not seen — its short meta when that says more. A
 * removed part is named by its kind alone: what it held is the source's.
 */
function partValue(nodeId: string, record: BuildRecord, fallback: NodeRef, withMeta: boolean): string {
  const type: NodeType | undefined = record.nodeTypes.find((candidate) => candidate.key === fallback.type);
  const kind = (type?.category ?? fallback.type_label).toLowerCase();
  if (!withMeta) return kind;
  const node = flatTree(record.tree).find((candidate) => candidate.id === nodeId);
  const meta = node ? partMeta(node, type) : null;
  return meta && meta !== kind && meta !== fallback.type_label.toLowerCase() ? `${kind} · ${meta}` : kind;
}

/**
 * The change set as rows, LINE FOR LINE with serialiseChangeSet(): the same
 * lines, the same keys, the same order — what changed, what was added, what was
 * removed, then what moved on the header — each split into a name and a value a
 * column can hold. Consecutive lines about parts are one group, the header's
 * lines another.
 */
export function changeGroups(source: BuildRecord, draft: BuildRecord, changes: ChangeSet): ChangeGroupView[] {
  const changedById = new Map(changes.changed.map((change) => [change.node_id, change]));
  const addedById = new Map(changes.added.map((node) => [node.node_id, node]));
  const removedById = new Map(changes.removed.map((node) => [node.node_id, node]));
  const headerByKey = new Map(changes.header.map((field) => [field.key, field]));

  const rowFor = (key: string, text: string): { group: "parts" | "header"; row: ChangeRowView } => {
    const [kind, id] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
    if (kind === "changed") {
      const change = changedById.get(id);
      return { group: "parts", row: { key, kind: "changed", name: change ? nodeName(change) : text, value: change ? changedValue(change) : "" } };
    }
    if (kind === "added") {
      const node = addedById.get(id);
      return { group: "parts", row: { key, kind: "added", name: node ? nodeName(node) : text, value: node ? partValue(id, draft, node, true) : "" } };
    }
    if (kind === "removed") {
      const node = removedById.get(id);
      return { group: "parts", row: { key, kind: "removed", name: node ? nodeName(node) : text, value: node ? partValue(id, source, node, false) : "" } };
    }
    /* The header: the title, what it does, the cover, and the steps added to the sequence. */
    if (id === "events") {
      const n = changes.events_added;
      return { group: "header", row: { key, kind: "added", name: "Sequence", value: `${n.toLocaleString("en-GB")} new ${n === 1 ? "step" : "steps"}` } };
    }
    const field = headerByKey.get(id);
    if (id === "cover") return { group: "header", row: { key, kind: "changed", name: "Cover", value: "a new picture" } };
    if (id === "outcome") {
      return {
        group: "header",
        row: { key, kind: field?.before ? "changed" : "added", name: "What it does", value: field ? `${flat(field.before) ?? "—"} → ${flat(field.after) ?? "—"}` : text },
      };
    }
    return {
      group: "header",
      row: { key, kind: "changed", name: field?.label ?? "Title", value: field ? `${flat(field.before) ?? "—"} → ${flat(field.after) ?? "—"}` : text },
    };
  };

  const groups: ChangeGroupView[] = [];
  for (const line of serialiseChangeSet(changes)) {
    const { group, row } = rowFor(line.key, line.text);
    const last = groups[groups.length - 1];
    if (last && last.key === group) last.rows.push(row);
    else groups.push({ key: group, label: group === "parts" ? "Parts" : "Header", rows: [row] });
  }
  return groups;
}

/** "Δ 7 changes". */
export function changesEyebrow(groups: readonly ChangeGroupView[]): string {
  const n = groups.reduce((sum, group) => sum + group.rows.length, 0);
  return `Δ ${n.toLocaleString("en-GB")} ${n === 1 ? "change" : "changes"}`;
}

/* ══ readiness ═══════════════════════════════════════════════════════════════ */

export interface ReadinessView {
  /** How much of the gate is met: the three things every record needs, and having changed something. */
  pct: number;
  /** "One thing before it can hang", "{n} things before it can hang", "Ready to hang". */
  headline: string;
  /** The first thing still missing, as a sentence. Null when nothing is. */
  next: string | null;
  ready: boolean;
}

const sentence = (copy: string): string => {
  const text = copy.trim().replace(/\.$/, "");
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
};

/**
 * The gate rebuildReadiness() keeps, as a figure and a sentence: the three
 * minimum publish requirements, then the one a rebuild adds — it has to change
 * something (a part added, removed or edited, or the outcome rewritten: the
 * gate's own rule, read the same way). The base requirements come first, as
 * the gate reports them.
 */
export function readinessView(readiness: PublishReadiness, changes: ChangeSet): ReadinessView {
  const diverged = changeCount(changes) > 0 || changes.outcome_changed;
  const total = MINIMUM_PUBLISHABLE_KEYS.length + 1;
  const outstanding = Math.min(total, readiness.blocking.length + (diverged ? 0 : 1));
  return {
    pct: Math.round(((total - outstanding) / total) * 100),
    headline:
      outstanding === 0
        ? "Ready to hang"
        : outstanding === 1
          ? "One thing before it can hang"
          : `${outstanding.toLocaleString("en-GB")} things before it can hang`,
    next: readiness.blocking[0] ? sentence(readiness.blocking[0].copy) : diverged ? null : NO_CHANGES_REASON,
    ready: readiness.ready,
  };
}

/* ══ the heading ═════════════════════════════════════════════════════════════ */

/** "Rebuilding Invoice triage agent by @maya." */
export const rebuildingLine = (source: { title: string; maker: string | null }): string =>
  `Rebuilding ${source.title}${source.maker ? ` by ${source.maker}` : ""}.`;

/** Read by assistive technology, drawn nowhere: the desktop boards draw no page heading. */
export const VISUALLY_HIDDEN: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

/* ══ the credit ══════════════════════════════════════════════════════════════ */

export interface RebuildCreditView {
  /** The source's title, as the draft froze it at the fork. */
  title: string;
  /** The source's maker's handle, without "@", as frozen; null when there was none. */
  handle: string | null;
  /** "Δ swapped model: …, and 3 more", or null when nothing differs yet. */
  delta: string | null;
}
