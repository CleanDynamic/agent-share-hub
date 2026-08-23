// The inspector: the right rail of the compose workspace.
//
// It resolves the selected node's type against the registry and renders that
// type's schema. There is no component in this file, or anywhere under it, that
// is named after a node type or knows what one contains — the whole point of
// node_types.schema is that a prompt and a result are the same code path with
// different rows behind them.
//
// Three columns are edited here. `title` and `note` are columns on every node
// whatever its type, so they are rendered above the gate; `payload` is the
// typed part and belongs to the schema, so it is rendered by SchemaForm below
// it. Title and note are written by this file's own debounced writer, payload
// by SchemaForm's. The two own disjoint column sets — see the note at the top
// of SchemaForm.tsx for why that is what keeps them from overwriting each
// other.

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
import type { BuildNode, NodeTree, NodeType } from "@/lib/build";
import type { ComposeBuild } from "@/hooks/useComposeBuild";
import {
  GAP_RED,
  HAIRLINE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  bodyText,
  labelText,
  titleText,
} from "@/components/build/tokens";
import { TypePill } from "@/components/compose/TreeNode";
import {
  SchemaForm,
  asPayload,
  findNodeInRecord,
  useNodeWrite,
} from "@/components/compose/SchemaForm";
import {
  blurControl,
  controlStyle,
  focusControl,
  helpStyle,
} from "@/components/compose/fields";

/**
 * THE GATE. NS-P10 deletes this line and the one that reads it.
 *
 * Payload editing is wired for these three types only. Every other type still
 * selects, still shows its title, note and identity, and shows what it holds
 * read-only — it simply has no form yet. The restriction lives here, once, and
 * not one widget below knows it exists.
 */
const WIRED_TYPES = ["prompt", "model_params", "result"];

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

const sectionLabel: React.CSSProperties = {
  ...labelText,
  textTransform: "uppercase",
  color: TEXT_SECONDARY,
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
      <p style={{ ...bodyText, margin: 0, color: TEXT_MUTED }}>
        Select a node to edit its fields. What appears here is whatever that
        node's type says it holds.
      </p>
    </div>
  );
}

/**
 * What an un-wired type shows instead of a form.
 *
 * The payload is rendered rather than hidden, because a node seeded with real
 * content should not look empty just because NS-P09 stopped at three types.
 */
function ReadOnlyPayload({ node, label }: { node: BuildNode; label: string }) {
  const payload = asPayload(node.payload);
  const keys = Object.keys(payload);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY }}>
        Editing {label} nodes arrives in NS-P10
      </p>
      {keys.length === 0 ? (
        <p style={{ ...helpStyle, margin: 0 }}>This node holds no fields yet.</p>
      ) : (
        <pre
          style={{
            ...bodyText,
            margin: 0,
            padding: 10,
            fontFamily:
              "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
            fontSize: 12,
            color: TEXT_SECONDARY,
            background: "rgba(255,255,255,0.025)",
            border: `1px solid ${HAIRLINE}`,
            borderRadius: 8,
            // The panel is 340px wide and a payload is not: let it scroll
            // sideways rather than wrapping a value mid-token.
            overflowX: "auto",
            whiteSpace: "pre",
          }}
        >
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
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
  const { patch } = useNodeWrite(buildId, node?.id ?? null);

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
  const isWired = WIRED_TYPES.includes(node.type);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <TypePill nodeType={nodeType} typeKey={node.type} />
        <span style={{ ...titleText, color: TEXT_PRIMARY }}>{label}</span>
      </div>

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

      <div style={{ height: 1, background: HAIRLINE }} />

      {isWired ? (
        <SchemaForm
          buildId={buildId}
          node={node}
          fields={nodeType?.schema.fields ?? []}
        />
      ) : (
        <ReadOnlyPayload node={node} label={label} />
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          paddingTop: 12,
          borderTop: `1px solid ${HAIRLINE}`,
        }}
      >
        <span
          style={{
            ...labelText,
            fontSize: 11,
            fontFamily:
              "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
            color: TEXT_MUTED,
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
            borderRadius: 8,
            background: "transparent",
            border: `1px solid ${HAIRLINE}`,
            color: TEXT_SECONDARY,
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
              style={{ background: GAP_RED, color: "#fff" }}
            >
              Delete {descendants > 0 ? `${descendants + 1} nodes` : "node"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
