// The thread box: a tweet in miniature, inset in the card's frame.
//
// TWO LAYERS, ONE CARD (BG-P09). GalleryCard is the FRAME — the record, glass,
// one step darker, carrying the title and everything under it. This is the BOX
// inset in it — the post, one step lighter, holding text-above-media entries.
// The whole structure is carried by the tonal step between the two surfaces
// (law-of-common-region): the box groups the post, the frame groups the record,
// and a reader who can see the step does not need a label for either.
//
// THE BOX IS NEVER BLURRED. The frame carries the card's one backdrop-filter and
// this file contains none — `buildgallery-theme`'s never-nest rule, which is not
// a preference. A blurred box inside a blurred frame inside a blurred shell is
// three stacked compositing layers per card, twenty-four times over, and that is
// what made the previous shell slow.
//
// WHAT AN ENTRY IS. `postEntriesOf` (src/lib/build/cover.ts) is the one place
// the rule lives: entry 0's text is the build's description unless the creator
// overrode it, and every later entry carries its own words or none. This file
// renders what that resolver returns and decides nothing about the text itself,
// so the card, BG-P23's composer preview and the build page cannot drift.
//
// TWO LAYOUTS, ONE COMPONENT.
//
//   feed  entries at their own shape, text above each picture, unfolding in
//         place. Heights come from the STORED dimensions of each picture, so
//         the box is the right height before a single image has loaded.
//   grid  the shape body the gallery has always rendered, in its fixed slot,
//         with no text and no unfold. A gallery cell is 300px wide: a column of
//         four pictures at their own ratios would be a column of stamps, and the
//         description already sits under the title where the grid can read it.
//
// The branch is in three places and nowhere else — the text, the media slot and
// the control row — which is what keeps them one component rather than two that
// look alike for a while.
//
// NO LAYOUT SHIFT, EVER. Every media slot reserves its height with
// `aspect-ratio` from build_media.width/height before its bytes are asked for.
// Nothing here measures a rendered element to decide a height, and nothing waits
// for `onLoad` to size anything: a card that settles as its pictures arrive is
// the failure this rule exists to prevent, and on a feed it moves the text the
// reader is in the middle of.
//
// Styled with inline style objects, like every other surface on the new path:
// Tailwind's generated utilities win over hand-written classes at build time.

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { aspectOf, type GalleryMedia, type PostEntry } from "@/lib/build";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { UI_EASING, prefersReducedMotion } from "@/lib/theme/controls";
import { body as bodyText, data as dataText, tabular } from "@/lib/theme/type";
import { stillFor, type MediaSrcMap } from "./cardMedia";

/* ────────────────────────────────────────────────────────────────────────────
   The measurements. Every one of them is a number this file needs twice — once
   to draw with and once to reserve height with — so none of them is written
   inline at a call site.
   ──────────────────────────────────────────────────────────────────────────── */

/** The box's own padding. The rail lives in the left one. */
export const THREAD_PAD = 16;

/** Between an entry's words and its picture. */
export const TEXT_TO_MEDIA = 12;

/** Between one entry and the next, above and below the hairline. */
export const ENTRY_GAP = 16;

/** The unfold control's row. A 40px target, which is the kit's list-row height. */
export const CONTROL_HEIGHT = 40;

/** The rail: 2px of --line, centred in the box's left padding. */
export const RAIL_WIDTH = 2;

/** The one animated moment on the card. */
export const UNFOLD_MS = 240;

/**
 * Which of the two the card is drawing.
 *
 * Feed sizes every picture from its own stored dimensions; grid keeps the fixed
 * `BODY_HEIGHT` letterbox the gallery has always used, because a gallery cell is
 * ~300px wide and a column of four pictures at their own ratios is a column of
 * stamps.
 */
export type CardLayout = "feed" | "grid";

