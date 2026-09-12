// One build, as a card: a tweet in miniature, mounted in a frame.
//
// TWO LAYERS, AND THE STEP BETWEEN THEM IS THE STRUCTURE (BG-P09).
//
//   the FRAME   this element. --card-frame, the card's one backdrop-filter, a
//               --glass-border edge, elevation.flat, --r-card. It is the RECORD:
//               the title, the credit, the plaque and the chips sit on it.
//   the BOX     CardThread, inset 8px. --card-thread, one step lighter, no blur,
//               no border, --r-thread. It is the POST: text above media, and in
//               feed layout it unfolds in place.
//
// A reader who can see the step does not need a label for either (see
// `law-of-common-region`, and the note in semantics.ts on why the step's
// DIRECTION is the same in both rooms). Get the step wrong and the card is a
// rectangle with a rectangle in it.
//
// THE TITLE WINS EVEN THOUGH IT SITS UNDER THE PICTURE. That is the one thing
// this card has to get right. It is why `type.cardTitle` is now the DISPLAY face
// at 22 in full `--text`, where it used to be the body face clamped from 19,
// while everything around it is 13–16px of `--text2` and mono. A picture is
// always the first thing the eye lands on, so a title under one cannot win by
// position: it wins by face, size and contrast, and every other element under
// the box is deliberately quieter than it. 22 clears the display floor, which is
// what makes the change legal rather than a waiver — see the role's own note.
// (The family is named in `type.ts` and nowhere else, which type.test.ts sweeps
// for: a card that spelled out a face would be a card that could drift.)
//
// THE FIGURE THAT USED TO LEAD IS THE REPRODUCTION COUNT, and it still says the
// same thing: how many people who are not the creator ran the thing and said
// what happened. It is the only number on the platform that cannot be
// self-served — the database refuses a creator's reproduction of their own build
// — which is why it and the freshness line are one object, the PLAQUE, and why
// they are always together, always under the title, never in a footer.
//
// THE CONTENT ORDER UNDER THE BOX IS FIXED: title → credit → plaque → chips →
// the open ask. BG-P09 moved them from "under the media" to "on the frame under
// the box", which is a change of container and not of order, and BG-P11 swapped
// four of the five for the shared components in `components/brand/` without
// moving any of them. Nothing among them has been added, removed or reordered.
//
// Styled with inline style objects, like every other surface on the new path:
// Tailwind's generated utilities win over hand-written classes at build time.

