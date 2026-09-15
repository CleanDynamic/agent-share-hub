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
import { GapMarker, gapEdge, gapState } from "@/components/brand/GapMarker";
import { rewardLabel } from "@/components/bounty/bountyDisplay";
import { Switch } from "@/components/ui/switch";
import { fieldMessageStyle, fieldStyle } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import {
  body as bodyText,
  data as dataText,
  eyebrow as eyebrowText,
  label as labelText,
  tabular,
} from "@/lib/theme/type";
import { fade } from "@/lib/theme/motion";

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

/**
 * The two outcome panels' shared surface.
 *
 * A `--bg` card inside the confirmation's `--recess` panel, with the state on a
 * 2px left edge and NO TINTED GROUND. The wash behind these was `hexToRgba` of
 * the hue at 6%, which on a light room turns a sentence about a live build into
 * something that reads like an alert. The edge carries the state; the ground
 * stays the workspace's own.
 */
const outcomeCard: CSSProperties = {
  backgroundColor: t.bg,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: t.line,
  borderRadius: r.card,
  borderLeftWidth: 2,
  borderLeftStyle: "solid",
  padding: "12px 14px",
};

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

/**
 * The reward and deadline fields.
 *
 * THE KIT'S PAINT WITHOUT THE KIT'S BOX (BG-P24). `fieldStyle()` is what the
 * BG-P07 Input spends — a `--recess` well, a `--line` border that brightens to
 * `--action` on focus, `--r-control`, and the shared ring — and it is a style
 * function rather than a component, so these two fields take all of it at the
 * 30px height this row was laid out around. Dropping the component in would
 * have made them 40px tall, which is a structural change to an existing row
 * and the one thing a repaint may never make.
 *
 * Mono and tabular, because both fields hold a number that sits in a column
 * beside other rows' numbers.
 */
const inputStyle: CSSProperties = {
  ...dataText,
  ...tabular,
  ...fieldStyle(),
  minWidth: 0,
  height: 30,
  padding: "0 8px",
  outline: "none",
};

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
        borderTopWidth: 1,
        borderTopStyle: "solid",
        borderTopColor: t.line,
      }}
    >
      {/* The eyebrow is the sheet's rhythm — the checklist and the rebuild
          section both open with one, and all three are 12px mono uppercase in
          `--text2`. The question is a sentence and reads as one, so it sits
          under the label rather than being shouted. */}
      <span style={{ ...eyebrowText, color: t.text2 }}>{SECTION_LABEL}</span>
      <p style={{ ...bodyText, margin: 0, color: t.text }}>
        {`You’ve marked ${marked === 1 ? "1 part" : `${marked} parts`} unsolved. ${HEADING}`}
      </p>

      {open.length === 0 ? (
        <p style={{ ...bodyText, margin: 0, color: t.text2 }}>
          Every one of them already carries a bounty. Nothing new will be filed.
        </p>
      ) : (
        <>
          <p style={{ ...bodyText, margin: 0, color: t.text2 }}>{UNPRICED}</p>

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
              transition: fade(),
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
          <span style={{ ...labelText, color: skip ? t.text : t.text2 }}>
            {SKIP_LABEL}
          </span>
          <span style={{ ...dataText, color: t.text2 }}>{SKIP_HELP}</span>
        </span>

        {/* THE BG-P07 SWITCH. It was a hand-rolled track and knob with its own
            geometry, its own transition and a hard-coded near-black thumb that
            was invisible against an Exhibition ground. The kit's carries the
            `--action` track, the `--bg` thumb, the shared focus ring and the
            reduced-motion gate, and it is the same switch every other toggle
            in the app is. `role="switch"` and `aria-checked` come from Radix,
            so the accessible contract the tests read is unchanged. */}
        <Switch
          data-testid="bounty-skip"
          aria-label={SKIP_LABEL}
          checked={skip}
          onCheckedChange={onSkipChange}
          style={{ flexShrink: 0 }}
        />
      </div>
      )}
    </section>
  );
}