export interface CardThreadProps {
  /**
   * The post, from `postEntriesOf`. Empty for a build whose creator never
   * arranged one, which is nearly every build today.
   */
  entries: readonly PostEntry<GalleryMedia>[];
  /** Signed once for the whole page, never per card. A miss means "not yet". */
  srcByPath: MediaSrcMap;
  layout: CardLayout;
  /** The shape tag's words, over the first entry's top-left corner only. */
  shape: string;
  /**
   * What a screen reader is told about one picture.
   *
   * A FUNCTION RATHER THAN THE BUILD ROW, so this component never needs to know
   * what a GalleryBuild is. BG-P23's composer preview will feed it entries from
   * a draft that is not one, and a prop typed to the gallery's row shape would
   * have made that a rewrite instead of a call.
   */
  altFor: (media: GalleryMedia) => string;
  /**
   * Grid layout only: the shape body the card has always rendered.
   *
   * The gallery's fixed slot is not a picture this file can resolve — it may be
   * a live app in an iframe, a prompt, a comparison table or a variant grid, and
   * the chain that picks between them is cardBodies.tsx's business. So grid mode
   * renders what it is handed, inside the box, and the guarantee that every card
   * has SOMETHING in it stays where it was written.
   */
  gridBody?: ReactNode;
  /**
   * Resets the unfold when the card is pointed at a different build.
   *
   * A feed list that reuses a card's element for the next build — a keyed list
   * whose key changed, a virtualiser recycling a row — would otherwise show the
   * new build's post already open because the old one was.
   */
  resetKey?: string;
}

/* ────────────────────────────────────────────────────────────────────────────
   Reserved height, as arithmetic

   THE FORMULAE THE PROMPT ASKS FOR, and the reason they are exported: BG-P18
   puts this card in a feed list, and a list that wants to know how tall a row
   will be before it renders it must be able to ask without mounting anything.
   Both answers are a function of the STORED dimensions and the box's width —
   no measurement, no loaded image, no DOM.

   They are not what drives the unfold animation; see `UnfoldRegion` for what is
   and why. They are the statement of the same heights in arithmetic, which is
   what makes "collapsed and unfolded heights are computable before any image
   loads" a fact a test can check rather than a claim about an implementation.

   TEXT IS NOT IN THEM. A paragraph's height depends on the font, the wrap and
   the reader's own text-size setting, none of which is stored on the row. So
   these measure the part that CAN move a card as it loads — the pictures — and
   name the rest as the caller's business. That is the honest boundary: an
   over-confident formula that guessed at text would be wrong on the first
   reader who runs their browser at 20px.
   ──────────────────────────────────────────────────────────────────────────── */

/** One picture's reserved height in a box of this width, from stored pixels. */
export function reservedMediaHeight(
  media: Pick<GalleryMedia, "width" | "height">,
  boxWidth: number
): number {
  const contentWidth = Math.max(0, boxWidth - THREAD_PAD * 2);
  return contentWidth / aspectOf(media).capped;
}

/**
 * What the box reserves for its pictures, collapsed and unfolded.
 *
 * `collapsed` is entry 0 alone plus the control row when there is one to show;
 * `unfolded` adds every later entry and the gaps between them. In grid layout
 * both are the fixed slot, because that is what grid renders.
 */
export function threadReserve(
  entries: readonly PostEntry<GalleryMedia>[],
  layout: CardLayout,
  boxWidth: number,
  fixedSlotHeight: number
): { collapsed: number; unfolded: number } {
  if (layout === "grid" || entries.length === 0) {
    const fixed = fixedSlotHeight + THREAD_PAD * 2;
    return { collapsed: fixed, unfolded: fixed };
  }

  const media = entries.map((entry) => reservedMediaHeight(entry.media, boxWidth));
  const control = entries.length > 1 ? CONTROL_HEIGHT : 0;

  const collapsed = THREAD_PAD * 2 + media[0] + control;
  const unfolded =
    THREAD_PAD * 2 +
    media.reduce((sum, height) => sum + height, 0) +
    ENTRY_GAP * 2 * (entries.length - 1) +
    control;

  return { collapsed, unfolded };
}

/* ────────────────────────────────────────────────────────────────────────────
   The box
   ──────────────────────────────────────────────────────────────────────────── */

