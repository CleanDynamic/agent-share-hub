// The rebuild credit: who this came from, and what moved (BG-P11).
//
// THE THEME ASKS FOR BOTH HALVES TOGETHER — "'Rebuilt from name by @handle'
// plus a machine-computed change summary in mono, prefixed Δ" — so they are one
// component. Before this they were three: the gallery card rendered the credit
// and said in a comment that it had no summary to put beside it, ForkAttribution
// rendered the credit and hid the summary behind a button, and the publish
// sheet rendered the summary with the credit in a footnote under the note box.
//
// THE STRING IS STILL rebuildCredit.ts's. This file owns appearance and nothing
// else: `rebuildCreditLine` composes the sentence from the two FROZEN snapshot
// columns, which is what makes the credit unrevokable — a source can be
// renamed, unpublished or deleted and the sentence does not change. When link
// targets are supplied the same sentence is rendered in segments so the title
// and the handle can be clicked, and `matchesCreditLine` below is what the test
// suite uses to prove the two renderings read identically.
//
// THE SUMMARY TRUNCATES AT SIX. Seven is the length at which collapsing is
// worth a press: hiding one line costs a reader an interaction to learn
// nothing. The constants are the publish sheet's own, lifted here so the rule
// is stated once and the two surfaces cannot drift to different numbers.
//
// A DELETED SOURCE KEEPS ITS CREDIT. The snapshot text renders exactly as it
// always did, with "(no longer available)" after it and no link — what a reader
// loses is somewhere to click, not who to credit. It is said only once the
// answer is in: a banner that announced a missing source for the length of one
// request would libel every live source on the site, which is why `gone` is a
// prop the caller sets after its lookup rather than `!href`.
//
// Styled with inline style objects, like every other surface on the new path:
// Tailwind's generated utilities win over hand-written classes at build time.

import { useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";

import {
  rebuildCreditLine,
  type RebuildCreditSource,
} from "@/components/build/rebuildCredit";
import type { ChangeKind, ChangeLine } from "@/lib/build";
import { categoryColour } from "@/lib/theme/category";
import { chipType } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { body as bodyText, data as dataText } from "@/lib/theme/type";

/** What the credit says when the source cannot be reached any more. */
export const GONE = "(no longer available)";

/** The sentence's fixed halves, so the segmented rendering cannot invent one. */
const PREFIX = "Rebuilt from ";
const BY = " by @";

/**
 * How many change lines a reader sees before they have to ask for the rest, and
 * the length at which asking is worth it.
 *
 * Seven rather than six is deliberate: collapsing a list to six to hide one
 * line costs a reader a press to learn nothing. The expander earns its place
 * from the second hidden line onwards. Lifted out of RebuildSection, which now
 * imports them, so the publish sheet and the published page cannot disagree
 * about what "too many to show" means.
 */
export const COLLAPSED_LINES = 6;
export const EXPAND_FROM = 7;

/**
 * Change kind to colour, resolved through the part categories.
 *
 * A CHANGE IS NOT A PART, so it has no category of its own — but the four kinds
 * each read as one of the nine, and borrowing the category keeps the two
 * vocabularies from drifting apart. This is the same move `eventDisplay.ts`
 * makes for event kinds, and it lands on the same four hues the tree and the
 * publish sheet already paint: changed is the rust the tree marks an edited
 * part with, added is the teal it marks a new one with, a removal is grey
 * because it is not a warning, and a header move is the ochre the sheet gave it.
 */
export const CHANGE_KIND_CATEGORY: Record<ChangeKind, string> = {
  changed: "instruction",
  added: "evidence",
  removed: "narrative",
  header: "artefact",
};

/** The same, as tokens. */
export function changeKindColour(kind: ChangeKind): string {
  return categoryColour(CHANGE_KIND_CATEGORY[kind] ?? "narrative");
}

/**
 * The lines a reader sees, and how many are behind the expander.
 *
 * Exported because the publish sheet applies the same rule to a list it lays
 * out differently, and a second copy of `slice(0, 6)` is a second chance to get
 * the off-by-one wrong.
 */
export function summaryWindow(
  lines: readonly ChangeLine[],
  expanded: boolean
): { shown: readonly ChangeLine[]; hidden: number; collapsible: boolean } {
  const collapsible = lines.length >= EXPAND_FROM;
  const shown = collapsible && !expanded ? lines.slice(0, COLLAPSED_LINES) : lines;
  return { shown, hidden: Math.max(0, lines.length - COLLAPSED_LINES), collapsible };
}

export interface RebuildCreditProps {
  /** The two frozen snapshot columns. Nothing renders when they are empty. */
  source: RebuildCreditSource;
  /**
   * serialiseChangeSet's lines, unedited and in its order.
   *
   * Absent means "nobody worked it out" and empty means "worked out, and
   * nothing differs" — a card assembled from a gallery row is the first and a
   * published rebuild whose diff came back empty is the second, and the two
   * must not render as the same thing.
   */
  changes?: readonly ChangeLine[];
  /** Where the source lives, when it still resolves. Absent renders plain text. */
  to?: string | null;
  /** The source's creator, when their handle resolves to a profile. */
  handleTo?: string | null;
  /** The lookup came back empty. Appends GONE and drops every link. */
  gone?: boolean;
  /** Truncate the credit to one line — a card, where it is provenance, not prose. */
  clamp?: boolean;
  /** Anything the surface hangs under the summary, such as a rebuilder's note. */
  children?: ReactNode;
}

export function RebuildCredit({
  source,
  changes,
  to,
  handleTo,
  gone = false,
  clamp = false,
  children,
}: RebuildCreditProps) {
  const [expanded, setExpanded] = useState(false);
  const line = rebuildCreditLine(source);

  // Naming nobody is better than "Rebuilt from" trailing off. A fork taken
  // before the snapshot columns existed renders nothing at all, which is the
  // position rebuildCredit.ts already takes and this must not soften.
  if (!line) return null;

  const title = (source.source_title_at_fork ?? "").trim();
  const handle = (source.source_handle_at_fork ?? "").trim();
  const linked = !gone && (Boolean(to) || Boolean(handleTo));

  const clampStyle: CSSProperties = clamp
    ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
    : {};

  return (
    <div
      data-visual-slot="rebuild-credit"
      data-source-resolved={gone ? "false" : to ? "true" : "pending"}
      style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}
    >
      <p
        data-testid="rebuild-credit-line"
        data-rebuild-credit=""
        /* The whole sentence on hover, because the clamped rendering on a card
           is the one that cannot show all of it. */
        title={gone ? `${line} ${GONE}` : line}
        style={{ ...bodyText, margin: 0, color: t.text2, minWidth: 0, ...clampStyle }}
      >
        {linked ? (
          <>
            {PREFIX}
            <CreditPart to={to}>{title}</CreditPart>
            {handle ? (
              <>
                {BY}
                <CreditPart to={handleTo}>{handle}</CreditPart>
              </>
            ) : null}
          </>
        ) : (
          line
        )}
        {gone ? <span style={{ color: t.text2 }}> {GONE}</span> : null}
      </p>

      {changes ? (
        <ChangeSummary
          lines={changes}
          expanded={expanded}
          onToggle={() => setExpanded((open) => !open)}
        />
      ) : null}

      {children}
    </div>
  );
}

