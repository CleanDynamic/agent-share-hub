// "Watch it get built": the event sequence as a story rather than a log.
//
// WHAT IT IS
// ----------
// A scrubber over the sequence, the artefact that existed at the scrubbed
// position, and the readable list underneath. Three views of one array, all
// driven by a single integer — the index of the position the reader is at.
//
// HIDDEN EVENTS
// -------------
// This component never filters. It renders every event it is handed, because
// the events it is handed have already had `visibility = 'hidden'` excluded by
// getEvents, in the query, before the rows crossed the wire. Filtering here as
// well would be defence in the wrong place: it would make the network response
// the leak and the DOM the fix, which is exactly backwards. If a hidden event
// ever reaches this component, the bug is in the query and belongs there.
//
// WHY THE ARTEFACT COMES FROM THE NODE RENDERERS
// ----------------------------------------------
// The state at a position is whatever node the most recent producing event
// pointed at, rendered through NodeCard — the same card the anatomy uses, the
// same registry, the same renderer. A replay-specific display of a prompt
// would drift from the anatomy's display of the same prompt within one prompt
// of work, and then the two tabs would disagree about the build.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Build, BuildEvent, BuildNode, NodeType } from "@/lib/build";
import { GenericPayload } from "./GenericPayload";
import { NodeCard } from "./NodeCard";
import type { ResolveMedia, ResolveNode } from "./renderers";
import {
  eventFields,
  eventLead,
  eventPayload,
  eventTime,
  kindColour,
} from "./eventDisplay";
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
  panelGlass,
  titleText,
} from "./tokens";

/** One event per this many milliseconds while playing. */
export const PLAY_INTERVAL_MS = 1500;

export interface ReplayProps {
  build: Build;
  /**
   * The visible sequence, in ordinal order. Hidden events are already gone —
   * see the note at the top of this file.
   */
  events: BuildEvent[];
  nodeTypes: NodeType[];
  resolveNode: ResolveNode;
  resolveMedia: ResolveMedia;
  /**
   * Jump here when it changes. An ordinal rather than an index, because the
   * caller — the breakage view, a deep link — knows ordinals and must not have
   * to know which of them survived the visibility filter.
   */
  focusOrdinal?: number | null;
  /**
   * Fork the build at this ordinal. Omitted, the control does not render.
   *
   * NS-P38 relabelled the control "Rebuild from here" and left the behaviour
   * exactly as it was: a fork at a moment, straight into compose. The mechanics
   * are the hook's, not this component's.
   */
  onFork?: (ordinal: number) => void;
  /** A fork is in flight; the controls say so and stop taking clicks. */
  forkPending?: boolean;
}

interface PhaseRun {
  key: string;
  title: string | null;
  /** Indices into `events`, contiguous. */
  from: number;
  to: number;
}

/**
 * The sequence cut into contiguous phase runs.
 *
 * Derived from the phase integer on each event and never stored as a range, so
 * a sequence whose phases were reordered shows up honestly split rather than
 * claiming a grouping the rows no longer support. Same rule the compose
 * sequence view follows, deliberately duplicated rather than imported: the
 * compose workspace is the heaviest chunk in the application and the public
 * build page must not pull it in for eleven lines.
 */
export function phaseRuns(events: BuildEvent[]): PhaseRun[] {
  const runs: PhaseRun[] = [];
  events.forEach((event, index) => {
    const last = runs[runs.length - 1];
    const samePhase = last && events[last.from].phase === event.phase;
    if (samePhase && last) {
      last.to = index;
      if (!last.title && event.phase_title) last.title = event.phase_title;
      return;
    }
    runs.push({
      key: `${event.phase ?? "none"}-${event.id}`,
      title: event.phase_title,
      from: index,
      to: index,
    });
  });
  return runs;
}

/**
 * The node that existed at this position: the one produced by the most recent
 * event at or before it.
 *
 * Walks backwards rather than forwards so that a position with no producing
 * event of its own inherits the last artefact instead of blanking — the state
 * at step 8 is whatever step 6 produced, until something replaces it.
 */
export function producedAt(
  events: BuildEvent[],
  index: number,
  resolveNode: ResolveNode
): { node: BuildNode; event: BuildEvent } | null {
  for (let i = Math.min(index, events.length - 1); i >= 0; i -= 1) {
    const event = events[i];
    if (!event.produced_node_id) continue;
    const node = resolveNode(event.produced_node_id);
    // An event pointing at a node that is not in the placed tree — one still
    // in the tray, or since deleted — is skipped, not rendered as a hole.
    if (node) return { node, event };
  }
  return null;
}

