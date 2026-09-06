// Run it yourself: the executable sequence with the prose taken out.
//
// The Anatomy tab is the record — every node, its note, its provenance, nested
// the way the creator placed it. This tab is the opposite: the smallest thing
// a reader can follow to get the same result. So exactly two kinds of node
// reach it.
//
//   copyable types   become numbered steps. The registry decides which — a
//                    type is a step because node_types.copyable says so, never
//                    because this file lists it. Flip a type in the registry and
//                    this tab follows with no code change. Its COLOUR does not
//                    come from the registry any more — BG-P05 moved that to the
//                    node's category, resolved through the theme.
//   prerequisites    become an unnumbered checklist at the top, because "have
//                    a Google account" is not step one of anything.
//
// Everything else — results, screenshots, decisions, breakages, gaps — belongs
// to the record, not to the run, and is not rendered here at all.
//
// NOTES ARE NEVER SHOWN. Not on a step, not on a prerequisite, not in the
// copied text. A note is the creator explaining themselves; this tab is for a
// reader who has already decided to do the thing. Stripping the prose IS the
// feature, and it is the one thing about this file that must not be softened
// later by someone adding "just the note, it is short".

import { useEffect, useMemo, useRef, useState } from "react";
import type { Build, BuildNode, NodeTree, NodeType } from "@/lib/build";
import { getNodeCopyText } from "./renderers";
import { MonoBlock } from "./renderers/shared";
import {
  HAIRLINE,
  ORANGE,
  TEAL,
  TEXT_MUTED,
  TEXT_SECONDARY,
  bodyText,
  cardGlass,
  hexToRgba,
  labelText,
  titleText,
} from "./tokens";
import { categoryFill } from "@/lib/theme/category";

interface RunViewProps {
  tree: NodeTree[];
  nodeTypes: NodeType[];
  /** Only for the heading line on the copied sequence. Nothing is rendered. */
  build: Build;
}

/** The type whose nodes are hoisted out of the sequence into the checklist. */
const PREREQUISITE_TYPE = "prerequisite";

/** Lines of a step's copy text shown before the reveal. */
const COLLAPSE_AT = 20;

/** How long a copy button stays in its confirmed state. */
const COPIED_MS = 1500;

interface Step {
  node: BuildNode;
  nodeType?: NodeType;
  copyText: string | null;
}

interface Prerequisite {
  node: BuildNode;
  requirement: string | null;
}

