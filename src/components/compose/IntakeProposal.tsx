// What the parser found, and what the creator does about it.
//
// The parser guesses. It has to — a model name assembled from scattered
// mentions, a result read off the position of a turn, a title taken from an
// opening line. The rule this component exists to enforce is that it never
// guesses silently: every inferred item carries a visible marker and the
// parser's own reason, so a creator can disagree with a specific claim rather
// than distrusting the whole proposal.
//
// Everything defaults to keep. The creator has already done this work
// elsewhere; making them opt each piece back in would be asking them to do it
// twice.
//
// The events are collapsed to a count. A twenty-exchange transcript is forty
// rows of chat that the creator has already read once, and rendering it in
// full turns a review into a scroll.
//
// EXTENDED, NOT FORKED (NS-P34). A Build File dropped on /import or
// /compose/new is reviewed here too, because a creator confirming imported
// material should not have to learn a second surface to do it on. Four optional
// props carry what a Build File has and a transcript does not — the line naming
// the tool that wrote it, the note about where kept nodes land, the scan for
// keys that travelled in the file, and test ids for the import flow. All four
// are absent on the transcript path, which renders exactly as it did.

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type {
  IntakeSelectionState,
  ProposedEvent,
  ProposedField,
  ProposedNode,
  TranscriptProposal,
} from "@/lib/build/intake";
import type { SecretWarning } from "@/lib/build/buildfile";
import {
  CATEGORY_COLOUR,
  GAP_RED,
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
  pageHeadingText,
  titleText,
} from "@/components/build/tokens";

/** Long enough to recognise the item, short enough to stay on one line. */
const SUMMARY_LIMIT = 96;

/**
 * The types NS-P13 emits, for the label and colour on a pill.
 *
 * A local map rather than the node_types registry: the review is the one
 * screen that must render before anything else loads, and a round trip to the
 * registry to label three known keys would be a gate for no gain. An unknown
 * key falls back to its own name, so a parser that learns a fourth type still
 * renders.
 */
const PARSER_TYPES: Record<string, { label: string; category: string }> = {
  code: { label: "Code", category: "artefact" },
  model_params: { label: "Model settings", category: "configuration" },
  result: { label: "Result", category: "evidence" },
};

/** What each group is called in the found-it sentence, singular and plural. */
const TYPE_NOUNS: Record<string, [string, string]> = {
  code: ["code block", "code blocks"],
  model_params: ["model setting", "model settings"],
  result: ["result", "results"],
};

function truncate(text: string, limit = SUMMARY_LIMIT): string {
  const flat = text.trim().replace(/\s+/g, " ");
  return flat.length > limit ? `${flat.slice(0, limit - 1)}…` : flat;
}

/** The first non-empty string in a payload. Shapes differ per type. */
function payloadSummary(payload: Record<string, unknown>): string | null {
  for (const value of Object.values(payload ?? {})) {
    if (typeof value === "string" && value.trim()) return truncate(value);
  }
  return null;
}

function plural(count: number, [one, many]: [string, string]): string {
  return `${count} ${count === 1 ? one : many}`;
}

// -----------------------------------------------------------------------------
// Pieces
// -----------------------------------------------------------------------------

function TypePill({ typeKey }: { typeKey: string }) {
  const known = PARSER_TYPES[typeKey];
  const colour = CATEGORY_COLOUR[known?.category ?? ""] ?? TEXT_SECONDARY;

  return (
    <span
      style={{
        ...labelText,
        fontSize: 10,
        textTransform: "uppercase",
        padding: "2px 7px",
        borderRadius: 100,
        whiteSpace: "nowrap",
        background: hexToRgba(colour, 0.15),
        color: colour,
      }}
    >
      {known?.label ?? typeKey}
    </span>
  );
}

/**
 * The uncertainty marker.
 *
 * `title` rather than a tooltip component: it is the reason on hover the brief
 * asks for, it works on a keyboard-focused element, and it costs no bundle on
 * the one route that must stay light.
 */
