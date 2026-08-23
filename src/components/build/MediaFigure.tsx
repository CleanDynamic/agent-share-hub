// Uploaded media, as it appears on a build.
//
// ONE QUERY, MANY NODES
// A renderer never looks a media id up. The page loads every media row for the
// build in a single getMediaForBuild call and hands the renderers a
// resolveMedia function over that list — the same discipline resolveNode
// follows for node references. A build with forty screenshots costs one query,
// not forty.
//
// WHY THIS FILE TOUCHES STORAGE AT ALL
// shared.tsx forbids itself Supabase, and rightly: a renderer that queries is a
// renderer that cannot be tested or reasoned about. Turning a RESOLVED row into
// a URL is a different thing from looking one up, and it has to happen
// somewhere — build-media is a private bucket, so an <img src> needs a signed
// URL rather than a path. That signing is the whole of this module's contact
// with storage, and it goes through the lib layer's signedMediaUrl, which
// applies the same width/quality transform mediaUrl does.
//
// TRANSFORMS ARE NOT OPTIONAL
// Every image is requested at the width of the slot it lands in — 1200 for the
// hero, 640 in the tree, 240 in a variant grid cell. The old content path
// serves full-size originals into thumbnails; nothing here does.

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  mediaUrl,
  signedMediaUrl,
  type BuildMedia,
  type BuildNode,
  type MediaRef,
} from "@/lib/build";
import { HAIRLINE, TEXT_MUTED, TEXT_SECONDARY, bodyText, labelText } from "./tokens";
import { mediaSrc, type ResolveMedia } from "./renderers/shared";

export type { ResolveMedia };

/**
 * The width each slot asks for. These are the only widths on the read path,
 * so a new slot picks one of them rather than inventing a fourth.
 */
export const MEDIA_WIDTH = {
  /** The header hero on /b2/:slug. */
  hero: 1200,
  /** A figure inside a node card in the anatomy tree. */
  tree: 640,
  /** One cell of the generated_media variant grid, and the inspector preview. */
  variant: 240,
} as const;

/** Quality is the lib layer's default everywhere; only width varies by slot. */
export type MediaSlotWidth = (typeof MEDIA_WIDTH)[keyof typeof MEDIA_WIDTH];

/**
 * A URL the browser can load for one media row, transformed for its slot.
 *
 * Signed, because the bucket is private and an <img> cannot send a bearer
 * token. mediaUrl is the fallback for the case where signing fails — it
 * carries the identical transform, and on a project whose bucket has been
 * opened up it loads.
 *
 * Returns null until the signature comes back, so nothing renders a URL that
 * is about to be replaced.
 */
export function useMediaSrc(
  media: MediaRef | null | undefined,
  width: number
): string | null {
  const bucket = media?.bucket ?? null;
  const path = media?.path ?? null;
  const kind = media?.kind ?? null;

  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setSrc(null);
      return;
    }
    const ref: MediaRef = { bucket: bucket ?? "", path, kind: kind ?? "file" };
    let live = true;
    signedMediaUrl(ref, { width })
      .then((url) => {
        if (live) setSrc(url);
      })
      .catch(() => {
        // A signature this browser could not get is not worth an empty slot:
        // the unsigned URL carries the same transform and may still load.
        if (live) setSrc(mediaUrl(ref, { width }));
      });
    return () => {
      live = false;
    };
  }, [bucket, kind, path, width]);

  return src;
}

/** The poster of a video, as a media reference of its own. */
function posterRef(media: BuildMedia | null | undefined): MediaRef | null {
  if (!media?.poster_path) return null;
  // Kind image rather than video: the poster is a still, and the transform is
  // only applied to images.
  return { bucket: media.bucket, path: media.poster_path, kind: "image" };
}

/**
 * The media id a node points at, or null.
 *
 * media_id is the field key every type carrying one media reference declares.
 * generated_media instead holds a list of variants, and the one that speaks
 * for the node is the chosen one — falling back to the first, so a node whose
 * creator has not chosen yet still has a hero candidate.
 */
export function nodeMediaId(node: BuildNode | null | undefined): string | null {
  const payload =
    node?.payload && typeof node.payload === "object" && !Array.isArray(node.payload)
      ? (node.payload as Record<string, unknown>)
      : null;
  if (!payload) return null;

  const direct = payload.media_id;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const variants = payload.variants;
  if (Array.isArray(variants)) {
    const records = variants.filter(
      (variant): variant is Record<string, unknown> =>
        Boolean(variant) && typeof variant === "object" && !Array.isArray(variant)
    );
    const chosen = records.find((variant) => variant.chosen === true) ?? records[0];
    const id = chosen?.media_id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }

  return null;
}

/**
 * A reference that no longer resolves.
 *
 * A media row can be deleted while a payload still points at it — a removed
 * upload, a build restored from an export, a hand-written id. That is a small
 * absence, not a broken page, and it renders as one rather than as the
 * browser's broken-image glyph.
 */
