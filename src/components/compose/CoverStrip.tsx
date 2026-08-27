// The compose workspace's cover strip: the first thing the page asks for.
//
// THE QUESTION IT PUTS FIRST
// Everything below this strip — the tray, the anatomy tree, the inspector — is
// the typed record, and the typed record is depth. It is not the front door. A
// creator who arrives with a screenshot and one sentence has a publishable post
// and should feel finished in under a minute, so the two things that make a
// post social are asked for here, above all of it: a picture, and a sentence
// saying what the thing does.
//
// WHY IT READS cover_media_id AND NOT resolveCover
// resolveCover (src/lib/build/cover.ts) is the READ chain: it falls through the
// explicit cover to the hero node's media to the first evidence image, so a
// card always has something to show. This strip is the WRITE surface for the
// first link only. If it rendered the resolved answer, Remove would clear the
// column and the strip would immediately fill again with whatever the chain
// found next — the creator would press Remove and watch nothing happen. So it
// shows the explicit choice, and only that.
//
// WHY THE WRITE GOES THROUGH setCover RATHER THAN patchBuild
// Every other header edit in the workspace is debounced by useComposeBuild: a
// title is typed, and 800ms later one row update carries it. An upload is not
// typing. It is a single deliberate act that has already cost the creator a
// wait, and it should be durable the moment it returns rather than 800ms after
// it. setCover is the lib layer's named write for exactly this one column, so
// the strip calls it and then merges the answer back into the workspace's
// cached record — that one key, not the whole row, so a debounced save landing
// at the same moment keeps whatever it wrote.
//
// Styled inline, like every other surface on this route: Tailwind's generated
// utilities win over hand-written classes at build time.

import { useCallback, useRef, useState } from "react";
import type { CSSProperties, DragEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Play } from "lucide-react";
import {
  MEDIA_MAX_BYTES,
  acceptedMediaTypes,
  mediaKindFor,
  setCover,
  type Build,
  type BuildMedia,
  type BuildRecord,
  type MediaKind,
  type MediaRef,
} from "@/lib/build";
import {
  MEDIA_WIDTH,
  MediaUnavailable,
  useMediaSrc,
} from "@/components/build/MediaFigure";
import { composeBuildQueryKey } from "@/hooks/useComposeBuild";
import { useComposeMedia } from "@/hooks/useComposeMedia";
import {
  GAP_RED,
  HAIRLINE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  bodyText,
  hexToRgba,
  labelText,
} from "@/components/build/tokens";

/**
 * The copy, held as constants because it is the design.
 *
 * "Show what you made" is the sentence this whole prompt exists to put at the
 * top of the page; a later refactor that reflows the JSX should have to delete
 * a named constant to lose it rather than quietly reword a string in place.
 */
const DROP_HEADLINE = "Show what you made — drop a screenshot or video, or browse";
const DROP_SUBLINE = "This becomes your post's picture everywhere on NeoScale.";

/** A cover is something a reader can see. Audio and documents are not covers. */
const COVER_KINDS: readonly MediaKind[] = ["image", "video"];

/** Empty, the target is a band. Filled, it is a 16:9 thumbnail 320 x 180. */
const EMPTY_HEIGHT = 120;
const THUMB_WIDTH = 320;

const quietButton: CSSProperties = {
  ...labelText,
  fontFamily: "inherit",
  fontSize: 11,
  padding: "3px 9px",
  borderRadius: 6,
  background: "rgba(8,8,12,0.72)",
  border: `1px solid rgba(255,255,255,0.14)`,
  color: TEXT_PRIMARY,
  cursor: "pointer",
};

/** The `accept` attribute, filtered out of the lib layer's own list. */
export function coverAcceptedTypes(): string {
  return acceptedMediaTypes()
    .filter((mime) => COVER_KINDS.includes(mediaKindFor(mime) as MediaKind))
    .join(",");
}

/**
 * Why this file cannot be a cover, or null when it can.
 *
 * Checked HERE, before uploadMedia is called at all, so a 40MB video costs no
 * request and no wait. The sentence names the limit, because "too large" is not
 * something a creator can act on.
 */
export function coverRejection(file: File): string | null {
  const name = file.name || "That file";

  if (file.size > MEDIA_MAX_BYTES) {
    return `${name} is ${megabytes(file.size)}MB. A cover has to be under ${megabytes(MEDIA_MAX_BYTES)}MB, so it was not uploaded.`;
  }

  const kind = mediaKindFor(file.type);
  if (!kind || !COVER_KINDS.includes(kind)) {
    return `${name} is ${file.type || "an unrecognised type"}. A cover is a picture or a video — png, jpg, webp, gif, avif, mp4, webm or mov.`;
  }

  return null;
}

function megabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

/** The poster of a video, as a media reference of its own. */
function posterRef(media: BuildMedia | null | undefined): MediaRef | null {
  if (!media?.poster_path) return null;
  // Kind image rather than video: the poster is a still, and the transform is
  // only applied to images.
  return { bucket: media.bucket, path: media.poster_path, kind: "image" };
}

interface CoverStripProps {
  build: Build;
  /** True below the compose breakpoint: the cover stacks above the tree. */
  stacked: boolean;
}

/**
 * The cover.
 *
 * A NEW element between the top bar and the three-panel frame. Nothing that
 * already lays this page out is touched: the panel row below is flex:1 and
 * absorbs whatever height this takes.
 */
export function CoverStrip({ build, stacked }: CoverStripProps) {
  const media = useComposeMedia();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const coverId = build.cover_media_id ?? null;
  // undefined while the media list is still loading, null when it holds no
  // such row. See ResolveMedia in renderers/shared.tsx.
  const cover = coverId ? media?.resolveMedia(coverId) : null;

  /**
   * Write the column, then reconcile the workspace's cached record.
   *
   * One key rather than the whole returned row: useComposeBuild may have a
   * debounced save open on the same record, and replacing its build wholesale
   * would drop whatever that save is about to reconcile.
   */
  const write = useCallback(
    async (mediaId: string | null) => {
      const row = await setCover(build.id, mediaId);
      queryClient.setQueryData<BuildRecord | null>(
        composeBuildQueryKey(build.id),
        (previous) =>
          previous
            ? {
                ...previous,
                build: { ...previous.build, cover_media_id: row.cover_media_id },
              }
            : previous
      );
    },
    [build.id, queryClient]
  );

  const accept = useCallback(
    async (file: File | undefined) => {
      if (!media || !file || uploading) return;
      setError(null);

      const reason = coverRejection(file);
      if (reason) {
        setError(reason);
        return;
      }

      setUploading(true);
      try {
        // nodeId null puts the object under UNPLACED_SEGMENT: a cover is the
        // build's picture, not any one node's evidence.
        const row = await media.upload(file, { nodeId: null });
        await write(row.id);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setUploading(false);
      }
    },
    [media, uploading, write]
  );

  /**
   * Clear the pointer. The uploaded row is left where it is.
   *
   * Deleting it would be a guess: an unplaced media row is also what a file
   * dropped on the workspace becomes, and a tray node may already point at
   * this one. A pointer nobody follows costs nothing; a deleted object a tray
   * node still references is a broken card.
   */
  const clear = useCallback(async () => {
    setError(null);
    try {
      await write(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [write]);

  const browse = useCallback(() => inputRef.current?.click(), []);

  // The workspace frame also takes file drops, and turns them into tray nodes.
  // A drop that landed on the cover is not one of those.
  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setOver(true);
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setOver(false);
      void accept(event.dataTransfer?.files?.[0]);
    },
    [accept]
  );

  return (
    <section
      data-visual-slot="compose-cover"
      data-testid="cover-strip"
      aria-label="Cover and description"
      style={{
        flexShrink: 0,
        display: "flex",
        flexDirection: stacked ? "column" : "row",
        alignItems: stacked ? "stretch" : "flex-start",
        gap: 14,
        padding: "12px 14px",
        borderBottom: `1px solid ${HAIRLINE}`,
        background: "rgba(255,255,255,0.012)",
      }}
    >
      <div
        style={{
          // Empty, the target claims the room. Filled, it is 320 wide and the
          // description moves up beside it.
          flex: coverId ? "0 0 auto" : "1 1 auto",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div
          data-testid="cover-drop"
          onDragOver={onDragOver}
          onDragEnter={onDragOver}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          style={{ display: "flex", minWidth: 0 }}
        >
          {/* The visible affordance is the band and the two hover controls;
              this is what they open. */}
          <input
            ref={inputRef}
            type="file"
            aria-label="Cover image or video"
            accept={coverAcceptedTypes()}
            disabled={!media || uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Cleared so choosing the same file twice fires a change again.
              event.target.value = "";
              void accept(file);
            }}
            style={{ display: "none" }}
          />

          {uploading ? (
            <Uploading />
          ) : coverId ? (
            <CoverThumb
              media={cover}
              onReplace={browse}
              onRemove={() => void clear()}
            />
          ) : (
            <EmptyTarget over={over} disabled={!media} onBrowse={browse} />
          )}
        </div>

        {error ? (
          <span
            role="alert"
            style={{
              ...bodyText,
              fontSize: 12,
              lineHeight: 1.5,
              color: GAP_RED,
              maxWidth: 520,
            }}
          >
            {error}
          </span>
        ) : null}
      </div>

    </section>
  );
}

/** The band that asks the question. A button, so a keyboard reaches it. */
function EmptyTarget({
  over,
  disabled,
  onBrowse,
}: {
  over: boolean;
  disabled: boolean;
  onBrowse: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onBrowse}
      style={{
        fontFamily: "inherit",
        width: "100%",
        minHeight: EMPTY_HEIGHT,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "14px 16px",
        borderRadius: 12,
        border: `1px dashed ${over ? TEAL : "rgba(255,255,255,0.14)"}`,
        background: over ? hexToRgba(TEAL, 0.06) : "rgba(255,255,255,0.02)",
        textAlign: "center",
        cursor: disabled ? "default" : "pointer",
        transition: "background 120ms ease, border-color 120ms ease",
      }}
    >
      <span style={{ ...bodyText, fontSize: 14, fontWeight: 400, color: TEXT_PRIMARY }}>
        {DROP_HEADLINE}
      </span>
      <span style={{ ...bodyText, fontSize: 12, color: TEXT_MUTED }}>
        {DROP_SUBLINE}
      </span>
    </button>
  );
}

/**
 * The upload, mid-flight.
 *
 * Indeterminate, and the same treatment as IntakeProgress: a sweep clipped by a
 * fixed rail. uploadMedia can report bytes, but a cover upload is one short act
 * and a bar that jumped to 99% and then waited on the row insert would be
 * reporting the wrong half of it.
 */
function Uploading() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        width: "100%",
        minHeight: EMPTY_HEIGHT,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "14px 16px",
        borderRadius: 12,
        border: `1px dashed ${hexToRgba(TEAL, 0.35)}`,
        background: hexToRgba(TEAL, 0.04),
      }}
    >
      <span style={{ ...labelText, color: TEAL }}>Uploading your cover…</span>
      {/* The track clips the sweep, so it reads as motion along a fixed rail
          rather than a block flying across the strip. */}
      <div
        aria-hidden="true"
        style={{
          position: "relative",
          height: 2,
          width: "100%",
          maxWidth: 280,
          overflow: "hidden",
          borderRadius: 2,
          background: HAIRLINE,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: "25%",
            borderRadius: 2,
            background: `linear-gradient(90deg, transparent, ${TEAL}, transparent)`,
            animation: "intakeSweep 1200ms ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}

/**
 * What the build is leading with.
 *
 * The two controls are quiet until the thumbnail is hovered or something inside
 * it takes focus — an inline style cannot express :hover, and hiding them from
 * the keyboard as well would make Remove unreachable without a mouse.
 */
function CoverThumb({
  media,
  onReplace,
  onRemove,
}: {
  /** null when the row has gone, undefined while the media list is loading. */
  media: BuildMedia | null | undefined;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const [active, setActive] = useState(false);
  const src = useMediaSrc(media, MEDIA_WIDTH.tree);
  const poster = useMediaSrc(posterRef(media), MEDIA_WIDTH.tree);
  const isVideo = media?.kind === "video";
  const still = isVideo ? poster : src;

  return (
    <div
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      style={{
        position: "relative",
        width: THUMB_WIDTH,
        maxWidth: "100%",
        aspectRatio: "16 / 9",
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.03)",
      }}
    >
      {media === null ? (
        <MediaUnavailable
          style={{ height: "100%", border: "none", justifyContent: "center" }}
        />
      ) : still ? (
        <img
          src={still}
          alt="Build cover"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : isVideo && src ? (
        // No poster on the row yet: the video's own first frame is the still.
        <video
          src={src}
          muted
          playsInline
          preload="metadata"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : null}

      {isVideo ? (
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.92)",
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: 999,
              background: "rgba(8,8,12,0.55)",
              border: "1px solid rgba(255,255,255,0.18)",
            }}
          >
            <Play size={16} fill="currentColor" />
          </span>
        </span>
      ) : null}

      <div
        style={{
          position: "absolute",
          right: 8,
          bottom: 8,
          display: "flex",
          gap: 6,
          opacity: active ? 1 : 0,
          transition: "opacity 120ms ease",
        }}
      >
        <button type="button" onClick={onReplace} style={quietButton}>
          Replace
        </button>
        <button
          type="button"
          onClick={onRemove}
          style={{ ...quietButton, color: TEXT_SECONDARY }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}