export function CardThread({
  entries,
  srcByPath,
  layout,
  shape,
  altFor,
  gridBody,
  resetKey,
}: CardThreadProps) {
  const [unfolded, setUnfolded] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const regionId = useId();

  // Pointed at a different build: the previous build's unfold is not this
  // build's state. An effect rather than a key on the caller's side, because
  // the card's props API gained exactly one member and this is internal.
  useEffect(() => {
    setUnfolded(false);
  }, [resetKey]);

  const first = entries[0] ?? null;
  const rest = entries.slice(1);
  const foldable = layout === "feed" && entries.length > 1;

  const collapse = () => {
    // A card whose top has scrolled above the viewport is about to get shorter
    // under the reader's eyes, which drops them into the middle of a page they
    // did not scroll to. Put its top back on screen first.
    const top = boxRef.current?.closest("[data-visual-slot='gallery-card']");
    const above = top ? top.getBoundingClientRect().top < 0 : false;
    setUnfolded(false);
    if (top && above) {
      top.scrollIntoView({
        block: "start",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    }
  };

  return (
    <div
      ref={boxRef}
      data-visual-slot="card-thread"
      data-thread-layout={layout}
      data-thread-unfolded={unfolded ? "" : undefined}
      style={{
        // --card-thread over the frame's --card-frame: the step that makes the
        // box a region rather than a rectangle. No border and no blur; the tone
        // is doing the work and the frame owns the card's only glass.
        background: t.cardThread,
        borderRadius: r.thread,
        padding: `${THREAD_PAD}px 0`,
        overflow: "hidden",
        // A containing block for the shape tag and the rail, both of which are
        // positioned against the box rather than against a picture.
        position: "relative",
      }}
    >
      {layout === "grid" ? (
        <div style={{ padding: `0 ${THREAD_PAD}px` }}>
          {gridBody}
          {entries.length > 1 ? <CountChip total={entries.length} /> : null}
        </div>
      ) : first ? (
        <>
          {/* Entry 0 always renders. Everything below it unfolds. */}
          <EntryText text={first.text} />
          <div style={{ position: "relative" }}>
            <EntryMedia
              entry={first}
              srcByPath={srcByPath}
              altFor={altFor}
              shape={shape}
              first
            />
            <UnfoldRegion open={unfolded} id={regionId}>
              {rest.map((entry) => (
                <div
                  key={entry.media.id}
                  data-thread-entry={entry.position}
                  style={{
                    marginTop: ENTRY_GAP,
                    paddingTop: ENTRY_GAP,
                    borderTop: `1px solid ${t.line}`,
                  }}
                >
                  <EntryText text={entry.text} />
                  <EntryMedia
                    entry={entry}
                    srcByPath={srcByPath}
                    altFor={altFor}
                    shape={shape}
                  />
                </div>
              ))}
            </UnfoldRegion>
            {/* The rail spans the pictures, not the words above the first one:
                it is the thread's spine, and a spine that started above the
                first picture would point at nothing. */}
            {unfolded && rest.length > 0 ? <Rail /> : null}
          </div>
          {foldable ? (
            <UnfoldControl
              open={unfolded}
              more={rest.length}
              controls={regionId}
              onOpen={() => setUnfolded(true)}
              onClose={collapse}
            />
          ) : null}
        </>
      ) : (
        // No post and no fixed body: the frame's own title and plaque carry the
        // card. --recess rather than a blank box, so the space reads as an inset
        // surface with nothing in it rather than as something that failed.
        <div
          data-thread-empty=""
          style={{
            margin: `0 ${THREAD_PAD}px`,
            borderRadius: r.media,
            background: t.recess,
            minHeight: 4,
          }}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   The pieces
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * An entry's words. Absent text collapses to nothing and the picture takes the
 * top padding, which is what makes a picture-only entry look deliberate.
 */
function EntryText({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p
      data-thread-text=""
      style={{
        ...bodyText,
        // No top margin of its own in either position: entry 0 sits on the box's
        // own 16px top padding, and a later entry sits on the 16px its hairline
        // already provided. 12px below, above the picture.
        margin: 0,
        padding: `0 ${THREAD_PAD}px ${TEXT_TO_MEDIA}px`,
        color: t.text,
      }}
    >
      {text}
    </p>
  );
}

/**
 * One picture or video, at the shape the record says it is.
 *
 * `aspect-ratio` from the stored pixels IS the reservation: the browser knows
 * the slot's height from the first layout pass, before the bytes are asked for,
 * so nothing moves when they land. A row with no stored dimensions gets
 * `aspectOf`'s 3:2 assumption, which is inside the capped range and so is never
 * reported as a crop.
 *
 * `objectFit: cover` is what makes the cap a CROP rather than a squeeze: a 5:1
 * panorama is framed at 2:1 and shows its middle; a 1:3 portrait is framed at
 * 3:4 and shows its centre.
 */
function EntryMedia({
  entry,
  srcByPath,
  altFor,
  shape,
  first = false,
}: {
  entry: PostEntry<GalleryMedia>;
  srcByPath: MediaSrcMap;
  altFor: (media: GalleryMedia) => string;
  shape: string;
  first?: boolean;
}) {
  const media = entry.media;
  const aspect = aspectOf(media);
  const src = stillFor(srcByPath, media);
  const video = media.kind === "video";

  const fill: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  };

  return (
    <div
      data-thread-media={entry.position}
      data-thread-cropped={aspect.cropped ? "" : undefined}
      style={{
        position: "relative",
        margin: `0 ${THREAD_PAD}px`,
        // The reservation. Never a measured height, never a height that waits.
        aspectRatio: String(aspect.capped),
        borderRadius: r.media,
        overflow: "hidden",
        background: t.recess,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={altFor(media)}
          loading="lazy"
          decoding="async"
          style={fill}
        />
      ) : null}
      {video ? <PlayAffordance /> : null}
      {video ? <DurationChip seconds={media.duration ?? null} /> : null}
      {first ? <ShapeTag shape={shape} /> : null}
    </div>
  );
}

/**
 * The shape, over the first picture's top-left corner and nowhere else.
 *
 * One tag per card, not one per entry: it says what KIND of build this is, which
 * is a fact about the record rather than about any one picture, and repeating it
 * down a thread would read as a caption that had lost its caption.
 */
function ShapeTag({ shape }: { shape: string }) {
  return (
    <span
      data-thread-shape=""
      style={{
        ...dataText,
        position: "absolute",
        top: 8,
        left: 8,
        padding: "2px 7px",
        borderRadius: r.chip,
        background: t.glass2,
        color: t.text,
        textTransform: "lowercase",
      }}
    >
      {shape}
    </span>
  );
}

/**
 * "1/4", top-right, in grid layout only.
 *
 * The grid shows one picture of a post that has several, and a reader who is not
 * told that reads the cover as the whole thing. It is the count and not a
 * carousel: a gallery cell is a picture of a build, and paging through it here
 * would be a control competing with the card's own link.
 */
function CountChip({ total }: { total: number }) {
  return (
    <span
      data-thread-count=""
      style={{
        ...dataText,
        ...tabular,
        position: "absolute",
        top: THREAD_PAD + 8,
        right: THREAD_PAD + 8,
        padding: "2px 7px",
        borderRadius: r.chip,
        background: t.glass2,
        color: t.text,
      }}
    >
      1/{total}
    </span>
  );
}

/**
 * The play mark. A rounded square at `--r-control`, NOT a disc.
 *
 * Nothing on this card is the scale's circular step: that step is reserved for
 * genuinely circular objects, and the previous card's 50% disc was the shape
 * language this series replaced. Decoration for a screen reader — the picture beneath already
 * carries the description, and the card is a link to the build rather than a
 * player, so announcing it would promise something the card does not do.
 */
function PlayAffordance() {
  return (
    <span
      aria-hidden
      data-card-mark="play"
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 48,
        height: 48,
        borderRadius: r.control,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // --glass-2 as a FILL, not as a blur: the box carries no backdrop-filter
        // and a play mark is not the place to open the card's second one.
        background: t.glass2,
      }}
    >
      <span
        style={{
          // A triangle drawn in borders rather than a glyph, so it is the same
          // shape at every font stack. Nudged right, because a triangle's
          // optical centre sits left of its box.
          width: 0,
          height: 0,
          marginLeft: 3,
          borderTop: "9px solid transparent",
          borderBottom: "9px solid transparent",
          borderLeft: `18px solid ${t.text}`,
        }}
      />
    </span>
  );
}

/** "0:42", bottom-right of a video's poster. Absent when nothing recorded one. */
function DurationChip({ seconds }: { seconds: number | null }) {
  const label = durationLabel(seconds);
  if (!label) return null;

  return (
    <span
      data-thread-duration=""
      style={{
        ...dataText,
        ...tabular,
        position: "absolute",
        bottom: 8,
        right: 8,
        padding: "1px 6px",
        borderRadius: r.chip,
        background: t.glass2,
        color: t.text,
      }}
    >
      {label}
    </span>
  );
}

/** Seconds as a clock. Null for a row whose probe never got a duration. */
export function durationLabel(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

/**
 * The rail: the thread's spine, down the box's left padding.
 *
 * Positioned against the block that begins at the first picture's top and ends
 * at the last entry's bottom, so its extent is those two facts rather than a
 * measured length. Centred in the 16px padding — (16 − 2) / 2 = 7 — which is the
 * one column of the box nothing else occupies.
 */
function Rail() {
  return (
    <span
      aria-hidden
      data-thread-rail=""
      style={{
        position: "absolute",
        left: (THREAD_PAD - RAIL_WIDTH) / 2,
        top: 0,
        bottom: 0,
        width: RAIL_WIDTH,
        borderRadius: RAIL_WIDTH,
        background: t.line,
      }}
    />
  );
}

/**
 * The part that unfolds, and the card's one animated moment.
 *
 * ONE TRANSITION, ONE STEP, NO MEASUREMENT. The region is a single-row grid
 * whose row goes from `0fr` to `1fr`: in an auto-height container an `fr` row
 * resolves to its content, so the height interpolates from nothing to exactly
 * the height the content already reserved — once, and never adjusted afterwards.
 * Because every picture inside has its `aspect-ratio` from stored pixels, that
 * target is settled before a single image has loaded, so an image landing
 * mid-transition changes nothing.
 *
 * WHY NOT `height`, WHICH IS WHAT BG-P09 ASKED FOR. A `height` transition needs
 * two concrete pixel values, and the only way to get the second one is to
 * measure the rendered content — the thing this file is not allowed to do, and
 * the thing that makes the "grows twice" failure possible in the first place
 * (measure early, get it wrong, correct it later). `grid-template-rows` is the
 * same single transition of the same box's height with the measurement removed.
 * `overflow: hidden` and `minHeight: 0` are load-bearing: without them the row
 * refuses to shrink below its content and nothing animates.
 *
 * Reduced motion snaps. `hidden` is not used — a hidden subtree is not laid out,
 * so its height could not be part of a transition — but `inert` keeps the
 * collapsed entries out of the tab order and off a screen reader's path, which
 * is what `hidden` would have been for.
 */
function UnfoldRegion({
  open,
  id,
  children,
}: {
  open: boolean;
  id: string;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      data-thread-region={open ? "open" : "closed"}
      // `inert` KEEPS THE COLLAPSED ENTRIES OUT OF THE TAB ORDER and off a
      // screen reader's path. `hidden` cannot do that job here — a hidden
      // subtree is not laid out, so its height could not then be part of a
      // transition — and React 18 does not carry `inert` in its prop allowlist,
      // so it is set on the element rather than passed as a prop. A ref is the
      // only place that can be done without the version of React deciding
      // whether the attribute survives.
      ref={(el) => {
        el?.toggleAttribute("inert", !open);
      }}
      style={{
        display: "grid",
        gridTemplateRows: open ? "1fr" : "0fr",
        transition: prefersReducedMotion()
          ? "none"
          : `grid-template-rows ${UNFOLD_MS}ms ${UI_EASING}`,
      }}
    >
      <div style={{ overflow: "hidden", minHeight: 0 }}>{children}</div>
    </div>
  );
}

/**
 * "Show thread · 3 more", and "Show less" once it is open.
 *
 * A BUTTON INSIDE A LINK, WHICH IS WHY THE PROPAGATION STOPS. The whole card is
 * an anchor to the build, so a click that reached it would navigate away from the
 * thread the reader just asked to see. `preventDefault` cancels the anchor's own
 * activation and `stopPropagation` keeps the event off it; both are needed,
 * because the anchor is the ancestor rather than the target. Keyboard activation
 * of a button fires a click, so Enter and Space go through the same guard.
 */
function UnfoldControl({
  open,
  more,
  controls,
  onOpen,
  onClose,
}: {
  open: boolean;
  more: number;
  controls: string;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <button
      type="button"
      data-thread-control=""
      aria-expanded={open}
      aria-controls={controls}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (open) onClose();
        else onOpen();
      }}
      style={{
        ...dataText,
        display: "flex",
        alignItems: "center",
        gap: 6,
        width: "100%",
        height: CONTROL_HEIGHT,
        marginTop: ENTRY_GAP,
        padding: `0 ${THREAD_PAD}px`,
        border: "none",
        borderTop: `1px solid ${t.line}`,
        background: "transparent",
        color: t.text2,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span>{open ? "Show less" : `Show thread · ${more} more`}</span>
      <Chevron open={open} />
    </button>
  );
}

/** The control's chevron: right when closed, up when open. */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      <path
        d={open ? "M2.5 7.5L6 4l3.5 3.5" : "M4 2.5L7.5 6L4 9.5"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
