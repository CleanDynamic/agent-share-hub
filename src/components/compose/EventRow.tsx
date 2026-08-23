// One event in the sequence, and the two decisions a creator makes about it.
//
// VISIBILITY IS A PRIVACY CONTROL, and it is built as one.
//
// A raw prompt log is the most revealing thing a creator can publish. It holds
// the client's name in the brief they pasted, the dead end they went down for
// two days, the key they forgot was in the error they shared with the model.
// "Hidden" here is not a display preference — it means the row never leaves the
// database, and the filter that enforces it lives in getEvents' query rather
// than in any component. So the three states are spelled out in words on every
// row, with what each one actually does written next to it, rather than hidden
// behind an eye icon that could plausibly mean either "visible" or "visible to
// me". A creator should never have to guess which of their prompts are public.
//
// KIND IS THE HIGH-VALUE INPUT. The transcript parser guesses `prompt` for
// almost everything, because from the outside almost everything looks like one.
// Only the creator knows which turn was the milestone and which was the moment
// it broke, and that judgement is most of what makes a 47-prompt sequence worth
// reading. So the control is on the row itself, one click from the text it
// describes, not behind a selection or a panel.

import { memo } from "react";
import {
  AlertTriangle,
  Flag,
  MessageSquare,
  Rocket,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import type { BuildEvent, EventKind, EventVisibility } from "@/lib/build";
import {
  FONT_STACK,
  GAP_RED,
  HAIRLINE,
  ORANGE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  VOID,
  hexToRgba,
  labelText,
} from "@/components/build/tokens";
import {
  CONTROL_BACKGROUND,
  CONTROL_BORDER,
  blurControl,
  compactControlStyle,
  focusControl,
} from "@/components/compose/fields";
import { EventNodeLink, type NodeLinkOption } from "./EventNodeLink";

// --- kinds -------------------------------------------------------------------

export interface KindMeta {
  label: string;
  Icon: LucideIcon;
  colour: string;
  /** What choosing this kind claims about the event. */
  hint: string;
}

/** Total over EventKind, so a sixth kind added to the CHECK constraint fails to
 *  compile here until it has an icon and a colour. */
export const KIND_META: Record<EventKind, KindMeta> = {
  prompt: {
    label: "Prompt",
    Icon: MessageSquare,
    colour: ORANGE,
    hint: "A turn you sent the model",
  },
  milestone: {
    label: "Milestone",
    Icon: Flag,
    colour: TEAL,
    hint: "The moment something started working",
  },
  breakage: {
    label: "Breakage",
    Icon: AlertTriangle,
    colour: GAP_RED,
    hint: "The moment something broke",
  },
  deploy: {
    label: "Deploy",
    Icon: Rocket,
    colour: "#F59E0B",
    hint: "You shipped it somewhere",
  },
  note: {
    label: "Note",
    Icon: StickyNote,
    colour: "#9CA3AF",
    hint: "Your own commentary, not a model turn",
  },
};

export const EVENT_KINDS = Object.keys(KIND_META) as EventKind[];

/** A kind off the registry — a row written before this build of the app. */
const UNKNOWN_KIND: KindMeta = {
  label: "Unknown",
  Icon: StickyNote,
  colour: TEXT_MUTED,
  hint: "A kind this version does not know",
};

export function kindMeta(kind: string): KindMeta {
  return KIND_META[kind as EventKind] ?? UNKNOWN_KIND;
}

// --- visibility --------------------------------------------------------------

export interface VisibilityMeta {
  label: string;
  /** Plain language, and literally true. Shown on the control, not buried. */
  meaning: string;
  colour: string;
}

export const VISIBILITY_META: Record<EventVisibility, VisibilityMeta> = {
  kept: {
    label: "Kept",
    meaning: "Shown in the replay, expanded",
    colour: TEAL,
  },
  folded: {
    label: "Folded",
    meaning: "Shown in the replay, collapsed by default",
    colour: TEXT_SECONDARY,
  },
  hidden: {
    label: "Hidden",
    meaning: "Never sent to the client, private forever",
    colour: GAP_RED,
  },
};

export const VISIBILITY_STATES = Object.keys(VISIBILITY_META) as EventVisibility[];

// --- formatting --------------------------------------------------------------

/** One formatter for the whole panel. A hundred rows must not build a hundred
 *  Intl instances. */
const WHEN = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatWhen(occurredAt: string | null): string | null {
  if (!occurredAt) return null;
  const at = new Date(occurredAt);
  return Number.isNaN(at.getTime()) ? null : WHEN.format(at);
}

/**
 * The first line of payload.text, truncated.
 *
 * The row is a scanning surface: a creator triaging sixty events reads down the
 * left edge looking for the one they remember. A paragraph in every row defeats
 * that, so the row takes one line and the payload keeps the rest.
 */
export function firstLine(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const text = (payload as { text?: unknown }).text;
  if (typeof text !== "string") return "";
  const line = text.split("\n").find((candidate) => candidate.trim() !== "");
  return (line ?? "").trim();
}

// --- the visibility control --------------------------------------------------

const segment: React.CSSProperties = {
  padding: "3px 8px",
  border: "1px solid transparent",
  borderRadius: 6,
  background: "transparent",
  color: TEXT_MUTED,
  fontFamily: "inherit",
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.04em",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

interface VisibilityControlProps {
  value: EventVisibility | string;
  onChange: (visibility: EventVisibility) => void;
  /** Announced on the group, so the three buttons are not three orphans. */
  label: string;
}

/**
 * Three states, named, always all three visible.
 *
 * Not a cycle button and not a dropdown: a creator must be able to see that
 * "Hidden" exists, and see which of the three this row is in, without
 * interacting with it at all. That is the difference between a control someone
 * trusts with a client's name in a prompt and one they do not.
 */
export function VisibilityControl({ value, onChange, label }: VisibilityControlProps) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      style={{
        display: "flex",
        gap: 2,
        padding: 2,
        borderRadius: 8,
        border: `1px solid ${CONTROL_BORDER}`,
        background: CONTROL_BACKGROUND,
        flexShrink: 0,
      }}
    >
      {VISIBILITY_STATES.map((state) => {
        const meta = VISIBILITY_META[state];
        const active = value === state;
        return (
          <button
            key={state}
            type="button"
            role="radio"
            aria-checked={active}
            title={`${meta.label} — ${meta.meaning}`}
            onClick={() => {
              if (!active) onChange(state);
            }}
            style={{
              ...segment,
              background: active ? hexToRgba(meta.colour, 0.16) : "transparent",
              borderColor: active ? hexToRgba(meta.colour, 0.4) : "transparent",
              color: active ? meta.colour : TEXT_MUTED,
            }}
          >
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

// --- the row -----------------------------------------------------------------

interface EventRowProps {
  event: BuildEvent;
  selected: boolean;
  /** shiftKey is carried through so the view can extend from its anchor. */
  onToggleSelect: (id: string, shiftKey: boolean) => void;
  onVisibility: (id: string, visibility: EventVisibility) => void;
  onKind: (id: string, kind: EventKind) => void;
  onLink: (id: string, nodeId: string | null) => void;
  nodeOptions: NodeLinkOption[];
}

function EventRowBase({
  event,
  selected,
  onToggleSelect,
  onVisibility,
  onKind,
  onLink,
  nodeOptions,
}: EventRowProps) {
  const meta = kindMeta(event.kind);
  const when = formatWhen(event.occurred_at);
  const text = firstLine(event.payload);
  const isHidden = event.visibility === "hidden";
  const name = `Event ${event.ordinal}`;

  return (
    <li
      data-event-ordinal={event.ordinal}
      style={{
        display: "flex",
        alignItems: "flex-start",
        flexWrap: "wrap",
        gap: 8,
        padding: "7px 10px",
        borderRadius: 10,
        border: `1px solid ${selected ? hexToRgba(TEAL, 0.32) : "transparent"}`,
        background: selected ? hexToRgba(TEAL, 0.05) : "transparent",
        borderBottom: `1px solid ${selected ? hexToRgba(TEAL, 0.32) : HAIRLINE}`,
        // A hidden row stays legible but visibly withdrawn, so a creator
        // scanning the panel can see at a glance how much of the sequence they
        // have taken out of the public record.
        opacity: isHidden ? 0.55 : 1,
        fontFamily: FONT_STACK,
      }}
    >
      <input
        type="checkbox"
        checked={selected}
        aria-label={`Select ${name}`}
        onChange={() => undefined}
        onClick={(nativeEvent) => onToggleSelect(event.id, nativeEvent.shiftKey)}
        style={{ marginTop: 4, accentColor: TEAL, cursor: "pointer", flexShrink: 0 }}
      />

      <span
        aria-hidden="true"
        style={{
          ...labelText,
          minWidth: 26,
          textAlign: "right",
          marginTop: 3,
          fontSize: 11,
          color: TEXT_MUTED,
          fontVariantNumeric: "tabular-nums",
          flexShrink: 0,
        }}
      >
        {event.ordinal}
      </span>

      <meta.Icon
        size={13}
        color={meta.colour}
        aria-hidden="true"
        style={{ marginTop: 4, flexShrink: 0 }}
      />

      <span
        title={text}
        style={{
          flex: 1,
          minWidth: 140,
          marginTop: 1,
          fontSize: 13,
          fontWeight: 300,
          lineHeight: 1.5,
          color: text ? TEXT_PRIMARY : TEXT_MUTED,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {text || "No text on this event"}
      </span>

      {when ? (
        <span
          style={{
            ...labelText,
            marginTop: 3,
            fontSize: 11,
            color: TEXT_MUTED,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {when}
        </span>
      ) : null}

      <select
        value={EVENT_KINDS.includes(event.kind as EventKind) ? event.kind : ""}
        aria-label={`Kind of ${name}`}
        title={meta.hint}
        onChange={(nativeEvent) => onKind(event.id, nativeEvent.target.value as EventKind)}
        onFocus={(nativeEvent) => focusControl(nativeEvent.currentTarget)}
        onBlur={(nativeEvent) => blurControl(nativeEvent.currentTarget)}
        style={{
          ...compactControlStyle,
          width: "auto",
          appearance: "none",
          cursor: "pointer",
          color: meta.colour,
          flexShrink: 0,
        }}
      >
        {/* The native menu paints on the OS surface, so each option carries the
            panel's own colours rather than inheriting the select's. */}
        {!EVENT_KINDS.includes(event.kind as EventKind) ? (
          <option value="" style={{ background: VOID, color: TEXT_SECONDARY }}>
            {event.kind}
          </option>
        ) : null}
        {EVENT_KINDS.map((kind) => (
          <option key={kind} value={kind} style={{ background: VOID, color: TEXT_PRIMARY }}>
            {KIND_META[kind].label}
          </option>
        ))}
      </select>

      <VisibilityControl
        value={event.visibility}
        label={`Visibility of ${name}`}
        onChange={(visibility) => onVisibility(event.id, visibility)}
      />

      <EventNodeLink
        event={event}
        options={nodeOptions}
        onLink={(nodeId) => onLink(event.id, nodeId)}
        labelPrefix={name}
      />
    </li>
  );
}

/**
 * Memoised, and that is load-bearing rather than tidy.
 *
 * A 200-event build re-renders this list on every keystroke in the phase title
 * and on every visibility click. React Query hands back a new array with the
 * same row objects in it for the events that did not change, so a memo on
 * identity turns a 200-row re-render into a 1-row one. Every callback above is
 * stable for the same reason.
 */
export const EventRow = memo(EventRowBase);
