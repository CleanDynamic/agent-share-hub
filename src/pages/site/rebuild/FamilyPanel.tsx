/* Synth 14: the family of a build, as a tree or as an indented list.

   TREE: generations in rows; each node a 150-wide Card button (radius 12, 10px 12px): the name 13/600 and "@maker" 13 Text
   3. Lines from parent to child in 1.5px `--tree-line`. The reader's draft is a dashed node (1px `--field-edge`, no fill),
   "Your rebuild", under its source, joined by a dashed line. On the lineage page the chosen node is Raised with a 2px Mint
   ring. No lamps and no reproduced counts. The tree scrolls sideways inside its panel when the family is wider than it.

   LIST: the same family indented 16px a generation, each row the name and the maker.

   ON THE LINEAGE PAGE a node is a choice rather than a way out: `onSelect` turns every node into a button.

   PURE. */

import { PageEmpty, PageState } from "@/components/pagestate/PageState";
import { readOf } from "@/components/pagestate/pageStateModel";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";

import type { PanelFailure } from "@/components/pagestate/PageState";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { Segmented, type SegmentedItem } from "@/components/brand/Segmented";
import type { PageFit } from "@/components/shell/siteFrameFit";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { shortDate } from "@/lib/build/readerSteps";

import {
  CANVAS_HEIGHT,
  NODE_WIDTH,
  TREE_MAX_NODES,
  familyFact,
  familyRows,
  familyStats,
  layoutFamily,
  type FamilyNodeView,
} from "./rebuildModel";

export type FamilyReading = "tree" | "list";

const READINGS: readonly SegmentedItem<FamilyReading>[] = [
  { value: "tree", label: "Tree" },
  { value: "list", label: "List" },
];

