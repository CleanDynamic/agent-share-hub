// "Where it broke": every recorded failure on one page, in the order it
// happened.
//
// TWO SOURCES, ONE LIST
// ---------------------
// A breakage can be recorded twice over: as a node in the tree, which is where
// a creator writes it up properly with a cause and a count of attempts, and as
// an event in the sequence, which is where it actually happened. Both are
// listed here, in event order, because a reader looking for "what went wrong"
// does not care which table it landed in.
//
// A node that links the breakage event it describes is ONE breakage, not two.
// Those are merged: the node wins, because it is the richer record, and the
// event it links supplies the ordinal to open the replay at.
//
// THE EMPTY STATE IS NOT AN EMPTY TAB
// -----------------------------------
// A build with no breakages says so. The absence of recorded failure is
// information — either nothing broke, which is worth knowing, or nothing was
// written down, which is worth knowing too. Hiding the tab would collapse both
// into "this build has no such thing", which is the one reading that is false.

import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { Build, BuildEvent, BuildNode, NodeTree, NodeType } from "@/lib/build";
import { GenericPayload } from "./GenericPayload";
import { NodeCard } from "./NodeCard";
import type { ResolveMedia, ResolveNode } from "./renderers";
import {
  asPayload,
  eventFields,
  eventPayload,
  eventTime,
  payloadNumber,
} from "./eventDisplay";
import {
  GAP_RED,
  HAIRLINE,
  TEXT_MUTED,
  TEXT_SECONDARY,
  bodyText,
  cardGlass,
  hexToRgba,
  labelText,
  titleText,
} from "./tokens";

/** The renderer key that says "this node is a breakage". */
const BREAKAGE_RENDERER = "breakage";

export interface BreakageViewProps {
  build: Build;
  /** The visible sequence. Hidden events were excluded by getEvents. */
  events: BuildEvent[];
  tree: NodeTree[];
  nodeTypes: NodeType[];
  resolveNode: ResolveNode;
  resolveMedia: ResolveMedia;
  /** Open the replay at this ordinal. Absent renders the span without a link. */
  onOpenReplay?: (ordinal: number) => void;
}

export interface BreakageEntry {
  key: string;
  title: string;
  /** The written-up node, when there is one. */
  node?: BuildNode;
  /** The event it happened at, when there is one. */
  event?: BuildEvent;
  /** Ordinals. `start` is what the replay link opens at. */
  start: number | null;
  end: number | null;
  when: string | null;
}

