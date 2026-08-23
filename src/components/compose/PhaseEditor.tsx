// Phases: the thing that makes a long sequence readable.
//
// A 47-prompt build is not 47 interesting decisions. It is four or five stretches
// of work — "getting auth working", "the CSS fight", "making it fast enough to
// demo" — and a reader who can see those stretches can find the one they came
// for. Without them the sequence is a wall, and a wall gets skimmed and closed.
//
// A phase is a contiguous run and nothing else. That is deliberate: phases are
// stored as an integer plus a title on each event, with no phase table and no
// ranges, so the only structure the data can express is "these consecutive
// events belong together". Allowing a phase to skip events would let a creator
// build a grouping the replay cannot draw, and the constraint is cheaper to
// enforce here — with a button that closes the gap for them — than to explain
// afterwards.

import { useEffect, useMemo, useState } from "react";
import { Layers, Scissors } from "lucide-react";
import type { BuildEvent } from "@/lib/build";
import {
  HAIRLINE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  hexToRgba,
  labelText,
} from "@/components/build/tokens";
import {
  CONTROL_BORDER,
  blurControl,
  compactControlStyle,
  focusControl,
} from "@/components/compose/fields";

export interface PhaseSpan {
  /** Indices into the ordinal-ordered event list. */
  from: number;
  to: number;
  /** True when the selection covers every event between from and to. */
  contiguous: boolean;
  /** How many events sit inside the span but outside the selection. */
  gaps: number;
}

/** Where the selection sits in the sequence, and whether it is a run. */
export function describeSpan(events: BuildEvent[], selectedIds: Set<string>): PhaseSpan | null {
  if (selectedIds.size === 0) return null;
  const indices: number[] = [];
  events.forEach((event, index) => {
    if (selectedIds.has(event.id)) indices.push(index);
  });
  if (indices.length === 0) return null;

  const from = indices[0];
  const to = indices[indices.length - 1];
  const span = to - from + 1;
  return { from, to, contiguous: span === indices.length, gaps: span - indices.length };
}

/**
 * The integer a newly named run should take.
 *
 * A selection that already shares one phase keeps it — renaming "the CSS fight"
 * must not renumber it and strand the events either side. Anything else takes
 * the next free integer, so phases stay ordered by first appearance.
 */
export function nextPhaseFor(events: BuildEvent[], selected: BuildEvent[]): number {
  const phases = new Set(
    selected.map((event) => event.phase).filter((phase): phase is number => phase !== null)
  );
  if (phases.size === 1 && selected.every((event) => event.phase !== null)) {
    return [...phases][0];
  }
  const highest = events.reduce((max, event) => Math.max(max, event.phase ?? 0), 0);
  return highest + 1;
}

const actionButton: React.CSSProperties = {
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

interface PhaseEditorProps {
  events: BuildEvent[];
  selectedIds: Set<string>;
  /** One action: every event in the run takes the same phase and title. */
  onAssign: (ids: string[], phase: number, title: string) => void;
  onClear: (ids: string[]) => void;
  /** Grow the selection to cover the whole span, closing its gaps. */
  onFillSpan: (ids: string[]) => void;
}

export function PhaseEditor({
  events,
  selectedIds,
  onAssign,
  onClear,
  onFillSpan,
}: PhaseEditorProps) {
  const selected = useMemo(
    () => events.filter((event) => selectedIds.has(event.id)),
    [events, selectedIds]
  );
  const span = useMemo(() => describeSpan(events, selectedIds), [events, selectedIds]);

  /** The title the selection already carries, when it carries exactly one. */
  const existingTitle = useMemo(() => {
    const titles = new Set(selected.map((event) => event.phase_title ?? ""));
    return titles.size === 1 ? [...titles][0] : "";
  }, [selected]);

  const [title, setTitle] = useState(existingTitle);

  // Reset to whatever the new selection already says rather than carrying the
  // last thing typed onto an unrelated run.
  useEffect(() => setTitle(existingTitle), [existingTitle, selectedIds]);

  if (!span || selected.length === 0) return null;

  const phase = nextPhaseFor(events, selected);
  const alreadyPhased = selected.some((event) => event.phase !== null);
  const ids = selected.map((event) => event.id);
  const canAssign = span.contiguous && title.trim() !== "";

  const fillIds = events.slice(span.from, span.to + 1).map((event) => event.id);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
        paddingTop: 8,
        borderTop: `1px solid ${HAIRLINE}`,
      }}
    >
      <Layers size={13} color={TEAL} aria-hidden="true" style={{ flexShrink: 0 }} />
      <span style={{ ...labelText, fontSize: 11, color: TEXT_SECONDARY, whiteSpace: "nowrap" }}>
        Phase {phase}
      </span>

      <input
        type="text"
        value={title}
        placeholder="Name this stretch of work"
        aria-label="Phase title"
        onChange={(nativeEvent) => setTitle(nativeEvent.target.value)}
        onKeyDown={(nativeEvent) => {
          if (nativeEvent.key === "Enter" && canAssign) onAssign(ids, phase, title.trim());
        }}
        onFocus={(nativeEvent) => focusControl(nativeEvent.currentTarget)}
        onBlur={(nativeEvent) => blurControl(nativeEvent.currentTarget)}
        style={{ ...compactControlStyle, flex: 1, minWidth: 160 }}
      />

      <button
        type="button"
        disabled={!canAssign}
        onClick={() => onAssign(ids, phase, title.trim())}
        style={{
          ...actionButton,
          borderColor: canAssign ? hexToRgba(TEAL, 0.4) : CONTROL_BORDER,
          color: canAssign ? TEAL : TEXT_MUTED,
          cursor: canAssign ? "pointer" : "not-allowed",
        }}
      >
        Name {selected.length} {selected.length === 1 ? "event" : "events"}
      </button>

      {alreadyPhased ? (
        <button
          type="button"
          onClick={() => onClear(ids)}
          style={{ ...actionButton, color: TEXT_MUTED }}
          title="Take these events out of their phase"
        >
          <Scissors size={11} aria-hidden="true" />
          Ungroup
        </button>
      ) : null}

      {!span.contiguous ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED, fontWeight: 300 }}>
            A phase has to be a run. Your selection skips {span.gaps}{" "}
            {span.gaps === 1 ? "event" : "events"}.
          </span>
          <button
            type="button"
            onClick={() => onFillSpan(fillIds)}
            style={{ ...actionButton, color: TEXT_PRIMARY }}
          >
            Select events {events[span.from].ordinal}–{events[span.to].ordinal}
          </button>
        </div>
      ) : null}
    </div>
  );
}
