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
// this card has to get right, and it is why the title spends `type.cardTitle` in
// full `--text` while everything around it is 13–16px of `--text2` and mono. A
// picture is always the first thing the eye lands on, so a title cannot win by
// position: it wins by face, size and contrast, and every other element under
// the box is deliberately quieter. (The face itself is named in `type.ts` and
// nowhere else, which type.test.ts sweeps for — a card that spelled out a
// family would be a card that could drift from the scale.)
//
// THE FIGURE THAT USED TO LEAD IS THE REPRODUCTION COUNT, and it still says the
// same thing: how many people who are not the creator ran the thing and said
// what happened. It is the only number on the platform that cannot be
// self-served — the database refuses a creator's reproduction of their own build
// — which is why it and the freshness line are one object, the PLAQUE, and why
// they are always together, always under the title, never in a footer.
//
// THE CONTENT ORDER UNDER THE BOX IS FIXED: title → credit → plaque → chips.
// BG-P09 moved all four from "under the media" to "on the frame under the box",
// which is a change of container and not of order. Nothing among them was added,
// removed or reordered.
//
// Styled with inline style objects, like every other surface on the new path:
// Tailwind's generated utilities win over hand-written classes at build time.

import { useMemo, useState, type CSSProperties, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { BranchIcon } from "@/components/build/BranchIcon";
import { categoryFill } from "@/lib/theme/category";
import { GLASS_BLUR, UI_EASING, UI_MS, hoverIsFine, prefersReducedMotion } from "@/lib/theme/controls";
import { elevation } from "@/lib/theme/elevation";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
// Roles by name, not the `type` object: this file uses inline `type X`
// import modifiers, which a value binding called `type` makes ambiguous.
import {
  body as bodyText,
  cardTitle,
  data as dataText,
  eyebrow as eyebrowText,
  tabular,
} from "@/lib/theme/type";
import {
  freshnessLabel,
  isStale,
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
import { CardThread, type CardLayout } from "./CardThread";
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

export interface GalleryCardProps {
  build: GalleryBuild;
  /** Signed once for the whole page, never per card. */
  srcByPath: MediaSrcMap;
  /**
   * "Rebuilt from Inbox triage agent by @amara", from rebuildCredit.ts.
   *
   * A PROP RATHER THAN SOMETHING THIS CARD WORKS OUT, because it cannot: the
   * columns it is composed from are not in GALLERY_BUILD_COLUMNS, and a card
   * that fetched them would issue one query per card. The page that lists the
   * builds composes the line once and hands it down.
   *
   * Absent on every build that is not a rebuild, and absent is the ordinary
   * case — nothing renders, and a card without one is the card that was here
   * before this prop existed.
   */
  credit?: string | null;
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

export function GalleryCard({
  build,
  srcByPath,
  credit,
  layout = "grid",
}: GalleryCardProps) {
  const Body =
    BODY_FOR_SHAPE[(build.shape ?? "other") as BuildShape] ?? DefaultCardBody;

  const shape = (build.shape ?? "other") as BuildShape;
  const count = build.reproduction_count ?? 0;
  const freshness = freshnessLabel(build);
  const stale = isStale(build);
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
             itself — findable, not loud. Composed by rebuildCredit.ts, which
             reads the two FROZEN snapshot columns so a credit cannot be revoked
             by the party being credited.

             NO CHANGE SUMMARY BESIDE IT, and that is a gap rather than a choice.
             The theme asks for "a machine-computed change summary in mono,
             prefixed Δ"; nothing in this codebase computes one — grep finds no
             such helper — and builds.rebuild_note is not it. That column is the
             rebuilder's own prose, which the feed already renders above the card
             in their voice, and mono never sets prose. Inventing a summary here
             would have put a sentence in the reader's way that no code stands
             behind. Whichever prompt computes it has one line to add. */}
        {credit ? (
          <p
            data-testid="gallery-card-credit"
            data-card-part="credit"
            title={credit}
            style={{
              ...bodyText,
              margin: 0,
              color: t.text2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {credit}
          </p>
        ) : null}

        {/* 3. THE PLAQUE: reproduction and freshness, together, one object. */}
        <Plaque
          count={count}
          freshness={freshness}
          stale={stale}
          rebuilds={build.rebuild_count ?? 0}
        />

        {/* 4. THE PART CHIPS. */}
        <Chips roles={build.made_for ?? []} promoted={promoted} bounty={bounty} />

        {/* An open ask's reward, in mono under the chips. No special container:
            the dashed edge on the frame is the whole treatment. */}
        {bounty ? (
          <p
            data-testid="gallery-card-bounty"
            data-card-part="reward"
            style={{ ...dataText, ...tabular, margin: 0, color: t.catBreakage }}
          >
            {bounty}
          </p>
        ) : null}
      </div>
    </Frame>
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
    ? {
        // A gap is an invitation, not a defect: the ordinary card shape with a
        // dashed edge, and the reward in words below the chips. No container.
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: t.catBreakage,
      }
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
   The plaque
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The two trust signals, as one object, under the title and above the chips.
 *
 * IMPOSSIBLE TO RENDER ONE WITHOUT THE OTHER, which is what the theme asks for:
 * they are two children of one element rather than two things a caller puts
 * where it likes. A build page and a card therefore cannot disagree about
 * whether a reader is entitled to both.
 *
 *   reproduction  an `--evidence-fill` tag with legal text on it: "41
 *                 reproduced". ZERO IS SHOWN, not hidden — "nobody yet" is a
 *                 real state a reader is entitled to, and suppressing it would
 *                 leave them unable to tell it from "we are not saying".
 *   freshness     an amber `--lit` OVAL LAMP plus mono text carrying the model:
 *                 "confirmed 3 days ago, on sonnet-4.5". Amber is light here and
 *                 never type, which is the one rule the colour contract states
 *                 twice; the words beside it are `--text2`.
 *
 * Three states. Healthy. Stale: the lamp dims to 45% and the text drops to
 * `--text2`, and the copy stays a gentle prompt — a build nobody has confirmed
 * lately has not failed, and the plaque must not read as though it had. Never
 * reproduced: "not yet reproduced", no lamp at all, because an unlit lamp and a
 * missing one say different things and only one of them is true.
 *
 * THE REBUILD COUNT RIDES WITH IT, absent at zero. "Nobody has run this yet" is
 * a fact worth a reader's attention before they spend an hour; "nobody has
 * rebuilt this yet" is not a warning about anything, and printing it on every
 * card would put a column of noughts down the page.
 */
function Plaque({
  count,
  freshness,
  stale,
  rebuilds,
}: {
  count: number;
  freshness: string | null;
  stale: boolean;
  rebuilds: number;
}) {
  const evidence = categoryFill("evidence");

  return (
    <div
      data-card-part="plaque"
      data-plaque-state={count === 0 ? "unreproduced" : stale ? "stale" : "healthy"}
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
      }}
    >
      <span
        data-plaque-reproduction=""
        title={
          count === 0
            ? "Nobody other than the creator has recorded running this yet."
            : `${count} ${count === 1 ? "person" : "people"} other than the creator ran this and said what happened.`
        }
        style={{
          ...dataText,
          ...tabular,
          flexShrink: 0,
          padding: "2px 8px",
          borderRadius: r.chip,
          // --evidence-fill with --text on it: 11.89:1 on Exhibition, and the
          // measured pair the contract names for this tag.
          background: evidence.background,
          color: t.text,
        }}
      >
        {count === 0 ? "not yet reproduced" : `${count} reproduced`}
      </span>

      <span
        data-plaque-freshness=""
        style={{
          ...dataText,
          display: "flex",
          alignItems: "center",
          gap: 6,
          minWidth: 0,
          color: t.text2,
        }}
      >
        {freshness ? <Lamp dim={stale} /> : null}
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {freshness ?? "not confirmed by anyone yet"}
        </span>
      </span>

      {rebuilds > 0 ? (
        <span
          data-testid="rebuild-count"
          title={`${rebuilds} ${rebuilds === 1 ? "build was" : "builds were"} started from this one.`}
          style={{
            ...dataText,
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
          {rebuilds} {rebuilds === 1 ? "REBUILD" : "REBUILDS"}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The lamp: an oval of `--lit`, dimmed to 45% when the claim has gone stale.
 *
 * An OVAL and not a circle, and 10×7 rather than 10×10, because the radius scale
 * keeps `--r-full` for genuinely circular objects and a lamp is a light rather
 * than a dot. `opacity` carries the stale state so the colour stays one token.
 */
function Lamp({ dim }: { dim: boolean }) {
  return (
    <span
      aria-hidden
      data-plaque-lamp={dim ? "dim" : "lit"}
      style={{
        flexShrink: 0,
        width: 10,
        height: 7,
        borderRadius: "50% / 50%",
        background: t.lit,
        opacity: dim ? 0.45 : 1,
      }}
    />
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   The chips
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The part chips, in `categoryFill`'s measured pairs (BG-P05).
 *
 * A ROLE IS NOT A PART CATEGORY, which is why `made_for` resolves through the
 * fallback pair rather than being handed a hue: the nine hues mean something
 * specific and borrowing one for "for founders" would say this card was talking
 * about a configuration. PICKED keeps `--evidence`, which is what it is.
 */
function Chips({
  roles,
  promoted,
  bounty,
}: {
  roles: readonly string[];
  promoted: boolean;
  bounty: string | null;
}) {
  const shown = roles.slice(0, 3);
  if (shown.length === 0 && !promoted && !bounty) return null;

  const fallback = categoryFill("__none__");

  return (
    <div
      data-card-part="chips"
      style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}
    >
      {promoted ? (
        <span
          style={{
            ...eyebrowText,
            padding: "2px 7px",
            borderRadius: r.chip,
            background: categoryFill("evidence").background,
            color: t.evidence,
          }}
        >
          PICKED
        </span>
      ) : null}
      {shown.map((role) => (
        <span
          key={role}
          style={{
            ...dataText,
            padding: "2px 7px",
            borderRadius: r.chip,
            background: fallback.background,
            color: fallback.color,
          }}
        >
          {role}
        </span>
      ))}
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
