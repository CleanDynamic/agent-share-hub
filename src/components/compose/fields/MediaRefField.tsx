// format: "media_id" — the upload control.
//
// A string field whose format is media_id stores ONE THING: the id of a row in
// build_media. This widget is what puts one there. It drops, it picks, it
// shows what was uploaded, and it replaces or removes it — and it does all of
// that through src/lib/build/media.ts. There is no supabase.storage call in
// this file, and there must never be one: the path convention that the object
// policies read as the access rule is uploadMedia's to write.
//
// The build id and the node being edited arrive by context (see
// useComposeMedia.tsx) rather than as props, so the widget contract every other
// field widget shares is unchanged and SchemaForm, resolveWidget and the
// Inspector are untouched.
//
// Outside the workspace — a schema rendered somewhere with no MediaProvider
// above it — there is nothing to upload against, so the control shows what the
// field holds and offers nothing to write with. That is a read-only state, not
// a broken one.

import { useCallback, useRef, useState } from "react";
import type { CSSProperties, DragEvent } from "react";
import { ImageOff, Upload } from "lucide-react";
import {
  GAP_RED,
  HAIRLINE,
  TEAL,
  TEXT_MUTED,
  TEXT_SECONDARY,
  hexToRgba,
  labelText,
} from "@/components/build/tokens";
import {
  MEDIA_WIDTH,
  MediaUnavailable,
  formatBytes,
  useMediaSrc,
} from "@/components/build/MediaFigure";
import {
  acceptedFieldTypes,
  mediaRejection,
  useComposeMedia,
} from "@/hooks/useComposeMedia";
import type { BuildMedia } from "@/lib/build";
import { FieldShell } from "../SchemaForm";
import { type FieldWidgetProps } from "./index";

const MONO =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";

/** The inspector rail is 340px wide; a preview never needs more than this. */
const PREVIEW_WIDTH = MEDIA_WIDTH.variant;

const buttonStyle: CSSProperties = {
  ...labelText,
  fontSize: 11,
  padding: "3px 9px",
  borderRadius: 6,
  background: "transparent",
  border: `1px solid ${HAIRLINE}`,
  color: TEXT_SECONDARY,
  cursor: "pointer",
};

export function MediaRefField({
  field,
  value,
  onChange,
  id,
  touched,
  compact,
}: FieldWidgetProps) {
  const compose = useComposeMedia();
  const stored = value === null || value === undefined ? "" : String(value).trim();
  // Outside the workspace there is no media to wait for, so a reference is
  // unresolved rather than pending: null, not undefined.
  const media = compose ? compose.resolveMedia(stored) : null;

  const inputRef = useRef<HTMLInputElement>(null);
  const [fraction, setFraction] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const src = useMediaSrc(media, PREVIEW_WIDTH);
  const uploading = fraction !== null;

  /**
   * Drop the media this field used to point at.
   *
   * Only when it belongs to the node being edited, or to no node at all. An
   * id typed in by hand, or shared with another node, is unlinked from this
   * field and left where it is — deleting someone else's object because this
   * field stopped referring to it is not this control's call.
   */
  const discard = useCallback(
    async (id: string) => {
      if (!compose) return;
      const row = compose.resolveMedia(id);
      if (!row) return;
      if (row.node_id !== null && row.node_id !== compose.nodeId) return;
      await compose.remove(id).catch(() => undefined);
    },
    [compose]
  );

  const accept = useCallback(
    async (file: File | undefined) => {
      if (!compose || !file) return;
      setError(null);

      // Refused HERE, before uploadMedia is called at all: a 30MB file costs
      // no request, no wait and no half-written row.
      const reason = mediaRejection(file);
      if (reason) {
        setError(reason);
        return;
      }

      const replaced = stored;
      setFraction(0);
      try {
        const row = await compose.upload(file, { onProgress: setFraction });
        onChange(row.id);
        if (replaced && replaced !== row.id) await discard(replaced);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setFraction(null);
      }
    },
    [compose, discard, onChange, stored]
  );

  const clear = useCallback(async () => {
    const removed = stored;
    onChange(null);
    setError(null);
    if (removed) await discard(removed);
  }, [discard, onChange, stored]);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!compose) return;
      // The workspace frame also takes file drops, and turns them into tray
      // nodes. A drop that landed on a field is not one of those.
      event.preventDefault();
      event.stopPropagation();
      setOver(false);
      void accept(event.dataTransfer?.files?.[0]);
    },
    [accept, compose]
  );

  const onDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!compose) return;
      event.preventDefault();
      event.stopPropagation();
      setOver(true);
    },
    [compose]
  );

  const readOnly = !compose;

  return (
    <FieldShell
      field={field}
      id={id}
      touched={touched}
      isEmpty={stored === ""}
      compact={compact}
    >
      <div
        data-visual-slot="media-field"
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: compact ? 6 : 8,
          borderRadius: 8,
          background: over ? hexToRgba(TEAL, 0.06) : "rgba(255,255,255,0.02)",
          border: `1px dashed ${over ? TEAL : HAIRLINE}`,
          transition: "background 120ms ease, border-color 120ms ease",
        }}
      >
        {/* The label points at this, so the field is still named for a screen
            reader even though the visible affordance is the button below. */}
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={acceptedFieldTypes()}
          disabled={readOnly || uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Cleared so choosing the same file twice fires a change again.
            event.target.value = "";
            void accept(file);
          }}
          style={{ display: "none" }}
        />

        {stored !== "" ? (
          <Preview
            src={src}
            media={media}
            reference={stored}
            alt={field.label}
            compact={compact}
          />
        ) : null}

        {uploading ? (
          <Progress fraction={fraction ?? 0} />
        ) : readOnly ? (
          <span
            style={{
              ...labelText,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: TEXT_MUTED,
            }}
          >
            <ImageOff size={12} aria-hidden />
            Uploads happen in the workspace.
          </span>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              style={{
                ...buttonStyle,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: TEAL,
                borderColor: hexToRgba(TEAL, 0.3),
              }}
            >
              <Upload size={12} aria-hidden />
              {stored === "" ? "Choose a file" : "Replace"}
            </button>

            {stored !== "" ? (
              <button type="button" onClick={() => void clear()} style={buttonStyle}>
                Remove
              </button>
            ) : (
              <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED }}>
                or drop one here
              </span>
            )}
          </div>
        )}

        {error ? (
          <span
            role="alert"
            style={{
              ...labelText,
              fontSize: 11,
              fontWeight: 400,
              letterSpacing: 0,
              lineHeight: 1.5,
              color: GAP_RED,
            }}
          >
            {error}
          </span>
        ) : null}
      </div>
    </FieldShell>
  );
}

