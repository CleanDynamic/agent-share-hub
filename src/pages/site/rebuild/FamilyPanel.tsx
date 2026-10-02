/* UI-P31 — the family of a build, as a tree or as an indented list.

   TREE (design/reference/desktop/{noon,dusk}/rebuild.html): a canvas 18px under
   the head, 460 tall on the board and taller when the generations need it,
   scrolling sideways inside the panel when the family is wider than it. Each
   generation is a row at y = 18 + 150·g; each node is 140 wide — padding 6,
   radius 12, `--glass` on a `--glass-border` hairline (the viewer's draft: 1.5px
   dashed `--action`), `--shadow-card` — with its lamp above it, a 50px cover,
   its title, and a row of who made it and how many reproduced it. One SVG
   behind the nodes draws every connector, parent's bottom centre to child's top
   centre, in `--line` at 1.5. Each node links to its build.

   LIST (design/reference/mobile/…/rebuild.html): the same family indented 22px
   a generation, an elbow into each child, a 40px cover, the title, the maker and
   the count, and the lamp at the end of the row. The default above twelve
   builds, and the only reading on a phone.

   THE LAMP IS DATA (RULES §5): lit, dimmed to 45% when stale, absent when nobody
   has reproduced the build; the viewer's draft has no lamp yet, only a dashed
   outline where one will hang.

   ON THE LINEAGE PAGE a node is a choice rather than a way out: `onSelect` turns
   every node into a button that says which build's changes to show.

   PURE. */

import { useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { CoverFallback } from "@/components/brand/CoverFallback";
import { LampDot } from "@/components/brand/LampDot";
import { Panel, PanelHead } from "@/components/brand/Panel";
import { Segmented, type SegmentedItem } from "@/components/brand/Segmented";
import type { PageFit } from "@/components/shell/siteFrameFit";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, display } from "@/lib/theme/type";

import {
  CANVAS_HEIGHT,
  NODE_WIDTH,
  TREE_MAX_NODES,
  familyRows,
  familyStats,
  familySubtitle,
  layoutFamily,
  type FamilyNodeView,
} from "./rebuildModel";

export type FamilyReading = "tree" | "list";

const READINGS: readonly SegmentedItem<FamilyReading>[] = [
  { value: "tree", label: "Tree" },
  { value: "list", label: "List" },
];

/** The title on a node: the display face at its floor (the board draws 14; Sentient is never under 17 here). */
const nodeTitle: CSSProperties = {
  ...display(17),
  letterSpacing: "-0.01em",
  lineHeight: 1.05,
  textWrap: "nowrap",
  color: t.text,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const countLabel = (n: number) => (n > 0 ? n.toLocaleString("en-GB") : "—");

function nodeLabel(node: FamilyNodeView): string {
  const reproduced = node.reproduced > 0 ? `${node.reproduced.toLocaleString("en-GB")} reproduced` : "not yet reproduced";
  return `${node.title}, ${node.draft ? "your draft" : `by ${node.maker}`}, ${reproduced}`;
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
  children: ReactNode;
}) {
  const { state, handlers } = useInteractive<HTMLAnchorElement & HTMLButtonElement>();
  const common = {
    "data-testid": "family-node",
    "data-node-id": node.id,
    "data-draft": node.draft ? "" : undefined,
    "data-lamp": node.lamp,
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

/** The edge a node stands in: the viewer's draft is dashed `--action`; a chosen node or the page's own build is solid `--action`. */
function edge(node: FamilyNodeView, selected: boolean, width: number): CSSProperties {
  if (node.draft) return { borderWidth: 1.5, borderStyle: "dashed", borderColor: t.action };
  if (selected || node.current) return { borderWidth: 1.5, borderStyle: "solid", borderColor: t.action };
  return { borderWidth: width, borderStyle: "solid", borderColor: t.glassBorder };
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
        padding: 6,
        borderRadius: r.control,
        background: t.glass,
        ...edge(node, selected, 1),
        boxShadow: t.shadowCard,
        boxSizing: "border-box",
        display: "block",
      }}
    >
      {node.lamp === "healthy" || node.lamp === "stale" ? (
        <span style={{ position: "absolute", top: -10, left: "50%", marginLeft: -12, display: "flex" }}>
          <LampDot width={24} height={7} dim={node.lamp === "stale"} />
        </span>
      ) : null}
      <span style={{ display: "block", height: 50, borderRadius: r.chip, overflow: "hidden" }}>
        <CoverFallback seed={node.seed} sky={node.sky} radius={0} />
      </span>
      <span style={{ ...nodeTitle, display: "block", marginTop: 5 }}>{node.title}</span>
      <span
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 6,
          marginTop: 2,
          fontFamily: DM_MONO,
          fontSize: 10,
          lineHeight: "normal",
          color: t.text2,
        }}
      >
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.maker}</span>
        <span>{countLabel(node.reproduced)}</span>
      </span>
    </NodeTarget>
  );
}

