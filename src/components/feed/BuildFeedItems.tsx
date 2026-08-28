// The three things the Builds tab renders.
//
// A build and a rebuild are the SAME COMPONENT the gallery renders, and that
// is deliberate rather than lazy. A build looks like itself wherever it
// appears; a feed that drew its own version of a card would drift from the
// gallery's the first time either changed, and a reader would have to learn
// two shapes for one thing. The card already sizes itself to its column, and
// the feed's centre column is close enough to a gallery cell that nothing had
// to move.
//
// A REPRODUCTION NOTE IS NOT A CARD, and that is the one place this file says
// no to the reuse. A note is one sentence about somebody else's build. Giving
// it a 168px body, a cover image and two big numbers would say it was the same
// kind of thing as the build it is about, and it is not: it is evidence
// attached to one. So it renders as a strip — one line, the reader's own words
// in quotes, linking to the build they ran.
//
// Styled with inline style objects, like every other surface on the new path:
// Tailwind's generated utilities win over hand-written classes at build time.

import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { GalleryCard } from "@/components/gallery/GalleryCard";
import { rebuildCreditLine } from "@/components/build/rebuildCredit";
import type { MediaSrcMap } from "@/components/gallery/cardMedia";
import {
  HAIRLINE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  cardGlass,
} from "@/components/build/tokens";
import type {
  BuildFeedItem,
  FeedItem,
  RebuildFeedItem,
  ReproNoteFeedItem,
} from "@/lib/feed/getBuildFeed";

/** Every item sits in the same width, so the column stays a column. */
const itemFrame: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  marginBottom: 12,
};

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
  return <BuildItem item={item} srcByPath={srcByPath} />;
}

/**
 * A build, as the gallery draws it.
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
      <GalleryCard build={item.build} srcByPath={srcByPath} credit={null} />
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
 * THE CREDIT IS COMPOSED HERE, not inside the card, for the same reason the
 * gallery composes it in the page: rebuildCreditLine reads the two frozen
 * snapshot columns, which arrive on the feed row with everything else, so a
 * rebuild's credit costs the feed nothing. See rebuildCredit.ts for why it is
 * a string rather than a component.
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
            margin: 0,
            fontSize: 13,
            fontWeight: 300,
            lineHeight: 1.5,
            color: TEXT_SECONDARY,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.note}
        </p>
      ) : null}
      <GalleryCard
        build={item.build}
        srcByPath={srcByPath}
        credit={rebuildCreditLine(item.build)}
      />
    </div>
  );
}

/**
 * "@rae ran Inbox triage agent — worked on Sonnet 4.5: 'Held up on 300.'"
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
 */
function ReproNoteStrip({ item }: { item: ReproNoteFeedItem }) {
  const who = item.handle ? `@${item.handle}` : "someone";
  const verb = item.worked ? "worked" : "didn’t work";
  const on = item.model ? ` on ${item.model}` : "";

  return (
    <div data-testid="feed-item-repro" style={itemFrame}>
      <Link
        to={`/b2/${item.slug}`}
        // The build and the rebuild carry the gallery card's own slot; this
        // strip is a surface of its own, so it names one.
        data-visual-slot="feed-repro-strip"
        style={{
          ...cardGlass,
          display: "block",
          padding: "10px 14px",
          textDecoration: "none",
          // Quieter than a card on purpose: a note about a build should not
          // compete with the builds around it.
          background: "rgba(255,255,255,0.015)",
          borderLeft: `2px solid ${item.worked ? TEAL : HAIRLINE}`,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 300,
            lineHeight: 1.55,
            color: TEXT_SECONDARY,
          }}
        >
          <span style={{ fontWeight: 500, color: TEXT_PRIMARY }}>{who}</span> ran{" "}
          <span style={{ fontWeight: 500, color: TEXT_PRIMARY }}>{item.title}</span>
          {" — "}
          <span style={{ color: item.worked ? TEAL : TEXT_MUTED }}>
            {verb}
            {on}
          </span>
          {": "}
          <span style={{ fontStyle: "italic" }}>“{item.note}”</span>
        </p>
      </Link>
    </div>
  );
}
