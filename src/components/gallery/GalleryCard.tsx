// One build, as a card: the reference card, on a real build (UI-P14).
//
// THIS FILE READS A `GalleryBuild` AND HANDS THE PIECES TO `BuildCard`, which
// draws them. The card is ONE SURFACE now — a picture lamp over a single glass
// card, a cover, then the record — where it used to be a blurred frame with a
// lighter thread box inset in it. The two layers' tokens (`--card-frame`,
// `--card-thread`) survive for CardThread's feed layout and are retired with the
// old frame in UI-P41; see the note in `semantics.ts`.
//
// THE ORDER IS FIXED: lamp → cover (with the shape tag) → title → credit and Δ →
// plaque → part chips → open ask. BuildCard's own header says why it cannot be
// rendered any other way.
//
// WHAT THE CARD READS, UNCHANGED. The props are the ones this card has always
// taken, and so is the data: the cover is `coverMedia(build)` signed by the
// page (`resolveCover()` first, the creator's own pick above everything), else
// the `CoverFallback` sky seeded with the build id; the chips are the part
// categories of the nodes the card's query already carries; the open ask is the
// largest open bounty on it. Nothing here adds a request.
//
// WHERE THE DESIGN OUTRUNS THE DATA, and what the card does instead:
//
//   by {maker}      a card is not handed its maker's handle (GalleryBuild has
//                   `creator_id` and nothing to resolve it), so a build that is
//                   not a rebuild shows no credit line, as before. A rebuild's
//                   line is the one the platform guarantees — "Rebuilt from
//                   *source* by @handle", composed from the two frozen fork
//                   columns, which is why it survives its source being deleted.
//   Δ summary       needs BOTH whole records — this build's and its source's —
//                   and a grid of twenty-four cards cannot read forty-eight. A
//                   stored summary column would fix it; until there is one the
//                   card leaves `delta` absent rather than guess, which
//                   BuildCard renders as nothing, not as "nothing changed".
//   cover height    92, the gallery wall's. A page that wants its own (profile
//                   works 86, a single column 120–150) renders `BuildCard`
//                   directly with the pieces this file builds.
//
// UI-P49 — THE ROW. `layout="row"` is the Gallery feed's card: one build per
// row, full width, a 2:1 cover, the title drawn at 24, the outcome under it (the one
// addition to the order, from the concept, not yet confirmed), "by @handle ·
// made with …", the plaque, the chips and the open ask. It is drawn by `RowCard`
// below rather than `BuildCard`, because its credit carries a link to the
// maker's profile and a link cannot sit inside the card's own link: the title
// is the link, and its box is stretched over the card. The handle is
// `makerHandle`, which only the feed has (UI-P44b's creatorHandle); `plaqueBuild`
// lets the plaque and the lamp speak for one model (plaqueBuildFor).
//
// THE FEED KEEPS ITS THREAD. A feed card whose creator arranged a post still
// unfolds in place: `CardThread` takes the cover's place inside the same card,
// with no fixed height. Every other card has the cover.
//
// Styled with inline style objects, like every other surface on the new path:
// Tailwind's generated utilities win over hand-written classes at build time.

import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BuildCard, CardCredit, COVER_HEIGHT, type BuildCardTitleSize } from "@/components/brand/BuildCard";
import { CategoryChip } from "@/components/brand/CategoryChip";
import { CoverFallback } from "@/components/brand/CoverFallback";
import { gapEdge } from "@/components/brand/GapMarker";
import { PictureLamp } from "@/components/brand/PictureLamp";
import { Plaque, plaqueState, type PlaqueBuild } from "@/components/brand/Plaque";
import { BranchIcon } from "@/components/build/BranchIcon";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { modelLabel } from "@/lib/models/registry";
import { chipType, hoverIsFine } from "@/lib/theme/controls";
import { feedback } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
// Roles by name, not the `type` object: this file uses inline `type X`
// import modifiers, which a value binding called `type` makes ambiguous.
import { display, DM_MONO, FIGTREE, tabular } from "@/lib/theme/type";
import {
  aspectOf,
  partCategories,
  type BuildShape,
  type GalleryBuild,
  type GalleryMedia,
} from "@/lib/build";
import { rewardLabel } from "@/components/bounty/bountyDisplay";
import { Skeleton } from "@/components/ui/skeleton";
import { CardThread, type CardLayout } from "./CardThread";
import { coverMedia, mediaAlt, postMediaOf, stillFor, type MediaSrcMap } from "./cardMedia";
import { EngagementRow, type RowEngagement } from "@/components/social/EngagementRow";

/** The cover's height on the gallery wall. */
const COVER_PX = COVER_HEIGHT.wall;

