// GridTile: one picture or video in a post's grid (CA-07).
//
// What PostMedia did for one picture (find the row, take its signed file, a video's still), drawn into the cell the
// grid gives it: the crop through cropStyle, cut further to fill the cell, so nothing is measured and nothing moves
// when the bytes arrive. Not signed yet is the cell's own t.tile. On top, bottom left, the badges: GIF, a video's
// length, ALT. A reader's video has a play mark in the middle and its still as the poster.

import { useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";

import { stillFor, type MediaSrcMap } from "@/components/gallery/cardMedia";
import type { GalleryMedia } from "@/lib/build";
import type { PostMediaAttrs } from "@/lib/build/thread";
import { FIGTREE } from "@/lib/theme/type";

import { cropStyle } from "./cropStyle";
import { PICTURE_INK, PICTURE_SHADE } from "./shade";

/** The badges' row, 8 in from the bottom left. */
export const BADGE_INSET = 8;
export const BADGE_HEIGHT = 20;
/** The play mark on a reader's video. */
export const PLAY_SIZE = 56;

export type TileKind = "image" | "gif" | "video";

/** What a tile shows, from the row (or, while it uploads, the file itself). */
export function tileKind(media: Pick<GalleryMedia, "kind" | "path"> | undefined, preview?: { kind: "image" | "video"; gif: boolean } | null): TileKind {
  if (preview) return preview.kind === "video" ? "video" : preview.gif ? "gif" : "image";
  if (media?.kind === "video") return "video";
  return media && /\.gif$/i.test(media.path) ? "gif" : "image";
}

/** "0:12", "1:05", "1:02:03". */
export function videoLength(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return null;
  const whole = Math.round(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = String(whole % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** What a tile reads to a screen reader: its alt text, or what it is and where. */
export function tileLabel(alt: string, kind: TileKind, index: number, count: number): string {
  if (alt.trim()) return alt;
  if (kind === "video") return "Video";
  if (kind === "gif") return "GIF";
  return count > 1 ? `Picture ${index + 1} of ${count}` : "Picture";
}

export const badgeStyle: CSSProperties = {
  boxSizing: "border-box",
  height: BADGE_HEIGHT,
  padding: "0 6px",
  borderRadius: 4,
  border: 0,
  background: PICTURE_SHADE,
  color: PICTURE_INK,
  fontFamily: FIGTREE,
  fontSize: 11,
  fontWeight: 700,
  lineHeight: `${BADGE_HEIGHT}px`,
  letterSpacing: 0,
  display: "inline-flex",
  alignItems: "center",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

export interface GridTileProps {
  attrs: PostMediaAttrs;
  media: GalleryMedia | undefined;
  srcByPath: MediaSrcMap;
  /** The cell's width over height, and where a cut keeps the picture. */
  cellRatio: number;
  align: "middle" | "top";
  index: number;
  count: number;
  /** While it uploads: the file itself. */
  preview?: { url: string; kind: "image" | "video"; gif: boolean } | null;
  /** A reader's tile: the play mark on a video. */
  reader?: boolean;
  /** Readers: the ALT badge is a button that opens the description. Absent: it is a mark. */
  onAlt?: (badge: HTMLElement) => void;
  /** Drawn over the picture, above the badges: the editor's controls, a content warning. */
  children?: ReactNode;
  /** Draw the badges. Off under a content warning's cover. */
  badges?: boolean;
  /** Extra style on the picture itself (a content warning's blur). */
  pictureStyle?: CSSProperties;
}

const fill: CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", objectFit: "cover" };

export function GridTile({ attrs, media, srcByPath, cellRatio, align, index, count, preview = null, reader = false, onAlt, children, badges = true, pictureStyle }: GridTileProps) {
  const kind = tileKind(media, preview);
  const [loadedLength, setLoadedLength] = useState<number | null>(null);
  const alt = typeof attrs.alt === "string" ? attrs.alt : "";
  const label = tileLabel(alt, kind, index, count);

  // A video's still is its poster; a video with no poster shows its first frame.
  const still = preview ? (preview.kind === "image" ? preview.url : null) : media && (kind !== "video" || media.poster_path) ? stillFor(srcByPath, media) : null;
  const videoSrc = preview ? (preview.kind === "video" ? preview.url : null) : media && kind === "video" ? (srcByPath.get(media.path) ?? null) : null;
  const length = kind === "video" ? videoLength(media?.duration ?? loadedLength) : null;
  const size = { w: attrs.w ?? media?.width ?? null, h: attrs.h ?? media?.height ?? null, crop: kind === "image" ? (attrs.crop ?? null) : null };

  const altBadge = alt.trim() ? (
    onAlt ? (
      <button
        type="button"
        aria-label="Image description"
        data-badge="alt"
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
          event.preventDefault();
          event.stopPropagation();
          onAlt(event.currentTarget);
        }}
        style={{ ...badgeStyle, cursor: "pointer" }}
      >
        ALT
      </button>
    ) : (
      <span data-badge="alt" style={badgeStyle}>
        ALT
      </span>
    )
  ) : null;

  return (
    <>
      {kind === "video" && videoSrc ? (
        <video
          src={videoSrc}
          poster={still ?? undefined}
          preload="metadata"
          muted
          playsInline
          aria-label={label}
          onLoadedMetadata={(event) => setLoadedLength(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : null)}
          style={{ ...fill, ...pictureStyle }}
        />
      ) : kind === "video" && still ? (
        <img src={still} alt={label} loading="lazy" decoding="async" style={{ ...fill, ...pictureStyle }} />
      ) : still ? (
        <img src={still} alt={label} loading="lazy" decoding="async" data-tile-img="" style={{ ...cropStyle(size, cellRatio, align), ...pictureStyle }} />
      ) : (
        // Not signed yet: the cell's own tile, at the reserved size, named for a screen reader.
        <span role="img" aria-label={label} data-tile-empty="" style={fill} />
      )}
      {reader && kind === "video" ? (
        <span
          aria-hidden="true"
          data-play-mark=""
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: PLAY_SIZE,
            height: PLAY_SIZE,
            marginLeft: -PLAY_SIZE / 2,
            marginTop: -PLAY_SIZE / 2,
            boxSizing: "border-box",
            borderRadius: 999,
            border: `2px solid ${PICTURE_INK}`,
            background: PICTURE_SHADE,
            color: PICTURE_INK,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <svg width={24} height={24} viewBox="0 0 16 16" aria-hidden="true">
            <path d="M5.5 3.5v9l7-4.5z" fill="currentColor" />
          </svg>
        </span>
      ) : null}
      {badges && (kind !== "image" || altBadge) ? (
        <span data-badges="" style={{ position: "absolute", left: BADGE_INSET, bottom: BADGE_INSET, display: "flex", gap: 4, zIndex: 1 }}>
          {kind === "gif" ? (
            <span data-badge="gif" style={badgeStyle}>
              GIF
            </span>
          ) : null}
          {length ? (
            <span data-badge="length" style={badgeStyle}>
              {length}
            </span>
          ) : null}
          {altBadge}
        </span>
      ) : null}
      {children}
    </>
  );
}

export default GridTile;