/** The bar the upload fills. Teal, like every other progress in the workspace. */
function Progress({ fraction }: { fraction: number }) {
  const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        role="progressbar"
        aria-label="Uploading"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          flex: 1,
          height: 4,
          borderRadius: 999,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: "100%",
            background: TEAL,
            transition: "width 120ms linear",
          }}
        />
      </div>
      <span style={{ ...labelText, fontSize: 11, color: TEXT_SECONDARY }}>
        {percent}%
      </span>
    </div>
  );
}

/**
 * What the field is holding.
 *
 * A resolved image is a thumbnail, a video or audio row is its own element,
 * and an id that resolves to nothing says so and prints the id — a reference
 * that has lost its row is worth showing rather than hiding, because the
 * creator is the only person who can put it right. `undefined` is not that
 * case: it means the build's media is still loading, and a field that said
 * "unavailable" for that moment would be wrong about half the panels a
 * creator opens.
 */
function Preview({
  src,
  media,
  reference,
  alt,
  compact,
}: {
  src: string | null;
  media: BuildMedia | null | undefined;
  reference: string;
  alt: string;
  compact?: boolean;
}) {
  const size = compact ? 44 : 64;
  const kind = media?.kind ?? null;
  const meta = media
    ? [
        media.kind,
        media.width && media.height ? `${media.width}×${media.height}` : null,
        media.bytes ? formatBytes(media.bytes) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  if (media === undefined) {
    return (
      <div
        aria-hidden
        style={{
          width: size,
          height: size,
          borderRadius: 6,
          background: "rgba(255,255,255,0.02)",
          border: `1px solid ${HAIRLINE}`,
        }}
      />
    );
  }

  if (!kind) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <MediaUnavailable />
        <span
          style={{
            fontFamily: MONO,
            fontSize: 10,
            color: TEXT_MUTED,
            wordBreak: "break-all",
          }}
        >
          {reference}
        </span>
      </div>
    );
  }

  if (kind === "audio") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {src ? (
          <audio src={src} controls preload="none" style={{ width: "100%" }}>
            {alt}
          </audio>
        ) : null}
        {meta ? <Meta text={meta} /> : null}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          flexShrink: 0,
          borderRadius: 6,
          overflow: "hidden",
          background: "rgba(0,0,0,0.35)",
          border: `1px solid ${HAIRLINE}`,
        }}
      >
        {src ? (
          kind === "video" ? (
            <video
              src={src}
              preload="metadata"
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <img
              src={src}
              alt={alt}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          )
        ) : null}
      </div>
      {meta ? <Meta text={meta} /> : null}
    </div>
  );
}

function Meta({ text }: { text: string }) {
  return (
    <span
      style={{
        ...labelText,
        fontSize: 11,
        color: TEXT_MUTED,
        minWidth: 0,
        wordBreak: "break-word",
      }}
    >
      {text}
    </span>
  );
}
