// The four things the Builds tab renders.
//
// A build and a rebuild are the SAME COMPONENT the gallery renders, and that
// is deliberate rather than lazy. A build looks like itself wherever it
// appears; a feed that drew its own version of a card would drift from the
// gallery's the first time either changed, and a reader would have to learn
// two shapes for one thing.
//
// BG-P18 ASKS THAT CARD FOR ITS FEED LAYOUT. `layout="feed"` is the one thing
// the feed now says about the card's inside, and it says it in one place —
// `feedCard` below — so the build, the rebuild and the bounty cannot disagree
// about it. In feed layout the card draws the creator's post: text above each
// picture at the picture's OWN shape, with a `Show thread` control that unfolds
// the later entries in place. In grid layout it draws the gallery's fixed
// letterbox slot. The card decides nothing else differently, and the feed
// decides nothing about the card beyond this word.
//
// WHAT THAT DOES NOT YET CHANGE ON SCREEN, and it is important that this is
// written down rather than discovered: the card falls back to the fixed slot for
// a build with no post ENTRIES, and `get_build_feed` returns one cover row with
// `post_position` null — so `postEntriesOf` reports no entries for every row the
// feed has. See the note on `coverRows` in src/lib/feed/getBuildFeed.ts, which
// says the same thing from the data layer's side. The layout is asked for here;
// the thread appears the day that function returns the post's rows. Asking for
// it now is not a no-op dressed up as work: it is the half of the switch that
// belongs to the feed, and the card is already correct on the other side of it.
//
// A REPRODUCTION NOTE IS NOT A CARD, and that is the one place this file says
// no to the reuse. A note is one sentence about somebody else's build. Giving
// it a body, a cover image and two big numbers would say it was the same
// kind of thing as the build it is about, and it is not: it is evidence
// attached to one. So it renders as a strip — one line, the reader's own words
// in quotes, linking to the build they ran.
//
// Styled with inline style objects, like every other surface on the new path:
// Tailwind's generated utilities win over hand-written classes at build time.

import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { GalleryCard } from "@/components/gallery/GalleryCard";
import { gapEdge } from "@/components/brand/GapMarker";
import { rewardLabel } from "@/components/bounty/bountyDisplay";
import type { MediaSrcMap } from "@/components/gallery/cardMedia";
import { PlaqueLamp } from "@/components/brand/Plaque";
import { chipStyle } from "@/lib/theme/controls";
import { elevation } from "@/lib/theme/elevation";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import {
  body as bodyText,
  data as dataText,
  eyebrow as eyebrowText,
  tabular,
} from "@/lib/theme/type";
import type {
  BountyFeedItem,
  BuildFeedItem,
  FeedItem,
  RebuildFeedItem,
  ReproNoteFeedItem,
} from "@/lib/feed/getBuildFeed";

/**
 * Every item sits in the same width, so the column stays a column.
 *
 * IT IMPOSES NO HEIGHT, AND THAT IS NOW LOAD-BEARING RATHER THAN INCIDENTAL. A
 * card in feed layout changes height after its first render — a reader opens a
 * thread and the card grows — so a wrapper carrying a fixed `height` or an
 * `overflow: hidden` would clip the thing the layout exists to show. BG-P18
 * checked for both and found neither, so nothing here changed; this note is the
 * guard against the next person adding one. The only properties are the column
 * direction, the 8px gap between a strip and the card under it, and the 12px to
 * the next item.
 */
const itemFrame: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  marginBottom: 12,
};

/**
 * One line of body text, in pixels.
 *
 * Derived from the role rather than typed, so a change to the body's size or
 * leading moves the reproduction strip's lamp with it instead of leaving it a
 * pixel or two off the line it is meant to sit on.
 */
const LINE_BOX = Math.round(
  parseFloat(bodyText.fontSize) * Number(bodyText.lineHeight),
);

/**
 * What the feed asks the card for.
 *
 * One constant rather than the string written three times: the three kinds of
 * item that render a card must all render the SAME card, and a literal repeated
 * at three call sites is how two of them end up in the gallery's layout.
 */
const FEED_LAYOUT = "feed" as const;

export interface BuildFeedItemViewProps {
  item: FeedItem;
  /** Signed once for the whole page, never per item. */
  srcByPath: MediaSrcMap;
}

