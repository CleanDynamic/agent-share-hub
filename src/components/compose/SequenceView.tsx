// The Sequence half of the compose workspace: the progression dimension, edited.
//
// Anatomy answers "what is this build made of". Sequence answers "what
// happened, in what order, and which of it is worth a stranger's time". They
// are the same record read along two axes, which is why they share a panel and
// a toggle rather than a route.
//
// WHAT THIS PANEL IS FOR
// ----------------------
// Triage. A transcript intake drops sixty events in at once, every one of them
// guessed as `prompt` and defaulted to `folded`, and none of that is yet a
// story. The creator's job here is four passes over the same list — mark the
// milestones and the breakages, hide what should never have been captured,
// group the runs into phases, and point the events that produced something at
// the node they produced. All four are on the row, and all four work over a
// selection, because a creator triaging sixty events one row at a time will
// stop triaging at about row nine.
//
// WHY IT PAGINATES
// ----------------
// A 200-prompt build is realistic, and 200 rows carrying a select, a segmented
// control and a node picker each is not something to hand a browser. Above one
// page the list is sliced and the selection survives across pages, so a bulk
// action still spans the whole build. Pagination rather than virtualisation on
// purpose: the panel's scroll container is an ancestor this component does not
// own and must not restructure, and a windowing implementation that measures
// the wrong element scrolls to nothing. A page boundary is honest and cheap.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { BuildEvent, EventKind, EventVisibility } from "@/lib/build";
import {
  FONT_STACK,
  HAIRLINE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  VOID,
  hexToRgba,
  labelText,
  titleText,
} from "@/components/build/tokens";
import {
  CONTROL_BORDER,
  blurControl,
  compactControlStyle,
  focusControl,
} from "@/components/compose/fields";
import type { NodeLinkOption } from "./EventNodeLink";
import {
  EVENT_KINDS,
  EventRow,
  KIND_META,
  VISIBILITY_META,
  VISIBILITY_STATES,
  VisibilityControl,
} from "./EventRow";
import { PhaseEditor } from "./PhaseEditor";
import type { Sequence } from "./useSequence";

/** One page of rows. Above this the list is sliced; at or below it, it is not. */
export const PAGE_SIZE = 100;

/** No shared value across the selection. Matches no visibility state, so the
 *  control shows three unselected segments rather than lying about one. */
const MIXED = "";

interface PhaseGroup {
  key: string;
  phase: number | null;
  title: string | null;
  events: BuildEvent[];
}

/**
 * The visible slice, cut into contiguous phase runs.
 *
 * Grouping is derived, never stored as a range: the phase integer on each row is
 * the whole truth, so a run that a reorder splits shows up split rather than
 * claiming a membership the data no longer supports.
 */
export function groupByPhase(events: BuildEvent[]): PhaseGroup[] {
  const groups: PhaseGroup[] = [];
  for (const event of events) {
    const last = groups[groups.length - 1];
    if (last && last.phase === event.phase) {
      last.events.push(event);
      // A later row in the run carries the title if the first one was blank.
      if (!last.title && event.phase_title) last.title = event.phase_title;
      continue;
    }
    groups.push({
      key: `${event.phase ?? "none"}-${event.id}`,
      phase: event.phase,
      title: event.phase_title,
      events: [event],
    });
  }
  return groups;
}

const barButton: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 10px",
  borderRadius: 8,
  border: `1px solid ${CONTROL_BORDER}`,
  background: "transparent",
  color: TEXT_SECONDARY,
  fontFamily: "inherit",
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.04em",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

/**
 * What the three visibility states mean, said once at the top.
 *
 * The row control repeats it in a tooltip, but a tooltip is not where someone
 * learns that "Hidden" is a privacy guarantee rather than a display setting.
 */
function VisibilityLegend() {
  return (
    <ul
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        margin: 0,
        padding: 0,
        listStyle: "none",
      }}
    >
      {VISIBILITY_STATES.map((state) => {
        const meta = VISIBILITY_META[state];
        return (
          <li key={state} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              aria-hidden="true"
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: meta.colour,
                flexShrink: 0,
              }}
            />
            <span style={{ ...labelText, fontSize: 11, color: TEXT_SECONDARY }}>{meta.label}</span>
            <span style={{ fontSize: 11, fontWeight: 300, color: TEXT_MUTED }}>{meta.meaning}</span>
          </li>
        );
      })}
    </ul>
  );
}

interface SequenceViewProps {
  sequence: Sequence;
  nodeOptions: NodeLinkOption[];
}

