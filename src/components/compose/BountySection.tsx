// Putting a price on the holes, at the moment of publishing.
//
// WHY THIS SITS IN THE PUBLISH SHEET AND NOT ON A PAGE OF ITS OWN. A bounty is
// not a thing a creator sets out to make. It is a thing that becomes true about
// a build the moment that build goes public with a part still missing — so the
// question belongs at the one moment they are already thinking about what other
// people will see, beside the card those people will see it on. NS-P54 retires
// the standalone /bounty/new route for the same reason: it asked creators to
// start from the ask rather than from the work, and almost nobody does.
//
// WHAT IT ASKS FOR, AND WHAT IT REFUSES TO ASK FOR. A tick, a reward and a
// deadline, all three optional in the sense that matters: an UNPRICED GAP IS
// STILL A REAL BOUNTY. It is filed open with reward_gbp NULL, it appears on the
// board, and someone can solve it. Money is one reason people answer a question
// and not the most common one, and a form that made the reward mandatory would
// be a form that quietly asserted otherwise.
//
// THE SWITCH IS A REAL ANSWER. "Publish without bounties" files nothing at all,
// and it is a switch rather than a hidden default because a creator who marked
// four parts unsolved deliberately and wants none of them advertised should be
// able to say so in one place rather than by un-ticking four rows.
//
// WHAT THIS COMPONENT DOES NOT DO. It does not write. Every draft here is held
// by PublishControl, exactly as the rebuild note is, and the writes happen
// after the build is live — see the comment over fileBounties there, and in
// particular the part about publishing never being rolled back by a bounty that
// failed to file.
//
// Styled with inline style objects like every other surface on this route:
// Tailwind's generated utilities win over hand-written classes at build time.

import type { CSSProperties } from "react";
import type { Bounty } from "@/lib/bounty";
import { gapProblem, type NodeTree, type NodeType } from "@/lib/build";
import { TypePill } from "@/components/compose/TreeNode";
import {
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
} from "@/components/build/tokens";

/**
 * The copy, held as constants because it is the design.
 *
 * The heading is a question, not an instruction, and it counts what the creator
 * did rather than what they failed to do. UNPRICED is the sentence that has to
 * survive any later rewrite of this file: it is the difference between a board
 * of open questions and a board of paid work.
 */
const SECTION_LABEL = "Unsolved parts";
const HEADING = "Put a bounty on them?";
const UNPRICED =
  "A gap with no reward is still filed as an open bounty. People answer questions for more reasons than money.";
const SKIP_LABEL = "Publish without bounties";
const SKIP_HELP = "Nothing is filed. The parts stay marked unsolved on the page.";
const NO_PROBLEM =
  "No problem statement yet. A stranger can only solve what you describe — add one in the inspector.";
const REWARD_LABEL = "Reward";
const REWARD_HELP = "Optional.";
const DEADLINE_LABEL = "Closes";
const BAD_REWARD = "Not an amount. This one will be filed without a reward.";
const ALREADY_FILED = "Already has a bounty.";

// --- the draft ---------------------------------------------------------------

/** One gap's answer to the three questions, as typed. */
export interface GapDraft {
  /** Whether a bounty is filed for this gap when the build goes live. */
  ticked: boolean;
  /** Pounds, as typed. Parsed at publish time, never per keystroke. */
  reward: string;
  /** yyyy-mm-dd, as a date input gives it. Empty for no deadline. */
  deadline: string;
}

/** What a gap starts at: ticked, unpriced, open-ended. */
export const DEFAULT_GAP_DRAFT: GapDraft = { ticked: true, reward: "", deadline: "" };

/**
 * A typed reward as a number, or null.
 *
 * STRICT, AND NULL IS A REAL ANSWER. Empty means unpriced, which is the
 * ordinary case. Anything that is not a non-negative finite number is also
 * filed unpriced — the row says so under the input before the creator presses
 * Publish, so the outcome is never a surprise. reward_gbp is NUMERIC on the
 * column; the value is passed as a number and PostgREST serialises it.
 */
