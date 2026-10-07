// The plaque: the two trust signals, as one object, at three sizes (BG-P11,
// repainted UI-P08).
//
// WHAT WAS HERE BEFORE. Three surfaces each drew their own: the gallery card's
// local `Plaque` (BG-P09), the build header's `reproduction` fallback, and the
// display half of `ReproductionAction`. Three renderings of one claim is three
// chances for them to disagree about what a reader is entitled to. This file is
// the one rendering; those three now spend it.
//
// IT IS IMPOSSIBLE TO RENDER HALF OF IT. The reproduction count and the
// freshness claim are both read off a single record: there is no argument list
// that supplies one and withholds the other, because `build` is the only
// argument there is.
//
// THREE STATES, FROM DATA (RULES §5), and `plaqueState()` is the one place they
// are decided:
//
//   healthy       "41 reproduced" on `--evidence-fill`, then a lit lamp dot and
//                 the freshness claim in `--text`.
//   stale         the same tag, the lamp dimmed to 45%, the claim in `--text2`.
//                 A prompt, never a failure: nothing here rewords it, warns, or
//                 paints it red. A build nobody confirmed lately has not failed.
//   unreproduced  one line, "not yet reproduced", in `--text2`. No tag, no lamp,
//                 no freshness: with no reproduction there is nothing to light
//                 and nothing to date, and a lamp that was off would say
//                 something different from a lamp that is absent.
//
// THE COUNT IS THE ONE FILLED GROUND, and wins on that alone: the same type as
// its neighbours, at every size, never a larger numeral. The two signals read as
// one object because they are one flex row at one gap (`law-of-proximity`) in
// type that differs only by face (`law-of-similarity`).
//
// SIZES. `card` and `row` say "3 days ago, on sonnet-4.5"; `header` says it in
// full, "last confirmed working 3 days ago, on sonnet-4.5", because the build
// page has the room and the reader has no card around the claim to tell them
// what it is a claim about. The text may wrap. `proof` (UI-P29) is the Build
// page's proof panel as the reference draws it: the tag at 11px, the claim at
// 12px and the 10×7 lamp, in full — and `wording="short"` where a phone column
// has no room for the lead.
//
// Styled with inline style objects, like every other surface on the new path:
// Tailwind's generated utilities win over hand-written classes at build time.

import type { CSSProperties, ReactNode } from "react";
import {
  freshnessLabel,
  freshnessShort,
  isStale,
  type FreshnessSource,
  type StalenessSource,
} from "@/lib/build/signals";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, tabular } from "@/lib/theme/type";

import { LampDot } from "./LampDot";

/**
 * Where the plaque is standing.
 *
 *   card    on a build card, under the title and above the chips. One wrapping
 *           row at the card's own 12px mono.
 *   header  on the build page, in the facts strip or the reproduction panel.
 *           A column, and the only size where the numeral steps up.
 *   row     in a list — a rebuilds tab, a solver's shortlist. One line that
 *           never wraps and clips its freshness rather than growing.
 *   proof   the Build page's proof panel (UI-P29): the reference's 11px tag
 *           and 12px claim beside the reproduction orb, said in full.
 */
export type PlaqueSize = "card" | "header" | "row" | "proof";

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

/**
 * The ground the plaque stands on. `surface` is every glass or solid surface;
 * `inverse` is the featured build's dark-on-light panel (UI-P11), where the
 * count wears `--inverse-evidence-fill` and the words `--on-inverse`.
 */
export type PlaqueTone = "surface" | "inverse";

export interface PlaqueProps {
  /** The build. One object, so neither signal can be supplied without the other. */
  build: PlaqueBuild;
  size?: PlaqueSize;
  /** The ground it stands on. Defaults to `surface`. */
  tone?: PlaqueTone;
  /**
   * Anything the surface wants riding at the end of the plaque — the build
   * page's rebuild link, say. It is a CHILD rather than a third signal: the
   * plaque decides where it sits, and never lets it displace either half.
   */
  trailing?: ReactNode;
  /**
   * How the freshness half is said, when the size's own choice does not fit:
   * `full` leads with "last confirmed working", `short` does not. Defaults to
   * full at `header` and `proof`, short everywhere else.
   */
  wording?: "full" | "short";
  /** Frozen "now", for a fixture or a test. Defaults to the clock. */
  now?: number;
}

/** What the plaque says when nobody who is not the creator has run it. */
const NEVER_REPRODUCED = "not yet reproduced";

/**
 * What the freshness half says when there is no confirmation to report.
 * Exported so a table that reports the same fact (RC-P23's analytics) says it
 * in the same words.
 */
export const NEVER_CONFIRMED = "not confirmed by anyone yet";

/** Type per size: the tag is DM Mono, the freshness line and the bare text Figtree.
    UI-P54, the density pass: the header's tag is 12 (13 before); 10 and 11 are
    in the table's kept band, and so are the lamp dots below. */
