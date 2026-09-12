// The plaque: the two trust signals, as one object, at three sizes (BG-P11).
//
// WHAT WAS HERE BEFORE. Three surfaces each drew their own: the gallery card's
// local `Plaque` (BG-P09), the build header's `reproduction` fallback, and the
// display half of `ReproductionAction`. Three renderings of one claim is three
// chances for them to disagree about what a reader is entitled to, and one of
// them already did — the header's fallback printed a raw `toLocaleDateString`
// and never named the model, so the same build said "on Sonnet 4.5" on its card
// and said nothing about the model on its own page. This file is the one
// rendering; those three now spend it.
//
// IT IS IMPOSSIBLE TO RENDER HALF OF IT, which is the rule the theme states and
// the reason this takes ONE props object rather than two optional halves. The
// reproduction count and the freshness claim are both read off a single record:
// there is no argument list that supplies one and withholds the other, because
// `build` is the only argument there is. A caller cannot pass a count without a
// confirmation date any more than it can pass half a row.
//
// THE COUNT IS THE NUMBER THAT SHOULD BE REMEMBERED, so it is the one element
// here that deviates — the only filled ground on an object that is otherwise
// mono text on nothing (`von-restorff-effect`: the deviation works because
// everything around it is consistent). It is NOT inflated to earn that: on a
// card it is the same 12px as its neighbours and wins on fill alone, and even
// at `header` size the numeral steps up one notch inside the same tag rather
// than becoming a 34px figure shouting across the page. Isolation by fill and
// weight survives greyscale; isolation by size alone is just a big number.
//
// THE TWO SIGNALS READ AS ONE OBJECT because they are one element's children at
// one gap, set apart from their neighbours by a larger one (`law-of-proximity`),
// and because both are set in the same mono face at the same size
// (`law-of-similarity`). Neither grouping survives being split across two
// containers, which is the other reason this is a component and not a pair of
// helpers.
//
// STALENESS IS A DIMMED LAMP AND NOTHING ELSE IS SAID. `freshnessLabel` already
// returns a statement of fact — "last confirmed working 8 months ago, on Sonnet
// 4.0" — which is the gentle prompt the theme asks for, so nothing here rewords
// it, adds a warning to it, or paints it red. A build nobody has confirmed
// lately has not failed.
//
// Styled with inline style objects, like every other surface on the new path:
// Tailwind's generated utilities win over hand-written classes at build time.

import type { CSSProperties, ReactNode } from "react";
import {
  freshnessLabel,
  isStale,
  type FreshnessSource,
  type StalenessSource,
} from "@/lib/build/signals";
import { categoryFill } from "@/lib/theme/category";
import { chipType } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { data as dataText, tabular } from "@/lib/theme/type";

/**
 * Where the plaque is standing.
 *
 *   card    on a build card, under the title and above the chips. One wrapping
 *           row at the card's own 12px mono.
 *   header  on the build page, in the facts strip or the reproduction panel.
 *           A column, and the only size where the numeral steps up.
 *   row     in a list — a rebuilds tab, a solver's shortlist. One line that
 *           never wraps and clips its freshness rather than growing.
 */
export type PlaqueSize = "card" | "header" | "row";

/** Healthy, gone stale, or nobody has run it yet. */
export type PlaqueState = "healthy" | "stale" | "unreproduced";

/**
 * The record the plaque reads, and the whole of its input.
 *
 * The four columns are the two signals: `reproduction_count` is the figure the
 * database refuses to let a creator self-serve, and the other three are what
 * `freshnessLabel` and `isStale` consume. `rebuild_count` rides along because a
 * rebuild is provenance on the same record, not a third signal.
 */
export interface PlaqueBuild extends FreshnessSource, StalenessSource {
  reproduction_count?: number | null;
  rebuild_count?: number | null;
}

export interface PlaqueProps {
  /** The build. One object, so neither signal can be supplied without the other. */
  build: PlaqueBuild;
  size?: PlaqueSize;
  /**
   * Anything the surface wants riding at the end of the plaque — the build
   * page's rebuild link, say. It is a CHILD rather than a third signal: the
   * plaque decides where it sits, and never lets it displace either half.
   */
  trailing?: ReactNode;
  /** Frozen "now", for a fixture or a test. Defaults to the clock. */
  now?: number;
}

/** What the tag says when nobody who is not the creator has run it. */
const NEVER_REPRODUCED = "not yet reproduced";

/** What the freshness half says when there is no confirmation to report. */
const NEVER_CONFIRMED = "not confirmed by anyone yet";

/** The numeral's size per plaque size. The word beside it never moves. */
const COUNT_PX: Record<PlaqueSize, number | undefined> = {
  card: undefined,
  /* One notch up inside the same tag. See the note on inflation above. */
  header: 20,
  row: undefined,
};

/** The lamp, per size. An oval rather than a circle: it is a light, not a dot. */
const LAMP: Record<PlaqueSize, { width: number; height: number }> = {
  card: { width: 10, height: 7 },
  header: { width: 12, height: 8 },
  row: { width: 9, height: 6 },
};

const GAP: Record<PlaqueSize, number> = { card: 8, header: 8, row: 8 };