export function parseReward(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

/** True for text that was meant to be an amount and is not one. */
export function isBadReward(text: string): boolean {
  return text.trim() !== "" && parseReward(text) === null;
}

/**
 * A date input's yyyy-mm-dd as the instant the bounty closes, or null.
 *
 * THE END OF THAT DAY, in the creator's own timezone. A creator who types the
 * 15th means "you have until the 15th", not "until midnight as the 15th
 * begins", and closing a bounty a whole day before its author expected is the
 * kind of quiet wrong that costs somebody a solution.
 */
export function closesAtFrom(date: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const end = new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 0);
  if (Number.isNaN(end.getTime())) return null;
  return end.toISOString();
}

// --- the outcome copy --------------------------------------------------------

/**
 * What the confirmation screen says once the filing has been attempted.
 *
 * ONE SENTENCE FOR EVERY FAILURE, per the handover, and it leads with the part
 * that matters most to a creator reading it: the build is live. A bounty that
 * did not file is a row missing from a board, not a publish that half happened,
 * and the sentence has to be readable by someone who does not know that.
 */
export function bountyFailureSentence(failedTitles: string[], attempted: number): string {
  if (failedTitles.length === 0) return "";
  const names = failedTitles.map((title) => `“${title}”`);
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  const count =
    failedTitles.length === attempted
      ? failedTitles.length === 1
        ? "The bounty"
        : "None of the bounties"
      : `${failedTitles.length} of the ${attempted} bounties`;
  return `Your build is live. ${count} could not be filed — ${list}. Nothing else was affected, and you can try again.`;
}

/** What it says when every one of them landed. */
export function bountyFiledSentence(filed: number): string {
  if (filed <= 0) return "";
  return filed === 1
    ? "One bounty is open on this build. It is on the open board now."
    : `${filed} bounties are open on this build. They are on the open board now.`;
}

// --- shared control styling --------------------------------------------------

const inputStyle: CSSProperties = {
  ...bodyText,
  fontFamily: "inherit",
  minWidth: 0,
  height: 30,
  padding: "0 8px",
  borderRadius: 8,
  outline: "none",
  background: "rgba(255,255,255,0.025)",
  border: `1px solid ${HAIRLINE}`,
  color: TEXT_PRIMARY,
};

const TRACK_WIDTH = 34;
const TRACK_HEIGHT = 20;
const KNOB = 14;

// --- the section -------------------------------------------------------------

export interface BountySectionProps {
  /** The placed gap nodes, in reading order. collectGaps' output, unedited. */
  gaps: NodeTree[];
  /** For the type pill on each row — the same pill the tree paints. */
  typesByKey: Map<string, NodeType>;
  /**
   * Gap node id -> the ask already filed against it.
   *
   * A gap in here is not offered again: one bounty per gap is a unique index in
   * the database, and a row that let a creator tick it would be a row that
   * produced a refusal they did nothing to deserve.
   */
  filedByNode: Map<string, Bounty>;
  /** The drafts, by gap node id. Held by the caller: publishing reads them. */
  drafts: Record<string, GapDraft>;
  onDraftChange: (nodeId: string, patch: Partial<GapDraft>) => void;
  /** The one switch. True files nothing at all. */
  skip: boolean;
  onSkipChange: (skip: boolean) => void;
}

