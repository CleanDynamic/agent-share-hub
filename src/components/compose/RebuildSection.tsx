// What a rebuild is publishing, in the publish sheet.
//
// THE DIFF IS THE CONTENT. This is the whole editorial position of the rebuild
// mechanic and the reason this section leads with a list rather than a box: a
// person who swapped the model and got a better answer has already said the
// useful thing by swapping the model. Asking them to write a paragraph before
// they may post it would buy prose nobody asked for and lose the posts of
// everyone who did not feel like writing one. So the computed lines are the
// content, they are shown whether or not anything is typed, and the note below
// them is gloss.
//
// The lines are serialiseChangeSet's, unedited and in its order. Nothing here
// re-derives, re-words or re-sorts them: the count in the top bar (NS-P38), the
// accents on the tree, and this list are three renderings of one ChangeSet, and
// a second opinion formed in this file is a way for them to disagree.
//
// THE CREDIT IS SHOWN, NOT OFFERED. There is no control beside it, because
// there is no decision to make — it is part of the post. Saying so plainly in
// one sub-line is kinder than a disabled toggle, and it is the honest moment to
// say it: before publishing rather than after.
//
// Styled with inline style objects like every other surface on this route:
// Tailwind's generated utilities win over hand-written classes at build time.

import { useId, useState } from "react";
import type { CSSProperties } from "react";
import type { ChangeKind, ChangeLine } from "@/lib/build";
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
} from "@/components/build/tokens";

/**
 * The copy, held as constants because it is the design.
 *
 * Four sentences carry the whole position: the list is what you are posting,
 * the note is optional and says so in its own label, the credit is permanent,
 * and an empty diff is "not yet" rather than "not allowed" — the refusal
 * belongs to the gate, in the gate's own words, beside the button.
 */
const HEADING = "What this rebuild changes";
const NOTE_LABEL =
  "What did you change, and why? (optional — the list above is shown either way)";
const NOTE_PLACEHOLDER = "Optional.";
const NOTHING_YET = "Nothing yet. This list fills in as you change things.";
const NO_DIFF =
  "The build this came from could not be read, so its changes cannot be listed.";
const CREDIT_PERMANENT = "This credit is part of the post and can't be removed.";

/**
 * How many lines a reader sees before they have to ask for the rest, and the
 * length at which asking is worth it.
 *
 * Seven rather than six is deliberate: collapsing a list to six to hide one
 * line costs a reader a press to learn nothing. The expander earns its place
 * from the second hidden line onwards.
 */
const COLLAPSED_LINES = 6;
const EXPAND_FROM = 7;

/**
 * Kind to colour, as the handover specifies them.
 *
 * changed and added are the two accents the whole platform already uses for
 * "was here and moved" and "is new" — the same pair the tree paints since
 * NS-P38, so a creator reading this list recognises it. removed and header take
 * the two greys from the category table: a removal is not a warning and a
 * rename is not an edit to the build's substance, and neither should read as
 * loudly as the two that are.
 */
const KIND_COLOUR: Record<ChangeKind, string> = {
  changed: ORANGE,
  added: TEAL,
  removed: "#9CA3AF",
  header: "#F59E0B",
};

const quietControl: CSSProperties = {
  ...labelText,
  fontFamily: "inherit",
  fontSize: 11,
  alignSelf: "flex-start",
  padding: "4px 8px",
  borderRadius: 8,
  background: "transparent",
  border: `1px solid ${HAIRLINE}`,
  color: TEXT_SECONDARY,
  cursor: "pointer",
};

export interface RebuildSectionProps {
  /** serialiseChangeSet's output, unedited. Empty is a real, ordinary state. */
  lines: ChangeLine[];
  /**
   * Whether a diff exists at all.
   *
   * False means the source could not be read — unpublished or deleted since the
   * fork — which is different from a diff that came back empty. An empty list
   * says "you have not changed anything yet"; no diff says "I cannot tell you",
   * and the two must not be shown as the same thing.
   */
  diffed: boolean;
  /** The note draft. Held by the caller, because the publish action reads it. */
  note: string;
  onNoteChange: (note: string) => void;
  /** rebuildCreditLine's sentence, or null when the fork froze no snapshot. */
  credit: string | null;
}

