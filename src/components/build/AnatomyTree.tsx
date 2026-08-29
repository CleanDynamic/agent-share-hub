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
import { HAIRLINE, TEXT_MUTED, TEXT_SECONDARY, bodyText } from "./tokens";

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
}

/** Indentation per level. Three levels deep is the deepest the schema allows. */
const INDENT = 18;

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden="true"
      style={{
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 120ms ease",
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
}: {
  node: NodeTree;
  typesByKey: Map<string, NodeType>;
  depth: number;
  build: Build;
  resolveNode: ResolveNode;
  resolveMedia: ResolveMedia;
  renderFooter?: (node: BuildNode) => ReactNode;
}) {
  // Expanded by default at every level: the anatomy is the point of the page.
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <li style={{ listStyle: "none", margin: 0, padding: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? `Collapse ${node.title}` : `Expand ${node.title}`}
            style={{
              marginTop: 16,
              width: 18,
              height: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: TEXT_SECONDARY,
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
      </div>

      {hasChildren && open ? (
        <ul
          style={{
            listStyle: "none",
            margin: `10px 0 0 ${INDENT}px`,
            padding: "0 0 0 16px",
            // The hairline connector down the left of every nested level.
            borderLeft: `1px solid ${HAIRLINE}`,
            display: "flex",
            flexDirection: "column",
            gap: 10,
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
}: AnatomyTreeProps) {
  const typesByKey = new Map(nodeTypes.map((type) => [type.key, type]));

  if (tree.length === 0) {
    return (
      <p style={{ ...bodyText, color: TEXT_MUTED, margin: 0 }}>
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
        gap: 12,
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
        />
      ))}
    </ul>
  );
}

export default AnatomyTree;