/**
 * Why a reader should care about the number, in words, on hover.
 *
 * The count's whole meaning is "other than the creator", and that is invisible
 * in the figure itself — so it is stated here rather than assumed.
 */
function countTitle(count: number): string {
  if (count === 0) {
    return "Nobody other than the creator has recorded running this yet.";
  }
  const who = count === 1 ? "person" : "people";
  return `${count} ${who} other than the creator ran this and said what happened.`;
}

/** The plaque's state, from the same two reads the halves render. */
export function plaqueState(build: PlaqueBuild, now?: number): PlaqueState {
  if ((build.reproduction_count ?? 0) === 0) return "unreproduced";
  return isStale(build, now) ? "stale" : "healthy";
}

export function Plaque({ build, size = "card", trailing, now }: PlaqueProps) {
  const count = build.reproduction_count ?? 0;
  const freshness = freshnessLabel(build, now);
  const stale = isStale(build, now);
  const state = plaqueState(build, now);

  const evidence = categoryFill("evidence");
  const countPx = COUNT_PX[size];

  const frame: CSSProperties =
    size === "header"
      ? {
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 6,
          minWidth: 0,
          maxWidth: "100%",
        }
      : {
          display: "flex",
          alignItems: "center",
          flexWrap: size === "row" ? "nowrap" : "wrap",
          gap: GAP[size],
          minWidth: 0,
        };

  return (
    <div
      /* The card's content-order contract (BG-P09) names its four parts in the
         DOM, and the plaque is the third. Emitted at `card` size only, because
         that attribute means "this is the card's plaque" and a build header is
         not a card. */
      data-card-part={size === "card" ? "plaque" : undefined}
      data-visual-slot="plaque"
      data-plaque-size={size}
      data-plaque-state={state}
      style={frame}
    >
      {/* 1. REPRODUCTION. Zero is shown, never hidden: "nobody yet" is a state a
           reader is entitled to, and suppressing it leaves them unable to tell
           it apart from "we are not saying". */}
      <span
        data-plaque-reproduction=""
        data-testid="reproduction-count"
        title={countTitle(count)}
        style={{
          ...chipType,
          ...tabular,
          /* INLINE FLOW, NOT FLEX. The numeral is its own span so it can step
             up at header size, and a flex container would swallow the space
             between it and the word — leaving "41reproduced" in the accessible
             name and in anything that copies the text. Inline flow keeps the
             space real and puts the two on the same baseline for free. */
          display: "inline-block",
          flexShrink: 0,
          padding: size === "header" ? "4px 10px" : "2px 8px",
          borderRadius: r.chip,
          /* `--evidence-fill` with `--text` on it: the measured pair the colour
             contract names for this tag, 11.89:1 on Exhibition. Both halves or
             neither — this ink on another ground is a pairing nobody measured.
             The LONGHAND rather than the `background` shorthand: the value is a
             colour and nothing else, and a shorthand whose value is a `var()`
             is the declaration jsdom's cssstyle is known to drop whole (see the
             note in NodeCard.tsx). */
          backgroundColor: evidence.background,
          color: t.text,
        }}
      >
        {count === 0 ? (
          NEVER_REPRODUCED
        ) : (
          <>
            <span style={countPx ? { fontSize: countPx, fontWeight: 500 } : undefined}>
              {count}
            </span>{" "}
            reproduced
          </>
        )}
      </span>

      {/* 2. FRESHNESS. The lamp is lit only where there is a confirmation to
           light: an unlit lamp and an absent one say different things, and on a
           build nobody has confirmed only the second one is true. */}
      <span
        data-plaque-freshness=""
        style={{
          ...(size === "card" || size === "row" ? chipType : dataText),
          display: "flex",
          alignItems: "center",
          gap: 6,
          /* Both, and for different jobs. `minWidth: 0` lets this shrink below
             its content inside a flex row; `maxWidth: 100%` stops it growing
             past its container in a COLUMN, where flex-start sizes a child to
             max-content and a nowrap line would otherwise run off the page.
             Without the second, the freshness sentence overflowed the header
             plaque at 390px. */
          minWidth: 0,
          maxWidth: "100%",
          color: t.text2,
        }}
      >
        {freshness ? <Lamp dim={stale} size={size} /> : null}
        <span
          style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {freshness ?? NEVER_CONFIRMED}
        </span>
      </span>

      {trailing}
    </div>
  );
}

/**
 * The lamp: an oval of `--lit`, dimmed to 45% when the claim has gone stale.
 *
 * Amber is LIGHT here and never type, which is the one rule the colour contract
 * states twice — `--lit` is 3.01:1 on the Exhibition ground, legal as a lamp and
 * illegal as a word. `opacity` carries the stale state so the colour stays one
 * token in both themes rather than becoming two.
 */
function Lamp({ dim, size }: { dim: boolean; size: PlaqueSize }) {
  return (
    <span
      aria-hidden
      data-plaque-lamp={dim ? "dim" : "lit"}
      style={{
        flexShrink: 0,
        ...LAMP[size],
        borderRadius: "50% / 50%",
        /* Longhand, for the reason noted on the tag above. */
        backgroundColor: t.lit,
        opacity: dim ? 0.45 : 1,
      }}
    />
  );
}

export default Plaque;
