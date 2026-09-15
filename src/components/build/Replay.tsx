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
// DIVERGENCE MARKERS (NS-P40)
// --------------------------
// A teal dot above the tick of every event somebody has rebuilt from. It is a
// ROW OF ITS OWN above the scrubber, sized cell-for-cell against the ticks, and
// not a decoration inside the tick buttons: the scrubber's mechanics — what a
// tick does, what it looks like, what the keyboard does to it — are untouched
// by this file's newest feature, and a marker row that renders nothing when
// there are no rebuilds leaves the panel exactly as NS-P16 shipped it.
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
import type { Build, BuildEvent, BuildNode, NodeType, RebuildSummary } from "@/lib/build";
import { GenericPayload } from "./GenericPayload";
import { creatorLabel } from "./rebuildDisplay";
import { NodeCard } from "./NodeCard";
import type { ResolveMedia, ResolveNode } from "./renderers";
import {
  eventFields,
  eventLead,
  eventPayload,
  eventTime,
  kindColour,
  kindFill,
} from "./eventDisplay";
import { cardGlass, hexToRgba, panelGlass } from "./tokens";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import {
  body as bodyType,
  data as dataType,
  eyebrow,
  label as labelType,
  measure,
  tabular,
} from "@/lib/theme/type";
import { feedback } from "@/lib/theme/motion";

/** One event per this many milliseconds while playing. */
export const PLAY_INTERVAL_MS = 1500;

/** The divergence dot. Small enough to sit over a 6px tick without hiding it. */
export const DIVERGENCE_DOT = 6;

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
  /**
   * Published rebuilds of THIS build (NS-P40). The ones naming an event of this
   * sequence in forked_from_event_id get a marker over that event's tick; the
   * rest — whole-build rebuilds, which name no moment — get none, because there
   * is no moment to point at.
   *
   * The page fetches this once for the Rebuilds tab and hands the same array
   * here, so the tab and the scrubber can never disagree about what exists.
   */
  divergences?: RebuildSummary[];
  /**
   * Open one. Omitted, the markers still render and still name who is behind
   * them — they simply stop being a way through to the build.
   *
   * A callback rather than a Link because this component is deliberately
   * router-free: it is rendered in tests without one, and onFork above already
   * hands navigation back to the page for the same reason.
   */
  onOpenRebuild?: (rebuild: RebuildSummary) => void;
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

/**
 * The replay's small controls: play, reveal, fork from here.
 *
 * Secondary by shape rather than through `buttonStyle`, because these sit
 * inside a blurred panel where a `--glass` fill on top of `--glass` would be
 * the nesting the theme forbids. A `--line` outline on nothing, at the chip
 * radius, is the same treatment with one layer instead of two.
 */
const controlStyle: CSSProperties = {
  ...labelType,
  padding: "5px 11px",
  borderRadius: r.chip,
  border: `1px solid ${t.line}`,
  background: "transparent",
  color: t.text2,
  cursor: "pointer",
};

