// The inspector: the right rail of the compose workspace.
//
// It resolves the selected node's type against the registry and renders that
// type's schema. There is no component in this file, or anywhere under it, that
// is named after a node type or knows what one contains — the whole point of
// node_types.schema is that a prompt and a result are the same code path with
// different rows behind them.
//
// Three columns are edited here. `title` and `note` are columns on every node
// whatever its type, so they are rendered first; `payload` is the typed part
// and belongs to the schema, so it is rendered by SchemaForm below them. Title
// and note are written by this file's own debounced writer, payload by
// SchemaForm's. The two own disjoint column sets — see the note at the top of
// SchemaForm.tsx for why that is what keeps them from overwriting each other.
//
// NS-P09 shipped this panel with a three-type gate. NS-P10 removed it: every
// active row in node_types is edited through the same SchemaForm, and there is
// no list of type keys anywhere in this file to fall out of date with the
// registry. A type whose form reads badly is a schema row to correct, not a
// branch to add here.
//
// A FOURTH THING IS EDITED HERE SINCE NS-P51: `is_gap`, and the problem
// statement that goes with it. Both belong to this file rather than to
// SchemaForm for the same reason title and note do — they are columns and
// conventions every node carries whatever its type, not fields of any type's
// dialect. See src/lib/build/gaps.ts for why the node keeps its type and why
// the statement lives at payload.gap_problem.

import { useCallback, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Json } from "@/integrations/supabase/types";
import type { FieldDef, NodePayload, NodeTree, NodeType } from "@/lib/build";
import { gapProblem, gapProblemPatch } from "@/lib/build";
import type { ComposeBuild } from "@/hooks/useComposeBuild";
import { r } from "@/lib/theme/radius";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import {
  body as bodyText,
  cardTitle as titleText,
  eyebrow,
  label as labelText,
} from "@/lib/theme/type";
import { TypePill } from "@/components/compose/TreeNode";
import {
  SchemaForm,
  asPayload,
  findNodeInRecord,
  useNodeWrite,
} from "@/components/compose/SchemaForm";
import {
  NodeRefProvider,
  blurControl,
  controlStyle,
  focusControl,
  helpStyle,
} from "@/components/compose/fields";
import { feedback } from "@/lib/theme/motion";

/** Enough of a UUID to recognise a node in a log or an export. */
const ID_PREFIX_LENGTH = 8;

function countDescendants(node: NodeTree | null): number {
  if (!node) return 0;
  return node.children.reduce((total, child) => total + 1 + countDescendants(child), 0);
}

function findInTree(nodes: NodeTree[], nodeId: string): NodeTree | null {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    const hit = findInTree(node.children, nodeId);
    if (hit) return hit;
  }
  return null;
}

/** A panel's own name. Mono, like every other eyebrow naming a surface. */
const sectionLabel: React.CSSProperties = {
  ...eyebrow,
  color: t.text2,
};

/**
 * What the panel says with nothing selected.
 *
 * A named, empty panel rather than a blank one: a creator who has not clicked a
 * node yet should be told what clicking one will do, not shown a hole in the
 * layout.
 */
function EmptyState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 18 }}>
      <span style={sectionLabel}>Inspector</span>
      <p style={{ ...bodyText, fontSize: 13, margin: 0, color: t.text2 }}>
        Select a node to edit its fields. What appears here is whatever that
        node's type says it holds.
      </p>
    </div>
  );
}

/**
 * Whether a field holds something a reader would see.
 *
 * A number of 0 and a boolean of false are answers, not blanks — the creator
 * set them deliberately and a count that ignored them would be lying. An empty
 * string, an empty list and an empty object are not.
 */
function isFilled(value: Json | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

/**
 * "3 of 5 suggested fields filled" for the selected node.
 *
 * SUGGESTED, and never a score. The count covers every field the type declares,
 * because the schema is this type's suggestion of what such a node usually
 * holds — not a checklist anyone has to complete. Nothing here turns red, fills
 * a bar, or reports a percentage: a node with two of nine fields filled may be
 * exactly the node its author meant to write. Build-level completeness is
 * NS-P17's question and is deliberately not answered here.
 */
function SuggestedFields({ fields, payload }: { fields: FieldDef[]; payload: NodePayload }) {
  const filled = useMemo(
    () => fields.filter((field) => isFilled(payload[field.key])).length,
    [fields, payload]
  );
  if (fields.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ ...labelText, color: t.text }}>
        {filled === fields.length
          ? `All ${fields.length} suggested fields filled`
          : `${filled} of ${fields.length} suggested fields filled`}
      </span>
      <span style={{ ...helpStyle, color: t.text2 }}>
        What this type suggests. Fill what you have.
      </span>
    </div>
  );
}

/**
 * The copy, held as constants because it is the design.
 *
 * "Unsolved" is the word, because it is already the word — the public build
 * page and the bounty board both use it for this flag, and a creator should
 * meet one name for one thing. The help line says what turning it on actually
 * does, all three consequences and none of them a punishment, so that it is an
 * informed act rather than a guess about what red means.
 */