/** The name on a node: 13 / 600. */
const nodeTitle: CSSProperties = {
  fontFamily: FIGTREE,
  fontSize: 13,
  fontWeight: 600,
  lineHeight: "16px",
  color: t.text,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

/** What a node is called: the reader's draft is "Your rebuild". */
const nodeName = (node: FamilyNodeView) => (node.draft ? "Your rebuild" : node.title);

/** G7: the name follows what the node draws, in its order: the name, then the maker. */
function nodeLabel(node: FamilyNodeView): string {
  return `${nodeName(node)}, ${node.maker}`;
}

/* ── one node, as a link or as a choice ── */

function NodeTarget({
  node,
  style,
  onSelect,
  selected,
  children,
}: {
  node: FamilyNodeView;
  style: CSSProperties;
  onSelect?: (id: string) => void;
  selected?: boolean;
  /** Kept for callers. */
  list?: boolean;
  children: ReactNode;
}) {
  const { state, handlers } = useInteractive<HTMLAnchorElement & HTMLButtonElement>();
  const common = {
    "data-testid": "family-node",
    "data-node-id": node.id,
    "data-draft": node.draft ? "" : undefined,
    "aria-label": nodeLabel(node),
    "aria-current": node.current ? ("page" as const) : undefined,
    ...handlers,
  };
  if (onSelect) {
    return (
      <button
        type="button"
        {...common}
        aria-pressed={Boolean(selected)}
        onClick={() => onSelect(node.id)}
        style={{ ...style, cursor: "pointer", textAlign: "left", font: "inherit", color: t.text, ...ring(state.focusVisible) }}
      >
        {children}
      </button>
    );
  }
  return (
    <Link to={node.to} {...common} style={{ ...style, textDecoration: "none", color: t.text, ...ring(state.focusVisible) }}>
      {children}
    </Link>
  );
}

/** How a node is painted: the draft dashed with no fill; the chosen node Raised with a 2px Mint ring; the rest Card. */
function paint(node: FamilyNodeView, selected: boolean): CSSProperties {
  if (node.draft) return { background: "transparent", border: `1px dashed ${t.fieldEdge}` };
  if (selected) return { background: t.control, border: "1px solid transparent", boxShadow: `0 0 0 2px ${t.brandAccent}` };
  return { background: t.treeNode, border: "1px solid transparent" };
}

/* ── the tree ── */

function TreeNode({
  node,
  x,
  y,
  onSelect,
  selected,
}: {
  node: FamilyNodeView;
  x: number;
  y: number;
  onSelect?: (id: string) => void;
  selected: boolean;
}) {
  return (
    <NodeTarget
      node={node}
      onSelect={onSelect}
      selected={selected}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: NODE_WIDTH,
        padding: "10px 12px",
        borderRadius: 12,
        ...paint(node, selected),
        boxSizing: "border-box",
        display: "block",
      }}
    >
      <span style={{ ...nodeTitle, display: "block" }}>{nodeName(node)}</span>
      {/* G7: the space keeps the words apart in the text a voice-control user matches the name against. */}{" "}
      <span style={{ display: "block", fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{node.maker}</span>
    </NodeTarget>
  );
}

export function FamilyTree({
  root,
  fit = "content",
  selectedId = null,
  onSelect,
  centre = false,
}: {
  root: FamilyNodeView;
  fit?: PageFit;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Mobile 28 A: a tree wider than the phone opens scrolled to the reader's rebuild (or the build in the address). */
  centre?: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const box = scroller.current;
    if (!centre || !box || box.scrollWidth <= box.clientWidth) return;
    const node = box.querySelector<HTMLElement>("[data-draft]") ?? box.querySelector<HTMLElement>("[aria-current='page']");
    if (!node) return;
    box.scrollLeft = node.offsetLeft + node.offsetWidth / 2 - box.clientWidth / 2;
  }, [centre, root]);
  const layout = layoutFamily(root);
  const drafts = new Set(familyRows(root).filter((row) => row.node.draft).map((row) => row.node.id));
  const height = fit === "board" ? CANVAS_HEIGHT : Math.max(CANVAS_HEIGHT, layout.height);
  return (
    <div
      ref={scroller}
      data-testid="family-tree"
      role="group"
      aria-label="The family, as a tree"
      style={{ position: "relative", height, marginTop: 16, overflowX: "auto", overflowY: "hidden", padding: "4px 0" }}
    >
      <div style={{ position: "relative", width: layout.width, height, margin: "0 auto" }}>
        <svg width={layout.width} height={height} viewBox={`0 0 ${layout.width} ${height}`} aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
          {layout.links.map((link) => (
            <path key={link.key} d={link.d} fill="none" stroke={t.treeLine} strokeWidth={1.5} strokeDasharray={drafts.has(link.key.split(">")[1]) ? "4 4" : undefined} />
          ))}
        </svg>
        {layout.nodes.map(({ node, x, y }) => (
          <TreeNode key={node.id} node={node} x={x} y={y} onSelect={onSelect} selected={node.id === selectedId} />
        ))}
      </div>
    </div>
  );
}

/* ── the list ── */

export function FamilyList({
  root,
  phone = false,
  selectedId = null,
  onSelect,
}: {
  root: FamilyNodeView;
  phone?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  if (phone) return <PhoneFamilyList root={root} selectedId={selectedId} onSelect={onSelect} />;
  return (
    <ol data-testid="family-list" aria-label="The family, oldest first" style={{ listStyle: "none", margin: "12px 0 0", padding: 0 }}>
      {familyRows(root).map(({ node, depth }) => {
        const selected = node.id === selectedId;
        return (
          <li key={node.id} data-depth={depth} style={{ position: "relative" }}>
            <NodeTarget
              node={node}
              onSelect={onSelect}
              selected={selected}
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                minHeight: 48,
                width: "100%",
                margin: "2px 0",
                padding: `6px 12px 6px ${12 + 16 * depth}px`,
                borderRadius: 12,
                ...paint(node, selected),
                boxSizing: "border-box",
              }}
            >
              <span style={{ ...nodeTitle, display: "block" }}>{nodeName(node)}</span>{" "}
              <span style={{ fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label }}>{node.maker}</span>
            </NodeTarget>
          </li>
        );
      })}
    </ol>
  );
}

