// One node, as a card. The pill colour comes from the node's registry row, so
// a type added or recoloured in node_types shows up here with no code change.
//
// The body is resolved the same way: by node_types.renderer, through the
// registry in ./renderers. This component never switches on node.type, and it
// never imports a typed renderer directly.

import { useEffect, useState, type CSSProperties } from "react";
import type { Build, BuildNode, NodeType } from "@/lib/build";
import { resolveCopyText, resolveRenderer, type ResolveNode } from "./renderers";
import {
  CATEGORY_COLOUR,
  GAP_RED,
  HAIRLINE,
  TEAL,
  TEXT_SECONDARY,
  bodyText,
  cardGlass,
  hexToRgba,
  labelText,
  titleText,
} from "./tokens";

interface NodeCardProps {
  node: BuildNode;
  nodeType?: NodeType;
  build: Build;
  resolveNode: ResolveNode;
}

/** How long the button admits it worked before going back to "Copy". */
const COPIED_MS = 1600;

/**
 * The copy control.
 *
 * It lives here rather than in each renderer for two reasons: whether a type is
 * copyable is a registry decision (node_types.copyable), and the clipboard
 * should get the payload's raw text, never the markup a renderer wrapped it in.
 * The string comes from the renderer module's getCopyText, or from the schema
 * default — the first required text field.
 */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!copied && !failed) return;
    const timer = window.setTimeout(() => {
      setCopied(false);
      setFailed(false);
    }, COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied, failed]);

  const onCopy = () => {
    // No clipboard in an insecure context or an old browser. Say so rather
    // than looking like it worked.
    if (!navigator.clipboard?.writeText) {
      setFailed(true);
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => setCopied(true),
      () => setFailed(true)
    );
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label="Copy to clipboard"
      style={{
        ...labelText,
        marginLeft: "auto",
        fontSize: 11,
        padding: "3px 10px",
        borderRadius: 6,
        border: `1px solid ${HAIRLINE}`,
        background: "rgba(255,255,255,0.04)",
        color: copied ? TEAL : failed ? GAP_RED : TEXT_SECONDARY,
        cursor: "pointer",
      }}
    >
      {copied ? "Copied" : failed ? "Copy failed" : "Copy"}
    </button>
  );
}

export function NodeCard({ node, nodeType, build, resolveNode }: NodeCardProps) {
  const colour =
    nodeType?.colour ??
    CATEGORY_COLOUR[nodeType?.category ?? node.type] ??
    CATEGORY_COLOUR.narrative;

  const surface: CSSProperties = {
    ...cardGlass,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    // A gap is the one thing on this page that is allowed to shout.
    ...(node.is_gap
      ? { borderLeft: `3px solid ${GAP_RED}` }
      : {}),
  };

  const Renderer = resolveRenderer(nodeType?.renderer);
  const copyText = nodeType?.copyable ? resolveCopyText(node, nodeType) : null;

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
            color: colour,
            background: hexToRgba(colour, 0.15),
            padding: "2px 8px",
            borderRadius: 6,
            textTransform: "uppercase",
            fontSize: 11,
          }}
        >
          {nodeType?.label ?? node.type}
        </span>
        {node.is_gap ? (
          <span style={{ ...labelText, color: GAP_RED, fontSize: 11 }}>
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

      {/* Renderer slot. The key is the registry's, not this component's. */}
      <div data-renderer-slot={nodeType?.renderer ?? "generic"}>
        <Renderer
          node={node}
          nodeType={nodeType}
          build={build}
          resolveNode={resolveNode}
        />
      </div>
    </article>
  );
}

export default NodeCard;