const controlStyle: CSSProperties = {
  ...labelText,
  fontSize: 11,
  padding: "5px 11px",
  borderRadius: 7,
  border: `1px solid ${HAIRLINE}`,
  background: "transparent",
  color: TEXT_SECONDARY,
  cursor: "pointer",
};

function KindPill({ kind }: { kind: string | null }) {
  const colour = kindColour(kind);
  return (
    <span
      style={{
        ...labelText,
        fontSize: 10,
        color: colour,
        background: hexToRgba(colour, 0.15),
        padding: "2px 7px",
        borderRadius: 5,
        textTransform: "uppercase",
      }}
    >
      {kind ?? "event"}
    </span>
  );
}

/** One row of the readable list. Kept rows arrive open, folded rows closed. */
function EventRow({
  event,
  index,
  current,
  onSelect,
  rowRef,
}: {
  event: BuildEvent;
  index: number;
  current: boolean;
  onSelect: (index: number) => void;
  rowRef: (element: HTMLLIElement | null) => void;
}) {
  const folded = event.visibility === "folded";
  const [open, setOpen] = useState(!folded);
  const lead = eventLead(event);
  const fields = eventFields(event.payload, { omit: lead ? [lead.key] : [] });

  return (
    <li
      ref={rowRef}
      data-event-ordinal={event.ordinal}
      data-visibility={event.visibility}
      style={{
        ...cardGlass,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        borderLeft: current ? `3px solid ${ORANGE}` : "3px solid transparent",
        background: current ? hexToRgba(ORANGE, 0.05) : cardGlass.background,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => onSelect(index)}
          aria-label={`Go to step ${event.ordinal}`}
          style={{
            ...labelText,
            fontSize: 11,
            color: current ? ORANGE : TEXT_MUTED,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
        >
          step {event.ordinal}
        </button>
        <KindPill kind={event.kind} />
        <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED }}>
          {eventTime(event.occurred_at)}
        </span>
        {folded ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            style={{ ...controlStyle, marginLeft: "auto", padding: "2px 9px" }}
          >
            {open ? "fold" : "reveal"}
          </button>
        ) : null}
      </div>

      {lead ? (
        <p
          style={{
            ...bodyText,
            margin: 0,
            whiteSpace: "pre-wrap",
            // A folded row is one line until it is revealed. The text is in the
            // DOM either way — this is emphasis, not concealment.
            ...(open
              ? {}
              : {
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: TEXT_SECONDARY,
                }),
          }}
        >
          {lead.text}
        </p>
      ) : null}

      {open && fields.length > 0 ? (
        <GenericPayload payload={eventPayload(event)} fields={fields} />
      ) : null}
    </li>
  );
}