function InferredMark({ reason }: { reason: string | null }) {
  return (
    <span
      title={reason ?? "Inferred by the parser rather than read from the transcript."}
      aria-label={`Inferred: ${reason ?? "not read directly from the transcript"}`}
      tabIndex={0}
      style={{
        ...labelText,
        fontSize: 10,
        textTransform: "uppercase",
        padding: "2px 7px",
        borderRadius: 100,
        whiteSpace: "nowrap",
        cursor: "help",
        background: hexToRgba(ORANGE, 0.14),
        border: `1px solid ${hexToRgba(ORANGE, 0.3)}`,
        color: ORANGE,
      }}
    >
      Guess
    </span>
  );
}

function KeepToggle({
  kept,
  onToggle,
  label,
}: {
  kept: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={kept}
      aria-label={`${kept ? "Discard" : "Keep"} ${label}`}
      onClick={onToggle}
      style={{
        ...labelText,
        fontFamily: "inherit",
        fontSize: 11,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        flexShrink: 0,
        padding: "3px 9px",
        borderRadius: 100,
        cursor: "pointer",
        background: kept ? hexToRgba(TEAL, 0.12) : "rgba(255,255,255,0.03)",
        border: `1px solid ${kept ? hexToRgba(TEAL, 0.32) : HAIRLINE}`,
        color: kept ? TEAL : TEXT_MUTED,
        transition: "background 120ms ease, border-color 120ms ease, color 120ms ease",
      }}
    >
      <span aria-hidden style={{ fontSize: 10 }}>{kept ? "✓" : "○"}</span>
      {kept ? "Keep" : "Discard"}
    </button>
  );
}

/** A row that dims when discarded, so the kept set is readable at a glance. */
function rowStyle(kept: boolean): CSSProperties {
  return {
    ...cardGlass,
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "9px 11px",
    opacity: kept ? 1 : 0.42,
    transition: "opacity 120ms ease",
  };
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ ...labelText, textTransform: "uppercase", color: TEXT_SECONDARY }}>
      {children}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Header fields — title and outcome, which are builds columns and not nodes
// -----------------------------------------------------------------------------

function FieldRow({
  name,
  field,
  kept,
  onToggle,
}: {
  name: string;
  field: ProposedField;
  kept: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={rowStyle(kept)}>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED }}>{name}</span>
          {field.inferred ? <InferredMark reason={field.inferred_reason} /> : null}
        </div>
        <span style={{ ...bodyText, color: TEXT_PRIMARY, wordBreak: "break-word" }}>
          {field.value}
        </span>
      </div>
      <KeepToggle kept={kept} onToggle={onToggle} label={`the proposed ${name.toLowerCase()}`} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Events — a count, and a list behind a disclosure
// -----------------------------------------------------------------------------

function EventRow({
  event,
  kept,
  onToggle,
}: {
  event: ProposedEvent;
  kept: boolean;
  onToggle: () => void;
}) {
  return (
    <li style={{ listStyle: "none" }}>
      <div style={rowStyle(kept)}>
        <span
          style={{
            ...labelText,
            fontSize: 11,
            color: TEXT_MUTED,
            minWidth: 22,
            flexShrink: 0,
            paddingTop: 1,
          }}
        >
          {event.ordinal}
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
          <span style={{ ...bodyText, color: TEXT_PRIMARY, wordBreak: "break-word" }}>
            {truncate(event.payload.text ?? "", 140) || "Empty turn"}
          </span>
          {event.payload.response_summary ? (
            <span style={{ ...bodyText, fontSize: 12, color: TEXT_MUTED, wordBreak: "break-word" }}>
              ↳ {truncate(event.payload.response_summary, 110)}
            </span>
          ) : null}
          <span style={{ ...labelText, fontSize: 10, color: TEXT_MUTED }}>
            turn {event.source_ref.index}
          </span>
        </div>
        {event.inferred ? <InferredMark reason={event.inferred_reason} /> : null}
        <KeepToggle kept={kept} onToggle={onToggle} label={`prompt ${event.ordinal}`} />
      </div>
    </li>
  );
}