/** One feed item, whichever kind it is. */
export function BuildFeedItemView({ item, srcByPath }: BuildFeedItemViewProps) {
  if (item.kind === "repro_note") return <ReproNoteStrip item={item} />;
  if (item.kind === "rebuild") {
    return <RebuildItem item={item} srcByPath={srcByPath} />;
  }
  if (item.kind === "bounty") {
    return <BountyItem item={item} srcByPath={srcByPath} />;
  }
  return <BuildItem item={item} srcByPath={srcByPath} />;
}

/**
 * A build, as the gallery draws it — in the feed's layout.
 *
 * No credit prop: a build with no parent has nothing to credit, and passing
 * null is what the card already expects for the ordinary case.
 */
function BuildItem({
  item,
  srcByPath,
}: {
  item: BuildFeedItem;
  srcByPath: MediaSrcMap;
}) {
  return (
    <div data-testid="feed-item-build" style={itemFrame}>
      <GalleryCard build={item.build} srcByPath={srcByPath} layout={FEED_LAYOUT} />
    </div>
  );
}

/**
 * A rebuild: what the rebuilder said, then the thing they made.
 *
 * THE NOTE LEADS. In a feed, the line above an attachment is read as the
 * person speaking and the thing below it as what they are speaking about,
 * which is exactly the relationship here — the rebuild note is the rebuilder's
 * account of their own build. Putting it under the card would read as a
 * caption on somebody else's work.
 *
 * THE CREDIT IS THE CARD'S (BG-P11). It reads the two frozen snapshot columns
 * off the record it is handed, and the feed row carries them like everything
 * else the card shows — so the feed neither composes the credit nor can decline
 * to pass it, which is what "the credit is structural" has to mean in code.
 *
 * A rebuild with no note renders the card alone. "A rebuild has to change
 * something" is enforced at publish; saying what you changed in prose is not,
 * and an empty line where the prose would go would be an accusation.
 */
function RebuildItem({
  item,
  srcByPath,
}: {
  item: RebuildFeedItem;
  srcByPath: MediaSrcMap;
}) {
  return (
    <div data-testid="feed-item-rebuild" style={itemFrame}>
      {item.note ? (
        <p
          data-testid="feed-rebuild-note"
          style={{
            // The body role. It was 13px at weight 300, which the theme's weight
            // floor forbids outright below 18px — and this is a person's own
            // sentence about their own work, which is prose and not metadata.
            ...bodyText,
            margin: 0,
            color: t.text2,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.note}
        </p>
      ) : null}
      <GalleryCard build={item.build} srcByPath={srcByPath} layout={FEED_LAYOUT} />
    </div>
  );
}

/**
 * An open ask: the dashed strip, then the build it is a hole in (NS-P52).
 *
 * THE STRIP LEADS, for the same reason the rebuild note does: the line above a
 * card is read as the thing being said and the card as what it is about, and
 * that is the relationship here — the creator is asking for one part of the
 * build below.
 *
 * IT SAYS WHICH PART, when the bounty names a gap node. "An open bounty on
 * Inbox triage agent" tells a reader nothing they can act on; "Unsolved: the
 * retry prompt" tells them whether it is theirs to solve. A build-level ask
 * names no node, and then the strip says the plain thing rather than inventing
 * a part.
 *
 * BG-P18 PUTS IT ON GapMarker's OWN MARKS. It was a 2px solid left border in a
 * hard-coded red over a 6% red wash, which was two departures from the theme in
 * one element: a gap's edge is 1.5px DASHED, because solid says "this is what
 * this is" and dashed says "this is where something goes", and a gap never gets
 * a tinted ground — a red wash behind an invitation reads as an error box, which
 * is the one thing an open bounty must not read as. The reward takes the
 * breakage category's measured fill pair, which is the only ground that hue is
 * legal as ink on.
 *
 * The card carries the pill as well, and that is not a duplication to tidy
 * away: the strip is this item, and the pill is the card's own summary of the
 * build — the same card appears in the gallery wearing it.
 */
function BountyItem({
  item,
  srcByPath,
}: {
  item: BountyFeedItem;
  srcByPath: MediaSrcMap;
}) {
  const reward = rewardLabel(item.reward);
  const part = (item.gapTitle ?? "").trim();

  return (
    <div data-testid="feed-item-bounty" style={itemFrame}>
      <div
        data-visual-slot="feed-bounty-strip"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          padding: "6px 10px",
          // The edge is the whole treatment, and it is the same edge a node row
          // and a card wear. No fill: see the note above.
          ...gapEdge("row"),
          background: "transparent",
        }}
      >
        <span style={{ ...eyebrowText, color: t.catBreakage }}>Open bounty</span>
        <span style={{ ...bodyText, color: t.text2 }}>
          {part ? (
            <>
              <span style={{ color: t.text }}>{part}</span> is unsolved
            </>
          ) : (
            "part of this build is unsolved"
          )}
        </span>
        {reward ? (
          <span
            data-testid="feed-bounty-reward"
            style={{
              ...chipStyle("category", { category: "breakage" }),
              ...tabular,
              padding: "2px 8px",
            }}
          >
            {reward}
          </span>
        ) : null}
      </div>
      <GalleryCard build={item.build} srcByPath={srcByPath} layout={FEED_LAYOUT} />
    </div>
  );
}