/** The body under the cover, in skeleton lines: title, credit, plaque, chips. 20 before the UI-P56 density pass. */
const TITLE_LINE = 16;

export interface GalleryCardProps {
  build: GalleryBuild;
  /** Signed once for the whole page, never per card. */
  srcByPath: MediaSrcMap;
  /**
   * THE ONE MEMBER BG-P09 ADDED, and it defaults so that every existing call
   * site is unchanged.
   *
   *   grid  the gallery. One fixed cover, no entry text, no unfold.
   *   feed  the Builds tab (BG-P18 switches it). Entries at their own shapes,
   *         text above each picture, unfolding in place.
   *
   * Unfold state is internal to the card and is not a prop: a list that owned it
   * would have to be told about a thread, and BG-P18's list has no business
   * knowing what is inside a card.
   *
   *   row   UI-P49: the Gallery feed's card, one build per row (see RowCard).
   */
  layout?: CardLayout | "row";
  /** UI-P49: the maker's handle, without its @ (the feed's creatorHandle). Row layout only. */
  makerHandle?: string | null;
  /** UI-P49: the build's models_used, as stored. Row layout only. */
  modelsUsed?: readonly string[];
  /**
   * UI-P49: the record the plaque and the lamp read, when it is not the build's
   * own figures — `plaqueBuildFor(build, proof)` for a chosen model. Row layout only.
   */
  plaqueBuild?: PlaqueBuild;
  /** Frozen "now", for a fixture or a test. Row layout only. */
  now?: number;
  /**
   * RC-P16 — the engagement row: this card's counts and whether the reader
   * likes and has saved it, from the one useEngagement call its list makes.
   *
   * OPTIONAL, AND ABSENT MEANS NO ROW. The lists of published builds — the
   * Gallery, Home's feed and where next — pass it; the composer's previews of a
   * draft do not, because a draft is nothing a reader can like or save.
   */
  engagement?: RowEngagement;
  /**
   * UI-P28: the cover's height and the title's size where the card stands. The
   * defaults are the gallery wall's (92 and 19); a phone's two-column wall is 96
   * and 18, and nothing else changes with them.
   */
  coverHeight?: number;
  titleSize?: BuildCardTitleSize;
}

export function GalleryCard({
  build,
  srcByPath,
  layout = "grid",
  engagement,
  coverHeight = COVER_PX,
  titleSize,
  makerHandle,
  modelsUsed,
  plaqueBuild,
  now,
}: GalleryCardProps) {
  if (layout === "row") {
    return (
      <RowCard
        build={build}
        srcByPath={srcByPath}
        makerHandle={makerHandle ?? null}
        modelsUsed={modelsUsed ?? []}
        plaqueBuild={plaqueBuild ?? build}
        now={now}
      />
    );
  }
  return (
    <WallCard
      build={build}
      srcByPath={srcByPath}
      layout={layout}
      engagement={engagement}
      coverHeight={coverHeight}
      titleSize={titleSize}
    />
  );
}

function WallCard({
  build,
  srcByPath,
  layout,
  engagement,
  coverHeight,
  titleSize,
}: Required<Pick<GalleryCardProps, "build" | "srcByPath" | "coverHeight">> &
  Pick<GalleryCardProps, "engagement" | "titleSize"> & { layout: CardLayout }) {
  const shape = (build.shape ?? "other") as BuildShape;
  const bounty = openBounty(build);

  // postEntriesOf over rows the page already has; see postMediaOf. Memoised
  // because it sorts, and a feed re-renders its items on every scroll tick.
  const entries = useMemo(() => postMediaOf(build), [build]);

  // A feed card whose creator never arranged a post has nothing to unfold, so it
  // draws the cover: the guarantee that no card is ever empty outranks the
  // layout it was asked for.
  const threaded = layout === "feed" && entries.length > 0;

  const altFor = (media: GalleryMedia) => mediaAlt(build, media);
  const title = (build.title ?? "").trim() || "Untitled build";
  const rebuiltFrom = (build.source_title_at_fork ?? "").trim();
  const sourceHandle = (build.source_handle_at_fork ?? "").trim();

  return (
    <BuildCard
      to={`/b2/${build.slug}`}
      title={title}
      shape={build.shape}
      shapeKey={shape}
      layout={layout}
      cover={<Cover build={build} srcByPath={srcByPath} />}
      coverHeight={coverHeight}
      titleSize={titleSize}
      media={
        threaded ? (
          <CardThread
            entries={entries}
            srcByPath={srcByPath}
            layout="feed"
            shape={shape}
            altFor={altFor}
            resetKey={build.id}
          />
        ) : undefined
      }
      credit={rebuiltFrom ? <CardCredit rebuiltFrom={rebuiltFrom} by={sourceHandle ? `@${sourceHandle}` : null} /> : null}
      build={build}
      plaqueTrailing={<Rebuilds count={build.rebuild_count ?? 0} />}
      categories={partCategories(build.nodes)}
      openAsk={bounty}
      gap={Boolean(bounty)}
      footer={
        engagement ? (
          // RC-P16 — THE ENGAGEMENT ROW, the one addition CONTRACT §3.5
          // sanctions: a NEW last element, with every item above it where it
          // was. Its presses stay off this card's link.
          <EngagementRow
            variant="card"
            build={{ id: build.id, slug: build.slug, title: build.title }}
            counts={engagement.counts}
            liked={engagement.liked}
            saved={engagement.saved}
          />
        ) : null
      }
    />
  );
}