export function BountySection({
  gaps,
  typesByKey,
  filedByNode,
  drafts,
  onDraftChange,
  skip,
  onSkipChange,
}: BountySectionProps) {
  const open = gaps.filter((gap) => !filedByNode.has(gap.id));
  const marked = gaps.length;

  return (
    <section
      data-testid="bounty-section"
      data-visual-slot="publish-bounty-section"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        paddingTop: 12,
        borderTop: `1px solid ${HAIRLINE}`,
      }}
    >
      {/* The uppercase label is the sheet's rhythm — the checklist and the
          rebuild section both open with one. The question is a sentence and
          reads as one, so it sits under the label rather than being shouted. */}
      <span style={{ ...labelText, textTransform: "uppercase", color: TEXT_MUTED }}>
        {SECTION_LABEL}
      </span>
      <p style={{ ...bodyText, margin: 0, color: TEXT_PRIMARY }}>
        {`You’ve marked ${marked === 1 ? "1 part" : `${marked} parts`} unsolved. ${HEADING}`}
      </p>

      {open.length === 0 ? (
        <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY }}>
          Every one of them already carries a bounty. Nothing new will be filed.
        </p>
      ) : (
        <>
          <p style={{ ...bodyText, margin: 0, fontSize: 12, color: TEXT_MUTED }}>
            {UNPRICED}
          </p>

          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              // The switch below turns the whole list into a statement of what
              // is NOT going to happen. Dimmed rather than unmounted, so a
              // creator can see what they are declining.
              opacity: skip ? 0.45 : 1,
              transition: "opacity 140ms ease",
            }}
          >
            {gaps.map((gap) => (
              <GapRow
                key={gap.id}
                gap={gap}
                nodeType={typesByKey.get(gap.type)}
                filed={filedByNode.get(gap.id) ?? null}
                draft={drafts[gap.id] ?? DEFAULT_GAP_DRAFT}
                disabled={skip}
                onChange={(patch) => onDraftChange(gap.id, patch)}
              />
            ))}
          </ul>
        </>
      )}

      {/* Nothing to decline when every gap is already spoken for. */}
      {open.length === 0 ? null : (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          paddingTop: 4,
        }}
      >
        <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
          <span style={{ ...labelText, color: skip ? TEXT_PRIMARY : TEXT_SECONDARY }}>
            {SKIP_LABEL}
          </span>
          <span style={{ ...bodyText, fontSize: 11, color: TEXT_MUTED }}>{SKIP_HELP}</span>
        </span>

        <button
          type="button"
          role="switch"
          data-testid="bounty-skip"
          aria-checked={skip}
          aria-label={SKIP_LABEL}
          onClick={() => onSkipChange(!skip)}
          style={{
            position: "relative",
            flexShrink: 0,
            width: TRACK_WIDTH,
            height: TRACK_HEIGHT,
            padding: 0,
            borderRadius: TRACK_HEIGHT,
            border: `1px solid ${skip ? hexToRgba(ORANGE, 0.75) : HAIRLINE}`,
            background: skip ? hexToRgba(ORANGE, 0.75) : "rgba(255,255,255,0.04)",
            cursor: "pointer",
            transition: "background 140ms ease, border-color 140ms ease",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "50%",
              left: skip ? TRACK_WIDTH - KNOB - 4 : 2,
              width: KNOB,
              height: KNOB,
              marginTop: -(KNOB / 2),
              borderRadius: "50%",
              background: skip ? "#08080C" : TEXT_MUTED,
              transition: "left 140ms ease, background 140ms ease",
            }}
          />
        </button>
      </div>
      )}
    </section>
  );
}

/**
 * One gap, as one row: what it is, what is wrong with it, and what it is worth.
 *
 * The type pill is TreeNode's, imported rather than reimplemented, so the row a
 * creator reads here is recognisably the row they ticked over in the tree.
 */