/**
 * One clickable half of the sentence, or the same words as plain text.
 *
 * `--action` rather than an underline: the credit is part of the record and a
 * line of underlined links in the middle of it would read as a caption full of
 * references rather than as one sentence.
 */
function CreditPart({ to, children }: { to?: string | null; children: ReactNode }) {
  if (!to) return <span style={{ color: t.text }}>{children}</span>;
  return (
    <Link to={to} style={{ color: t.action, textDecoration: "none" }}>
      {children}
    </Link>
  );
}

/**
 * The Δ summary: what moved, in mono, at most six lines before the ask.
 *
 * MONO BECAUSE IT IS DATA. These are machine-computed lines about a record —
 * the same role as a model name or a timestamp — and setting them in the body
 * face would make them read as the rebuilder's own account, which is the note
 * below them and is somebody's prose.
 *
 * EXPANDS IN PLACE. The button swaps its own label and the list grows under it;
 * nothing opens, moves or scrolls. A reader who wanted line seven does not want
 * the page to jump.
 */
function ChangeSummary({
  lines,
  expanded,
  onToggle,
}: {
  lines: readonly ChangeLine[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const { shown, hidden, collapsible } = summaryWindow(lines, expanded);

  if (lines.length === 0) {
    return (
      <p
        data-testid="rebuild-credit-summary"
        data-change-count="0"
        style={{ ...dataText, margin: 0, color: t.text2 }}
      >
        Δ nothing in the record reads differently from its source
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <ul
        data-testid="rebuild-credit-summary"
        data-change-count={String(lines.length)}
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
          <li
            key={line.key}
            data-change-kind={line.kind}
            style={{
              ...dataText,
              display: "flex",
              alignItems: "flex-start",
              gap: 6,
              minWidth: 0,
              color: t.text2,
            }}
          >
            {/* The Δ is the prefix the theme names, and it carries the kind's
                colour so a reader scanning the column sees what KIND of change
                each line is before reading it. aria-hidden: "delta" adds
                nothing to a line a screen reader already reads out. */}
            <span aria-hidden style={{ flexShrink: 0, color: changeKindColour(line.kind) }}>
              Δ
            </span>
            <span style={{ minWidth: 0 }}>{line.text}</span>
          </li>
        ))}
      </ul>

      {collapsible ? (
        <button
          type="button"
          data-testid="rebuild-credit-more"
          onClick={onToggle}
          aria-expanded={expanded}
          style={{
            ...chipType,
            fontFamily: "inherit",
            alignSelf: "flex-start",
            padding: "3px 8px",
            borderRadius: r.chip,
            background: "transparent",
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: t.line,
            color: t.text2,
            cursor: "pointer",
          }}
        >
          {expanded ? "Show fewer" : `and ${hidden} more`}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Whether a segmented rendering reads as the helper's own sentence.
 *
 * The linked rendering has to compose the sentence out of its parts so the
 * title and the handle can be separate destinations, which is the one place
 * this component could drift from `rebuildCreditLine`. This is the check, and
 * RebuildCredit.test.tsx runs it over a matrix rather than trusting the
 * composition by eye.
 */
export function matchesCreditLine(source: RebuildCreditSource, rendered: string): boolean {
  return rebuildCreditLine(source) === rendered.trim();
}

export default RebuildCredit;
