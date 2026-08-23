// The join between the two dimensions: which node an event produced.
//
// build_events.produced_node_id and build_nodes.event_id are the same fact
// written from both ends, and this control is the only place a creator states
// it. It matters more than it looks: without it the sequence is a chat log and
// the anatomy is a folder. With it, an event knows what it left behind, which
// is what lets NS-P16 show the artefact as it stood at any point in the replay.
//
// THE LIST IS RENDERED IN FLOW, not in a popover — the same call NodeRefField
// makes, for the same reason. The centre panel is an overflow:auto column; an
// absolutely positioned menu inside one detaches from its trigger the moment
// the panel scrolls, and a sequence panel scrolls constantly.

import { useMemo, useRef, useState } from "react";
import { Link2, Link2Off, Search } from "lucide-react";
import type { BuildEvent, BuildNode, NodeType } from "@/lib/build";
import {
  HAIRLINE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  hexToRgba,
  labelText,
} from "@/components/build/tokens";
import { TypePill } from "@/components/compose/TreeNode";
import {
  CONTROL_BACKGROUND,
  CONTROL_BORDER,
  blurControl,
  compactControlStyle,
  focusControl,
} from "@/components/compose/fields";

/** One node an event may be linked to. */
export interface NodeLinkOption {
  node: BuildNode;
  nodeType?: NodeType;
  /** False for a tray node. Offered anyway — a creator is entitled to point at
   *  something they have drafted and not yet placed. */
  placed: boolean;
}

/** Past this the list is a wall, and the filter is the way through it. */
const VISIBLE_OPTIONS = 40;

export function optionTitle(option: NodeLinkOption): string {
  return option.node.title || `Untitled ${option.nodeType?.label ?? option.node.type}`;
}

function matches(option: NodeLinkOption, query: string): boolean {
  if (query === "") return true;
  const needle = query.toLowerCase();
  return (
    optionTitle(option).toLowerCase().includes(needle) ||
    (option.nodeType?.label ?? option.node.type).toLowerCase().includes(needle)
  );
}

const chipButton: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  maxWidth: 200,
  minWidth: 0,
  padding: "3px 8px",
  borderRadius: 999,
  background: CONTROL_BACKGROUND,
  border: `1px solid ${CONTROL_BORDER}`,
  color: TEXT_SECONDARY,
  fontFamily: "inherit",
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.04em",
  cursor: "pointer",
};

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

interface EventNodeLinkProps {
  event: BuildEvent;
  options: NodeLinkOption[];
  onLink: (nodeId: string | null) => void;
  /** Named so the trigger announces which event it belongs to. */
  labelPrefix: string;
}

export function EventNodeLink({ event, options, onLink, labelPrefix }: EventNodeLinkProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listId = useRef(`event-node-link-${event.id}`).current;

  const linked = useMemo(
    () => options.find((option) => option.node.id === event.produced_node_id) ?? null,
    [event.produced_node_id, options]
  );

  const visible = useMemo(
    () => options.filter((option) => matches(option, query)).slice(0, VISIBLE_OPTIONS),
    [options, query]
  );

  // A stored id with no node behind it. The node was deleted after the link was
  // made; say so rather than rendering an empty chip that reads as "unlinked".
  const isMissing = Boolean(event.produced_node_id) && !linked;

  const choose = (nodeId: string | null) => {
    onLink(nodeId);
    setOpen(false);
    setQuery("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${labelPrefix}: ${linked ? `produced ${optionTitle(linked)}` : "link a node"}`}
        onClick={() => setOpen((current) => !current)}
        onFocus={(nativeEvent) => focusControl(nativeEvent.currentTarget)}
        onBlur={(nativeEvent) => blurControl(nativeEvent.currentTarget)}
        style={{
          ...chipButton,
          borderColor: linked ? hexToRgba(TEAL, 0.28) : CONTROL_BORDER,
          color: linked ? TEXT_PRIMARY : TEXT_MUTED,
        }}
        title={
          linked
            ? `Produced ${optionTitle(linked)}`
            : "Link this event to the node it produced"
        }
      >
        {linked ? (
          <Link2 size={11} color={TEAL} aria-hidden="true" style={{ flexShrink: 0 }} />
        ) : (
          <Link2Off size={11} aria-hidden="true" style={{ flexShrink: 0 }} />
        )}
        <span
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontWeight: 300,
          }}
        >
          {linked ? optionTitle(linked) : isMissing ? "missing node" : "Link node"}
        </span>
      </button>

      {open ? (
        <div
          id={listId}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            padding: 6,
            borderRadius: 8,
            border: `1px solid ${HAIRLINE}`,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Search size={12} color={TEXT_MUTED} aria-hidden="true" style={{ flexShrink: 0 }} />
            <input
              type="text"
              value={query}
              autoFocus
              placeholder="Filter nodes"
              aria-label="Filter nodes"
              onChange={(nativeEvent) => setQuery(nativeEvent.target.value)}
              onFocus={(nativeEvent) => focusControl(nativeEvent.currentTarget)}
              onBlur={(nativeEvent) => blurControl(nativeEvent.currentTarget)}
              style={{ ...compactControlStyle, flex: 1, minWidth: 0 }}
            />
          </div>

          {event.produced_node_id ? (
            <button
              type="button"
              onClick={() => choose(null)}
              style={{ ...rowButton, color: TEXT_SECONDARY }}
            >
              <Link2Off size={12} aria-hidden="true" style={{ flexShrink: 0 }} />
              Unlink
            </button>
          ) : null}

          {visible.length === 0 ? (
            <p style={{ ...labelText, margin: 0, padding: "4px 8px", color: TEXT_MUTED, fontSize: 11 }}>
              {options.length === 0 ? "This build has no nodes yet." : "No node matches."}
            </p>
          ) : (
            visible.map((option) => (
              <button
                key={option.node.id}
                type="button"
                onClick={() => choose(option.node.id)}
                style={{
                  ...rowButton,
                  borderColor:
                    option.node.id === event.produced_node_id
                      ? hexToRgba(TEAL, 0.35)
                      : "transparent",
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
                  }}
                >
                  {optionTitle(option)}
                </span>
                {!option.placed ? (
                  <span style={{ ...labelText, fontSize: 10, color: TEXT_MUTED }}>tray</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