function GapRow({
  gap,
  nodeType,
  filed,
  draft,
  disabled,
  onChange,
}: {
  gap: NodeTree;
  nodeType?: NodeType;
  filed: Bounty | null;
  draft: GapDraft;
  disabled: boolean;
  onChange: (patch: Partial<GapDraft>) => void;
}) {
  const problem = gapProblem(gap.payload);
  const badReward = isBadReward(draft.reward);
  const title = gap.title || `Untitled ${nodeType?.label ?? gap.type}`;
  const ticked = filed ? false : draft.ticked;
  const locked = disabled || filed !== null;

  return (
    <li
      data-testid="bounty-gap-row"
      data-node-id={gap.id}
      style={{
        ...cardGlass,
        margin: 0,
        padding: "10px 12px",
        borderLeft: `2px solid ${hexToRgba(GAP_RED, filed ? 0.3 : 0.6)}`,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
          cursor: locked ? "default" : "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={ticked}
          disabled={locked}
          onChange={(event) => onChange({ ticked: event.target.checked })}
          style={{ flexShrink: 0, width: 14, height: 14, accentColor: ORANGE }}
        />
        <TypePill nodeType={nodeType} typeKey={gap.type} />
        <span
          style={{
            ...bodyText,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: gap.title ? TEXT_PRIMARY : TEXT_MUTED,
          }}
        >
          {title}
        </span>
      </label>

      {problem ? (
        <p
          style={{
            ...bodyText,
            margin: 0,
            fontSize: 12,
            color: TEXT_SECONDARY,
            // Two lines of it. The whole statement is on the node, and the
            // creator wrote it — this is a reminder, not the reading of it.
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {problem}
        </p>
      ) : (
        <p style={{ ...bodyText, margin: 0, fontSize: 11, color: TEXT_MUTED }}>
          {NO_PROBLEM}
        </p>
      )}

      {filed ? (
        <span style={{ ...labelText, fontSize: 11, color: TEAL }}>
          {ALREADY_FILED}
          {filed.reward_gbp !== null && filed.reward_gbp !== undefined
            ? ` £${filed.reward_gbp}`
            : ""}
        </span>
      ) : (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            gap: 8,
          }}
        >
          <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED }}>
              {`${REWARD_LABEL} — ${REWARD_HELP}`}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ ...bodyText, color: TEXT_MUTED }} aria-hidden>
                £
              </span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                data-testid="bounty-reward-input"
                aria-label={`${REWARD_LABEL} for ${title}`}
                value={draft.reward}
                disabled={locked}
                placeholder="0"
                onChange={(event) => onChange({ reward: event.target.value })}
                style={{
                  ...inputStyle,
                  width: 96,
                  borderColor: badReward ? hexToRgba(GAP_RED, 0.5) : HAIRLINE,
                }}
              />
            </span>
          </span>

          <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED }}>
              {DEADLINE_LABEL}
            </span>
            <input
              type="date"
              data-testid="bounty-deadline-input"
              aria-label={`${DEADLINE_LABEL} for ${title}`}
              value={draft.deadline}
              disabled={locked}
              onChange={(event) => onChange({ deadline: event.target.value })}
              style={{ ...inputStyle, width: 150 }}
            />
          </span>
        </div>
      )}

      {badReward && !filed ? (
        <span style={{ ...labelText, fontSize: 11, color: GAP_RED }}>{BAD_REWARD}</span>
      ) : null}
    </li>
  );
}

/**
 * What became of the filing, on the screen the creator is actually looking at.
 *
 * IT IS NOT IN THE SHEET, and that is not an oversight. The sheet closes the
 * moment Publish is pressed — that has been true since NS-P29, because the
 * review pass is a second modal and two stacked overlays is not something a
 * creator should have to read their way out of — so by the time a bounty
 * fails there is no sheet left to put a sentence in. The confirmation is where
 * they are, so the sentence and the retry go there.
 */
export function BountyOutcome({
  filed,
  failedTitles,
  attempted,
  busy,
  onRetry,
}: {
  filed: number;
  failedTitles: string[];
  attempted: number;
  busy: boolean;
  onRetry: () => void;
}) {
  const failedSentence = bountyFailureSentence(failedTitles, attempted);

  if (failedSentence) {
    return (
      <div
        data-testid="bounty-outcome"
        role="alert"
        style={{
          ...cardGlass,
          padding: "12px 14px",
          borderLeft: `2px solid ${GAP_RED}`,
          background: hexToRgba(GAP_RED, 0.06),
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <p style={{ ...bodyText, margin: 0 }}>{failedSentence}</p>
        <button
          type="button"
          data-testid="bounty-retry"
          disabled={busy}
          onClick={onRetry}
          style={{
            ...labelText,
            fontFamily: "inherit",
            height: 28,
            padding: "0 12px",
            borderRadius: 100,
            background: "rgba(255,255,255,0.025)",
            border: `1px solid ${HAIRLINE}`,
            color: busy ? TEXT_MUTED : TEXT_PRIMARY,
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "Filing…" : "Try again"}
        </button>
      </div>
    );
  }

  const filedSentence = bountyFiledSentence(filed);
  if (!filedSentence) return null;

  return (
    <div
      data-testid="bounty-outcome"
      style={{
        ...cardGlass,
        padding: "12px 14px",
        borderLeft: `2px solid ${TEAL}`,
        background: hexToRgba(TEAL, 0.06),
      }}
    >
      <p style={{ ...bodyText, margin: 0 }}>{filedSentence}</p>
    </div>
  );
}

export default BountySection;
