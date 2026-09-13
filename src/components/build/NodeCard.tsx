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
import { cardGlass } from "./tokens";
import { useActionStyle } from "./actionStyle";
import { CategoryChip } from "@/components/brand/CategoryChip";
import { GapMarker, gapEdge } from "@/components/brand/GapMarker";
import { t } from "@/lib/theme/tokens";
import { body as bodyType, label as labelType, measure } from "@/lib/theme/type";

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
  const action = useActionStyle("secondary");

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
    /* SECONDARY, AND CONFIRMED IS A STATE OF IT. One copy control per copyable
       type, in the same place on every card, so the affordance is learned once.
       The confirmed pairing is the measured `--evidence-fill` / `--evidence`
       one — "it worked" is what `--evidence` names — rather than the 14% teal
       wash it replaces, which nobody measured and which vanished on Exhibition. */
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : "Copy"}
      {...action.handlers}
      style={{
        ...action.style,
        ...labelType,
        marginLeft: "auto",
        padding: "2px 9px",
        ...(copied
          ? { background: t.evidenceFill, color: t.evidence, borderColor: t.evidence }
          : {}),
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
  const category = nodeType?.category ?? node.type;
  const label = nodeType?.label ?? node.type;

  const surface: CSSProperties = {
    ...cardGlass,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    /* A gap keeps the ordinary node shape and redraws its left edge (BG-P11).
       DASHED rather than the 3px SOLID this file used to draw: solid says
       "this is what it is" and dashed says "this is where something goes",
       which is the whole difference between a defect and an invitation. The
       edge is GapMarker's, so this card, the build card and the gap panel
       cannot drift to three different dashes. */
    ...(node.is_gap ? gapEdge("row") : {}),
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
        {/* A GAP KEEPS ITS OWN CATEGORY CHIP. A gap on an agent config is still
            configuration — that is what routes it to people who write agent
            configs — so the chip is the part's own hue and the breakage red is
            spent on the edge. GapMarker renders the chip AND the word, in that
            order, which is the order this row already had. */}
        {node.is_gap ? (
          <GapMarker placement="row" category={category} categoryLabel={label} />
        ) : (
          <CategoryChip category={category} label={label} />
        )}
        {copyText ? <CopyButton text={copyText} /> : null}
      </div>

      {/* BODY AT 600, NOT THE DISPLAY FACE. A node title is a heading inside a
          list that can run to twenty of them; `cardTitle` is Bodoni at 22 and
          belongs to the build's own card, where there is one per object. Twenty
          didone headings in a tree would out-shout the build's title two
          screens above them, which is the hierarchy this page cannot afford to
          lose. Figtree at the body size, at the weight the face publishes for
          emphasis, is the heading a list row gets. */}
      <h3 style={{ ...bodyType, fontWeight: 600, margin: 0, color: t.text }}>
        {node.title}
      </h3>

      {node.note ? (
        <p
          style={{
            ...bodyType,
            ...measure,
            margin: 0,
            color: t.text2,
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