export function MediaUnavailable({ style }: { style?: CSSProperties }) {
  return (
    <div
      data-visual-slot="media-unavailable"
      style={{
        ...bodyText,
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        color: TEXT_MUTED,
        padding: "10px 12px",
        border: `1px dashed ${HAIRLINE}`,
        borderRadius: 8,
        ...style,
      }}
    >
      <span aria-hidden>◇</span>
      media unavailable
    </div>
  );
}

interface MediaFigureProps {
  /** What the payload holds: a build_media id, or a legacy URL. */
  reference: string | undefined | null;
  resolveMedia: ResolveMedia;
  /** The slot's width. Images are requested at exactly this. */
  width: number;
  alt: string;
  style?: CSSProperties;
}

/**
 * One media reference, rendered as whatever it is.
 *
 * Image, video with its poster, audio, or a file. The kind comes from the
 * build_media row rather than from the node's type, so a recording node
 * holding an audio file renders an audio element without anything knowing that
 * a recording can be either.
 */
export function MediaFigure({
  reference,
  resolveMedia,
  width,
  alt,
  style,
}: MediaFigureProps) {
  const id = (reference ?? "").trim();
  const media = id ? resolveMedia(id) : null;

  // Hooks before any branch: an unresolved reference renders a placeholder,
  // it does not skip a hook.
  const src = useMediaSrc(media, width);
  const poster = useMediaSrc(posterRef(media), width);
  const [failed, setFailed] = useState(false);

  if (!id) return null;

  if (!media) {
    // A payload written before build_media existed may carry a URL or a
    // bucket path rather than an id. Those still render, through the same
    // transform endpoint.
    const legacy = mediaSrc(id, { width });
    if (legacy) {
      return (
        <img
          src={legacy}
          alt={alt}
          loading="lazy"
          decoding="async"
          style={{
            display: "block",
            maxWidth: "100%",
            height: "auto",
            borderRadius: 8,
            border: `1px solid ${HAIRLINE}`,
            ...style,
          }}
        />
      );
    }
    // undefined is "the media has not loaded yet", and a slot that is about to
    // hold an image must not spend that moment claiming the image is gone.
    return media === undefined ? (
      <MediaPending style={style} />
    ) : (
      <MediaUnavailable style={style} />
    );
  }

  const frame: CSSProperties = {
    display: "block",
    maxWidth: "100%",
    height: "auto",
    borderRadius: 8,
    border: `1px solid ${HAIRLINE}`,
    ...style,
  };

  if (media.kind === "image") {
    // Held back until the signature arrives rather than rendering a src that
    // is about to be replaced. The box keeps its place using the row's own
    // dimensions, so the page does not jump when the image lands.
    if (!src) return <MediaPending media={media} style={style} />;
    // A src that will not load — an expired signature, an object removed from
    // under its row — is the same absence as a missing row, and reads better
    // as the placeholder than as the browser's broken-image glyph.
    if (failed) return <MediaUnavailable style={style} />;
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        width={media.width ?? undefined}
        height={media.height ?? undefined}
        onError={() => setFailed(true)}
        style={frame}
      />
    );
  }

  if (media.kind === "video") {
    if (!src) return <MediaPending media={media} style={style} />;
    return (
      <video
        src={src}
        poster={poster ?? undefined}
        controls
        // Nothing on a read surface downloads a video the reader has not
        // asked to watch.
        preload="none"
        style={{ ...frame, background: "#000", width: "100%" }}
      >
        {alt}
      </video>
    );
  }

  if (media.kind === "audio") {
    if (!src) return <MediaPending media={media} style={style} />;
    return (
      <audio src={src} controls preload="none" style={{ width: "100%", ...style }}>
        {alt}
      </audio>
    );
  }

  return <MediaFileChip media={media} src={src} style={style} />;
}

/** The slot a media row occupies before it — or its signed URL — arrives. */
function MediaPending({
  media,
  style,
}: {
  media?: BuildMedia | null;
  style?: CSSProperties;
}) {
  const ratio =
    media?.width && media?.height ? `${media.width} / ${media.height}` : "16 / 9";
  return (
    <div
      aria-hidden
      style={{
        width: "100%",
        aspectRatio: ratio,
        maxHeight: 320,
        borderRadius: 8,
        border: `1px solid ${HAIRLINE}`,
        background: "rgba(255,255,255,0.02)",
        ...style,
      }}
    />
  );
}

/** A non-media upload — a CSV, a PDF — as a line rather than a figure. */
function MediaFileChip({
  media,
  src,
  style,
}: {
  media: BuildMedia;
  src: string | null;
  style?: CSSProperties;
}) {
  const name = media.path.split("/").pop() ?? "file";
  const label = `${media.mime ?? "file"}${media.bytes ? ` · ${formatBytes(media.bytes)}` : ""}`;

  const body = (
    <>
      <span style={{ ...bodyText, fontSize: 12 }}>{name}</span>
      <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED }}>{label}</span>
    </>
  );

  const shell: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 12px",
    borderRadius: 8,
    border: `1px solid ${HAIRLINE}`,
    color: TEXT_SECONDARY,
    textDecoration: "none",
    ...style,
  };

  if (!src) return <div style={shell}>{body}</div>;
  return (
    <a href={src} target="_blank" rel="noreferrer noopener" style={shell}>
      {body}
    </a>
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