import { useMemo, useState, type CSSProperties, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { BranchIcon } from "@/components/build/BranchIcon";
import { CategoryChip } from "@/components/brand/CategoryChip";
import { GapMarker, gapEdge } from "@/components/brand/GapMarker";
import { Plaque } from "@/components/brand/Plaque";
import { RebuildCredit } from "@/components/brand/RebuildCredit";
import { GLASS_BLUR, UI_EASING, UI_MS, hoverIsFine, prefersReducedMotion } from "@/lib/theme/controls";
import { elevation } from "@/lib/theme/elevation";
import { chipType } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
// Roles by name, not the `type` object: this file uses inline `type X`
// import modifiers, which a value binding called `type` makes ambiguous.
import { cardTitle, tabular } from "@/lib/theme/type";
import {
  aspectOf,
  type BuildShape,
  type GalleryBuild,
  type GalleryMedia,
} from "@/lib/build";
import { rewardLabel } from "@/components/bounty/bountyDisplay";
import {
  AppCardBody,
  DefaultCardBody,
  MediaCardBody,
  PromptCardBody,
  StudyCardBody,
  type CardBodyProps,
} from "./cardBodies";
import { Skeleton } from "@/components/ui/skeleton";
import { CardThread, THREAD_PAD, type CardLayout } from "./CardThread";
import { BODY_HEIGHT } from "./cardBodies";
import { coverMedia, mediaAlt, postMediaOf, stillFor, type MediaSrcMap } from "./cardMedia";

/**
 * Shape to body. Five bodies, nine shapes: agent and workflow are apps as far
 * as a card is concerned — something deployed, with a link and a screenshot —
 * and dataset, technique and other have no card-shaped summary of their own, so
 * they take the default chain.
 */
const BODY_FOR_SHAPE: Partial<
  Record<BuildShape, (props: CardBodyProps) => ReactElement>
> = {
  app: AppCardBody,
  agent: AppCardBody,
  workflow: AppCardBody,
  prompt: PromptCardBody,
  study: StudyCardBody,
  media: MediaCardBody,
};

/** The frame's padding, which is the box's inset on all four sides. */
const FRAME_PAD = 8;

/** The frame's own content padding, below the box. */
const CONTENT_PAD = 16;

/**
 * The title, one step up, on a card with no picture.
 *
 * 22 × 1.2 rounded — one step of the scale's own ratio, and still well below the
 * 30px section head, because a card is not a section. It is here rather than in
 * `type.ts` because it is not a role: it is the card title role, spent larger,
 * in the one case where the title is the only thing carrying the card.
 */
const TITLE_NO_PICTURE_PX = 26;

/**
 * One line of the title, for the skeleton to reserve.
 *
 * Derived from the role rather than guessed: 22 × 1.25 is the line box
 * `type.cardTitle` produces, so a skeleton line is the height a title line will
 * be and the swap moves nothing.
 */
const TITLE_LINE = Math.round(22 * 1.25);

export interface GalleryCardProps {
  build: GalleryBuild;
  /** Signed once for the whole page, never per card. */
  srcByPath: MediaSrcMap;
  /**
   * THE ONE MEMBER BG-P09 ADDED, and it defaults so that every existing call
   * site is unchanged.
   *
   *   grid  the gallery. One fixed slot, no entry text, no unfold — the card
   *         the grid has always laid out, repainted.
   *   feed  the Builds tab (BG-P18 switches it). Entries at their own shapes,
   *         text above each picture, unfolding in place.
   *
   * Unfold state is internal to the card and is not a prop: a list that owned it
   * would have to be told about a thread, and BG-P18's list has no business
   * knowing what is inside a card.
   */
  layout?: CardLayout;
}

export function GalleryCard({ build, srcByPath, layout = "grid" }: GalleryCardProps) {
  const Body =
    BODY_FOR_SHAPE[(build.shape ?? "other") as BuildShape] ?? DefaultCardBody;

  const shape = (build.shape ?? "other") as BuildShape;
  const promoted = build.status === "gallery";
  const bounty = openBounty(build);

  // postEntriesOf over rows the page already has; see postMediaOf. Memoised
  // because it sorts, and a feed re-renders its items on every scroll tick.
  const entries = useMemo(() => postMediaOf(build), [build]);

  /**
   * Whether this card has a picture at all, which decides two things: the title
   * steps up one size without one, and the box holds a text well rather than a
   * media slot.
   *
   * Read from the SIGNED map rather than from the record, because an unsigned
   * row is a card with no picture as far as a reader is concerned — the same
   * branch every body already takes while the signatures are in flight.
   */
  const hasPicture =
    entries.length > 0
      ? entries.some((entry) => stillFor(srcByPath, entry.media) !== null)
      : stillFor(srcByPath, coverMedia(build)) !== null;

  const altFor = (media: GalleryMedia) => mediaAlt(build, media);

  return (
    <Frame to={`/b2/${build.slug}`} shape={shape} bounty={Boolean(bounty)} layout={layout}>
      <CardThread
        entries={entries}
        srcByPath={srcByPath}
        // A feed card whose creator never arranged a post has nothing to unfold,
        // so it draws the fixed slot: the guarantee that no card is ever empty
        // outranks the layout it was asked for.
        layout={layout === "feed" && entries.length > 0 ? "feed" : "grid"}
        shape={shape}
        altFor={altFor}
        resetKey={build.id}
        gridBody={<Body build={build} srcByPath={srcByPath} />}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: `${CONTENT_PAD}px ${CONTENT_PAD}px ${CONTENT_PAD}px`,
        }}
      >
        {/* 1. THE TITLE. */}
        <h3
          data-card-part="title"
          style={{
            ...cardTitle,
            // One step up on a card with no picture: the title is then the only
            // thing carrying the card, and the box above it is a quiet well.
            ...(hasPicture ? null : { fontSize: TITLE_NO_PICTURE_PX }),
            margin: 0,
            color: t.text,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {(build.title ?? "").trim() || "Untitled build"}
        </h3>

        {/* 2. THE CREDIT, on a rebuild only. One quiet line under the title,
             because it is provenance rather than a claim the card is making for
             itself — findable, not loud.

             READ OFF THE CARD'S OWN RECORD (BG-P11). This was a `credit` PROP,
             on the reasoning that the snapshot columns were not in the card's
             query and a card that fetched them would issue one request per
             card. Both halves of that stopped being true at NS-P40, which put
             source_title_at_fork and source_handle_at_fork in
             GALLERY_BUILD_COLUMNS: they ride in on the query the card already
             makes. Composing here rather than in each page is what makes the
             credit structural — three pages could each decide not to pass it,
             and the theme is explicit that the credit is not the rebuilder's
             (or the page's) to remove.

             NO Δ SUMMARY BESIDE IT, and that is a gap rather than a choice.
             Computing one needs BOTH whole records — this build's and its
             source's — and a grid of twenty-four cards cannot read
             forty-eight. A stored summary column would fix it; until there is
             one, `changes` is left absent, which RebuildCredit renders as
             "nobody worked it out" rather than as "nothing changed". */}
        <RebuildCredit source={build} placement="card" />

        {/* 3. THE PLAQUE: reproduction and freshness, together, one object.
             The rebuild count rides at its end rather than beside it: it is
             provenance on the same record, not a third trust signal. */}
        <Plaque
          build={build}
          size="card"
          trailing={<Rebuilds count={build.rebuild_count ?? 0} />}
        />

        {/* 4. THE PART CHIPS. */}
        <Chips roles={build.made_for ?? []} promoted={promoted} />

        {/* 5. An open ask's reward, in mono under the chips. No special
             container: the dashed edge on the frame is the whole treatment. */}
        <GapMarker
          placement="card"
          state="funded"
          summary={bounty}
          testId="gallery-card-bounty"
        />
      </div>
    </Frame>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   The skeleton
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The card's shape before the card exists.
 *
 * THE SAME PROPORTIONS, NOT AN APPROXIMATION OF THEM. It spends FRAME_PAD,
 * CONTENT_PAD, THREAD_PAD and BODY_HEIGHT — the same constants the real card
 * spends — so a skeleton cannot drift from the thing it stands in for, and the
 * swap when the data lands does not move the page. In feed layout the media
 * block reserves its height with `aspect-ratio` at `aspectOf(null).capped`,
 * which is the ratio the real card uses for a row whose dimensions it does not
 * know yet: the skeleton and the first paint of the loaded card are the same box.
 *
 * NO BACKDROP-FILTER. The frame's glass is the one blurred surface on a real
 * card; a grid of twenty-four skeletons blurring the page for the few hundred
 * milliseconds before the data arrives would be paying the card's whole
 * compositing cost for a placeholder. The surface colour is the frame's own, so
 * the shape and the tone still read as the card.
 *
 * The shimmer is BG-P07's: `--recess` with a highlight swept across it by the
 * `bgShimmer` keyframe, reduced-motion answered in both the style object and the
 * stylesheet. Nothing here re-implements it.
 */
export function GalleryCardSkeleton({ layout = "grid" }: { layout?: CardLayout }) {
  return (
    <div
      data-visual-slot="gallery-card-skeleton"
      data-card-layout={layout}
      aria-hidden
      style={{
        display: "flex",
        flexDirection: "column",
        background: t.cardFrame,
        borderRadius: r.card,
        ...elevation.flat,
        borderColor: t.glassBorder,
        padding: FRAME_PAD,
      }}
    >
      <div
        style={{
          background: t.cardThread,
          borderRadius: r.thread,
          padding: `${THREAD_PAD}px 0`,
        }}
      >
        <Skeleton
          style={{
            margin: `0 ${THREAD_PAD}px`,
            borderRadius: r.media,
            ...(layout === "feed"
              ? { aspectRatio: String(aspectOf(null).capped) }
              : { height: BODY_HEIGHT }),
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: CONTENT_PAD,
        }}
      >
        {/* The title, at its own line height so the block is the height two
            lines of the real title would take. */}
        <Skeleton style={{ height: TITLE_LINE, borderRadius: r.chip }} />
        <Skeleton style={{ height: TITLE_LINE, width: "62%", borderRadius: r.chip }} />
        {/* The plaque: one row, because its two halves are one object. */}
        <Skeleton style={{ height: 20, width: "78%", borderRadius: r.chip }} />
        <div style={{ display: "flex", gap: 6 }}>
          <Skeleton style={{ height: 22, width: 64, borderRadius: r.chip }} />
          <Skeleton style={{ height: 22, width: 48, borderRadius: r.chip }} />
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   The frame
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The card's outer element: one link, one blurred surface, one hairline.
 *
 * THE CARD'S ONLY `backdrop-filter` IS HERE. CardThread has none — the
 * never-nest rule in `buildgallery-theme`, which is not negotiable: a blurred
 * box inside a blurred frame is two compositing layers per card and twenty-four
 * cards make forty-eight.
 *
 * THE HOVER SHADOW IS ON A PSEUDO-ELEMENT, NOT ON THIS ELEMENT. `box-shadow` is
 * not a compositable property, so animating it repaints; the stylesheet's
 * `[data-visual-slot="gallery-card"]::after` carries the shadow and this
 * animates its OPACITY, which is. The 1px lift is a `transform`. Both are gated
 * behind `(hover: hover) and (pointer: fine)` so a touch reader never gets a
 * stuck hover state, and both are dropped under reduced motion.
 */
function Frame({
  to,
  shape,
  bounty,
  layout,
  children,
}: {
  to: string;
  shape: BuildShape;
  bounty: boolean;
  layout: CardLayout;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const lifted = hover && hoverIsFine() && !prefersReducedMotion();

  const edge: CSSProperties = bounty
    ? // A gap is an invitation, not a defect: the ordinary card shape with a
      // dashed edge, and the reward in words below the chips. No container.
      // The edge is GapMarker's, so the card and the node card and the panel
      // cannot drift to three different dashes (BG-P11).
      gapEdge("card")
    : {
        ...elevation.flat,
        borderColor: lifted ? t.glassHi : t.glassBorder,
      };

  return (
    <Link
      to={to}
      data-visual-slot="gallery-card"
      data-build-shape={shape}
      data-card-layout={layout}
      data-card-lifted={lifted ? "" : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        background: t.cardFrame,
        backdropFilter: GLASS_BLUR,
        WebkitBackdropFilter: GLASS_BLUR,
        borderRadius: r.card,
        ...edge,
        padding: FRAME_PAD,
        textDecoration: "none",
        color: t.text,
        transform: lifted ? "translateY(-1px)" : "translateY(0)",
        transition: prefersReducedMotion()
          ? "none"
          : `transform ${UI_MS}ms ${UI_EASING}, border-color ${UI_MS}ms ${UI_EASING}`,
      }}
    >
      {children}
    </Link>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   The rebuild count
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * "3 REBUILDS", riding at the end of the plaque. Absent at zero.
 *
 * NOT A THIRD TRUST SIGNAL, which is why it is a `trailing` child of the plaque
 * rather than a third member of it. "Nobody has run this yet" is a fact worth a
 * reader's attention before they spend an hour; "nobody has rebuilt this yet"
 * is not a warning about anything, and printing it on every card would put a
 * column of noughts down the page.
 */
function Rebuilds({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span
      data-testid="rebuild-count"
      title={`${count} ${count === 1 ? "build was" : "builds were"} started from this one.`}
      style={{
        ...chipType,
        ...tabular,
        display: "flex",
        alignItems: "center",
        gap: 4,
        flexShrink: 0,
        marginLeft: "auto",
        color: t.text2,
      }}
    >
      <BranchIcon size={11} colour="currentColor" />
      {count} {count === 1 ? "REBUILD" : "REBUILDS"}
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   The chips
   ──────────────────────────────────────────────────────────────────────────── */

/** How many roles fit before the rest become a "+N". */
const ROLES_SHOWN = 3;

/**
 * The part chips, on CategoryChip's measured pairs (BG-P11).
 *
 * A ROLE IS NOT A PART CATEGORY, which is why `made_for` resolves through the
 * fallback pair rather than being handed a hue: the nine hues mean something
 * specific and borrowing one for "for founders" would say this card was talking
 * about a configuration. PICKED is `evidence`, which is what it is.
 *
 * THE OVERFLOW CHIP IS NEW, and it is the one thing BG-P11 adds to this row
 * rather than repaints. The slice was always three; before this the fourth role
 * simply vanished, and a reader had no way to know the card was holding
 * anything back. "+2" is the smallest honest fix and it costs the row one chip.
 */
function Chips({ roles, promoted }: { roles: readonly string[]; promoted: boolean }) {
  const shown = roles.slice(0, ROLES_SHOWN);
  const overflow = Math.max(0, roles.length - ROLES_SHOWN);
  if (shown.length === 0 && !promoted) return null;

  return (
    <div
      data-card-part="chips"
      style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}
    >
      {promoted ? <CategoryChip category="evidence" label="PICKED" /> : null}
      {shown.map((role) => (
        <CategoryChip key={role} category={role} label={role} />
      ))}
      {overflow > 0 ? (
        <CategoryChip
          variant="overflow"
          count={overflow}
          title={roles.slice(ROLES_SHOWN).join(", ")}
        />
      ) : null}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   The open ask
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * "1 part unsolved · £120", or null (NS-P52, reworded by BG-P09's spec).
 *
 * The rows arrive on the card's own query, already filtered to open ones, so
 * this is a read rather than a fetch — see GALLERY_BOUNTY_COLUMNS. A build with
 * several open asks gets ONE line carrying the largest reward: the card is a
 * badge, not a board, and the biggest number is the one that decides whether a
 * reader clicks through to the rest.
 *
 * Null for a build with no open ask AND for one whose query never asked, which
 * is why `bounties` is optional on GalleryBuild rather than defaulted to empty.
 */
function openBounty(build: GalleryBuild): string | null {
  const open = (build.bounties ?? []).filter((row) => row.status === "open");
  if (open.length === 0) return null;

  let best: number | null = null;
  for (const row of open) {
    const amount =
      typeof row.reward_gbp === "number" ? row.reward_gbp : Number(row.reward_gbp);
    if (Number.isFinite(amount) && (best === null || amount > best)) best = amount;
  }

  // The theme's own words for this line: "1 part unsolved · £150". It replaces
  // the "bounty · £120" pill NS-P52 put here, because a gap has to read as an
  // INVITATION rather than as a badge — the build works, one piece is missing on
  // purpose, and naming the missing piece is what says so. An unpriced ask keeps
  // the invitation and drops the price: it is filed, it is on the board, and
  // somebody can solve it, which is the position bountyDisplay.ts already takes.
  const parts = open.length === 1 ? "1 part unsolved" : `${open.length} parts unsolved`;
  const money = rewardLabel(best);
  return money ? `${parts} · ${money}` : parts;
}