/** Mobile 28 B: a generation's indent on a phone, and the elbow that joins a build to its parent. */
export const PHONE_INDENT = 24;
const ELBOW = 2;

/** "@kit · Rebuilt 21 Nov": the maker, and for a rebuild the day it was made. */
export function phoneNodeLine(node: FamilyNodeView, depth: number): string {
  const day = depth > 0 && !node.draft ? shortDate(node.at) : null;
  return day ? `${node.maker} · Rebuilt ${day}` : node.maker;
}

/**
 * Mobile 28 B: the family as an indented tree. Each build a Card (name 15/600, "@kit · Rebuilt 21 Nov" 13 Text 3), each
 * generation 24 further in, joined to its parent by a 2px `--tree-line` elbow. The chosen build keeps the 2px Mint ring.
 */
/** The rows with what each draws at its left: the elbow to its parent, and the rails of ancestors whose siblings come later. */
export function phoneTreeRows(root: FamilyNodeView) {
  const rows = familyRows(root);
  const later = rows.map((row, i) => row.parentId !== null && rows.slice(i + 1).some((next) => next.parentId === row.parentId));
  const index = new Map(rows.map((row, i) => [row.node.id, i]));
  return rows.map((row, i) => {
    /* An ancestor at depth k (k at least 1) with a sibling still to come keeps its parent's line running through this row. */
    const rails: number[] = [];
    let at = row.parentId ? index.get(row.parentId) : undefined;
    while (at !== undefined && rows[at].depth >= 1) {
      if (later[at]) rails.push(rows[at].depth);
      at = rows[at].parentId ? index.get(rows[at].parentId as string) : undefined;
    }
    return { ...row, rails, continues: later[i] };
  });
}

/** A vertical line at a depth's elbow column. */
const railLeft = (depth: number) => PHONE_INDENT * (depth - 1) + 11;
const GAP = 8;
const MIDDLE = 28;

/**
 * Mobile 28 B: the family as an indented tree. Each build a Card (name 15/600, "@kit · Rebuilt 21 Nov" 13 Text 3), each
 * generation 24 further in, joined to its parent by a 2px `--tree-line` elbow; a parent's line runs on past deeper rows to
 * its later children. The chosen build keeps the 2px Mint ring.
 */
function PhoneFamilyList({ root, selectedId, onSelect }: { root: FamilyNodeView; selectedId: string | null; onSelect?: (id: string) => void }) {
  const line = `${ELBOW}px solid ${t.treeLine}`;
  return (
    <ol data-testid="family-list" data-phone="" aria-label="The family, oldest first" style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: GAP }}>
      {phoneTreeRows(root).map(({ node, depth, rails, continues }) => {
        const selected = node.id === selectedId;
        return (
          <li key={node.id} data-depth={depth} style={{ position: "relative", paddingLeft: PHONE_INDENT * depth }}>
            {rails.map((rail) => (
              <span key={rail} aria-hidden="true" data-rail="" style={{ position: "absolute", left: railLeft(rail), top: -GAP, bottom: 0, borderLeft: line }} />
            ))}
            {depth > 0 ? (
              <span
                aria-hidden="true"
                data-elbow=""
                style={{ position: "absolute", left: railLeft(depth), top: -GAP, width: PHONE_INDENT - 11, height: GAP + MIDDLE, boxSizing: "border-box", borderLeft: line, borderBottom: line, borderBottomLeftRadius: 8 }}
              />
            ) : null}
            {depth > 0 && continues ? <span aria-hidden="true" style={{ position: "absolute", left: railLeft(depth), top: MIDDLE, bottom: 0, borderLeft: line }} /> : null}
            <NodeTarget
              node={node}
              onSelect={onSelect}
              selected={selected}
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 2,
                minHeight: 56,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                ...paint(node, selected),
                boxSizing: "border-box",
              }}
            >
              <span style={{ ...nodeTitle, fontSize: 15, lineHeight: "20px", display: "block" }}>{nodeName(node)}</span>{" "}
              <span style={{ fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{phoneNodeLine(node, depth)}</span>
            </NodeTarget>
          </li>
        );
      })}
    </ol>
  );
}

