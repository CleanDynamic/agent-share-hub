// One node, as a card. The pill colour comes from the node's CATEGORY, resolved
// through src/lib/theme/category.ts, so a type added to node_types shows up here
// with no code change and in one of the nine hues. BG-P05: `node_types.colour`
// is no longer read — a type recoloured in the registry does NOT recolour this
// pill, because a part's colour is what category it is, not a per-row choice.
//
// The card owns two things the renderers do not: the type pill, and the copy
// control. Copy is here rather than in each renderer so that every copyable
// type gets the same affordance in the same place — the card asks the registry
// what "copy this node" means for the type and renders one button, or none.

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Build, BuildNode, NodeType } from "@/lib/build";
import {
  getNodeCopyText,
  resolveRenderer,
  type ResolveMedia,
  type ResolveNode,
} from "./renderers";
import {
  HAIRLINE,
  TEAL,
  TEXT_SECONDARY,
  bodyText,
  cardGlass,
  hexToRgba,
  labelText,
  titleText,
} from "./tokens";
import { categoryColour, categoryFill } from "@/lib/theme/category";

interface NodeCardProps {
  node: BuildNode;
  nodeType?: NodeType;
  build: Build;
  resolveNode: ResolveNode;
  /** The build's media, loaded once by the page. See MediaFigure.tsx. */
  resolveMedia: ResolveMedia;
  /**
   * Whatever the page wants to hang under this node (NS-P52).
   *
   * The gap panel on a node with an open bounty, the solver's credit on one a
   * bounty has filled — and nothing at all on the great majority of nodes. It
   * arrives as a rendered child rather than as data because this card must go
   * on knowing nothing about bounties: it draws a node, and the page decides
   * what else is true about that node.
   */
  footer?: ReactNode;
}

/** How long the button stays in its confirmed state. */
const COPIED_MS = 1500;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      // A denied clipboard permission is not worth a toast on a read surface.
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : "Copy"}
      style={{
        ...labelText,
        marginLeft: "auto",
        padding: "2px 9px",
        borderRadius: 6,
        fontSize: 11,
        cursor: "pointer",
        color: copied ? TEAL : TEXT_SECONDARY,
        background: copied ? hexToRgba(TEAL, 0.14) : "transparent",
        border: `1px solid ${copied ? hexToRgba(TEAL, 0.3) : HAIRLINE}`,
        transition: "color 120ms ease, border-color 120ms ease",
      }}
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

export function NodeCard({
  node,
  nodeType,
  build,
  resolveNode,
  resolveMedia,
  footer,
}: NodeCardProps) {
  const fill = categoryFill(nodeType?.category ?? node.type);

  const surface: CSSProperties = {
    ...cardGlass,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    // A gap is the one thing on this page that is allowed to shout.
      // Longhands rather than the `border-left` shorthand: a shorthand whose
      // colour is a `var()` is valid CSS but jsdom's cssstyle drops the whole
      // declaration, so the edge's width and style would vanish from every unit
      // test that renders this. Split, the geometry survives the test
      // environment and the colour is the token in the browser.
    ...(node.is_gap
      ? {
          borderLeftWidth: 3,
          borderLeftStyle: "solid" as const,
          borderLeftColor: categoryColour("breakage"),
        }
      : {}),
  };

  // The registry decides which renderer draws the payload, and whether there
  // is anything worth copying. An unknown renderer resolves to GenericPayload.
  const Renderer = resolveRenderer(nodeType?.renderer);
  const copyText = nodeType?.copyable ? getNodeCopyText(node, nodeType) : null;

  return (
    <article
      data-visual-slot="build-node-card"
      data-node-id={node.id}
      data-node-type={node.type}
      style={surface}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span
          style={{
            ...labelText,
            color: fill.color,
            background: fill.background,
            padding: "2px 8px",
            borderRadius: 6,
            textTransform: "uppercase",
            fontSize: 11,
          }}
        >
          {nodeType?.label ?? node.type}
        </span>
        {node.is_gap ? (
          <span style={{ ...labelText, color: categoryColour("breakage"), fontSize: 11 }}>
            unsolved
          </span>
        ) : null}
        {copyText ? <CopyButton text={copyText} /> : null}
      </div>

      <h3 style={{ ...titleText, margin: 0 }}>{node.title}</h3>

      {node.note ? (
        <p
          style={{
            ...bodyText,
            margin: 0,
            color: TEXT_SECONDARY,
            whiteSpace: "pre-wrap",
          }}
        >
          {node.note}
        </p>
      ) : null}

      <div data-renderer-slot={nodeType?.renderer ?? "generic"} style={{ minWidth: 0 }}>
        <Renderer
          node={node}
          nodeType={nodeType}
          build={build}
          resolveNode={resolveNode}
          resolveMedia={resolveMedia}
        />
      </div>

      {footer}
    </article>
  );
}

export default NodeCard;