const UNSOLVED_LABEL = "Unsolved";
const UNSOLVED_HELP =
  "This part is a hole someone could fill. It goes red in the tree, reads as an admitted hole rather than a filled one, and can carry a bounty when you publish.";
const PROBLEM_LABEL = "What is missing?";
const PROBLEM_HELP =
  "Optional, and the difference between a gap someone picks up and one they scroll past.";
const PROBLEM_PLACEHOLDER =
  "What you were trying to do, what you tried, and how you would know it was solved.";

const TRACK_WIDTH = 34;
const TRACK_HEIGHT = 20;
const KNOB = 14;

/**
 * The unsolved flag, and the sentence that goes with it.
 *
 * TWO COLUMNS, TWO WRITERS, ONE HOOK. `is_gap` is a column and goes through
 * `patch`; the problem statement is a payload key and goes through
 * `patchPayload`. Both are this panel's own writer, which now touches `payload`
 * as well as `title` and `note` — see the note at the top of SchemaForm.tsx for
 * why that is safe alongside the form's own payload writer.
 *
 * TURNING THE FLAG OFF DOES NOT ERASE THE SENTENCE. The key stays in the
 * payload, so a creator who mis-clicks and toggles straight back finds their
 * paragraph where they left it. The cost is a key on a node that is no longer a
 * gap — invisible on the public page, because no node type declares it and a
 * renderer prints only what its type declares — and that is the cheaper of the
 * two mistakes to make.
 */
function GapControl({
  isGap,
  problem,
  onToggle,
  onProblemChange,
}: {
  isGap: boolean;
  problem: string;
  onToggle: (next: boolean) => void;
  onProblemChange: (text: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "10px 12px",
        borderRadius: r.control,
        /* DASHED WHEN ON, like every other unsolved mark in the system — the
           card's border, the part list's left edge, the tree row. A gap is an
           invitation, and a dashed edge is what says "not finished, on purpose"
           where a solid red one would say "broken". */
        borderWidth: 1,
        borderStyle: isGap ? "dashed" : "solid",
        borderColor: isGap ? t.catBreakage : t.line,
        background: isGap ? tokenAlpha("cat-breakage", 0.06) : "transparent",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
          <span style={{ ...labelText, color: isGap ? t.catBreakage : t.text }}>
            {UNSOLVED_LABEL}
          </span>
          <span style={{ ...helpStyle, color: t.text2 }}>{UNSOLVED_HELP}</span>
        </span>

        {/* BG-P07's switch, in the breakage accent rather than the action one:
            red is what this flag means everywhere else. The track takes
            `--r-control` and the thumb `--r-full`, which is the one place a
            circle is correct — see switchTrackStyle's note on why a 24px track
            at a 12px radius still renders as a capsule and why the token wins
            anyway. */}
        <button
          type="button"
          role="switch"
          data-testid="gap-toggle"
          aria-checked={isGap}
          aria-label={UNSOLVED_LABEL}
          onClick={() => onToggle(!isGap)}
          style={{
            position: "relative",
            flexShrink: 0,
            width: TRACK_WIDTH,
            height: TRACK_HEIGHT,
            padding: 0,
            borderRadius: r.control,
            border: `1px solid ${isGap ? t.catBreakage : t.line}`,
            background: isGap ? t.catBreakage : t.recess,
            cursor: "pointer",
            transition: feedback("background-color"),
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "50%",
              left: isGap ? TRACK_WIDTH - KNOB - 4 : 2,
              width: KNOB,
              height: KNOB,
              marginTop: -(KNOB / 2),
              /* A thumb is a circle, which is what `--r-full` is for. */
              borderRadius: r.full,
              /* --on-action is the measured ink for a filled control; "var(--bg)"
                 was the old void, invisible on a red track in the light room. */
              background: isGap ? t.onAction : t.text2,
              transition: "none",
            }}
          />
        </button>
      </div>

      {isGap ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label htmlFor="inspector-gap-problem" style={{ ...labelText }}>
            {PROBLEM_LABEL}
          </label>
          <p style={{ ...helpStyle, margin: 0, color: t.text2 }}>{PROBLEM_HELP}</p>
          <textarea
            id="inspector-gap-problem"
            data-testid="gap-problem"
            value={problem}
            rows={3}
            placeholder={PROBLEM_PLACEHOLDER}
            onChange={(event) => onProblemChange(event.target.value)}
            onFocus={(event) => focusControl(event.currentTarget)}
            onBlur={(event) => blurControl(event.currentTarget)}
            style={{ ...controlStyle, minHeight: 64, resize: "vertical", display: "block" }}
          />
        </div>
      ) : null}
    </div>
  );
}

interface InspectorProps {
  buildId: string;
  compose: ComposeBuild;
  /** The tree's own delete, reused so one code path closes the position gap. */
  onDelete: (nodeId: string) => void;
}