function KindPill({ kind }: { kind: string | null }) {
  const fill = kindFill(kind);
  return (
    <span
      style={{
        ...eyebrow,
        color: fill.color,
        background: fill.background,
        padding: "2px 7px",
        borderRadius: r.chip,
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
        /* The current row, marked by an edge and a wash of the action hue.
           The edge occupies its 3px at rest in transparent, so stepping
           through the list moves a colour and never a box. */
        borderLeft: current ? `3px solid ${t.action}` : "3px solid transparent",
        background: current ? hexToRgba(t.action, 0.05) : cardGlass.background,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => onSelect(index)}
          aria-label={`Go to step ${event.ordinal}`}
          style={{
            ...dataType,
            ...tabular,
            color: current ? t.action : t.text2,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
        >
          step {event.ordinal}
        </button>
        <KindPill kind={event.kind} />
        <span style={{ ...dataType, ...tabular, color: t.text2 }}>
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
            ...bodyType,
            ...measure,
            color: t.text,
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
                  color: t.text2,
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

/** "@sam rebuilt from here", or "3 people rebuilt from here". */
export function markerLabel(rebuilds: RebuildSummary[]): string {
  if (rebuilds.length === 1) return `${creatorLabel(rebuilds[0])} rebuilt from here`;
  return `${rebuilds.length} people rebuilt from here`;
}

/** What the line says while nothing is being pointed at. */
function summaryLabel(markers: Map<number, RebuildSummary[]>): string {
  let total = 0;
  for (const bucket of markers.values()) total += bucket.length;
  const moments = markers.size;
  return `${total} rebuild${total === 1 ? "" : "s"} started from ${
    moments === 1 ? "a step" : `${moments} steps`
  } in this sequence`;
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
  divergences,
  onOpenRebuild,
}: ReplayProps) {
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  /** The marker a reader is pointing at, as an index into `events`. */
  const [named, setNamed] = useState<number | null>(null);
  const rows = useRef<Array<HTMLLIElement | null>>([]);
  const moved = useRef(false);

  const last = Math.max(events.length - 1, 0);
  const runs = useMemo(() => phaseRuns(events), [events]);
  const typesByKey = useMemo(
    () => new Map(nodeTypes.map((type) => [type.key, type])),
    [nodeTypes]
  );

  /**
   * Which events somebody rebuilt from, keyed by their index in this list.
   *
   * Keyed by INDEX rather than by ordinal because the row below is laid out
   * cell-per-event against the ticks, and ordinals are not contiguous — the
   * sequence in front of a reader has already had hidden events removed. A
   * rebuild naming an event that is not in this list (hidden, or since deleted)
   * lands in no bucket and shows no marker, which is the honest outcome: there
   * is no tick for it to sit over.
   */
  const markers = useMemo(() => {
    const byEventId = new Map<string, number>();
    events.forEach((event, index) => byEventId.set(event.id, index));

    const out = new Map<number, RebuildSummary[]>();
    for (const rebuild of divergences ?? []) {
      if (!rebuild.forked_from_event_id) continue;
      const index = byEventId.get(rebuild.forked_from_event_id);
      if (index === undefined) continue;
      const bucket = out.get(index);
      if (bucket) bucket.push(rebuild);
      else out.set(index, [rebuild]);
    }
    return out;
  }, [divergences, events]);

  const namedRebuilds = named === null ? undefined : markers.get(named);

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
        style={{ ...bodyType, ...measure, color: t.text2, margin: 0, padding: "48px 0" }}
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
        /* THE SCRUBBER SITS IN A RECESS (BG-P21). It was a blurred panel, and
           a blur is a thing this page can only afford about twenty of — every
           node card, every figure and the hero are already spending them. A
           scrubber is a control surface cut into the page, which is exactly
           what `--recess` names, and the recess also gives the unreached ticks
           a ground to be quiet against without a white-alpha wash that only
           existed in the dark room. */
        style={{
          background: t.recess,
          border: `1px solid ${t.line}`,
          borderRadius: r.panel,
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
                  borderTop: `1px solid ${t.line}`,
                  paddingTop: 5,
                }}
              >
                {/* A PHASE HEADING IS MONO. It labels a span of the sequence —
                    the same job as every other eyebrow on the site — and mono
                    is what the theme sets a label in. It also keeps the
                    headings optically even across runs of different lengths,
                    which a proportional face at 10px did not. */}
                <span
                  style={{
                    ...eyebrow,
                    color: t.text2,
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

          {/* The divergence markers, one cell per event so each dot sits over
              its own tick. Rendered only where there is something to mark, so a
              build nobody has rebuilt from gets the panel it always had. */}
          {markers.size > 0 ? (
            <div
              data-visual-slot="build-replay-divergences"
              style={{ display: "flex", gap: 2, minWidth: 320, marginBottom: 3 }}
            >
              {events.map((event, index) => {
                const here = markers.get(index);
                return (
                  <div
                    key={event.id}
                    style={{
                      flex: "1 1 0",
                      minWidth: 6,
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "flex-end",
                      height: DIVERGENCE_DOT + 2,
                    }}
                  >
                    {here ? (
                      <button
                        type="button"
                        data-testid="divergence-marker"
                        data-divergence-ordinal={event.ordinal}
                        data-divergence-count={here.length}
                        aria-label={markerLabel(here)}
                        title={markerLabel(here)}
                        onMouseEnter={() => setNamed(index)}
                        onMouseLeave={() => setNamed((at) => (at === index ? null : at))}
                        onFocus={() => setNamed(index)}
                        onBlur={() => setNamed((at) => (at === index ? null : at))}
                        onClick={() => {
                          setNamed(index);
                          // One rebuild is unambiguous, so the click IS the
                          // opening. Several share a moment, and picking for the
                          // reader would be picking wrong five times in six —
                          // they are named below instead, each its own control.
                          if (here.length === 1 && onOpenRebuild) onOpenRebuild(here[0]);
                        }}
                        style={{
                          width: DIVERGENCE_DOT,
                          height: DIVERGENCE_DOT,
                          padding: 0,
                          border: "none",
                          /* --evidence, and a halo of the same hue rather than
                             a second colour: a divergence is somebody else's
                             run of this build, which is the same claim
                             "reproduced" makes. Circular, so --r-full is
                             correct here and almost nowhere else. */
                          borderRadius: r.full,
                          background: t.evidence,
                          boxShadow: `0 0 0 2px ${hexToRgba(t.evidence, 0.18)}`,
                          cursor: "pointer",
                        }}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

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
                    background: reached ? colour : t.line,
                    // BG-P05: `colour` is a var() now, so the played-but-not-
                    // current tick can no longer be struck as a 45% alpha of it.
                    // Opacity on the tick itself gets the same three steps out of
                    // one colour, and is a visual property, not a layout one.
                    opacity: reached && !active ? 0.45 : 1,
                    transition: feedback("background-color"),
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
            style={{ ...controlStyle, color: playing ? t.evidence : t.text2 }}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <span style={{ ...dataType, ...tabular, color: t.text2 }}>
            step {current.ordinal} of {events[last].ordinal}
          </span>
          <KindPill kind={current.kind} />
          <span style={{ ...dataType, ...tabular, color: t.text2 }}>
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
                /* "Rebuild from here" is the same act as the header's primary,
                   at one moment of the sequence — so it takes the action hue,
                   but as an outline and not a second fill. The page has one
                   filled --action surface and it is not in this panel. */
                color: forkPending ? t.text2 : t.action,
                borderColor: t.action,
                cursor: forkPending ? "progress" : "pointer",
              }}
            >
              {forkPending ? "Rebuilding…" : "Rebuild from here"}
            </button>
          ) : null}
        </div>

        {/* Who diverged, in words. It holds its line whether or not a marker is
            being pointed at, so nothing under the panel jumps as the pointer
            crosses the row — and on a touch screen, where there is no hover,
            the summary is the naming. */}
        {markers.size > 0 ? (
          <p
            data-testid="divergence-names"
            style={{ ...dataType, ...measure, color: t.text2, margin: 0 }}
          >
            {namedRebuilds
              ? namedRebuilds.map((rebuild, index) => (
                  <span key={rebuild.id}>
                    {index > 0 ? ", " : null}
                    <button
                      type="button"
                      onClick={() => onOpenRebuild?.(rebuild)}
                      style={{
                        ...dataType,
                        padding: 0,
                        background: "transparent",
                        border: "none",
                        color: t.evidence,
                        textDecoration: onOpenRebuild ? "underline" : "none",
                        textUnderlineOffset: 3,
                        cursor: onOpenRebuild ? "pointer" : "default",
                      }}
                    >
                      {creatorLabel(rebuild)} rebuilt from here
                    </button>
                  </span>
                ))
              : summaryLabel(markers)}
          </p>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ ...eyebrow, color: t.text2 }}>
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
          <p style={{ ...bodyType, ...measure, color: t.text2, margin: 0 }}>
            Nothing had been produced yet at this point.
          </p>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {runs.map((run) => (
          <div key={run.key} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* THE PHASE HEADING IN THE LIST IS MONO TOO, matching the one over
                the scrubber: the same phase named twice must not be named in
                two faces. A hairline above it does the grouping, so the list
                reads as phases without a box around each one. */}
            <h3
              style={{
                ...eyebrow,
                margin: 0,
                color: t.text,
                paddingTop: 6,
                borderTop: `1px solid ${t.line}`,
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
