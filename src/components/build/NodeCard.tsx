// One node, as a card. The pill colour comes from the node's registry row, so
// a type added or recoloured in node_types shows up here with no code change.

import type { CSSProperties } from "react";
import type { BuildNode, NodePayload, NodeType } from "@/lib/build";
import { GenericPayload } from "./GenericPayload";
import {
  CATEGORY_COLOUR,
  GAP_RED,
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
}

export function NodeCard({ node, nodeType }: NodeCardProps) {
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

      {/* Renderer slot. NS-P05 swaps a typed renderer in here per node type and
          keeps GenericPayload as the fallback. */}
      <div data-renderer-slot={nodeType?.renderer ?? "generic"}>
        <GenericPayload payload={node.payload as NodePayload} fields={nodeType?.schema.fields ?? []} />
      </div>
    </article>
  );
}

export default NodeCard;
