// The five shape bodies, in one file because their guarantee is a property of
// the set rather than of any one of them.
//
// NO CREATOR EVER UPLOADS A THUMBNAIL, AND NO CARD IS EVER EMPTY. Those two
// sentences are the whole design. A gallery that asks for a cover image gets
// covers from the creators who already knew to make one and blank tiles from
// everybody else — which is a gallery that shows you who is good at marketing.
//
// So the fallback chain is defined ONCE, in DefaultCardBody, and the other four
// end by delegating to it rather than each carrying their own tail:
//
//   AppCardBody      live preview  -> DefaultCardBody
//   PromptCardBody   prompt text   -> DefaultCardBody
//   StudyCardBody    table         -> DefaultCardBody
//   MediaCardBody    variant grid  -> DefaultCardBody
//   DefaultCardBody  cover media -> evidence words -> outcome
//
// DefaultCardBody cannot itself fall through, because its last branch is the
// outcome set large — not a placeholder standing in for a missing image, but
// the sentence a reader came for, at the size that says so. A build with an
// outcome and nothing else still looks like something.
//
// Styled with inline style objects, like every other surface on the new path:
// Tailwind's generated utilities win over hand-written classes at build time.

import type { CSSProperties, ReactElement } from "react";
import { categoryColour, categoryFill } from "@/lib/theme/category";
import { t } from "@/lib/theme/tokens";

/* ────────────────────────────────────────────────────────────────────────────
   BG-P09 — the colours in this file are TOKENS now, repointed in place.

   The bodies were written for the legacy dark shell, where TEXT_PRIMARY was a
   near-white hex. That was invisible the moment BG-P09 put them inside the
   thread box: the box is `--card-thread` over `--card-frame`, which is a LIGHT
   surface in Exhibition, and white text on it is the "dark card on a light
   ground" the spec forbids, arrived at from the other direction.

   So every colour declaration below reads a semantic token and the layout is
   untouched — the repaint the theme sanctions, not a reshape. The names kept
   their jobs: primary text is `--text`, the two quieter greys are `--text2`, and
   the teal that marked a study's winner is `--evidence`, which is what it always
   meant.
   ──────────────────────────────────────────────────────────────────────────── */

/** Primary text on a card body. */
const TEXT_PRIMARY = t.text;
/** The quieter voice: a column header, a role, a caption. */
const TEXT_MUTED = t.text2;
/** Between the two on the legacy ramp; one token serves both here. */
const TEXT_SECONDARY = t.text2;
import type { GalleryBuild, GalleryMedia } from "@/lib/build";
import {
  EVIDENCE_TYPES,
  coverMedia,
  firstNodeOfType,
  listField,
  mediaAlt,
  numberField,
  payloadOf,
  stillFor,
  textField,
  variantsOf,
  type MediaSrcMap,
} from "./cardMedia";

export interface CardBodyProps {
  build: GalleryBuild;
  /** Signed once for the whole page. A miss is treated as "no media". */
  srcByPath: MediaSrcMap;
}

/** Every body fills the same slot, so the grid stays a grid. */
export const BODY_HEIGHT = 168;

/**
 * The fixed slot every grid body fills. BG-P09 repainted it and moved nothing:
 * `BODY_HEIGHT` and the crop are the gallery's layout and survive unchanged.
 *
 * `--recess` is what a slot with no picture in it shows, and it is what a slot
 * with one shows while the bytes are in flight — an inset surface waiting for
 * content rather than a frame that failed. It is also what makes the "no
 * picture" card the theme describes: a text body on --recess, inside the thread
 * box, under a title stepped up one size.
 *
 * No border. The thread box around it is already a region; a hairline inside a
 * region inside a frame is the third edge in 8px, and the tone is enough.
 */
const bodyFrame: CSSProperties = {
  position: "relative",
  height: BODY_HEIGHT,
  overflow: "hidden",
  borderRadius: "var(--r-media)",
  background: "var(--recess)",
};

/** The measured media pair, for the tag on a chosen variant. */
const MEDIA_FILL = categoryFill("media");


// =============================================================================
// App
// =============================================================================

/**
 * The live thing, running, when it will consent to run in a frame.
 *
 * EMBEDDABLE IS THE CREATOR'S CLAIM, not a guess. The live_app node carries the
 * flag, and an iframe pointed at a site that refuses framing renders an empty
 * box that no script can detect — so an unflagged app falls straight through to
 * its hero rather than gambling the card on it.
 *
 * The frame is inert: no pointer events, no scrolling. A gallery card is a
 * picture of an app, not a place to use one.
 */