export function FamilyTree({
  root,
  fit = "content",
  selectedId = null,
  onSelect,
}: {
  root: FamilyNodeView;
  fit?: PageFit;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const layout = layoutFamily(root);
  const height = fit === "board" ? CANVAS_HEIGHT : Math.max(CANVAS_HEIGHT, layout.height);
  return (
    <div
      data-testid="family-tree"
      role="group"
      aria-label="The family, as a tree"
      style={{ position: "relative", height, marginTop: 18, overflowX: "auto", overflowY: "hidden" }}
    >
      <div style={{ position: "relative", width: layout.width, height, margin: "0 auto" }}>
        <svg width={layout.width} height={height} viewBox={`0 0 ${layout.width} ${height}`} aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
          {layout.links.map((link) => (
            <path key={link.key} d={link.d} fill="none" stroke={t.line} strokeWidth={1.5} />
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
  return (
    <ol data-testid="family-list" aria-label="The family, oldest first" style={{ listStyle: "none", margin: phone ? "8px 0 0" : "12px 0 0", padding: 0 }}>
      {familyRows(root).map(({ node, depth }) => {
        const selected = node.id === selectedId;
        return (
          <li key={node.id} data-depth={depth} style={{ position: "relative" }}>
            {depth > 0 ? (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 22 * depth - 12,
                  top: 0,
                  width: 10,
                  height: 26,
                  borderLeft: `1.5px solid ${t.line}`,
                  borderBottom: `1.5px solid ${t.line}`,
                  borderRadius: `0 0 0 ${r.chip}`,
                  boxSizing: "border-box",
                }}
              />
            ) : null}
            <NodeTarget
              node={node}
              onSelect={onSelect}
              selected={selected}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                minHeight: 52,
                width: "100%",
                paddingLeft: 22 * depth,
                paddingRight: 0,
                border: 0,
                borderRadius: r.control,
                background: selected ? t.rowHighlight : "transparent",
                boxSizing: "border-box",
              }}
            >
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 9,
                  overflow: "hidden",
                  flexShrink: 0,
                  boxSizing: "border-box",
                  ...(node.draft ? { borderWidth: 1.5, borderStyle: "dashed", borderColor: t.action } : {}),
                }}
              >
                <CoverFallback seed={node.seed} sky={node.sky} radius={0} />
              </span>
              <span style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <span style={{ ...nodeTitle, display: "block" }}>{node.title}</span>
                <span style={{ fontFamily: DM_MONO, fontSize: 10, lineHeight: "normal", color: t.text2 }}>
                  {node.maker} · {countLabel(node.reproduced)} reproduced
                </span>
              </span>
              {node.lamp === "draft" ? (
                <span
                  aria-hidden="true"
                  style={{ width: 18, height: 6, borderRadius: "50%", borderWidth: 1.5, borderStyle: "dashed", borderColor: t.action, boxSizing: "border-box", flexShrink: 0 }}
                />
              ) : node.lamp === "unreproduced" ? (
                <span aria-hidden="true" style={{ width: 18, flexShrink: 0 }} />
              ) : (
                <LampDot width={18} height={6} dim={node.lamp === "stale"} />
              )}
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
  /** Fill the track (desktop). */
  fill?: boolean;
}

export function FamilyPanel({ root, fit = "content", phone = false, selectedId = null, onSelect, fill = false }: FamilyPanelProps) {
  const { builds } = familyStats(root);
  const [reading, setReading] = useState<FamilyReading>(builds > TREE_MAX_NODES ? "list" : "tree");
  const title = `Family of ${root?.title ?? "this build"}`;

  if (phone) {
    return (
      <Panel padding="14px 16px">
        <div data-testid="family-panel">
          <PanelHead headingLevel={2} title={title} subtitle="Lamps show which still work" />
          {root ? <FamilyList root={root} phone selectedId={selectedId} onSelect={onSelect} /> : null}
        </div>
      </Panel>
    );
  }

  return (
    <Panel padding="16px 18px" style={fill ? { height: "100%" } : undefined}>
      <div data-testid="family-panel">
        <PanelHead
          headingLevel={2}
          title={title}
          subtitle={familySubtitle(root)}
          right={<Segmented<FamilyReading> items={READINGS} value={reading} onChange={setReading} size={30} fontSize={11} label="Read the family as" />}
        />
        {root ? (
          reading === "tree" ? (
            <FamilyTree root={root} fit={fit} selectedId={selectedId} onSelect={onSelect} />
          ) : (
            <FamilyList root={root} selectedId={selectedId} onSelect={onSelect} />
          )
        ) : null}
      </div>
    </Panel>
  );
}

export default FamilyPanel;