/**
 * The cover: the build's own picture, else its sky.
 *
 * `coverMedia` is `resolveCover()` first — the creator's explicit pick above
 * anything a card would choose for itself — with the node-derived answers as the
 * fallback. A picture that has not been signed yet is the same branch as a build
 * with none: the sky is drawn, so a card is never empty while signatures are in
 * flight. The picture's alt is the caption the creator wrote, else "title — kind"
 * (`mediaAlt`); the link's own name is the title, by `aria-labelledby`.
 */
function Cover({ build, srcByPath }: { build: GalleryBuild; srcByPath: MediaSrcMap }) {
  const media = coverMedia(build);
  const src = stillFor(srcByPath, media);
  if (!src) return <CoverFallback seed={build.id} radius={0} />;
  return (
    <img
      src={src}
      alt={mediaAlt(build, media)}
      loading="lazy"
      decoding="async"
      style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   The row (UI-P49)
   ──────────────────────────────────────────────────────────────────────────── */

/** "Sonnet 5.5 + Opus 5.5": each stored model by its registry name, in order, without repeats. */
function madeWithLine(models: readonly string[]): string {
  const names: string[] = [];
  for (const raw of models) {
    const name = modelLabel(raw);
    if (name && !names.includes(name)) names.push(name);
  }
  return names.join(" + ");
}

/**
 * The feed's card. The existing card surface (a fill, a 1px border, the card
 * shadow, no blur: RULES §7b) at padding 9/9/13, radius 14, gap 10, under its
 * picture lamp (12/12/18 and 14 before the UI-P56 density pass; type and spacing
 * through the table, the 2:1 cover and the order unchanged). The title's link is
 * stretched over the whole card, so the card is still one target, while the
 * maker's profile link rides above it.
 */
function RowCard({
  build,
  srcByPath,
  makerHandle,
  modelsUsed,
  plaqueBuild,
  now,
}: {
  build: GalleryBuild;
  srcByPath: MediaSrcMap;
  makerHandle: string | null;
  modelsUsed: readonly string[];
  plaqueBuild: PlaqueBuild;
  now?: number;
}) {
  const titleId = `row-title-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [hover, setHover] = useState(false);
  const lit = hover && hoverIsFine();
  /* The title is drawn at 24 in the desktop column and 22 in a phone's; display() renders them 20 and 19. */
  const phone = useIsPhone();

  const bounty = openBounty(build);
  const title = (build.title ?? "").trim() || "Untitled build";
  const outcome = (build.outcome ?? "").trim();
  const handle = (makerHandle ?? "").trim();
  const models = madeWithLine(modelsUsed);
  const rebuiltFrom = (build.source_title_at_fork ?? "").trim();
  const sourceHandle = (build.source_handle_at_fork ?? "").trim();
  const chips = partCategories(build.nodes);

  return (
    <div data-ui="build-card" data-card-layout="row" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <PictureLamp state={plaqueState(plaqueBuild, now)} />
      <article
        aria-labelledby={titleId}
        data-visual-slot="gallery-card"
        data-build-shape={build.shape ?? "other"}
        data-card-layout="row"
        data-gap={bounty ? "" : undefined}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          width: "100%",
          padding: "9px 9px 13px",
          boxSizing: "border-box",
          background: t.glass,
          borderRadius: r.card,
          boxShadow: t.shadowCard,
          color: t.text,
          ...(bounty
            ? gapEdge("card")
            : { borderWidth: 1, borderStyle: "solid", borderColor: lit ? t.text2 : t.glassBorder }),
          transition: feedback("border-color"),
        }}
      >
        <div
          data-card-part="cover"
          style={{ position: "relative", aspectRatio: "2 / 1", borderRadius: r.media, overflow: "hidden" }}
        >
          <Cover build={build} srcByPath={srcByPath} />
          {build.shape ? (
            <span
              data-ui="shape-tag"
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                background: t.mediaTag,
                color: t.text,
                fontFamily: DM_MONO,
                fontSize: 11,
                lineHeight: "normal",
                padding: "2px 4px",
                borderRadius: r.chip,
              }}
            >
              {build.shape}
            </span>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0, padding: "0 4px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <h3 id={titleId} data-card-part="title" style={{ ...display(phone ? 22 : 24), textWrap: "balance", margin: 0, color: t.text }}>
              <Link to={`/b2/${build.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                {/* The stretched box: the whole card is this link's target. */}
                <span aria-hidden="true" style={{ position: "absolute", inset: 0, borderRadius: r.card }} />
                {title}
              </Link>
            </h3>
            {outcome ? (
              <p
                data-card-part="description"
                style={{
                  margin: 0,
                  fontFamily: FIGTREE,
                  fontSize: 15,
                  lineHeight: 1.45,
                  color: t.text2,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {outcome}
              </p>
            ) : null}
          </div>

          {handle || models || rebuiltFrom ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              {handle || models ? (
                <div
                  data-card-part="credit"
                  data-testid="row-credit"
                  style={{ fontFamily: FIGTREE, fontSize: 13, lineHeight: 1.45, color: t.text2 }}
                >
                  {handle ? (
                    <>
                      by{" "}
                      <Link
                        to={`/profile/${encodeURIComponent(handle)}`}
                        style={{ position: "relative", zIndex: 1, color: t.text2, textDecoration: "underline", textUnderlineOffset: 2 }}
                      >
                        @{handle}
                      </Link>
                    </>
                  ) : null}
                  {models ? (
                    <>
                      {handle ? " · made with " : "Made with "}
                      <span style={{ fontFamily: DM_MONO, fontSize: 12, color: t.text }}>{models}</span>
                    </>
                  ) : null}
                </div>
              ) : null}
              {rebuiltFrom ? <CardCredit rebuiltFrom={rebuiltFrom} by={sourceHandle ? `@${sourceHandle}` : null} /> : null}
            </div>
          ) : null}

          <Plaque build={plaqueBuild} size="card" trailing={<Rebuilds count={build.rebuild_count ?? 0} />} now={now} />

          {chips.length > 0 ? (
            <div data-card-part="chips" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {chips.map((category) => (
                <CategoryChip key={category} category={category} label={category} />
              ))}
            </div>
          ) : null}

          {bounty ? (
            <p
              data-visual-slot="gap-marker"
              data-testid="gallery-card-bounty"
              data-gap-placement="card"
              data-card-part="reward"
              style={{
                margin: 0,
                fontFamily: DM_MONO,
                fontSize: 11,
                lineHeight: "normal",
                color: t.catBreakage,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {bounty}
            </p>
          ) : null}
        </div>
      </article>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   The skeleton
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The card's shape before the card exists.
 *
 * THE SAME PROPORTIONS, NOT AN APPROXIMATION OF THEM: an 18px lamp spacer, the
 * card's 5px of padding and gap (7 before the UI-P56 density pass, as BuildCard),
 * the cover's height, and a body of the same lines, so the swap when the data
 * lands moves nothing. In feed layout the media
 * block reserves its height with `aspect-ratio` at `aspectOf(null).capped`, the
 * ratio the real card uses for a row whose dimensions it does not know yet.
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
      style={{ display: "flex", flexDirection: "column", minWidth: 0 }}
    >
      <div style={{ height: 18 }} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 5,
          padding: 5,
          background: t.glass,
          borderRadius: r.card,
          border: `1px solid ${t.glassBorder}`,
          boxSizing: "border-box",
        }}
      >
        <Skeleton
          style={{
            borderRadius: r.media,
            ...(layout === "feed" ? { aspectRatio: String(aspectOf(null).capped) } : { height: COVER_PX }),
          }}
        />
        <div style={{ padding: "0 5px 5px", display: "flex", flexDirection: "column", gap: 4 }}>
          <Skeleton style={{ height: TITLE_LINE, width: "70%", borderRadius: r.chip }} />
          {/* The plaque: one row, because its two halves are one object. */}
          <Skeleton style={{ height: 18, width: "78%", borderRadius: r.chip }} />
          <div style={{ display: "flex", gap: 4 }}>
            <Skeleton style={{ height: 16, width: 64, borderRadius: r.chip }} />
            <Skeleton style={{ height: 16, width: 48, borderRadius: r.chip }} />
          </div>
          {/* RC-P16 — the engagement row's 44px, so the card that replaces this
              placeholder does not grow on arrival. */}
          <div style={{ height: 44, display: "flex", alignItems: "center" }}>
            <Skeleton style={{ height: 18, width: 132, borderRadius: r.chip }} />
          </div>
        </div>
      </div>
    </div>
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