export function SequenceView({ sequence, nodeOptions }: SequenceViewProps) {
  const { events, isLoading, loadError, isWriting, patchEvents, linkNode } = sequence;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(0);

  /**
   * The event list as it stands right now, for callbacks that must not change
   * identity. Every callback handed to EventRow closes over this ref instead of
   * over `events`, so a patch that replaces the array does not replace all
   * hundred handlers and re-render every memoised row along with the one that
   * actually changed.
   */
  const eventsRef = useRef(events);
  eventsRef.current = events;

  /** Where a shift-click measures its range from. */
  const anchorRef = useRef<string | null>(null);

  const pageCount = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const paginated = events.length > PAGE_SIZE;

  useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1);
  }, [page, pageCount]);

  const visible = useMemo(
    () => (paginated ? events.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE) : events),
    [events, page, paginated]
  );
  const groups = useMemo(() => groupByPhase(visible), [visible]);

  /** True once anything in the build carries a phase. Until then an "Unphased"
   *  heading over every row is noise about a feature not yet in use. */
  const anyPhased = useMemo(() => events.some((event) => event.phase !== null), [events]);

  const selected = useMemo(
    () => events.filter((event) => selectedIds.has(event.id)),
    [events, selectedIds]
  );

  /** The visibility the whole selection shares, or MIXED. */
  const sharedVisibility = useMemo(() => {
    if (selected.length === 0) return MIXED;
    const first = selected[0].visibility;
    return selected.every((event) => event.visibility === first) ? first : MIXED;
  }, [selected]);

  const onToggleSelect = useCallback((id: string, shiftKey: boolean) => {
    const current = eventsRef.current;
    setSelectedIds((previous) => {
      const next = new Set(previous);
      const anchor = anchorRef.current;

      if (shiftKey && anchor && anchor !== id) {
        const from = current.findIndex((event) => event.id === anchor);
        const to = current.findIndex((event) => event.id === id);
        if (from !== -1 && to !== -1) {
          for (let i = Math.min(from, to); i <= Math.max(from, to); i += 1) {
            next.add(current[i].id);
          }
          return next;
        }
      }

      if (next.has(id)) next.delete(id);
      else next.add(id);
      anchorRef.current = id;
      return next;
    });
  }, []);

  const selectIds = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
    anchorRef.current = ids[ids.length - 1] ?? null;
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    anchorRef.current = null;
  }, []);

  const onVisibility = useCallback(
    (id: string, visibility: EventVisibility) => patchEvents([id], { visibility }),
    [patchEvents]
  );

  const onKind = useCallback(
    (id: string, kind: EventKind) => patchEvents([id], { kind }),
    [patchEvents]
  );

  const onLink = useCallback(
    (id: string, nodeId: string | null) => linkNode(id, nodeId),
    [linkNode]
  );

  const selectedIdList = useMemo(() => selected.map((event) => event.id), [selected]);

  const onBulkVisibility = useCallback(
    (visibility: EventVisibility) => patchEvents(selectedIdList, { visibility }),
    [patchEvents, selectedIdList]
  );

  const onAssignPhase = useCallback(
    (ids: string[], phase: number, title: string) =>
      patchEvents(ids, { phase, phase_title: title }),
    [patchEvents]
  );

  const onClearPhase = useCallback(
    (ids: string[]) => patchEvents(ids, { phase: null, phase_title: null }),
    [patchEvents]
  );

  const offPage = paginated
    ? selected.filter((event) => !visible.some((row) => row.id === event.id)).length
    : 0;

  const shell: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 16,
    fontFamily: FONT_STACK,
  };

  if (isLoading) {
    return (
      <div style={shell}>
        <span style={{ ...labelText, color: TEXT_MUTED }}>Loading the sequence…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={shell}>
        <p style={{ ...labelText, margin: 0, color: TEXT_SECONDARY }}>
          The sequence could not be loaded.
        </p>
        <p style={{ fontSize: 12, fontWeight: 300, margin: 0, color: TEXT_MUTED }}>
          {loadError.message}
        </p>
      </div>
    );
  }

  return (
    <div style={shell}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ ...labelText, textTransform: "uppercase", color: TEXT_SECONDARY, flex: 1 }}>
          Sequence
        </span>
        {isWriting ? (
          <span
            style={{ ...labelText, fontSize: 11, color: TEXT_MUTED, display: "flex", gap: 6 }}
          >
            <Loader2 size={11} aria-hidden="true" style={{ animation: "sequenceSpin 1s linear infinite" }} />
            Saving
          </span>
        ) : null}
        <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED }}>
          {events.length} {events.length === 1 ? "event" : "events"}
        </span>
        {events.length > 0 ? (
          <button
            type="button"
            onClick={() =>
              selectedIds.size === events.length
                ? clearSelection()
                : selectIds(events.map((event) => event.id))
            }
            style={barButton}
          >
            {selectedIds.size === events.length ? "Clear selection" : "Select all"}
          </button>
        ) : null}
      </div>

      {events.length === 0 ? (
        <p style={{ fontSize: 13, fontWeight: 300, lineHeight: 1.6, margin: 0, color: TEXT_MUTED }}>
          Nothing has happened yet. Paste a transcript when you start a build and the
          sequence fills itself; until then this is where the story of the build will go.
        </p>
      ) : (
        <>
          <VisibilityLegend />

          {/* The bulk bar. Sticky rather than fixed: it belongs to this panel's
              scroll, and a creator working down a hundred rows should not have to
              scroll back up to act on what they have selected. */}
          {selected.length > 0 ? (
            <div
              role="group"
              aria-label="Actions on the selected events"
              style={{
                position: "sticky",
                top: 0,
                zIndex: 2,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: 10,
                borderRadius: 12,
                border: `1px solid ${hexToRgba(TEAL, 0.22)}`,
                background: "rgba(16,16,24,0.94)",
                backdropFilter: "blur(40px) saturate(180%)",
                WebkitBackdropFilter: "blur(40px) saturate(180%)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <span style={{ ...labelText, fontSize: 11, color: TEAL, whiteSpace: "nowrap" }}>
                  {selected.length} selected
                  {offPage > 0 ? ` (${offPage} on another page)` : ""}
                </span>

                <VisibilityControl
                  value={sharedVisibility}
                  label="Visibility of the selected events"
                  onChange={onBulkVisibility}
                />

                <select
                  value=""
                  aria-label="Kind of the selected events"
                  onChange={(nativeEvent) => {
                    const kind = nativeEvent.target.value;
                    if (kind) patchEvents(selectedIdList, { kind: kind as EventKind });
                    nativeEvent.target.value = "";
                  }}
                  onFocus={(nativeEvent) => focusControl(nativeEvent.currentTarget)}
                  onBlur={(nativeEvent) => blurControl(nativeEvent.currentTarget)}
                  style={{ ...compactControlStyle, width: "auto", appearance: "none", cursor: "pointer" }}
                >
                  <option value="" style={{ background: VOID, color: TEXT_SECONDARY }}>
                    Set kind…
                  </option>
                  {EVENT_KINDS.map((kind) => (
                    <option key={kind} value={kind} style={{ background: VOID, color: TEXT_PRIMARY }}>
                      {KIND_META[kind].label}
                    </option>
                  ))}
                </select>

                <button type="button" onClick={clearSelection} style={barButton}>
                  Clear
                </button>
              </div>

              <PhaseEditor
                events={events}
                selectedIds={selectedIds}
                onAssign={onAssignPhase}
                onClear={onClearPhase}
                onFillSpan={selectIds}
              />
            </div>
          ) : null}

          {groups.map((group) => (
            <section key={group.key} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {group.phase !== null || anyPhased ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    padding: "6px 2px 4px",
                    borderBottom: `1px solid ${HAIRLINE}`,
                  }}
                >
                  <h3
                    style={{
                      ...titleText,
                      margin: 0,
                      fontSize: 13,
                      color: group.phase === null ? TEXT_MUTED : TEXT_PRIMARY,
                    }}
                  >
                    {group.phase === null
                      ? "Unphased"
                      : group.title || `Phase ${group.phase}`}
                  </h3>
                  {group.phase !== null ? (
                    <span style={{ ...labelText, fontSize: 10, color: TEXT_MUTED }}>
                      phase {group.phase}
                    </span>
                  ) : null}
                  <span style={{ flex: 1 }} />
                  <button
                    type="button"
                    onClick={() => selectIds(group.events.map((event) => event.id))}
                    style={{ ...barButton, padding: "2px 8px", fontSize: 10 }}
                  >
                    Select {group.events.length}
                  </button>
                </div>
              ) : null}

              <ul style={{ display: "flex", flexDirection: "column", gap: 2, margin: 0, padding: 0, listStyle: "none" }}>
                {group.events.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    selected={selectedIds.has(event.id)}
                    onToggleSelect={onToggleSelect}
                    onVisibility={onVisibility}
                    onKind={onKind}
                    onLink={onLink}
                    nodeOptions={nodeOptions}
                  />
                ))}
              </ul>
            </section>
          ))}

          {paginated ? (
            <nav
              aria-label="Sequence pages"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}
            >
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                style={{ ...barButton, opacity: page === 0 ? 0.4 : 1 }}
              >
                <ChevronLeft size={12} aria-hidden="true" />
                Previous
              </button>
              <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED }}>
                Events {page * PAGE_SIZE + 1}–{Math.min(events.length, (page + 1) * PAGE_SIZE)} of{" "}
                {events.length}
              </span>
              <button
                type="button"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                style={{ ...barButton, opacity: page >= pageCount - 1 ? 0.4 : 1 }}
              >
                Next
                <ChevronRight size={12} aria-hidden="true" />
              </button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