const TAG_PX: Record<PlaqueSize, number> = { card: 10, row: 11, header: 12, proof: 11 };
const TEXT_PX: Record<PlaqueSize, number> = { card: 10, row: 11, header: 12, proof: 12 };

/** The lamp dot, per size. Card and row use the default 10×7. */
const LAMP: Record<PlaqueSize, { width: number; height: number }> = {
  card: { width: 10, height: 7 },
  row: { width: 10, height: 7 },
  header: { width: 12, height: 8 },
  proof: { width: 10, height: 7 },
};

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

export function Plaque({ build, size = "card", tone = "surface", trailing, wording, now }: PlaqueProps) {
  const count = build.reproduction_count ?? 0;
  const state = plaqueState(build, now);
  const stale = state === "stale";
  const inverse = tone === "inverse";

  /* On the inverse panel the tag is the reference's own 10px and the line beside
     it 11px (the featured plate draws them that way), the lamp is the same lit
     dot, and every word is read against `--inverse`: current in `--on-inverse`,
     quiet in `--on-inverse-2`. */
  const textPx = inverse ? 11 : TEXT_PX[size];
  const tagPx = inverse ? 10 : TAG_PX[size];
  const ink = inverse ? t.onInverse : t.text;
  const quietInk = inverse ? t.onInverse2 : t.text2;

  const frame: CSSProperties = {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 5,
    minWidth: 0,
  };

  const marks = {
    /* The card's content-order contract (BG-P09) names its four parts in the
       DOM, and the plaque is the third. Emitted at `card` size only, because
       that attribute means "this is the card's plaque" and a build header is
       not a card. */
    "data-card-part": size === "card" ? "plaque" : undefined,
    "data-visual-slot": "plaque",
    "data-ui": "plaque",
    "data-plaque-size": size,
    "data-plaque-state": state,
    "data-plaque-tone": inverse ? "inverse" : undefined,
  } as const;

  /* UNREPRODUCED: one quiet line. No tag, no lamp, no freshness. It keeps the
     tag's hooks (`data-plaque-reproduction`, the test id and the hover) because
     it IS the reproduction half, said in words — and `trailing` still rides. */
  if (state === "unreproduced") {
    return (
      <div {...marks} data-variant="never" style={{ ...frame, fontFamily: FIGTREE, fontSize: textPx, lineHeight: "normal", color: quietInk }}>
        <span
          data-plaque-reproduction=""
          data-testid="reproduction-count"
          title={countTitle(0)}
        >
          {NEVER_REPRODUCED}
        </span>
        {trailing}
      </div>
    );
  }

  const freshness =
    (wording ?? (size === "header" || size === "proof" ? "full" : "short")) === "full"
      ? freshnessLabel(build, now)
      : freshnessShort(build, now);

  return (
    <div {...marks} data-variant={stale ? "stale" : "fresh"} style={frame}>
      {/* 1. REPRODUCTION. The one filled ground on the object. */}
      <span
        data-plaque-reproduction=""
        data-testid="reproduction-count"
        title={countTitle(count)}
        style={{
          ...tabular,
          fontFamily: DM_MONO,
          fontSize: tagPx,
          lineHeight: "normal",
          background: inverse ? t.inverseEvidenceFill : t.evidenceFill,
          color: inverse ? t.onInverseEvidenceFill : t.onEvidenceFill,
          padding: "2px 4px",
          borderRadius: r.chip,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {count} reproduced
      </span>

      {/* 2. FRESHNESS. A lit lamp for a current claim, a dim one for a stale
          claim; the text is `--text` while it is current and `--text2` once it
          is not, and it may wrap. */}
      <span
        data-plaque-freshness=""
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          fontFamily: FIGTREE,
          fontSize: textPx,
          lineHeight: "normal",
          color: stale ? quietInk : ink,
          minWidth: 0,
        }}
      >
        <PlaqueLamp dim={stale} size={size} />
        {freshness ?? NEVER_CONFIRMED}
      </span>

      {trailing}
    </div>
  );
}

/**
 * The lamp in a plaque: `LampDot`, at the size the plaque is standing at.
 *
 * Kept as its own export since BG-P18, because the signal is in two places and
 * has to be one object. A reproduction note in the feed — "@rae ran it, and it
 * worked on sonnet-4.5" — is the same claim this lamp reports on a card: somebody
 * who is not the creator ran the thing and said what happened. UI-P08 moved the
 * drawing into `LampDot`; this is the plaque's name for it.
 */
export function PlaqueLamp({ dim, size = "row" }: { dim: boolean; size?: PlaqueSize }) {
  return (
    <LampDot data-plaque-lamp={dim ? "dim" : "lit"} dim={dim} {...LAMP[size]} />
  );
}

export default Plaque;
