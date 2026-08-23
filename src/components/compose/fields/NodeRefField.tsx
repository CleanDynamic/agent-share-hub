// format: "node_id" — a picker over the nodes of the build being edited.
//
// A reference is stored as the target node's uuid and nothing else. That is the
// whole reason this widget exists: a creator picks a node by its title, and the
// payload keeps an id that survives the title being rewritten.
//
// THE SCOPE
// ---------
// A widget receives a field and a value, never the record it belongs to — the
// six base widgets are pure by design and this one must not change that
// contract for them. The nodes to choose from arrive through a context the
// Inspector provides instead, so the widget stays a function of its props plus
// one ambient scope, and SchemaForm still knows nothing about references.
//
// Tray nodes are offered alongside placed ones. A creator who has drafted a
// tool definition and not yet placed it is entitled to point at it; forcing the
// reference to wait for the placement would be the tail wagging the dog.
//
// THE LIST IS RENDERED IN FLOW, not in a popover. The inspector rail is an
// overflow:auto column 340px wide: an absolutely positioned menu inside it is
// clipped horizontally and detaches from its trigger the moment the rail
// scrolls. Pushing the rows down costs a little height and always lands where
// the creator is looking.

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";
import type { BuildNode, NodeTree, NodeType } from "@/lib/build";
import {
  GAP_RED,
  HAIRLINE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  labelText,
} from "@/components/build/tokens";
import { TypePill } from "@/components/compose/TreeNode";
import { FieldShell } from "../SchemaForm";
import { StringField } from "./StringField";
import {
  blurControl,
  compactControlStyle,
  controlStyle,
  focusControl,
  helpStyle,
  type FieldWidgetProps,
} from "./index";

/** One selectable node, with the two things the row shows. */
export interface NodeRefOption {
  node: BuildNode;
  nodeType?: NodeType;
  /** False for a tray node, which is offered but grouped after the placed ones. */
  placed: boolean;
}

interface NodeRefScope {
  options: NodeRefOption[];
  /** The node being edited. Excluded from its own picker. */
  currentNodeId: string | null;
}

/**
 * Null when no provider is above the widget.
 *
 * That is not an error state to render — a picker with no build around it falls
 * back to the plain string input below, so a stored id stays visible and
 * editable rather than being reported as missing by a panel that never had a
 * list to look in.
 */
const NodeRefContext = createContext<NodeRefScope | null>(null);

function flatten(nodes: NodeTree[], into: BuildNode[]): BuildNode[] {
  for (const node of nodes) {
    into.push(node);
    flatten(node.children, into);
  }
  return into;
}

interface NodeRefProviderProps {
  tree: NodeTree[];
  tray: BuildNode[];
  nodeTypes: NodeType[];
  currentNodeId: string | null;
  children: ReactNode;
}

/**
 * Hands every node_id field below it the build's nodes.
 *
 * The flattening happens once here rather than once per picker: an agent
 * configuration with eight tool rows is eight pickers over one list.
 */
export function NodeRefProvider({
  tree,
  tray,
  nodeTypes,
  currentNodeId,
  children,
}: NodeRefProviderProps) {
  const value = useMemo<NodeRefScope>(() => {
    const typesByKey = new Map(nodeTypes.map((type) => [type.key, type]));
    const placed = flatten(tree, []).map((node) => ({
      node,
      nodeType: typesByKey.get(node.type),
      placed: true,
    }));
    const unplaced = tray.map((node) => ({
      node,
      nodeType: typesByKey.get(node.type),
      placed: false,
    }));
    return { options: [...placed, ...unplaced], currentNodeId };
  }, [currentNodeId, nodeTypes, tray, tree]);

  return <NodeRefContext.Provider value={value}>{children}</NodeRefContext.Provider>;
}

function optionTitle(option: NodeRefOption): string {
  return option.node.title || `Untitled ${option.nodeType?.label ?? option.node.type}`;
}

function matches(option: NodeRefOption, query: string): boolean {
  if (query === "") return true;
  const needle = query.toLowerCase();
  return (
    optionTitle(option).toLowerCase().includes(needle) ||
    (option.nodeType?.label ?? option.node.type).toLowerCase().includes(needle)
  );
}

const rowButton: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  textAlign: "left",
  padding: "5px 8px",
  borderRadius: 6,
  background: "transparent",
  border: "1px solid transparent",
  color: TEXT_PRIMARY,
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 300,
  cursor: "pointer",
};

const clearButton: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
  flexShrink: 0,
  padding: 0,
  borderRadius: 6,
  background: "transparent",
  border: `1px solid ${HAIRLINE}`,
  color: TEXT_SECONDARY,
  cursor: "pointer",
};

