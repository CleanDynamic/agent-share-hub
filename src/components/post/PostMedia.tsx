// PostMedia: one picture or video in a post (PT-03).
//
// ITS OWN SHAPE, NEVER CROPPED. The slot's aspect-ratio comes from the node's
// w and h (the media row's when the node has none), so the height is settled
// before any bytes load. aspectOf is not used: it caps a ratio for a card, and
// a creator's picture is shown whole. The one exception is capTall, which the
// Gallery asks for, and which is a choice the reader can undo in place.
//
// NOT SIGNED YET IS A BLOCK OF t.tile AT THE RESERVED SIZE. Never a spinner
// over the post's text, and nothing moves when the picture arrives.

import { useState, type CSSProperties, type MouseEvent } from "react";

import { Button } from "@/components/brand/Button";
import { stillFor, type MediaSrcMap } from "@/components/gallery/cardMedia";
import type { GalleryMedia } from "@/lib/build";
import type { PostMediaAttrs, ThreadPostMedia } from "@/lib/build/thread";
import { POST_MEDIA_WIDTH_MAX, POST_MEDIA_WIDTH_MIN } from "@/lib/build/thread";
import { t } from "@/lib/theme/tokens";

import { postType } from "./postType";

/** The shape assumed for a picture that carries no size anywhere: 3:2. */
const ASSUMED_RATIO = 3 / 2;
/** A picture taller than this times its width is capped when capTall is on. */
const TALL = 1.25;

export interface PostMediaProps {
  node: ThreadPostMedia;
  /** The thread's media rows by id. The node holds only the id. */
  mediaById: ReadonlyMap<string, GalleryMedia>;
  srcByPath: MediaSrcMap;
  /** Gallery: draw a picture taller than 5:4 at 4:5 until the reader asks for the rest. */
  capTall?: boolean;
  /** Below 768px. */
  phone?: boolean;
  /** Inside a postMediaRow: fill the slot the row gave, ignore the node's width, never cap. */
  inRow?: boolean;
}

function positive(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/** The picture's pixel size: the node's, else the media row's, else null. */
export function sizeOf(
  attrs: Partial<PostMediaAttrs> | undefined,
  media: Pick<GalleryMedia, "width" | "height"> | undefined,
): { w: number; h: number } | null {
  const w = positive(attrs?.w) ?? null;
  const h = positive(attrs?.h) ?? null;
  if (w && h) return { w, h };
  const mw = positive(media?.width);
  const mh = positive(media?.height);
  return mw && mh ? { w: mw, h: mh } : null;
}

/** Width over height, 3:2 when nothing is known. */
export function ratioOf(
  attrs: Partial<PostMediaAttrs> | undefined,
  media: Pick<GalleryMedia, "width" | "height"> | undefined,
): number {
  const size = sizeOf(attrs, media);
  return size ? size.w / size.h : ASSUMED_RATIO;
}

function widthPercent(attrs: Partial<PostMediaAttrs> | undefined): number {
  const width = positive(attrs?.width);
  if (width === null) return POST_MEDIA_WIDTH_MAX;
  return Math.min(POST_MEDIA_WIDTH_MAX, Math.max(POST_MEDIA_WIDTH_MIN, width));
}

export function PostMedia({ node, mediaById, srcByPath, capTall = false, phone = false, inRow = false }: PostMediaProps) {
  const [uncapped, setUncapped] = useState(false);
  const attrs = node.attrs ?? ({} as Partial<PostMediaAttrs>);
  const media = typeof attrs.mediaId === "string" ? mediaById.get(attrs.mediaId) : undefined;
  const video = media?.kind === "video";
  const size = sizeOf(attrs, media);
  const ratio = size ? size.w / size.h : ASSUMED_RATIO;
  const caption = typeof attrs.caption === "string" ? attrs.caption.trim() : "";
  const alt = typeof attrs.alt === "string" ? attrs.alt : "";
  // An empty description is right only when a caption says what the picture is.
  const label = alt || (caption ? "" : video ? "A video in this post" : "A picture in this post");

  // A video's still is its poster; a video row with no poster has none, and its own file is not a poster.
  const still = media && (!video || media.poster_path) ? stillFor(srcByPath, media) : null;
  const videoSrc = media && video ? (srcByPath.get(media.path) ?? null) : null;
  const ready = Boolean(still || videoSrc);

  const capped = capTall && !inRow && !video && !uncapped && size !== null && size.h > TALL * size.w;
  const type = postType(phone);

  const fill: CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "cover",
  };

  const showRest = (event: MouseEvent) => {
    // The Gallery draws a thread inside a link; the press belongs to the button.
    event.preventDefault();
    event.stopPropagation();
    setUncapped(true);
  };

  return (
    <figure
      data-post-media=""
      data-capped={capped ? "" : undefined}
      style={{
        margin: inRow ? 0 : "0 auto",
        width: inRow ? "100%" : `${widthPercent(attrs)}%`,
        minWidth: 0,
      }}
    >
      <div
        data-post-media-box=""
        data-ready={ready ? "" : undefined}
        style={{
          position: "relative",
          // The reservation. Never measured, never waits for a load.
          aspectRatio: capped ? "4 / 5" : size ? `${size.w} / ${size.h}` : String(ratio),
          borderRadius: 6,
          overflow: "hidden",
          background: t.tile,
        }}
      >
        {ready && !video ? (
          <img
            src={still ?? undefined}
            alt={label}
            loading="lazy"
            decoding="async"
            style={{ ...fill, objectPosition: capped ? "top" : "center" }}
          />
        ) : null}
        {ready && video ? (
          <video
            src={videoSrc ?? undefined}
            poster={still ?? undefined}
            controls
            preload="none"
            playsInline
            aria-label={label || undefined}
            style={fill}
          />
        ) : null}
        {capped && size ? (
          <div
            data-post-media-cap=""
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 12,
              padding: 12,
              background: t.module,
              borderTop: `1px solid ${t.hairline}`,
            }}
          >
            <Button
              variant="secondary"
              size={phone ? 44 : 36}
              onClick={showRest}
              // A narrow picture (25% of a phone column) cannot hold the label on one line.
              style={{ height: "auto", minHeight: phone ? 44 : 36, padding: "8px 12px", whiteSpace: "normal", flexShrink: 1, maxWidth: "100%", lineHeight: 1.3 }}
            >
              Show the whole picture
            </Button>
            <span style={type.small}>{`${Math.round(size.w)} × ${Math.round(size.h)}, the rest is below`}</span>
          </div>
        ) : null}
      </div>
      {caption ? <figcaption style={{ ...type.small, marginTop: 8 }}>{caption}</figcaption> : null}
    </figure>
  );
}