function EventSection({
  events,
  selection,
  onChange,
}: {
  events: ProposedEvent[];
  selection: IntakeSelectionState;
  onChange: (next: IntakeSelectionState) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const keptCount = events.filter((event) => selection.eventOrdinals.has(event.ordinal)).length;
  const allKept = keptCount === events.length;

  if (events.length === 0) return null;

  const toggleOne = (ordinal: number) => {
    const next = new Set(selection.eventOrdinals);
    if (next.has(ordinal)) next.delete(ordinal);
    else next.add(ordinal);
    onChange({ ...selection, eventOrdinals: next });
  };

  const toggleAll = () => {
    onChange({
      ...selection,
      eventOrdinals: allKept ? new Set() : new Set(events.map((event) => event.ordinal)),
    });
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <SectionHeading>The sequence</SectionHeading>

      <div style={{ ...rowStyle(keptCount > 0), alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
          <span style={{ ...titleText, fontSize: 14 }}>
            {plural(events.length, ["prompt in sequence", "prompts in sequence"])}
          </span>
          <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED }}>
            {keptCount === events.length
              ? "All kept"
              : `${keptCount} of ${events.length} kept`}
            {" · they become the build's event sequence"}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          style={{
            ...labelText,
            fontFamily: "inherit",
            fontSize: 11,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: TEAL,
            flexShrink: 0,
          }}
        >
          {expanded ? "Hide" : `Show all ${events.length}`}
        </button>

        <KeepToggle kept={allKept} onToggle={toggleAll} label="every prompt" />
      </div>

      {expanded ? (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {events.map((event) => (
            <EventRow
              key={event.ordinal}
              event={event}
              kept={selection.eventOrdinals.has(event.ordinal)}
              onToggle={() => toggleOne(event.ordinal)}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

// -----------------------------------------------------------------------------
// Nodes — grouped by type, every one of them tray material
// -----------------------------------------------------------------------------

function NodeRow({
  node,
  kept,
  onToggle,
}: {
  node: ProposedNode;
  kept: boolean;
  onToggle: () => void;
}) {
  const summary = node.title?.trim() || payloadSummary(node.payload);
  const detail = node.title?.trim() ? payloadSummary(node.payload) : null;

  return (
    <li style={{ listStyle: "none" }}>
      <div style={rowStyle(kept)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <TypePill typeKey={node.type} />
            {node.inferred ? <InferredMark reason={node.inferred_reason} /> : null}
            <span style={{ ...labelText, fontSize: 10, color: TEXT_MUTED }}>
              turn {node.source_ref.index}
            </span>
          </div>
          <span style={{ ...bodyText, color: TEXT_PRIMARY, wordBreak: "break-word" }}>
            {summary ?? `Untitled ${node.type}`}
          </span>
          {detail ? (
            <span style={{ ...bodyText, fontSize: 12, color: TEXT_MUTED, wordBreak: "break-word" }}>
              {detail}
            </span>
          ) : null}
          {node.note ? (
            <span style={{ ...bodyText, fontSize: 12, color: TEXT_MUTED }}>{node.note}</span>
          ) : null}
        </div>
        <KeepToggle kept={kept} onToggle={onToggle} label={summary ?? node.type} />
      </div>
    </li>
  );
}

function NodeSection({
  nodes,
  selection,
  onChange,
}: {
  nodes: ProposedNode[];
  selection: IntakeSelectionState;
  onChange: (next: IntakeSelectionState) => void;
}) {
  const groups = useMemo(() => {
    const byType = new Map<string, ProposedNode[]>();
    for (const node of nodes) {
      const group = byType.get(node.type) ?? [];
      group.push(node);
      byType.set(node.type, group);
    }
    return [...byType.entries()];
  }, [nodes]);

  if (nodes.length === 0) return null;

  const toggleOne = (localId: string) => {
    const next = new Set(selection.nodeLocalIds);
    if (next.has(localId)) next.delete(localId);
    else next.add(localId);
    onChange({ ...selection, nodeLocalIds: next });
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <SectionHeading>Pulled out of the replies</SectionHeading>

      {groups.map(([type, group]) => (
        <div key={type} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED }}>
            {plural(group.length, TYPE_NOUNS[type] ?? [type, `${type} items`])}
          </span>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {group.map((node) => (
              <NodeRow
                key={node.local_id}
                node={node}
                kept={selection.nodeLocalIds.has(node.local_id)}
                onToggle={() => toggleOne(node.local_id)}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** "node 1.2 · params" — where in the file the match was found. */
function secretLocation(secret: SecretWarning): string {
  const subject = secret.where === "event" ? `step ${secret.ref}` : `node ${secret.ref}`;
  return secret.field ? `${subject} · ${secret.field}` : subject;
}

/**
 * Keys and passwords that travelled in the file.
 *
 * IT NEVER BLOCKS THE IMPORT. The scan cannot tell a live key from an example
 * one, and a surface that refused the file would be wrong often enough to teach
 * creators to route around it. Nor does anything here edit the payload: the
 * match is shown already masked by the scanner, and what gets written is what
 * the file said. Import that silently edits a build is a worse failure than
 * import that shows a creator what is in their own file and lets them decide.
 *
 * Red, at the alpha the intake error panel already uses, because this is the
 * one thing on the review worth stopping to read.
 */
function SecretsBanner({ secrets }: { secrets: SecretWarning[] }) {
  if (secrets.length === 0) return null;

  return (
    <section
      data-testid="import-secrets-banner"
      data-visual-slot="intake-secrets"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "12px 14px",
        borderRadius: 10,
        border: `1px solid ${hexToRgba(GAP_RED, 0.3)}`,
        background: hexToRgba(GAP_RED, 0.06),
      }}
    >
      <span style={{ ...labelText, textTransform: "uppercase", color: GAP_RED }}>
        {secrets.length === 1 ? "1 possible secret" : `${secrets.length} possible secrets`}
      </span>
      <p style={{ ...bodyText, margin: 0, color: TEXT_PRIMARY }}>
        Looks like a key or password travelled in this file. Check these before
        you publish — clear them in the fields after import.
      </p>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 5,
        }}
      >
        {secrets.map((secret, index) => (
          <li
            key={`${secret.where}-${secret.ref}-${secret.field}-${index}`}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <code
              style={{
                ...bodyText,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 12,
                color: TEXT_PRIMARY,
                wordBreak: "break-all",
              }}
            >
              {secret.excerpt}
            </code>
            <span style={{ ...labelText, fontSize: 11, color: TEXT_SECONDARY }}>
              {secretLocation(secret)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// -----------------------------------------------------------------------------
// The review
// -----------------------------------------------------------------------------

interface IntakeProposalProps {
  proposal: TranscriptProposal;
  selection: IntakeSelectionState;
  onChange: (next: IntakeSelectionState) => void;
  onConfirm: () => void;
  /** Take the empty draft instead and throw the proposal away. */
  onSkip: () => void;
  isWriting: boolean;
  error: string | null;
  /**
   * "From Claude, 12 parts and 30 steps" — what wrote the file and how much of
   * it there is. Absent on the transcript path, which has no such provenance to
   * state: it was parsed from a paste, and saying so would be filler.
   */
  sourceLine?: string | null;
  /**
   * Where kept items land, when it is not the tray.
   *
   * The default sentence is true of every parser that guesses at structure. A
   * Build File carries the structure, so its nodes are placed and telling a
   * creator to go and arrange them would be wrong.
   */
  arrivalNote?: string;
  /** Keys and passwords found in the file. Advisory; never blocks the import. */
  secrets?: SecretWarning[];
  /** For the import flow's own tests. Omitted on the transcript path. */
  testId?: string;
  confirmTestId?: string;
}

export function IntakeProposal({
  proposal,
  selection,
  onChange,
  onConfirm,
  onSkip,
  isWriting,
  error,
  sourceLine,
  arrivalNote,
  secrets,
  testId,
  confirmTestId,
}: IntakeProposalProps) {
  const { events, nodes, summary, warnings } = proposal;

  /** "20 prompts · 3 code blocks · GPT-4o" — what it found, in one line. */
  const found = useMemo(() => {
    const parts: string[] = [];
    if (events.length) parts.push(plural(events.length, ["prompt", "prompts"]));

    const counts = new Map<string, number>();
    for (const node of nodes) counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
    for (const [type, count] of counts) {
      parts.push(plural(count, TYPE_NOUNS[type] ?? [type, `${type} items`]));
    }

    const model = nodes.find((node) => node.type === "model_params");
    if (model?.title) parts.push(model.title);

    return parts;
  }, [events, nodes]);

  const keptTotal =
    selection.eventOrdinals.size + selection.nodeLocalIds.size;

  return (
    <div
      {...(testId ? { "data-testid": testId } : {})}
      data-visual-slot="intake-proposal"
      style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%" }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h1 style={{ ...pageHeadingText, margin: 0 }}>Here is what it found</h1>
        {sourceLine ? (
          <p
            data-testid="import-source-line"
            style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY }}
          >
            {sourceLine}
          </p>
        ) : null}
        <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY }}>
          {found.length > 0 ? found.join(" · ") : "Nothing it could split into turns"}
        </p>
        <p style={{ ...bodyText, margin: 0, color: TEXT_MUTED }}>
          Anything marked <span style={{ color: ORANGE }}>Guess</span> was inferred
          rather than read — hover it for the reason.{" "}
          {arrivalNote ??
            "Everything you keep lands in the tray, unplaced, for you to arrange."}
        </p>
      </div>

      <SecretsBanner secrets={secrets ?? []} />

      {warnings.length > 0 ? (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            borderRadius: 8,
            border: `1px solid ${hexToRgba(ORANGE, 0.22)}`,
            background: hexToRgba(ORANGE, 0.05),
          }}
        >
          {warnings.map((warning, index) => (
            /* Keyed by position as well as code: one Build File can raise the
               same code many times — an unknown type per node — and a bare code
               would collide. */
            <li
              key={`${warning.code}-${index}`}
              style={{ ...bodyText, fontSize: 12, color: TEXT_SECONDARY }}
            >
              {warning.message}
            </li>
          ))}
        </ul>
      ) : null}

      {summary.proposed_title || summary.proposed_outcome ? (
        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SectionHeading>The build itself</SectionHeading>
          {summary.proposed_title ? (
            <FieldRow
              name="Title"
              field={summary.proposed_title}
              kept={selection.title}
              onToggle={() => onChange({ ...selection, title: !selection.title })}
            />
          ) : null}
          {summary.proposed_outcome ? (
            <FieldRow
              name="Outcome"
              field={summary.proposed_outcome}
              kept={selection.outcome}
              onToggle={() => onChange({ ...selection, outcome: !selection.outcome })}
            />
          ) : null}
          {!selection.title ? (
            <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED }}>
              Without a title the build stays called “Untitled build” until you
              name it.
            </span>
          ) : null}
        </section>
      ) : null}

      <EventSection events={events} selection={selection} onChange={onChange} />
      <NodeSection nodes={nodes} selection={selection} onChange={onChange} />

      {error ? (
        <p
          style={{
            ...bodyText,
            margin: 0,
            padding: "10px 12px",
            borderRadius: 8,
            border: `1px solid ${hexToRgba(GAP_RED, 0.3)}`,
            background: hexToRgba(GAP_RED, 0.06),
            color: TEXT_PRIMARY,
          }}
        >
          {error}
        </p>
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
          paddingTop: 4,
          borderTop: `1px solid ${HAIRLINE}`,
        }}
      >
        {/* VISUAL SLOT — the primary button surface is supplied externally.
            Structure only here: pill geometry, disabled state, no surface. */}
        <span data-visual-slot="btn-primary" style={{ display: "inline-flex", marginTop: 14 }}>
          <button
            type="button"
            {...(confirmTestId ? { "data-testid": confirmTestId } : {})}
            onClick={onConfirm}
            disabled={isWriting}
            style={{
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.04em",
              height: 34,
              padding: "0 18px",
              borderRadius: 100,
              background: "rgba(255,255,255,0.025)",
              border: `1px solid ${hexToRgba(TEAL, 0.32)}`,
              color: isWriting ? TEXT_MUTED : TEAL,
              cursor: isWriting ? "wait" : "pointer",
            }}
          >
            {isWriting
              ? "Adding to the draft…"
              : keptTotal === 0
                ? "Continue with nothing kept"
                : `Add ${keptTotal} to the draft`}
          </button>
        </span>

        <button
          type="button"
          onClick={onSkip}
          disabled={isWriting}
          style={{
            ...labelText,
            fontFamily: "inherit",
            marginTop: 14,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: isWriting ? "wait" : "pointer",
            color: TEXT_SECONDARY,
            textDecoration: "underline",
            textUnderlineOffset: 3,
          }}
        >
          Throw this away and start empty
        </button>
      </div>
    </div>
  );
}