export function AppCardBody({ build, srcByPath }: CardBodyProps) {
  const node = firstNodeOfType(build, "live_app");
  const url = textField(node, "url") ?? (build.live_url ?? "").trim();
  const embeddable = payloadOf(node).embeddable === true;

  if (url && embeddable) {
    return (
      <div data-card-branch="embed" style={bodyFrame}>
        <iframe
          src={url}
          title={`${build.title ?? "Build"} — live preview`}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin"
          referrerPolicy="no-referrer"
          scrolling="no"
          style={{
            // Rendered at twice the slot and halved, so the preview shows a
            // desktop layout rather than the mobile one a 320px frame triggers.
            width: "200%",
            height: "200%",
            border: "none",
            transform: "scale(0.5)",
            transformOrigin: "top left",
            pointerEvents: "none",
            display: "block",
          }}
        />
      </div>
    );
  }

  return <DefaultCardBody build={build} srcByPath={srcByPath} />;
}

// =============================================================================
// Prompt
// =============================================================================

/**
 * The prompt itself, truncated, with how many variables it takes.
 *
 * The variables count is the useful number on a prompt card: it is the
 * difference between something to copy and something to fill in first.
 */
export function PromptCardBody({ build, srcByPath }: CardBodyProps) {
  const node = firstNodeOfType(build, "prompt", "system_prompt");
  const text = textField(node, "text");

  if (!text) return <DefaultCardBody build={build} srcByPath={srcByPath} />;

  const variables = listField(node, "variables").length;
  const model = textField(node, "model");

  return (
    <div
      data-card-branch="prompt"
      style={{
        ...bodyFrame,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "14px 16px",
        borderLeftWidth: 2,
        borderLeftStyle: "solid",
        borderLeftColor: categoryColour("instruction"),
      }}
    >
      <p
        style={{
          margin: 0,
          flex: 1,
          minHeight: 0,
          fontSize: 12.5,
          fontWeight: 300,
          lineHeight: 1.55,
          color: TEXT_PRIMARY,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          whiteSpace: "pre-wrap",
          display: "-webkit-box",
          WebkitLineClamp: 5,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {text}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
        <Chip
          text={
            variables === 0
              ? "no variables"
              : `${variables} variable${variables === 1 ? "" : "s"}`
          }
          category="instruction"
        />
        {/* A model name is not a part category, so it takes the fallback pair
            rather than borrowing a hue that means something else. */}
        {model ? <Chip text={model} category="" /> : null}
      </div>
    </div>
  );
}

// =============================================================================
// Study
// =============================================================================

/**
 * The comparison table, small, with the winner marked.
 *
 * Three rows and three columns is what fits; the rest becomes a count, because
 * a card that pretends to show a twenty-row table shows nothing legibly. The
 * winner is marked in evidence teal rather than merely bolded, so the finding
 * survives the shrinking.
 */
export function StudyCardBody({ build, srcByPath }: CardBodyProps) {
  const node = firstNodeOfType(build, "comparison_table");

  const columns = listField(node, "columns")
    .map((column) => firstString(column.label, column.key))
    .filter((label): label is string => Boolean(label))
    .slice(0, 3);

  const rows = listField(node, "rows")
    .map((row) => (typeof row.cells === "string" ? row.cells.trim() : ""))
    .filter(Boolean);

  if (columns.length === 0 && rows.length === 0) {
    return <DefaultCardBody build={build} srcByPath={srcByPath} />;
  }

  const winner = textField(node, "winner");
  const sampleSize = numberField(node, "n");
  const shown = rows.slice(0, 3);

  return (
    <div
      data-card-branch="table"
      style={{
        ...bodyFrame,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "12px 14px",
        borderLeftWidth: 2,
        borderLeftStyle: "solid",
        borderLeftColor: categoryColour("evidence"),
      }}
    >
      {columns.length > 0 ? (
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          {columns.map((column) => (
            <span key={column} style={columnHeaderText}>
              {column}
            </span>
          ))}
        </div>
      ) : null}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: 3,
          overflow: "hidden",
        }}
      >
        {shown.map((row, index) => {
          const isWinner = Boolean(
            winner && row.toLowerCase().includes(winner.toLowerCase())
          );
          return (
            <div
              key={`${row}-${index}`}
              style={{
                display: "flex",
                gap: 10,
                padding: "3px 6px",
                borderRadius: 6,
                background: isWinner ? categoryFill("evidence").background : "transparent",
              }}
            >
              {splitCells(row, Math.max(columns.length, 1)).map((cell, cellIndex) => (
                <span
                  key={cellIndex}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 12,
                    fontWeight: isWinner && cellIndex === 0 ? 600 : 300,
                    color: isWinner ? t.evidence : TEXT_PRIMARY,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {cell}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>
        {/* The winner is an evidence claim and takes the evidence hue. The
            other two are counts about the table rather than claims from it, so
            they take the fallback pair rather than borrowing a category. */}
        {winner ? <Chip text={`${winner} won`} category="evidence" /> : null}
        {sampleSize !== null ? <Chip text={`n = ${sampleSize}`} category="" /> : null}
        {rows.length > shown.length ? (
          <Chip text={`+${rows.length - shown.length} more`} category="" />
        ) : null}
      </div>
    </div>
  );
}

/** "gpt-5 | 82% | 1.2s" or "gpt-5, 82%, 1.2s" — whichever the creator wrote. */
function splitCells(row: string, count: number): string[] {
  const parts = row.includes("|") ? row.split("|") : row.split(/\s*,\s*/);
  const cells = parts.map((part) => part.trim()).filter(Boolean);
  return cells.length > 0 ? cells.slice(0, count) : [row];
}

// =============================================================================
// Media
// =============================================================================

/**
 * The variant grid: what came out, including what was not kept.
 *
 * The rejected generations are the point of a media build's record. A grid of
 * four with one marked is the difference between "here is an image" and "here
 * is what this prompt does, four times".
 */
export function MediaCardBody({ build, srcByPath }: CardBodyProps) {
  const variants = variantsOf(
    build,
    firstNodeOfType(build, "generated_media")
  ).filter((variant) => stillFor(srcByPath, variant.media) !== null);

  if (variants.length === 0) {
    return <DefaultCardBody build={build} srcByPath={srcByPath} />;
  }

  return (
    <div
      data-card-branch="variants"
      style={{
        ...bodyFrame,
        display: "grid",
        gridTemplateColumns: `repeat(${variants.length === 1 ? 1 : 2}, 1fr)`,
        gridAutoRows: "1fr",
        gap: 2,
      }}
    >
      {variants.map((variant) => (
        <div key={variant.media.id} style={{ position: "relative", overflow: "hidden" }}>
          <img
            src={stillFor(srcByPath, variant.media) ?? ""}
            alt={variant.note ?? mediaAlt(build, variant.media)}
            loading="lazy"
            decoding="async"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          {variant.chosen ? (
            <span
              style={{
                position: "absolute",
                left: 6,
                bottom: 6,
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: "0.06em",
                padding: "2px 6px",
                borderRadius: 5,
                // BG-P05: was magenta at 85% with white on it — 2.65:1 on Dusk,
                // and unmeasurable once the hue is a var(). The measured media
                // pair reads on either theme and over the thumbnail behind it,
                // because the fill is opaque.
                ...MEDIA_FILL,
              }}
            >
              KEPT
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Default — the chain that cannot fail
// =============================================================================

/**
 * The cover, else the first evidence node's words, else the outcome set large.
 *
 * The body every shape without one of its own gets, and the tail the other
 * four delegate to. Its picture is now whatever coverMedia resolves — the
 * creator's chosen cover ahead of anything this file would have guessed — and
 * the branch beneath it is unchanged: a result's summary is a perfectly good
 * card, and reaching the outcome only because a screenshot is missing would
 * throw it away.
 */
export function DefaultCardBody({ build, srcByPath }: CardBodyProps) {
  const media = coverMedia(build);
  const picture = mediaBlock(media, srcByPath, mediaAlt(build, media));
  if (picture) return picture;

  const stated = evidenceWords(build);
  if (stated) return stated;

  return <OutcomeBlock build={build} />;
}

/** The first evidence node that says something in words. */
function evidenceWords(build: GalleryBuild): ReactElement | null {
  for (const type of EVIDENCE_TYPES) {
    const node = firstNodeOfType(build, type);
    if (!node) continue;

    const summary =
      textField(node, "summary") ??
      textField(node, "caption") ??
      textField(node, "harness") ??
      nonEmpty(node.title);
    if (!summary) continue;

    const metric = textField(node, "metric");
    const value = textField(node, "value");
    const score = numberField(node, "score");
    const figure =
      [metric, value].filter(Boolean).join(" ") ||
      (score !== null ? `scored ${score}` : "");

    return (
      <div
        key={node.id}
        data-card-branch="evidence"
        style={{
          ...bodyFrame,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 10,
          padding: "14px 16px",
          borderLeftWidth: 2,
          borderLeftStyle: "solid",
          borderLeftColor: categoryColour("evidence"),
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 13.5,
            fontWeight: 300,
            lineHeight: 1.5,
            color: TEXT_PRIMARY,
            display: "-webkit-box",
            WebkitLineClamp: 4,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {summary}
        </p>
        {figure ? (
          <div style={{ display: "flex" }}>
            <Chip text={figure} category="evidence" />
          </div>
        ) : null}
      </div>
    );
  }
  return null;
}

/**
 * The outcome, set large. The floor under all five bodies.
 *
 * Exported because the card's own empty-record guard renders it directly: this
 * is the one branch that is always available, and nothing above it in any chain
 * is allowed to be the last word.
 */
export function OutcomeBlock({
  build,
  accent = "evidence",
}: {
  build: GalleryBuild;
  /** A part category, resolved through categoryFill. Never a raw colour. */
  accent?: string;
}) {
  const text = nonEmpty(build.outcome) ?? nonEmpty(build.title) ?? "Untitled build";

  return (
    <div
      data-card-branch="outcome"
      style={{
        ...bodyFrame,
        display: "flex",
        alignItems: "center",
        padding: "16px 18px",
        // The accent's measured fill, fading into the well. A gradient rather
        // than a flat fill because the outcome set large IS the card here, and
        // the wash is what keeps it from reading as an empty slot.
        background: `linear-gradient(140deg, ${categoryFill(accent).background}, var(--recess))`,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 17,
          fontWeight: 600,
          lineHeight: 1.35,
          color: TEXT_PRIMARY,
          display: "-webkit-box",
          WebkitLineClamp: 4,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {text}
      </p>
    </div>
  );
}

// =============================================================================
// Shared
// =============================================================================

/**
 * A signed image or video filling the slot, or null.
 *
 * A plain function rather than a component on purpose: the bodies BRANCH on
 * whether there is a picture, and a component that returns null still yields a
 * truthy element, so `<MediaBlock/> ?? fallback` would silently never fall
 * back. Calling it is what makes the chain real.
 */
function mediaBlock(
  media: GalleryMedia | null,
  srcByPath: MediaSrcMap,
  label: string
): ReactElement | null {
  const src = stillFor(srcByPath, media);
  if (!src || !media) return null;

  // objectFit cover on the IMAGE, so the picture is cropped to the slot the
  // grid already gives every card rather than the slot being reshaped around
  // the picture. The card's own box is untouched by what lands in it.
  const fill: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  };

  const video = media.kind === "video";
  // A poster is a still, so it takes the transform and the play glyph reads as
  // an affordance over it. Without one there is nothing to show but the video's
  // own first frame, which is what preload="metadata" fetches — and no more.
  const posterOnly = video && Boolean(media.poster_path);

  return (
    <div data-card-branch="media" style={bodyFrame}>
      {video && !posterOnly ? (
        // Muted, never autoplaying: a grid of cards is not a wall of moving
        // pictures, and nothing on this page downloads a video to play it.
        <video src={src} muted playsInline preload="metadata" aria-label={label} style={fill} />
      ) : (
        <img
          src={src}
          alt={label}
          // The bytes for an off-screen card are never fetched.
          loading="lazy"
          decoding="async"
          style={fill}
        />
      )}
      {video ? <PlayGlyph /> : null}
    </div>
  );
}

/**
 * The centred play mark that says "this one moves".
 *
 * THE GRID'S SIZE OF IT (BG-P09): 36px at `--r-media` with a 14px triangle,
 * where the thread box's is 48 at `--r-control` with 18. A 168px letterbox and a
 * full-width picture are not the same slot, and a mark sized for the larger one
 * covers a third of the smaller.
 *
 * NOT A DISC. The 50% radius this used to carry was the shape language the
 * series replaced; `--r-full` is for genuinely circular objects and nothing on
 * this card is one. `--glass-2` as a FILL and deliberately NOT a
 * backdrop-filter: the frame carries the card's only blur.
 *
 * Decoration for a screen reader — the picture beneath it already carries the
 * description, and the card is a link to the build rather than a player, so a
 * second announcement would be a promise the card does not keep.
 */
function PlayGlyph() {
  return (
    <span
      aria-hidden
      data-card-mark="play"
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 36,
        height: 36,
        borderRadius: "var(--r-media)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--glass-2)",
      }}
    >
      <span
        style={{
          // A triangle drawn in borders rather than a glyph, so it is the same
          // shape at every font stack. Nudged right, because a triangle's
          // optical centre sits left of its box.
          width: 0,
          height: 0,
          marginLeft: 2,
          borderTop: "7px solid transparent",
          borderBottom: "7px solid transparent",
          borderLeft: "14px solid var(--text)",
        }}
      />
    </span>
  );
}

const columnHeaderText: CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: 10.5,
  fontWeight: 500,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: TEXT_MUTED,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

/**
 * A chip, in one category's measured pair.
 *
 * BG-P05: it takes a CATEGORY rather than a colour. The background used to be
 * struck here as a 10% alpha of whatever hex was passed in, which cannot work
 * once the colour is a `var()` and was never measured when it was a hex. The
 * hairline is the hue itself — a border carries state, so its floor is 3.0:1,
 * and every one of the nine clears 4.83:1 on the ground.
 */
function Chip({ text, category }: { text: string; category: string }) {
  const fill = categoryFill(category);
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.04em",
        padding: "2px 7px",
        borderRadius: 5,
        color: fill.color,
        background: fill.background,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: fill.color,
        whiteSpace: "nowrap",
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {text}
    </span>
  );
}

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}
