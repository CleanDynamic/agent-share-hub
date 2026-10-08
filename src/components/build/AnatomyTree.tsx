// The anatomy: the placed node tree, nested and collapsible at every level.
//
// The tree handed in here is what getNodeTree returned, which excludes tray
// nodes in the query itself. Nothing is filtered again in this component — if
// a tray node ever reached the page, the bug would be in the data layer and
// re-filtering here would only hide it.

import { useState } from "react";
import type { ReactNode } from "react";
import type { Build, BuildNode, NodeTree, NodeType } from "@/lib/build";
import { NodeCard } from "./NodeCard";
import type { ResolveMedia, ResolveNode } from "./renderers";
import { t } from "@/lib/theme/tokens";
import { body as bodyType, measure } from "@/lib/theme/type";
import { feedback } from "@/lib/theme/motion";
import { PartCommentMarker } from "@/components/social/PartCommentMarker";

/**
 * RC-P17 — each part's comment count, and what "Comment on this part" does.
 * Supplied by BuildPage for a published build; absent, the rows are exactly
 * what they were.
 */
export interface PartComments {
  counts: Record<string, number>;
  onComment: (nodeId: string) => void;
}

interface AnatomyTreeProps {
  tree: NodeTree[];
  nodeTypes: NodeType[];
  build: Build;
  /** Supplied by BuildPage from the loaded tree, so renderers never query. */
  resolveNode: ResolveNode;
  /** Supplied by BuildPage from one media query, for the same reason. */
  resolveMedia: ResolveMedia;
  /**
   * What to hang under a given node, if anything (NS-P52).
   *
   * Passed straight through to NodeCard's footer. The tree does not look at
   * what comes back and has no opinion about which nodes get one — that is the
   * page's, which is the only layer that knows what bounties exist.
   */
  renderFooter?: (node: BuildNode) => ReactNode;
  partComments?: PartComments;
}

/** Indentation per level. Three levels deep is the deepest the schema allows. */
const INDENT = 18;

/* ── BG-P21 — DEPTH IS CARRIED BY ALIGNMENT, NOT BY NESTING ───────────────────

   `law-of-continuity`: the eye follows an unbroken path, so a level reads as a
   level when its rows share a left edge and one line runs down it. It does NOT
   read as a level by being put inside a box — a card inside a card inside a
   card is three borders competing to say the same thing, and by the third the
   reader is measuring insets instead of reading the build.

   This tree was already built that way and BG-P21 keeps it: a child list is a
   SIBLING of its parent's card rather than a child of it, indented by the width
   of the chevron column so the guide lands exactly under the disclosure control
   that owns it. The only thing carrying depth is that alignment plus the
   hairline, which is why the hairline has to be a hairline — `--line` at 1px,
   the same rule used everywhere else in the system, and never a heavier or
   tinted edge that would start competing with the category chips it runs past.
   ─────────────────────────────────────────────────────────────────────────── */

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden="true"
      style={{
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        transition: feedback("transform"),
      }}
    >
      <path d="M3 1 L7 5 L3 9" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function TreeNode({
  node,
  typesByKey,
  depth,
  build,
  resolveNode,
  resolveMedia,
  renderFooter,
  partComments,
}: {
  node: NodeTree;
  typesByKey: Map<string, NodeType>;
  depth: number;
  build: Build;
  resolveNode: ResolveNode;
  resolveMedia: ResolveMedia;
  renderFooter?: (node: BuildNode) => ReactNode;
  partComments?: PartComments;
}) {
  // Expanded by default at every level: the anatomy is the point of the page.
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <li style={{ listStyle: "none", margin: 0, padding: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? `Collapse ${node.title}` : `Expand ${node.title}`}
            style={{
              marginTop: 12,
              width: 18,
              height: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: t.text2,
            }}
          >
            <Chevron open={open} />
          </button>
        ) : (
          <span style={{ width: 18, flexShrink: 0 }} aria-hidden="true" />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <NodeCard
            node={node}
            nodeType={typesByKey.get(node.type)}
            build={build}
            resolveNode={resolveNode}
            resolveMedia={resolveMedia}
            footer={renderFooter?.(node)}
          />
        </div>
        {/* RC-P17 — a NEW element at the row's trailing end: comment on this
            part. Nothing already in the row moves or changes. */}
        {partComments ? (
          <PartCommentMarker
            count={partComments.counts[node.id] ?? 0}
            onPress={() => partComments.onComment(node.id)}
          />
        ) : null}
      </div>

      {hasChildren && open ? (
        <ul
          style={{
            listStyle: "none",
            margin: `7px 0 0 ${INDENT}px`,
            padding: "0 0 0 12px",
            // The hairline connector down the left of every nested level. One
            // line, one pixel, `--line` — the guide, not a second container.
            borderLeft: `1px solid ${t.line}`,
            display: "flex",
            flexDirection: "column",
            gap: 7,
          }}
        >
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              typesByKey={typesByKey}
              depth={depth + 1}
              build={build}
              resolveNode={resolveNode}
              resolveMedia={resolveMedia}
              renderFooter={renderFooter}
              partComments={partComments}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function AnatomyTree({
  tree,
  nodeTypes,
  build,
  resolveNode,
  resolveMedia,
  renderFooter,
  partComments,
}: AnatomyTreeProps) {
  const typesByKey = new Map(nodeTypes.map((type) => [type.key, type]));

  if (tree.length === 0) {
    return (
      <p style={{ ...bodyType, ...measure, color: t.text2, margin: 0 }}>
        Nothing has been placed in this build yet.
      </p>
    );
  }

  return (
    <ul
      data-visual-slot="build-anatomy-tree"
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: 9,
      }}
    >
      {tree.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          typesByKey={typesByKey}
          depth={0}
          build={build}
          resolveNode={resolveNode}
          resolveMedia={resolveMedia}
          renderFooter={renderFooter}
          partComments={partComments}
        />
      ))}
    </ul>
  );
}

export default AnatomyTree;
