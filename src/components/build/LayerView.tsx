// A generated explanation layer, as a reader meets it.
//
// TWO THINGS THIS FILE IS NOT ALLOWED TO SOFTEN.
//
//   THE ATTRIBUTION LINE IS PERMANENT. Not a tooltip, not a footnote, not
//   something that scrolls away and not something a reader can dismiss. Every
//   generated layer says where its words came from, at the top, every time. A
//   reader must never be able to mistake this for the creator writing to them.
//
//   NOTHING UNAPPROVED REACHES HERE. The filter is in the query — see
//   getApprovedLayers — and this component is only ever handed a row that came
//   back through it. There is no "unapproved" state to render, deliberately:
//   an unapproved layer is absent from the page, not greyed out on it.
//
// A step that names a node links into the Anatomy tab. A step whose node_ref
// no longer resolves — the node was deleted after the layer was written —
// renders as an ordinary unlinked step rather than a dead link, which is
// exactly what the NS-P22 migration says should happen to a dangling ref.
//
// Styled with inline style objects like the rest of this route: Tailwind's
// generated utilities win over hand-written classes at build time.

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  LAYER_ATTRIBUTION,
  LAYER_BLURB,
  type BuildLayer,
  type BuildNode,
  type Layer,
} from "@/lib/build";
import {
  HAIRLINE,
  ORANGE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  bodyText,
  cardGlass,
  hexToRgba,
  labelText,
  titleText,
} from "./tokens";
import { measure } from "@/lib/theme/type";

/** One accent per layer: the doing layer takes the instruction colour. */
const LAYER_COLOUR: Record<Layer, string> = {
  run: ORANGE,
  understand: TEAL,
};

export interface LayerViewProps {
  layer: BuildLayer;
  /** The page's index of its own tree. A ref that misses renders unlinked. */
  resolveNode: (id: string) => BuildNode | undefined;
  /** Take the reader to that node in the Anatomy tab. */
  onOpenNode?: (nodeId: string) => void;
}

/**
 * The line that says whose words these are.
 *
 * Rendered by LayerView itself rather than by its callers, so there is no way
 * to put a generated layer on the page without it.
 */
function Attribution({ colour }: { colour: string }) {
  return (
    <p
      data-testid="layer-attribution"
      style={{
        ...labelText,
        margin: 0,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 8,
        border: `1px solid ${HAIRLINE}`,
        borderLeft: `2px solid ${colour}`,
        background: hexToRgba(colour, 0.05),
        color: TEXT_SECONDARY,
        fontWeight: 400,
        letterSpacing: 0,
        lineHeight: 1.5,
      }}
    >
      {LAYER_ATTRIBUTION}
    </p>
  );
}

function StepCard({
  step,
  colour,
  node,
  onOpenNode,
}: {
  step: { n: number; title: string; body: string; node_ref: string | null };
  colour: string;
  node: BuildNode | undefined;
  onOpenNode?: (nodeId: string) => void;
}) {
  const surface: CSSProperties = {
    ...cardGlass,
    padding: "14px 16px",
    display: "flex",
    gap: 12,
  };

  return (
    <li>
      <article style={surface}>
        <span
          aria-hidden
          style={{
            ...labelText,
            flexShrink: 0,
            width: 24,
            height: 24,
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: colour,
            background: hexToRgba(colour, 0.15),
            fontSize: 11,
          }}
        >
          {step.n}
        </span>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
          {step.title ? (
            <h3 style={{ ...titleText, margin: 0 }}>
              <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                {`Step ${step.n}: `}
              </span>
              {step.title}
            </h3>
          ) : null}

          {step.body ? (
            <p style={{ ...bodyText, ...measure, margin: 0, whiteSpace: "pre-wrap", color: TEXT_PRIMARY }}>
              {step.body}
            </p>
          ) : null}

          {node && onOpenNode ? (
            <button
              type="button"
              onClick={() => onOpenNode(node.id)}
              style={{
                ...labelText,
                fontFamily: "inherit",
                alignSelf: "flex-start",
                background: "transparent",
                border: "none",
                padding: 0,
                color: colour,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {node.title || "This step’s node"} in the anatomy →
            </button>
          ) : null}
        </div>
      </article>
    </li>
  );
}

export function LayerView({ layer, resolveNode, onOpenNode }: LayerViewProps) {
  const colour = LAYER_COLOUR[layer.layer];
  const steps = layer.content.steps;

  return (
    <section
      data-visual-slot="build-layer-view"
      data-layer={layer.layer}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <Attribution colour={colour} />

      <p style={{ ...bodyText, ...measure, margin: 0, color: TEXT_SECONDARY }}>
        {LAYER_BLURB[layer.layer]}
      </p>

      {steps.length === 0 ? (
        <p style={{ ...bodyText, margin: 0, color: TEXT_MUTED }}>
          This layer has no steps in it.
        </p>
      ) : (
        <ol
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {steps.map((step) => (
            <StepCard
              key={step.n}
              step={step}
              colour={colour}
              node={step.node_ref ? resolveNode(step.node_ref) : undefined}
              onOpenNode={onOpenNode}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

const switchBase: CSSProperties = {
  ...labelText,
  fontFamily: "inherit",
  height: 28,
  padding: "0 12px",
  borderRadius: 100,
  border: "1px solid transparent",
  background: "transparent",
  cursor: "pointer",
};

/**
 * Run it yourself, in two states.
 *
 * The sequence is the default and stays the default: it is the material, it is
 * exact, and it is what a reader who came to run this build actually needs. The
 * generated layer is the second state, offered beside it — never in front of
 * it, and never instead of it.
 *
 * Rendered only where an APPROVED run layer exists. With no layer the tab is
 * the sequence alone, exactly as NS-P06 left it, with no control at all.
 */
export function RunItPanel({
  sequence,
  layer,
  resolveNode,
  onOpenNode,
}: {
  /** The executable sequence from NS-P06. */
  sequence: ReactNode;
  layer: BuildLayer;
  resolveNode: (id: string) => BuildNode | undefined;
  onOpenNode?: (nodeId: string) => void;
}) {
  const [showLayer, setShowLayer] = useState(false);

  const states: { id: string; label: string; on: boolean }[] = [
    { id: "sequence", label: "The sequence", on: !showLayer },
    { id: "words", label: "In words", on: showLayer },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        role="group"
        aria-label="How to read this build"
        style={{
          display: "inline-flex",
          alignSelf: "flex-start",
          gap: 4,
          padding: 3,
          borderRadius: 100,
          border: `1px solid ${HAIRLINE}`,
          background: "rgba(255,255,255,0.025)",
        }}
      >
        {states.map((state) => (
          <button
            key={state.id}
            type="button"
            aria-pressed={state.on}
            onClick={() => setShowLayer(state.id === "words")}
            style={{
              ...switchBase,
              color: state.on ? TEXT_PRIMARY : TEXT_SECONDARY,
              background: state.on ? hexToRgba(ORANGE, 0.14) : "transparent",
              borderColor: state.on ? hexToRgba(ORANGE, 0.45) : "transparent",
            }}
          >
            {state.label}
          </button>
        ))}
      </div>

      {showLayer ? (
        <LayerView layer={layer} resolveNode={resolveNode} onOpenNode={onOpenNode} />
      ) : (
        sequence
      )}
    </div>
  );
}

export default LayerView;