export function Inspector({ buildId, compose, onDelete }: InspectorProps) {
  const { selectedNodeId, tree, tray, nodeTypes } = compose;

  const node = useMemo(
    () => (selectedNodeId ? findNodeInRecord({ tree, tray }, selectedNodeId) : null),
    [selectedNodeId, tray, tree]
  );
  const nodeType: NodeType | undefined = useMemo(
    () => (node ? nodeTypes.find((type) => type.key === node.type) : undefined),
    [node, nodeTypes]
  );

  // Held even when nothing is selected: a hook cannot be called conditionally,
  // and the writer is a no-op on a null node id.
  const { patch, patchPayload } = useNodeWrite(buildId, node?.id ?? null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const descendants = useMemo(
    () => (selectedNodeId ? countDescendants(findInTree(tree, selectedNodeId)) : 0),
    [selectedNodeId, tree]
  );

  const confirmDelete = useCallback(() => {
    if (!node) return;
    setConfirmOpen(false);
    onDelete(node.id);
  }, [node, onDelete]);

  if (!node) return <EmptyState />;

  const label = nodeType?.label ?? node.type;
  const fields = nodeType?.schema.fields ?? [];

  return (
    // The testid is an anchor for the e2e suite and nothing else: a spec that
    // fills "the node's first field" has to be able to say which column it
    // means, and the inspector has no role or accessible name of its own. No
    // structure or style is changed by it — see the e2e skill's selector rules.
    <div
      data-testid="inspector"
      data-node-id={node.id}
      style={{ display: "flex", flexDirection: "column", gap: 16, padding: 18 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <TypePill nodeType={nodeType} typeKey={node.type} />
        <span style={{ ...titleText, fontSize: 19, color: t.text }}>{label}</span>
      </div>

      <SuggestedFields fields={fields} payload={asPayload(node.payload)} />

      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label htmlFor="inspector-title" style={{ ...labelText }}>
          Title
        </label>
        <input
          id="inspector-title"
          type="text"
          value={node.title ?? ""}
          placeholder={`Untitled ${label.toLowerCase()}`}
          onChange={(event) => {
            const next = event.target.value;
            patch({ title: next === "" ? null : next });
          }}
          onFocus={(event) => focusControl(event.currentTarget)}
          onBlur={(event) => blurControl(event.currentTarget)}
          style={controlStyle}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label htmlFor="inspector-note" style={{ ...labelText }}>
          note — the only free prose on this node
        </label>
        <textarea
          id="inspector-note"
          value={node.note ?? ""}
          rows={3}
          onChange={(event) => {
            const next = event.target.value;
            patch({ note: next === "" ? null : next });
          }}
          onFocus={(event) => focusControl(event.currentTarget)}
          onBlur={(event) => blurControl(event.currentTarget)}
          style={{ ...controlStyle, minHeight: 64, resize: "vertical", display: "block" }}
        />
      </div>

      {/* Above the type's own fields, because "this part is not done" is a
          statement about the whole node rather than a value inside it — the
          same reason it sits beside title and note rather than in SchemaForm. */}
      <GapControl
        isGap={node.is_gap === true}
        problem={gapProblem(node.payload)}
        onToggle={(next) => patch({ is_gap: next })}
        onProblemChange={(text) => patchPayload(gapProblemPatch(text))}
      />

      <div style={{ height: 1, background: t.line }} />

      {/* Every node_id field below resolves its options from here, so the
          picker sees the same tree and tray the panels do without SchemaForm
          learning that references exist. */}
      <NodeRefProvider
        tree={tree}
        tray={tray}
        nodeTypes={nodeTypes}
        currentNodeId={node.id}
      >
        <SchemaForm buildId={buildId} node={node} fields={fields} />
      </NodeRefProvider>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          paddingTop: 12,
          borderTop: `1px solid ${t.line}`,
        }}
      >
        <span
          style={{
            ...labelText,
            fontSize: 11,
            fontFamily:
              "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
            color: t.text2,
          }}
          title={node.id}
        >
          {node.id.slice(0, ID_PREFIX_LENGTH)}
        </span>

        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          style={{
            ...labelText,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px",
            borderRadius: r.control,
            background: "transparent",
            border: `1px solid ${t.line}`,
            color: t.text2,
            cursor: "pointer",
          }}
        >
          <Trash2 size={12} aria-hidden />
          Delete node
        </button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent data-visual-slot="modal-surface" style={{ fontFamily: "inherit" }}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete “{node.title || label}”
              {descendants > 0 ? " and everything under it?" : "?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {descendants > 0
                ? `This node has ${
                    descendants === 1 ? "1 node" : `${descendants} nodes`
                  } nested under it. Deleting it removes ${
                    descendants === 1 ? "both of them" : `all ${descendants + 1} of them`
                  }. This cannot be undone.`
                : "This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              style={{ background: t.catBreakage, color: t.onAction }}
            >
              Delete {descendants > 0 ? `${descendants + 1} nodes` : "node"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