/**
 * One gap, as one row: what it is, what is wrong with it, and what it is worth.
 *
 * BG-P24 — THE ROW IS THE SHARED `GapMarker` IN ITS ROW PLACEMENT.
 *
 * It was a hand-rolled arrangement: TreeNode's type pill, a 2px solid left edge
 * in a 60%-alpha red, and "Already has a bounty." set in teal. Every one of
 * those is a second answer to a question the brand component already answers,
 * and each was a different answer from the one the build page and the card
 * give for the same object.
 *
 * What the marker brings, and why each half matters:
 *
 *   THE EDGE IS DASHED, not solid. Solid says "this is what it is"; dashed says
 *   "this is where something goes". A gap is an invitation, and the edge is the
 *   whole of the treatment — no red wash, because a tinted ground behind an
 *   invitation reads as an error box.
 *
 *   THE CHIP KEEPS THE PART'S TRUE CATEGORY. A gap on an agent config is still
 *   configuration; that is what routes it to people who write agent configs.
 *   The marker never recolours it red, and neither does this row.
 *
 *   THE STATE WORD AND THE REWARD ARE MEASURED PAIRS, not the breakage hue as
 *   text on whatever ground the row happens to sit on.
 *
 * A row whose gap is already filed renders `funded` with the reward it carries,
 * which is the marker's own way of saying the same thing the teal sentence used
 * to say — and it says it in the vocabulary a reader already knows from the
 * board.
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

  /* An ask already on the board is `funded` when it carries money and
     `unsolved` when it does not — the marker's own two words for the same
     distinction the section makes between a priced and an unpriced gap. */
  const filedReward = filed ? rewardLabel(filed.reward_gbp) : null;
  const state = gapState(false, filedReward);

  return (
    <li
      data-testid="bounty-gap-row"
      data-node-id={gap.id}
      style={{
        /* The workspace's flat card — `--bg` inside the `--recess` sheet with
           one `--line` hairline — rather than the glass film it was. A working
           surface carries no glass, whether or not it carries a blur. */
        backgroundColor: t.bg,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: t.line,
        borderRadius: r.card,
        margin: 0,
        padding: "10px 12px",
        /* The brand edge, applied to the element that already has a border —
           the marker exports it as a value for exactly this, because wrapping
           this row in a marker would change its structure. Dimmed for a gap
           that is already spoken for, which is the one thing about this row
           that is not the marker's to say. */
        ...gapEdge("row", state),
        opacity: filed ? 0.72 : 1,
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
          style={{
            flexShrink: 0,
            width: 14,
            height: 14,
            borderRadius: r.chip,
            accentColor: t.action,
          }}
        />
        {/* The shared marker in its row placement: the part's own category
            chip, the state word on its measured ground, and the reward it
            already carries when it carries one. */}
        <GapMarker
          placement="row"
          state={state}
          category={nodeType?.category ?? gap.type}
          categoryLabel={nodeType?.label ?? gap.type}
          reward={filedReward}
        />
        <span
          style={{
            ...bodyText,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: gap.title ? t.text : t.text2,
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
            color: t.text2,
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
        <p style={{ ...dataText, margin: 0, color: t.text2 }}>{NO_PROBLEM}</p>
      )}

      {filed ? (
        /* The marker above already shows the state and the money as measured
           tags; this is the one thing it cannot say — that the ask is on the
           board ALREADY, so nothing new is filed for it. `--text2`, because a
           fact about a row is not a state of it. */
        <span style={{ ...dataText, color: t.text2 }}>{ALREADY_FILED}</span>
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
            <span style={{ ...labelText, color: t.text2 }}>
              {`${REWARD_LABEL} — ${REWARD_HELP}`}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ ...dataText, color: t.text2 }} aria-hidden>
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
                aria-invalid={badReward || undefined}
                style={{
                  ...inputStyle,
                  width: 96,
                  /* The kit's own invalid treatment, taken from the same
                     function the field's resting paint comes from, so the
                     two cannot land on different reds. */
                  ...(badReward ? fieldStyle({ invalid: true }) : null),
                }}
              />
            </span>
          </span>

          <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <span style={{ ...labelText, color: t.text2 }}>{DEADLINE_LABEL}</span>
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

      {/* `fieldMessageStyle` is the kit's message under an invalid field —
          breakage red in mono, which the theme measures as legal text on both
          grounds. It travels with the border above rather than being a second
          opinion about what "wrong" looks like. */}
      {badReward && !filed ? (
        <span role="alert" style={fieldMessageStyle}>
          {BAD_REWARD}
        </span>
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
          ...outcomeCard,
          borderLeftColor: t.catBreakage,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <p style={{ ...bodyText, margin: 0, color: t.text }}>{failedSentence}</p>
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
            /* `--r-control`, not the retired 999px capsule. */
            borderRadius: r.control,
            backgroundColor: t.recess,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: t.line,
            color: busy ? t.text2 : t.text,
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
      style={{ ...outcomeCard, borderLeftColor: t.evidence }}
    >
      <p style={{ ...bodyText, margin: 0, color: t.text }}>{filedSentence}</p>
    </div>
  );
}

export default BountySection;
