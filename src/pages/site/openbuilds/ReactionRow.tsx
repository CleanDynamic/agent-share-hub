/* UX-07 Part 7: the reactions a space can switch on (UX-04's `spaces.reactions`), under a topic's or a reply's engagement row.

   PURE: typed props. Drawn only for the kinds every one of the topic's spaces switched on; with none, nothing is drawn.
   - Dislike: a text button with `aria-pressed`, its count after it, hidden at zero.
   - Rate: a radio group of 1 to 5, one tab stop, the arrow keys (and Home and End) moving and choosing, then `4.2 from 9` in
     12 `--label` once anyone has rated.
   The look is the Thread's text buttons (12 `--text2`, 16 apart); the chosen rating is `--text`. Nothing moves. Emoji reactions are
   not built. */

import { useRef, type KeyboardEvent } from "react";

import type { PostReactions } from "@/lib/openbuilds/postPage";
import type { SpaceReaction } from "@/lib/openbuilds/types";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { TextButton } from "./PostReplies";

export const RATINGS = [1, 2, 3, 4, 5] as const;

export interface ReactionRowProps {
  kinds: readonly SpaceReaction[];
  reactions: PostReactions;
  /** "topic" or "reply": what the group names. */
  what: "topic" | "reply";
  onDislike: (on: boolean) => void;
  onRate: (value: 1 | 2 | 3 | 4 | 5) => void;
}

/** "4.2 from 9". */
export const ratingWords = (average: number, count: number): string => `${(Math.round(average * 10) / 10).toFixed(1)} from ${count.toLocaleString("en-GB")}`;

function RatingGroup({ what, mine, onRate }: { what: ReactionRowProps["what"]; mine: number | null; onRate: ReactionRowProps["onRate"] }) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  // One tab stop: the chosen rating, or the first when there is none.
  const stop = mine ?? 1;
  const choose = (value: number) => {
    const next = Math.min(5, Math.max(1, value)) as 1 | 2 | 3 | 4 | 5;
    onRate(next);
    buttons.current[next - 1]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, value: number) => {
    const moves: Record<string, number> = { ArrowRight: value + 1, ArrowDown: value + 1, ArrowLeft: value - 1, ArrowUp: value - 1, Home: 1, End: 5 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    choose(moves[event.key] > 5 ? 1 : moves[event.key] < 1 ? 5 : moves[event.key]);
  };
  return (
    <div role="radiogroup" aria-label={`Rate this ${what}`} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span aria-hidden="true" style={{ fontFamily: FIGTREE, fontSize: 12, lineHeight: "16px", color: t.text2 }}>
        Rate
      </span>
      {RATINGS.map((value) => (
        <TextButton
          key={value}
          ref={(node) => {
            buttons.current[value - 1] = node;
          }}
          role="radio"
          aria-checked={mine === value}
          aria-label={`${value} of 5`}
          tabIndex={value === stop ? 0 : -1}
          onClick={() => choose(value)}
          onKeyDown={(event) => onKeyDown(event, value)}
          style={{ fontVariantNumeric: "tabular-nums", ...(mine === value ? { color: t.text, fontWeight: 500 } : null) }}
        >
          {value}
        </TextButton>
      ))}
    </div>
  );
}

export function ReactionRow({ kinds, reactions, what, onDislike, onRate }: ReactionRowProps) {
  if (kinds.length === 0) return null;
  return (
    <div data-testid="reaction-row" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 16, rowGap: 8, marginTop: 8 }}>
      {kinds.includes("dislike") ? (
        <TextButton aria-pressed={reactions.disliked} onClick={() => onDislike(!reactions.disliked)} style={reactions.disliked ? { color: t.text } : undefined}>
          {reactions.dislikes > 0 ? `Dislike ${reactions.dislikes.toLocaleString("en-GB")}` : "Dislike"}
        </TextButton>
      ) : null}
      {kinds.includes("rating") ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <RatingGroup what={what} mine={reactions.mine} onRate={onRate} />
          {reactions.ratings > 0 && reactions.average !== null ? (
            <span data-testid="rating-summary" style={{ fontFamily: FIGTREE, fontSize: 12, lineHeight: "16px", color: t.label, fontVariantNumeric: "tabular-nums" }}>
              {ratingWords(reactions.average, reactions.ratings)}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