/* ── the panel ── */

export interface FamilyPanelProps {
  root: FamilyNodeView | null;
  fit?: PageFit;
  phone?: boolean;
  /** The lineage page: a node is a choice. */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Kept for callers. */
  fill?: boolean;
  /** The family is on its way: the head stays, the tree's canvas (or the list's rows) is bones. */
  loading?: boolean;
  /** The family could not be read: said in the panel, with a retry. */
  failure?: PanelFailure;
  /** The page's h1 is this panel's fact (rebuild, lineage); 2 where something else is the page's heading. */
  headingLevel?: 1 | 2;
  /** A quiet line above the heading (the lineage page's link back to its build). */
  above?: ReactNode;
  /** Force a reading: the lineage page on a phone reads the family as a list. */
  reading?: FamilyReading;
  /** Mobile 28 B: the heading drawn as a 13 Text 3 line under the top bar, which already names the page. */
  quietHeading?: boolean;
}

/** The family before it has arrived. */
function FamilySkeleton({ phone }: { phone: boolean }) {
  return (
    <LoadingRegion what="the family" data-testid="family-loading" style={{ marginTop: 16 }}>
      {phone ? (
        Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={44} radius={12} style={{ marginBottom: 4 }} />)
      ) : (
        <Skeleton height={CANVAS_HEIGHT} radius={12} />
      )}
    </LoadingRegion>
  );
}

const heading: CSSProperties = { margin: 0, fontFamily: FIGTREE, fontSize: 20, fontWeight: 600, lineHeight: "24px", color: t.text };

export function FamilyPanel({ root, fit = "content", phone = false, selectedId = null, onSelect, loading = false, failure, headingLevel = 2, above, reading: forced, quietHeading = false }: FamilyPanelProps) {
  const { builds } = familyStats(root);
  const [chosen, setReading] = useState<FamilyReading>(builds > TREE_MAX_NODES ? "list" : "tree");
  const reading = forced ?? chosen;
  const Heading = headingLevel === 1 ? "h1" : "h2";
  /* G25: the count only once the family has loaded. */
  const title = root && !loading && !failure ? familyFact(root) : "The family";
  /* A build nobody has rebuilt is a family of one: nothing to draw, and a line saying so. */
  const lone = Boolean(root) && builds <= 1;

  return (
    <div data-testid="family-panel">
      {above}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: quietHeading ? 16 : 32 }}>
        <Heading tabIndex={quietHeading ? -1 : undefined} style={quietHeading ? { ...heading, fontSize: 13, fontWeight: 400, lineHeight: "16px", color: t.label, outline: "none" } : heading}>{title}</Heading>
        {lone || loading || failure || phone || forced ? null : (
          <Segmented<FamilyReading> items={READINGS} value={reading} onChange={setReading} size={32} fontSize={13} label="Read the family as" />
        )}
      </div>
      {failure ? (
        <PageState read={readOf("error", undefined, failure.onRetry, failure.error)} thing="this family" region="The family" skeleton={null} style={{ paddingTop: 9 }}>
          {() => null}
        </PageState>
      ) : loading ? (
        <FamilySkeleton phone={phone} />
      ) : root && lone ? (
        <PageEmpty line="This build has no rebuilds yet." testId="family-empty" />
      ) : root ? (
        reading === "tree" ? (
          <FamilyTree root={root} fit={fit} selectedId={selectedId} onSelect={onSelect} centre={phone} />
        ) : (
          <FamilyList root={root} phone={phone} selectedId={selectedId} onSelect={onSelect} />
        )
      ) : null}
    </div>
  );
}

export default FamilyPanel;