export function NodeRefField(props: FieldWidgetProps) {
  const { field, value, onChange, id, touched, onTouch, compact } = props;
  const scope = useContext(NodeRefContext);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const stored = value === null || value === undefined ? "" : String(value);

  const options = useMemo(
    () =>
      (scope?.options ?? []).filter(
        (option) => option.node.id !== scope?.currentNodeId
      ),
    [scope]
  );
  const visible = useMemo(
    () => options.filter((option) => matches(option, query)),
    [options, query]
  );

  // Resolved against every node, the excluded self included: a payload that
  // already points at its own node should read as that node, not as missing.
  const selected = scope?.options.find((option) => option.node.id === stored) ?? null;

  // No provider above this widget. Nothing here can resolve an id, so the raw
  // string input is the honest control rather than a picker over nothing.
  if (!scope) return <StringField {...props} />;

  const isMissing = stored !== "" && !selected;
  const control = compact ? compactControlStyle : controlStyle;

  const choose = (nodeId: string | null) => {
    onTouch?.();
    onChange(nodeId);
    setOpen(false);
    setQuery("");
  };

  return (
    <FieldShell
      field={field}
      id={id}
      touched={touched}
      isEmpty={stored === ""}
      compact={compact}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            // In a list row the label is hidden, so the control carries its own
            // name rather than being announced as an unlabelled button.
            aria-label={compact ? field.label : undefined}
            onClick={() => setOpen((current) => !current)}
            onFocus={(event) => focusControl(event.currentTarget)}
            onBlur={(event) => blurControl(event.currentTarget)}
            style={{
              ...control,
              display: "flex",
              alignItems: "center",
              gap: 8,
              minWidth: 0,
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            {selected ? (
              <>
                <TypePill nodeType={selected.nodeType} typeKey={selected.node.type} />
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {optionTitle(selected)}
                </span>
              </>
            ) : isMissing ? (
              // The id is kept in the title attribute rather than shown: a
              // creator can copy it if they are chasing what went, and never has
              // to read a uuid to understand that the target is gone.
              <span style={{ flex: 1, color: GAP_RED }} title={stored}>
                missing node
              </span>
            ) : (
              <span style={{ flex: 1, color: TEXT_MUTED }}>
                {compact ? field.label : "Choose a node"}
              </span>
            )}
            <ChevronDown size={13} aria-hidden style={{ flexShrink: 0, color: TEXT_MUTED }} />
          </button>

          {stored !== "" && (
            <button
              type="button"
              aria-label={`Clear ${field.label}`}
              onClick={() => choose(null)}
              style={clearButton}
            >
              <X size={12} aria-hidden />
            </button>
          )}
        </div>

        {open && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              padding: 6,
              borderRadius: 8,
              background: "rgba(255,255,255,0.025)",
              border: `1px solid ${HAIRLINE}`,
            }}
          >
            <input
              type="text"
              value={query}
              aria-label={`Filter nodes for ${field.label}`}
              placeholder="Filter nodes"
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setOpen(false);
              }}
              onFocus={(event) => focusControl(event.currentTarget)}
              onBlur={(event) => blurControl(event.currentTarget)}
              style={{ ...compactControlStyle }}
            />

            {visible.length === 0 ? (
              <p style={{ ...helpStyle, padding: "4px 8px" }}>
                {options.length === 0
                  ? "This build has no other nodes yet."
                  : "No node matches that."}
              </p>
            ) : (
              <ul
                role="listbox"
                aria-label={`Nodes for ${field.label}`}
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  maxHeight: 220,
                  overflowY: "auto",
                }}
              >
                {visible.map((option, index) => {
                  const isSelected = option.node.id === stored;
                  // The tray heading is drawn once, above the first unplaced
                  // node, and only when placed nodes came before it.
                  const startsTray =
                    !option.placed && (index === 0 ? false : visible[index - 1].placed);
                  return (
                    <li key={option.node.id}>
                      {startsTray && (
                        <span
                          style={{
                            ...labelText,
                            display: "block",
                            fontSize: 10,
                            textTransform: "uppercase",
                            color: TEXT_MUTED,
                            padding: "6px 8px 2px",
                          }}
                        >
                          Tray
                        </span>
                      )}
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => choose(option.node.id)}
                        style={{
                          ...rowButton,
                          background: isSelected ? "rgba(255,255,255,0.05)" : "transparent",
                        }}
                      >
                        <TypePill nodeType={option.nodeType} typeKey={option.node.type} />
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: option.node.title ? TEXT_PRIMARY : TEXT_MUTED,
                          }}
                        >
                          {optionTitle(option)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </FieldShell>
  );
}
