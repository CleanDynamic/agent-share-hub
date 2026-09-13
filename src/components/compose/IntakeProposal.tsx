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
/* BG-P24 — the colour aliases and the two page-level type roles are gone from
   this file. What is left are `bodyText` and `labelText`, which carry this
   route's 13px density rather than a colour: moving those is a reflow of the
   review rather than a repaint of it, and it is not this prompt's to make. */
import { bodyText, labelText } from "@/components/build/tokens";
import { CategoryChip } from "@/components/brand/CategoryChip";
import { Button } from "@/components/ui/button";
import { UI_EASING, UI_MS } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import {
  data as dataText,
  eyebrow as eyebrowText,
  measure,
  sectionHead as sectionHeadText,
} from "@/lib/theme/type";
import { workspaceCard } from "@/components/shell/WorkspaceBar";

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

/**
 * BG-P11: the shared chip, which also takes this off `border-radius: 100` —
 * the capsule the theme dropped by decision. BG-P05's rule is unchanged: a type
 * the parser learned but this map has not is the fallback rather than an
 * invented hue, and it still renders under its own key.
 */
function TypePill({ typeKey }: { typeKey: string }) {
  const known = PARSER_TYPES[typeKey];
  return <CategoryChip category={known?.category ?? ""} label={known?.label ?? typeKey} />;
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
        borderRadius: r.chip,
        whiteSpace: "nowrap",
        cursor: "help",
        /* The accent's own measured pair, opaque, rather than a 14% wash of it
           — a tint of the accent over an unknown ground is a pairing nobody
           measured, and on Exhibition it is close to invisible. */
        backgroundColor: t.action,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "transparent",
        color: t.onAction,
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
        borderRadius: r.chip,
        cursor: "pointer",
        backgroundColor: kept ? t.evidenceFill : t.recess,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: kept ? t.evidence : t.line,
        color: kept ? t.evidence : t.text2,
        transition: `background-color ${UI_MS}ms ${UI_EASING}, border-color ${UI_MS}ms ${UI_EASING}, color ${UI_MS}ms ${UI_EASING}`,
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
    ...workspaceCard,
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
    <span style={{ ...labelText, textTransform: "uppercase", color: t.text2 }}>
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
          <span style={{ ...labelText, fontSize: 11, color: t.text2 }}>{name}</span>
          {field.inferred ? <InferredMark reason={field.inferred_reason} /> : null}
        </div>
        <span style={{ ...bodyText, color: t.text, wordBreak: "break-word" }}>
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
            color: t.text2,
            minWidth: 22,
            flexShrink: 0,
            paddingTop: 1,
          }}
        >
          {event.ordinal}
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
          <span style={{ ...bodyText, color: t.text, wordBreak: "break-word" }}>
            {truncate(event.payload.text ?? "", 140) || "Empty turn"}
          </span>
          {event.payload.response_summary ? (
            <span style={{ ...bodyText, fontSize: 12, color: t.text2, wordBreak: "break-word" }}>
              ↳ {truncate(event.payload.response_summary, 110)}
            </span>
          ) : null}
          <span style={{ ...labelText, fontSize: 10, color: t.text2 }}>
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
          {/* A count, which the theme sets in the data face. */}
          <span style={{ ...dataText, color: t.text }}>
            {plural(events.length, ["prompt in sequence", "prompts in sequence"])}
          </span>
          <span style={{ ...labelText, fontSize: 11, color: t.text2 }}>
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
            /* `--action`, underlined at rest: this is somewhere to go, and
               `--evidence` means a thing was reproduced rather than "press
               me". Colour alone is not an affordance. */
            color: t.action,
            textDecoration: "underline",
            textUnderlineOffset: 3,
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
            <span style={{ ...labelText, fontSize: 10, color: t.text2 }}>
              turn {node.source_ref.index}
            </span>
          </div>
          <span style={{ ...bodyText, color: t.text, wordBreak: "break-word" }}>
            {summary ?? `Untitled ${node.type}`}
          </span>
          {detail ? (
            <span style={{ ...bodyText, fontSize: 12, color: t.text2, wordBreak: "break-word" }}>
              {detail}
            </span>
          ) : null}
          {node.note ? (
            <span style={{ ...bodyText, fontSize: 12, color: t.text2 }}>{node.note}</span>
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
          <span style={{ ...labelText, fontSize: 11, color: t.text2 }}>
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
 * BG-P24 — `--cat-breakage` ON THE EDGE AND ON THE COUNT, NOT UNDER THE PANEL.
 *
 * It was a 6% red wash inside a 30%-alpha red border, matching the refusal
 * panel's old treatment. On the Exhibition ground that is a pink box, and the
 * two surfaces then say the same thing in the same voice when they mean
 * different things: the refusal is "this file could not be read" and this is
 * "read this before you publish". So this keeps a 2px breakage edge over the
 * `--recess` ground the review stands on, spends the hue on the COUNT — which
 * is the fact worth stopping at — and leaves the sentence in `--text`.
 *
 * The excerpts are DM Mono from the scale rather than a hand-written monospace
 * stack: a masked key is data, and the theme has one face for that.
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
        backgroundColor: t.recess,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: t.line,
        borderRadius: r.panel,
        borderLeftWidth: 2,
        borderLeftStyle: "solid",
        borderLeftColor: t.catBreakage,
      }}
    >
      <span style={{ ...eyebrowText, color: t.catBreakage }}>
        {secrets.length === 1 ? "1 possible secret" : `${secrets.length} possible secrets`}
      </span>
      <p style={{ ...bodyText, margin: 0, color: t.text }}>
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
                ...dataText,
                color: t.text,
                wordBreak: "break-all",
              }}
            >
              {secret.excerpt}
            </code>
            <span style={{ ...dataText, color: t.text2 }}>
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
        {/* The display face at the section size, which is what this is: the
            page's one heading once a file is in hand. It was the workspace's
            22px Figtree, which is a panel title rather than a page's name. */}
        <h1 style={{ ...sectionHeadText, color: t.text, margin: 0 }}>
          Here is what it found
        </h1>
        {sourceLine ? (
          <p
            data-testid="import-source-line"
            /* Provenance and counts are data — "From Claude, 12 parts and 30
               steps" is the same role as a model name — so both lines are mono
               and the prose below them is not. */
            style={{ ...dataText, margin: 0, color: t.text2 }}
          >
            {sourceLine}
          </p>
        ) : null}
        <p style={{ ...dataText, margin: 0, color: t.text2 }}>
          {found.length > 0 ? found.join(" · ") : "Nothing it could split into turns"}
        </p>
        <p style={{ ...bodyText, ...measure, margin: 0, color: t.text2 }}>
          Anything marked <span style={{ color: t.action }}>Guess</span> was inferred
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
            /* The state on a 2px edge over `--recess`, like every other
               noticing surface in this flow. A 5% accent wash behind a list is
               the thing that turns a note into an alert. */
            backgroundColor: t.recess,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: t.line,
            borderRadius: r.panel,
            borderLeftWidth: 2,
            borderLeftStyle: "solid",
            borderLeftColor: t.action,
          }}
        >
          {warnings.map((warning, index) => (
            /* Keyed by position as well as code: one Build File can raise the
               same code many times — an unknown type per node — and a bare code
               would collide. */
            <li
              key={`${warning.code}-${index}`}
              style={{ ...bodyText, margin: 0, color: t.text2 }}
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
            <span style={{ ...labelText, fontSize: 11, color: t.text2 }}>
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
          role="alert"
          style={{
            ...bodyText,
            margin: 0,
            padding: "10px 12px",
            backgroundColor: t.recess,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: t.line,
            borderRadius: r.panel,
            borderLeftWidth: 2,
            borderLeftStyle: "solid",
            borderLeftColor: t.catBreakage,
            color: t.text,
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
          borderTopWidth: 1,
          borderTopStyle: "solid",
          borderTopColor: t.line,
        }}
      >
        {/* THE REVIEW'S ONE PRIMARY ACTION (BG-P24). It was a `--recess`
            button with a 32%-alpha teal outline and a teal label — a
            SECONDARY treatment on the one control the whole screen exists to
            reach. `--evidence` is also the wrong hue for it: evidence means
            "this was reproduced", and this button means "go". The kit's
            primary Button says both things correctly and carries its own
            slot, so the wrapper span that used to mark it is gone. */}
        <Button
          type="button"
          {...(confirmTestId ? { "data-testid": confirmTestId } : {})}
          onClick={onConfirm}
          disabled={isWriting}
          style={{ marginTop: 14, cursor: isWriting ? "wait" : undefined }}
        >
          {isWriting
            ? "Adding to the draft…"
            : keptTotal === 0
              ? "Continue with nothing kept"
              : `Add ${keptTotal} to the draft`}
        </Button>

        <button
          type="button"
          onClick={onSkip}
          disabled={isWriting}
          style={{
            ...labelText,
            fontFamily: "inherit",
            marginTop: 14,
            background: "transparent",
            borderWidth: 0,
            borderStyle: "none",
            padding: 0,
            cursor: isWriting ? "wait" : "pointer",
            color: t.text2,
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