export function Replay({
  build,
  events,
  nodeTypes,
  resolveNode,
  resolveMedia,
  focusOrdinal,
  onFork,
  forkPending = false,
}: ReplayProps) {
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rows = useRef<Array<HTMLLIElement | null>>([]);
  const moved = useRef(false);

  const last = Math.max(events.length - 1, 0);
  const runs = useMemo(() => phaseRuns(events), [events]);
  const typesByKey = useMemo(
    () => new Map(nodeTypes.map((type) => [type.key, type])),
    [nodeTypes]
  );

  const step = useCallback(
    (next: number) => {
      moved.current = true;
      setPosition(Math.min(Math.max(next, 0), last));
    },
    [last]
  );

  // A jump from another tab. Lands on the event at that ordinal, or on the
  // nearest one below it when the ordinal itself is not in the visible set.
  useEffect(() => {
    if (focusOrdinal === null || focusOrdinal === undefined) return;
    let target = -1;
    events.forEach((event, index) => {
      if (event.ordinal <= focusOrdinal) target = index;
    });
    if (target >= 0) {
      moved.current = true;
      setPosition(target);
    }
  }, [focusOrdinal, events]);

  // Playback: one event per PLAY_INTERVAL_MS, stopping at the end rather than
  // looping. A story that restarts itself is a carousel.
  useEffect(() => {
    if (!playing) return;
    if (position >= last) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => step(position + 1), PLAY_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [playing, position, last, step]);

  useEffect(() => {
    if (!moved.current) return;
    rows.current[position]?.scrollIntoView?.({ block: "nearest" });
  }, [position]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      setPlaying(false);
      step(position + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      setPlaying(false);
      step(position - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      step(0);
    } else if (event.key === "End") {
      event.preventDefault();
      step(last);
    } else if (event.key === " " || event.key === "Spacebar") {
      // preventDefault before the browser turns the keypress into a click on
      // the focused tick, and before the page scrolls.
      event.preventDefault();
      setPlaying((value) => !value);
    }
  };

  if (events.length === 0) {
    return (
      <p
        data-visual-slot="build-replay-empty"
        style={{ ...bodyText, color: TEXT_MUTED, margin: 0, padding: "48px 0" }}
      >
        No sequence was recorded for this build.
      </p>
    );
  }

  const current = events[Math.min(position, last)];
  const artefact = producedAt(events, position, resolveNode);

  return (
    <section
      data-visual-slot="build-replay"
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
    >
      <div
        style={{
          ...panelGlass,
          borderRadius: 12,
          padding: "14px 16px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ overflowX: "auto" }}>
          {/* The phase headings, each spanning the ticks it owns. */}
          <div style={{ display: "flex", gap: 2, minWidth: 320, marginBottom: 6 }}>
            {runs.map((run) => (
              <div
                key={run.key}
                style={{
                  flex: `${run.to - run.from + 1} 1 0`,
                  minWidth: 0,
                  borderTop: `1px solid ${HAIRLINE}`,
                  paddingTop: 5,
                }}
              >
                <span
                  style={{
                    ...labelText,
                    fontSize: 10,
                    color: TEXT_MUTED,
                    textTransform: "uppercase",
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {run.title ?? "unphased"}
                </span>
              </div>
            ))}
          </div>

          {/* The scrubber. Roving tabindex: one tick in the tab order, arrows
              move between them, space plays. */}
          <div
            role="toolbar"
            aria-orientation="horizontal"
            aria-label="Event scrubber — left and right step, space plays"
            onKeyDown={onKeyDown}
            style={{ display: "flex", gap: 2, minWidth: 320 }}
          >
            {events.map((event, index) => {
              const active = index === position;
              const reached = index <= position;
              const colour = kindColour(event.kind);
              return (
                <button
                  key={event.id}
                  type="button"
                  data-tick-ordinal={event.ordinal}
                  aria-label={`Step ${event.ordinal}: ${event.kind ?? "event"}`}
                  aria-current={active ? "step" : undefined}
                  tabIndex={active ? 0 : -1}
                  onClick={() => {
                    setPlaying(false);
                    step(index);
                  }}
                  style={{
                    flex: "1 1 0",
                    minWidth: 6,
                    height: active ? 26 : 18,
                    alignSelf: "flex-end",
                    padding: 0,
                    border: "none",
                    borderRadius: 3,
                    cursor: "pointer",
                    background: active
                      ? colour
                      : reached
                        ? hexToRgba(colour, 0.45)
                        : "rgba(255,255,255,0.10)",
                    transition: "height 120ms ease, background 120ms ease",
                  }}
                />
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            aria-pressed={playing}
            style={{ ...controlStyle, color: playing ? TEAL : TEXT_SECONDARY }}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED }}>
            step {current.ordinal} of {events[last].ordinal}
          </span>
          <KindPill kind={current.kind} />
          <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED }}>
            {eventTime(current.occurred_at)}
          </span>
          {onFork ? (
            <button
              type="button"
              onClick={() => onFork(current.ordinal)}
              disabled={forkPending}
              style={{
                ...controlStyle,
                marginLeft: "auto",
                color: forkPending ? TEXT_MUTED : ORANGE,
                borderColor: hexToRgba(ORANGE, 0.35),
                cursor: forkPending ? "progress" : "pointer",
              }}
            >
              {forkPending ? "Rebuilding…" : "Rebuild from here"}
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED, textTransform: "uppercase" }}>
          What existed at step {current.ordinal}
        </span>
        {artefact ? (
          <div data-produced-by-ordinal={artefact.event.ordinal}>
            <NodeCard
              node={artefact.node}
              nodeType={typesByKey.get(artefact.node.type)}
              build={build}
              resolveNode={resolveNode}
              resolveMedia={resolveMedia}
            />
          </div>
        ) : (
          <p style={{ ...bodyText, color: TEXT_MUTED, margin: 0 }}>
            Nothing had been produced yet at this point.
          </p>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {runs.map((run) => (
          <div key={run.key} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h3
              style={{
                ...titleText,
                margin: 0,
                color: TEXT_PRIMARY,
                paddingTop: 6,
                borderTop: `1px solid ${HAIRLINE}`,
              }}
            >
              {run.title ?? "Unphased"}
            </h3>
            <ol
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {events.slice(run.from, run.to + 1).map((event, offset) => {
                const index = run.from + offset;
                return (
                  <EventRow
                    key={event.id}
                    event={event}
                    index={index}
                    current={index === position}
                    onSelect={(next) => {
                      setPlaying(false);
                      step(next);
                    }}
                    rowRef={(element) => {
                      rows.current[index] = element;
                    }}
                  />
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

export default Replay;