/**
 * "@rae ran Inbox triage agent — worked on sonnet-4.5: 'Held up on 300.'"
 *
 * The handle leads because the claim is only worth anything attached to a
 * person: the platform's one unfakeable number counts people who are not the
 * creator, and this is one of them saying what happened in their own words.
 *
 * IT SAYS "didn't work" WHEN IT DIDN'T. build_reproductions records both
 * outcomes and the failures are the more useful half — a build that fails on
 * one person's data is a thing the next reader needs to know before they spend
 * an hour on it. A strip that only ever said "worked" would be a testimonials
 * page wearing a feed's clothes.
 *
 * NOT A CARD, AND BG-P18 IS WHERE IT STOPS LOOKING LIKE A DIM ONE. It was a
 * glass panel at 2.5% white with a card's radius and a teal or grey left edge —
 * which is to say a build card with the volume down, and a reader scanning the
 * column had to read it before knowing it was not one. Now it is a surface cut
 * INTO the page rather than one sitting on it: `--recess` under a `--line`
 * hairline at `--r-control`, which is the list-row shape and not the card shape.
 * The step goes the opposite way to every card around it, so the difference is
 * legible before a single word is (`law-of-similarity`).
 *
 * THE LAMP IS THE PLAQUE'S LAMP, imported rather than redrawn. A card's plaque
 * says "confirmed 3 days ago, on sonnet-4.5" with an amber oval beside it; this
 * strip is one of the confirmations that claim is made of. Lit when it worked,
 * dimmed to the same 45% when it did not — the plaque's own grammar for a claim
 * that has weakened, spent on a claim that was negative to begin with. Amber
 * stays LIGHT and never type, which is the rule the colour contract states
 * twice.
 *
 * THE READER'S OWN WORDS ARE THE ONLY THING IN `--text`. Everything else — who,
 * what they ran, whether it worked, on which model — is `--text2`, because the
 * strip is evidence and the evidence is the sentence in quotes. The model name
 * takes DM Mono, which is the data face and what every other model name on the
 * platform is set in.
 */
function ReproNoteStrip({ item }: { item: ReproNoteFeedItem }) {
  const who = item.handle ? `@${item.handle}` : "someone";
  const verb = item.worked ? "worked" : "didn’t work";

  return (
    <div data-testid="feed-item-repro" style={itemFrame}>
      <Link
        to={`/b2/${item.slug}`}
        // The build and the rebuild carry the gallery card's own slot; this
        // strip is a surface of its own, so it names one.
        data-visual-slot="feed-repro-strip"
        data-repro-worked={item.worked ? "" : undefined}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          padding: "10px 14px",
          borderRadius: r.control,
          background: t.recess,
          ...elevation.flat,
          textDecoration: "none",
        }}
      >
        {/* One line box tall, so the lamp centres on the FIRST line rather than
            on the paragraph: a two-line note would otherwise float it halfway
            down the strip, beside nothing. The height is derived from the body
            role rather than typed, so it cannot drift from the text it sits
            beside. */}
        <span
          style={{
            display: "flex",
            alignItems: "center",
            height: LINE_BOX,
            flexShrink: 0,
          }}
        >
          <PlaqueLamp dim={!item.worked} />
        </span>
        <p style={{ ...bodyText, margin: 0, color: t.text2 }}>
          {who} ran {item.title} — {verb}
          {item.model ? (
            <>
              {" on "}
              <span style={dataText}>{item.model}</span>
            </>
          ) : null}
          {": "}
          <span style={{ color: t.text }}>“{item.note}”</span>
        </p>
      </Link>
    </div>
  );
}