export function RebuildSection({
  lines,
  diffed,
  note,
  onNoteChange,
  credit,
}: RebuildSectionProps) {
  const [expanded, setExpanded] = useState(false);
  /** Generated rather than hardcoded: an id written by hand is an id that
   *  collides the first time two of these are mounted at once. */
  const noteId = useId();

  const collapsible = lines.length >= EXPAND_FROM;
  const shown = collapsible && !expanded ? lines.slice(0, COLLAPSED_LINES) : lines;
  const hidden = lines.length - COLLAPSED_LINES;

  return (
    <section
      data-testid="rebuild-section"
      data-visual-slot="publish-rebuild-section"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        paddingTop: 12,
        borderTop: `1px solid ${HAIRLINE}`,
      }}
    >
      <span style={{ ...labelText, textTransform: "uppercase", color: TEXT_MUTED }}>
        {HEADING}
      </span>

      {!diffed ? (
        <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY }}>{NO_DIFF}</p>
      ) : lines.length === 0 ? (
        <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY }}>{NOTHING_YET}</p>
      ) : (
        <>
          <ul
            data-testid="rebuild-change-lines"
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {shown.map((line) => (
              <ChangeLineRow key={line.key} line={line} />
            ))}
          </ul>

          {collapsible ? (
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              style={quietControl}
            >
              {expanded
                ? "Show fewer"
                : `and ${hidden} more`}
            </button>
          ) : null}
        </>
      )}

      <label
        htmlFor={noteId}
        style={{ ...bodyText, fontSize: 12, color: TEXT_SECONDARY }}
      >
        {NOTE_LABEL}
      </label>
      <textarea
        id={noteId}
        data-testid="rebuild-note"
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
        placeholder={NOTE_PLACEHOLDER}
        rows={3}
        style={{
          ...bodyText,
          fontFamily: "inherit",
          width: "100%",
          minWidth: 0,
          resize: "vertical",
          padding: "8px 10px",
          borderRadius: 10,
          outline: "none",
          background: "rgba(255,255,255,0.025)",
          border: `1px solid ${HAIRLINE}`,
          color: TEXT_PRIMARY,
        }}
      />

      {credit ? (
        <div
          data-testid="rebuild-credit"
          style={{
            ...cardGlass,
            borderLeft: `2px solid ${hexToRgba(ORANGE, 0.5)}`,
            background: hexToRgba(ORANGE, 0.05),
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {/* The card's own treatment for this line, so what a creator reads
              here is what a reader will read there. See rebuildCredit.ts. */}
          <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED }}>{credit}</span>
          <span style={{ ...labelText, fontSize: 11, color: TEXT_SECONDARY }}>
            {CREDIT_PERMANENT}
          </span>
        </div>
      ) : null}
    </section>
  );
}

/**
 * One change, as one line.
 *
 * The dot carries the kind and the text carries the change, which is why the
 * dot is aria-hidden: a screen reader gets "Swapped model: Sonnet 4.5 → Opus 4"
 * either way, and "orange bullet" adds nothing to it. Colour is the fast read
 * for the eye, never the only carrier of meaning.
 */
function ChangeLineRow({ line }: { line: ChangeLine }) {
  return (
    <li
      data-change-kind={line.kind}
      style={{
        ...bodyText,
        margin: 0,
        padding: "3px 0",
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 5,
          height: 5,
          marginTop: 8,
          borderRadius: 999,
          flexShrink: 0,
          background: KIND_COLOUR[line.kind],
        }}
      />
      <span style={{ minWidth: 0 }}>{line.text}</span>
    </li>
  );
}

export default RebuildSection;