function flatten(nodes: NodeTree[]): NodeTree[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

/**
 * Every breakage on the build, merged and ordered.
 *
 * Exported so the ordering and the merge are testable without a DOM: they are
 * the whole substance of this view.
 */
export function collectBreakages(
  tree: NodeTree[],
  events: BuildEvent[],
  nodeTypes: NodeType[]
): BreakageEntry[] {
  const typesByKey = new Map(nodeTypes.map((type) => [type.key, type]));
  const eventsById = new Map(events.map((event) => [event.id, event]));

  // A node is a breakage because its TYPE says so, never because this file
  // knows the string "breakage" is a type key. Recolour or rename the type in
  // node_types and this still finds it; point the type at another renderer and
  // this correctly stops claiming it.
  const nodes = flatten(tree).filter(
    (node) => typesByKey.get(node.type)?.renderer === BREAKAGE_RENDERER
  );

  const claimed = new Set<string>();
  const entries: BreakageEntry[] = [];

  for (const node of nodes) {
    const linked = node.event_id ? eventsById.get(node.event_id) : undefined;
    if (linked) claimed.add(linked.id);

    const payload = asPayload(node.payload);
    const start = payloadNumber(payload, "event_start") ?? linked?.ordinal ?? null;
    const end = payloadNumber(payload, "event_end") ?? start;

    entries.push({
      key: `node-${node.id}`,
      title: node.title,
      node,
      event: linked,
      start,
      end,
      when: linked?.occurred_at ?? null,
    });
  }

  for (const event of events) {
    if (event.kind !== BREAKAGE_RENDERER || claimed.has(event.id)) continue;
    entries.push({
      key: `event-${event.id}`,
      // An event-recorded breakage has no title of its own — only a symptom,
      // which renders in full below rather than being cut down to a heading
      // and then printed twice.
      title: `Breakage at step ${event.ordinal}`,
      event,
      start: event.ordinal,
      end: event.ordinal,
      when: event.occurred_at,
    });
  }

  // Event order, and an entry with no ordinal at all sorts to the end rather
  // than to the top: an unplaced breakage is not the first thing that broke.
  return entries.sort(
    (a, b) => (a.start ?? Number.MAX_SAFE_INTEGER) - (b.start ?? Number.MAX_SAFE_INTEGER)
  );
}

/** "steps 6-9", "step 11", or nothing when no ordinal is recorded. */
export function spanLabel(entry: BreakageEntry): string | null {
  if (entry.start === null) return null;
  if (entry.end === null || entry.end === entry.start) return `step ${entry.start}`;
  return `steps ${entry.start}–${entry.end}`;
}

const spanStyle: CSSProperties = {
  ...labelText,
  fontSize: 11,
  color: GAP_RED,
  background: hexToRgba(GAP_RED, 0.14),
  border: `1px solid ${hexToRgba(GAP_RED, 0.3)}`,
  borderRadius: 6,
  padding: "2px 9px",
  cursor: "pointer",
};

export function BreakageView({
  build,
  events,
  tree,
  nodeTypes,
  resolveNode,
  resolveMedia,
  onOpenReplay,
}: BreakageViewProps) {
  const entries = useMemo(
    () => collectBreakages(tree, events, nodeTypes),
    [tree, events, nodeTypes]
  );
  const typesByKey = useMemo(
    () => new Map(nodeTypes.map((type) => [type.key, type])),
    [nodeTypes]
  );

  if (entries.length === 0) {
    return (
      <div
        data-visual-slot="build-breakage-empty"
        style={{ display: "flex", flexDirection: "column", gap: 8, padding: "48px 0" }}
      >
        <p style={{ ...titleText, margin: 0, color: TEXT_SECONDARY }}>
          No breakages recorded
        </p>
        <p style={{ ...bodyText, margin: 0, color: TEXT_MUTED, maxWidth: 520 }}>
          Either nothing broke, or nothing was written down. Both are worth
          knowing, which is why this section stays where it is rather than
          disappearing.
        </p>
      </div>
    );
  }

  return (
    <section
      data-visual-slot="build-breakage"
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY, maxWidth: 620 }}>
        {entries.length} recorded {entries.length === 1 ? "breakage" : "breakages"}, in
        the order they happened. Each one links into the replay at the step it
        broke.
      </p>

      <ol
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {entries.map((entry) => {
          const span = spanLabel(entry);
          return (
            <li
              key={entry.key}
              data-breakage-start={entry.start ?? undefined}
              data-breakage-end={entry.end ?? undefined}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  borderTop: `1px solid ${HAIRLINE}`,
                  paddingTop: 12,
                }}
              >
                {/* A node-backed entry gets its pill and its title from
                    NodeCard below, which is the same card the anatomy renders.
                    Repeating them here would print the breakage twice. */}
                {entry.node ? null : (
                  <>
                    <span
                      style={{
                        ...labelText,
                        fontSize: 10,
                        color: GAP_RED,
                        background: hexToRgba(GAP_RED, 0.15),
                        padding: "2px 7px",
                        borderRadius: 5,
                        textTransform: "uppercase",
                      }}
                    >
                      breakage
                    </span>
                    <h3 style={{ ...titleText, margin: 0 }}>{entry.title}</h3>
                  </>
                )}
                {entry.when ? (
                  <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED }}>
                    {eventTime(entry.when)}
                  </span>
                ) : null}
                {span ? (
                  onOpenReplay && entry.start !== null ? (
                    <button
                      type="button"
                      onClick={() => onOpenReplay(entry.start as number)}
                      style={{ ...spanStyle, marginLeft: "auto" }}
                    >
                      {span} — watch it
                    </button>
                  ) : (
                    <span
                      style={{ ...spanStyle, marginLeft: "auto", cursor: "default" }}
                    >
                      {span}
                    </span>
                  )
                ) : (
                  <span
                    style={{ ...labelText, fontSize: 11, color: TEXT_MUTED, marginLeft: "auto" }}
                  >
                    no step recorded
                  </span>
                )}
              </div>

              {/* The node's own renderer draws symptom, cause, resolution and
                  attempts — the same one the anatomy uses. An event-only
                  breakage has no node and no renderer, so its payload is
                  presented the way the replay presents an event's. */}
              {entry.node ? (
                <NodeCard
                  node={entry.node}
                  nodeType={typesByKey.get(entry.node.type)}
                  build={build}
                  resolveNode={resolveNode}
                  resolveMedia={resolveMedia}
                />
              ) : entry.event ? (
                <div style={{ ...cardGlass, padding: "14px 16px" }}>
                  <GenericPayload
                    payload={eventPayload(entry.event)}
                    fields={eventFields(entry.event.payload)}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default BreakageView;
