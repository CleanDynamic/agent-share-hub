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
import type { ChangeLine } from "@/lib/build";
import {
  rebuildCreditLine,
  type RebuildCreditSource,
} from "@/components/build/rebuildCredit";
import {
  RebuildCredit,
  changeKindColour,
  summaryWindow,
} from "@/components/brand/RebuildCredit";
import { Textarea } from "@/components/ui/textarea";
import { chipType } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import {
  body as bodyText,
  data as dataText,
  eyebrow as eyebrowText,
  label as labelText,
} from "@/lib/theme/type";

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

/*  WHAT IS SHARED, AND WHAT THIS FILE STILL ARRANGES ITSELF.

    `summaryWindow` is the six-shown / seven-to-collapse rule this file wrote
    first and the published page now applies too; it lives in RebuildCredit so
    the two cannot drift to different numbers, and this file reads it rather
    than keeping a second `slice(0, 6)`.

    `changeKindColour` is the one answer to what colour a change kind is —
    changed the accent, added the evidence token, removed the quiet text rung,
    a header move the artefact hue. BG-P24 moved three of those off the part
    categories; the reasoning is in RebuildCredit.tsx, and the point of it not
    being here is that a second opinion formed in this file is how this list
    and the published page's Δ summary come to disagree.

    BG-P24 — THE CREDIT IS THE SHARED COMPONENT NOW. It was a hand-rolled tinted
    box repeating a sentence the shared component already renders. It takes the
    frozen snapshot columns and composes the sentence itself, which is what
    makes what a creator reads here identical to what a reader will read on the
    card and on the build page.

    WHAT DID NOT MOVE is the ARRANGEMENT. The publish sheet leads with the diff
    — it IS the content here — so the Δ list stays above, the note follows, and
    the credit sits under both as a footnote. `changes` is therefore NOT passed
    to RebuildCredit: it would render its own second copy of the same lines
    directly beneath the first. */

/**
 * The expander under the Δ list. RebuildCredit's own paint, so the two match.
 *
 * ITS PADDING IS THE ONE THING NOT TAKEN FROM THERE. The shared expander is
 * `3px 8px` and this was already `4px 8px`; a repaint may change what an
 * existing control looks like and may not change the box it occupies, and one
 * pixel of vertical padding is not worth being the exception. The two read
 * identically at these sizes.
 */
const quietControl: CSSProperties = {
  ...chipType,
  fontFamily: "inherit",
  alignSelf: "flex-start",
  padding: "4px 8px",
  borderRadius: r.chip,
  background: "transparent",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: t.line,
  color: t.text2,
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
  /**
   * The two FROZEN snapshot columns, handed straight to RebuildCredit.
   *
   * The composed sentence used to arrive here as a string and be printed by
   * this file. It is the source now, because the shared component composes the
   * sentence from exactly these two columns — so the credit a creator reads in
   * the sheet and the credit a reader sees on the card are one rendering, not
   * two that happen to agree today. A fork taken before those columns existed
   * carries neither, and the component renders nothing at all rather than
   * "Rebuilt from" trailing off.
   */
  source: RebuildCreditSource | null;
}

export function RebuildSection({
  lines,
  diffed,
  note,
  onNoteChange,
  source,
}: RebuildSectionProps) {
  const [expanded, setExpanded] = useState(false);
  /** Generated rather than hardcoded: an id written by hand is an id that
   *  collides the first time two of these are mounted at once. */
  const noteId = useId();

  const { shown, hidden, collapsible } = summaryWindow(lines, expanded);

  return (
    <section
      data-testid="rebuild-section"
      data-visual-slot="publish-rebuild-section"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopStyle: "solid",
        borderTopColor: t.line,
      }}
    >
      <span style={{ ...eyebrowText, color: t.text2 }}>{HEADING}</span>

      {!diffed ? (
        <p style={{ ...bodyText, margin: 0, color: t.text2 }}>{NO_DIFF}</p>
      ) : lines.length === 0 ? (
        <p style={{ ...bodyText, margin: 0, color: t.text2 }}>{NOTHING_YET}</p>
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

      <label htmlFor={noteId} style={{ ...labelText, color: t.text2 }}>
        {NOTE_LABEL}
      </label>
      {/* THE BG-P07 TEXTAREA. A `--recess` well with a `--line` border that
          brightens to `--action` on focus, `--r-control`, the shared ring, and
          the placeholder in `--text2` — all of it the kit's, none of it
          restated here. It was a hand-rolled 2.5%-white film with a 10px
          radius that belonged to no step of the scale. */}
      <Textarea
        id={noteId}
        data-testid="rebuild-note"
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
        placeholder={NOTE_PLACEHOLDER}
        rows={3}
        style={{ minWidth: 0, resize: "vertical" }}
      />

      {/* `rebuildCreditLine` is asked here rather than by the caller, because
          this is where the answer is rendered: a fork taken before the
          snapshot columns existed composes to no sentence, and a container
          around a component that renders nothing is an empty box. */}
      {source && rebuildCreditLine(source) ? (
        <div
          data-testid="rebuild-credit"
          style={{
            /* A `--recess` footnote with an `--action` edge, which is the
               workspace's own vocabulary for "this belongs to the record" —
               rather than the glass film and the tinted orange wash it was.
               No blur: a working surface carries none. */
            backgroundColor: t.recess,
            borderLeftWidth: 2,
            borderLeftStyle: "solid",
            borderLeftColor: t.action,
            borderRadius: r.card,
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {/* THE SHARED COMPONENT, composing the sentence from the same two
              frozen columns the card and the build page compose it from.
              `changes` is deliberately not passed: the Δ list is already above
              this, and RebuildCredit would render a second copy of it here. */}
          <RebuildCredit source={source} placement="panel">
            <span style={{ ...labelText, color: t.text2 }}>{CREDIT_PERMANENT}</span>
          </RebuildCredit>
        </div>
      ) : null}
    </section>
  );
}

/**
 * One change, as one line.
 *
 * MONO, BECAUSE IT IS DATA (BG-P24). These are machine-computed lines about a
 * record — the same role as a model name, a cost or a timestamp — and the theme
 * names "change summaries" in the list of things DM Mono sets. In the body face
 * they read as the rebuilder's own account of what they did, which is the note
 * below them and is somebody's prose. The published page's Δ summary has been
 * mono since BG-P11; this is the same list, so it is the same face.
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
        ...dataText,
        margin: 0,
        padding: "3px 0",
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        color: t.text,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 5,
          height: 5,
          marginTop: 8,
          borderRadius: r.full,
          flexShrink: 0,
          background: changeKindColour(line.kind),
        }}
      />
      <span style={{ minWidth: 0 }}>{line.text}</span>
    </li>
  );
}

export default RebuildSection;