function payloadString(node: BuildNode, key: string): string | null {
  const payload = node.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * One walk of the tree, in render order, sorting the nodes into the two things
 * this tab shows. A copyable node nested under a prerequisite is still a step:
 * the walk never stops descending, so nothing runnable can hide.
 */
function collect(tree: NodeTree[], typesByKey: Map<string, NodeType>) {
  const steps: Step[] = [];
  const prerequisites: Prerequisite[] = [];

  const walk = (nodes: NodeTree[]) => {
    for (const node of nodes) {
      const nodeType = typesByKey.get(node.type);

      if (node.type === PREREQUISITE_TYPE) {
        prerequisites.push({ node, requirement: payloadString(node, "requirement") });
      } else if (nodeType?.copyable) {
        steps.push({ node, nodeType, copyText: getNodeCopyText(node, nodeType) });
      }

      if (node.children.length > 0) walk(node.children);
    }
  };

  walk(tree);
  return { steps, prerequisites };
}

/**
 * The whole sequence as plain text.
 *
 * Plain text, not markdown: this goes into a terminal, a notes app or a chat
 * box, and a reader who wanted markdown wants the portable file instead. No
 * fences, no asterisks, no hashes — a numbered heading and the text under it.
 */
function sequenceText(build: Build, prerequisites: Prerequisite[], steps: Step[]): string {
  const blocks: string[] = [build.title];

  if (prerequisites.length > 0) {
    const lines = ["Before you start"];
    for (const item of prerequisites) {
      lines.push(`- ${item.node.title}${item.requirement ? ` — ${item.requirement}` : ""}`);
    }
    blocks.push(lines.join("\n"));
  }

  steps.forEach((step, index) => {
    const heading = `${index + 1}. ${step.node.title}`;
    blocks.push(step.copyText ? `${heading}\n${step.copyText}` : heading);
  });

  return `${blocks.join("\n\n")}\n`;
}

/**
 * A copy control. Deliberately not the one inside NodeCard: that button is the
 * Anatomy tab's, and this tab needs a second variant for the whole sequence.
 * Duplicating thirty lines keeps the two tabs independently revertable.
 */
function CopyButton({
  text,
  label,
  emphasis = false,
}: {
  text: string;
  label: string;
  emphasis?: boolean;
}) {
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

  const accent = emphasis ? ORANGE : TEAL;

  return (
    <button
      type="button"
      onClick={copy}
      style={{
        ...labelText,
        padding: emphasis ? "7px 14px" : "2px 9px",
        borderRadius: emphasis ? 8 : 6,
        fontSize: emphasis ? 12 : 11,
        cursor: "pointer",
        whiteSpace: "nowrap",
        color: copied || emphasis ? accent : TEXT_SECONDARY,
        background: copied || emphasis ? hexToRgba(accent, emphasis ? 0.12 : 0.14) : "transparent",
        border: `1px solid ${copied || emphasis ? hexToRgba(accent, 0.3) : HAIRLINE}`,
        transition: "color 120ms ease, border-color 120ms ease",
      }}
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}

function Checklist({ prerequisites }: { prerequisites: Prerequisite[] }) {
  return (
    <section
      data-visual-slot="build-run-prerequisites"
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED, textTransform: "uppercase" }}>
        Before you start
      </span>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {prerequisites.map(({ node, requirement }) => (
          <li
            key={node.id}
            data-node-id={node.id}
            style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 13,
                height: 13,
                marginTop: 3,
                flexShrink: 0,
                borderRadius: 3,
                border: `1px solid ${hexToRgba(TEAL, 0.45)}`,
              }}
            />
            <span style={{ ...bodyText, minWidth: 0 }}>
              {node.title}
              {requirement ? (
                <span style={{ color: TEXT_SECONDARY }}> — {requirement}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StepCard({ step, number }: { step: Step; number: number }) {
  // BG-P05: the step number takes its colour from the step's category, not from
  // `node_types.colour` — the registry stores a colour, and the theme decides one.
  const fill = categoryFill(step.nodeType?.category ?? step.node.type);

  return (
    <li style={{ listStyle: "none" }}>
      <article
        data-visual-slot="build-run-step"
        data-node-id={step.node.id}
        data-node-type={step.node.type}
        style={{ ...cardGlass, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span
            aria-hidden="true"
            style={{
              ...labelText,
              width: 24,
              height: 24,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 0,
              color: fill.color,
              background: fill.background,
            }}
          >
            {number}
          </span>
          <h3 style={{ ...titleText, margin: 0, minWidth: 0 }}>
            <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
              {`Step ${number}: `}
            </span>
            {step.node.title}
          </h3>
          <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED, textTransform: "uppercase" }}>
            {step.nodeType?.label ?? step.node.type}
          </span>
          <span style={{ marginLeft: "auto" }}>
            {step.copyText ? <CopyButton text={step.copyText} label="Copy" /> : null}
          </span>
        </div>

        {step.copyText ? (
          <MonoBlock text={step.copyText} collapseTo={COLLAPSE_AT} />
        ) : (
          <span style={{ ...bodyText, color: TEXT_MUTED }}>
            This step carries nothing to copy yet.
          </span>
        )}
      </article>
    </li>
  );
}

export function RunView({ tree, nodeTypes, build }: RunViewProps) {
  const typesByKey = useMemo(
    () => new Map(nodeTypes.map((type) => [type.key, type])),
    [nodeTypes]
  );
  const { steps, prerequisites } = useMemo(() => collect(tree, typesByKey), [tree, typesByKey]);
  const allText = useMemo(
    () => sequenceText(build, prerequisites, steps),
    [build, prerequisites, steps]
  );

  if (steps.length === 0 && prerequisites.length === 0) {
    return (
      <p style={{ ...bodyText, color: TEXT_MUTED, margin: 0 }}>
        Nothing in this build is runnable yet. The anatomy has no copyable nodes in it.
      </p>
    );
  }

  return (
    <section
      data-visual-slot="build-run-view"
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {steps.length > 0 ? <CopyButton text={allText} label="Copy all steps" emphasis /> : null}
        <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED }}>
          {steps.length === 1 ? "1 step" : `${steps.length} steps`}
        </span>
      </div>

      {prerequisites.length > 0 ? <Checklist prerequisites={prerequisites} /> : null}

      {steps.length > 0 ? (
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
          {steps.map((step, index) => (
            <StepCard key={step.node.id} step={step} number={index + 1} />
          ))}
        </ol>
      ) : null}
    </section>
  );
}

export default RunView;
