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
import {
  CATEGORY_COLOUR,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  VOID,
  hexToRgba,
} from "@/components/build/tokens";
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

const bodyFrame: CSSProperties = {
  position: "relative",
  height: BODY_HEIGHT,
  overflow: "hidden",
  borderRadius: 10,
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.05)",
};

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
        borderLeft: `2px solid ${CATEGORY_COLOUR.instruction}`,
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
          colour={CATEGORY_COLOUR.instruction}
        />
        {model ? <Chip text={model} colour={TEXT_SECONDARY} /> : null}
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
        borderLeft: `2px solid ${CATEGORY_COLOUR.evidence}`,
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
                background: isWinner ? hexToRgba(TEAL, 0.1) : "transparent",
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
                    color: isWinner ? TEAL : TEXT_PRIMARY,
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
        {winner ? <Chip text={`${winner} won`} colour={TEAL} /> : null}
        {sampleSize !== null ? (
          <Chip text={`n = ${sampleSize}`} colour={TEXT_SECONDARY} />
        ) : null}
        {rows.length > shown.length ? (
          <Chip text={`+${rows.length - shown.length} more`} colour={TEXT_MUTED} />
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
                background: hexToRgba(CATEGORY_COLOUR.media, 0.85),
                color: "rgba(255,255,255,0.95)",
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
          borderLeft: `2px solid ${CATEGORY_COLOUR.evidence}`,
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
            <Chip text={figure} colour={CATEGORY_COLOUR.evidence} />
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
  accent = TEAL,
}: {
  build: GalleryBuild;
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
        background: `linear-gradient(140deg, ${hexToRgba(accent, 0.1)}, rgba(255,255,255,0.02))`,
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
        width: 44,
        height: 44,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Opaque enough to read over any frame, and deliberately NOT a
        // backdrop-filter: this app already pays for nine nested ones in the
        // shell, and a grid of cards is the last place to add more.
        background: hexToRgba(VOID, 0.62),
        border: "1px solid rgba(255,255,255,0.22)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
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
          borderTop: "7px solid transparent",
          borderBottom: "7px solid transparent",
          borderLeft: `12px solid ${TEXT_PRIMARY}`,
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

function Chip({ text, colour }: { text: string; colour: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.04em",
        padding: "2px 7px",
        borderRadius: 5,
        color: colour,
        background: hexToRgba(colour, 0.1),
        border: `1px solid ${hexToRgba(colour, 0.22)}`,
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
