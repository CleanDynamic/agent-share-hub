/* A prompt's attachments as one row: pictures as square thumbnails, files as chips with their type's mark, name and size, and
   a placeholder (named by an import, never brought) as a dashed chip. The composer's tile draws it at 56 (48 on a phone), with
   "+2" when there are more than it shows; the build page draws it at 72, each picture opening full size in the picture viewer
   and each file opening through the signed media path, with its note under it.

   Reads each picture's media row by id, as `ManualThumb` does; nothing here writes. */

import { useEffect, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";

import { useMediaSrc } from "@/components/build/MediaFigure";
import { MediaViewerProvider, useMediaViewer, type ViewerItem } from "@/components/post/media/MediaViewer";
import { ATTACHMENT_COPY, type Attachment } from "@/lib/build/attachments";
import { getMediaById, signedMediaUrl } from "@/lib/build/media";
import type { BuildMedia, GalleryMedia } from "@/lib/build";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, textStep } from "@/lib/theme/type";
import { space } from "@/lib/theme/space";
import { fileSize } from "@/pages/site/compose/detailsModel";

import { FileMark } from "./tileBodies";

/** A thumbnail's corner, as the brand pack draws attachments. Not on the radius scale: it is the attachment's own. */
export const ATTACHMENT_RADIUS = 9;
/** The sizes the strip is drawn at: the composer's tile, the tile on a phone, and the build page and the window. */
export const ATTACHMENT_SIZE = { tile: 56, phone: 48, reader: 72 } as const;
/** How many the tile shows before "+n". */
export const TILE_SHOWN = { desktop: 6, phone: 4 } as const;

const META = 12;

function useMediaRow(mediaId: string | null): BuildMedia | null {
  const [media, setMedia] = useState<BuildMedia | null>(null);
  useEffect(() => {
    if (!mediaId) return;
    let live = true;
    getMediaById(mediaId)
      .then((row) => live && setMedia(row))
      .catch(() => live && setMedia(null));
    return () => {
      live = false;
    };
  }, [mediaId]);
  return media;
}

/** A stored file opened in a new tab: the tab opens in the click, then goes to the signed link. */
export function openAttachmentFile(mediaId: string): void {
  const tab = window.open("about:blank", "_blank");
  if (tab) tab.opener = null;
  void getMediaById(mediaId)
    .then((media) => (media ? signedMediaUrl(media, { width: "original" }) : null))
    .then((url) => {
      if (url && tab) tab.location.href = url;
      else tab?.close();
    })
    .catch(() => tab?.close());
}

const bare: CSSProperties = { appearance: "none", background: "none", border: 0, padding: 0, margin: 0, font: "inherit", color: "inherit", cursor: "pointer", textAlign: "left" };

function Thumb({ attachment, side }: { attachment: Attachment; side: number }) {
  const media = useMediaRow(attachment.mediaId);
  const src = useMediaSrc(media, side * 2);
  return (
    <span data-testid="attachment-thumb" aria-hidden="true" style={{ width: side, height: side, flexShrink: 0, borderRadius: ATTACHMENT_RADIUS, overflow: "hidden", border: `1px solid ${t.line}`, background: t.cell, display: "inline-block", boxSizing: "border-box" }}>
      {src ? <img src={src} alt={attachment.name} width={side} height={side} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : null}
    </span>
  );
}

function FileChip({ attachment, side }: { attachment: Attachment; side: number }) {
  const size = fileSize(attachment.size);
  return (
    <span data-testid="attachment-chip" style={{ height: side, maxWidth: 220, display: "inline-flex", alignItems: "center", gap: space[2], padding: `0 ${space[3]}px 0 ${space[2]}px`, boxSizing: "border-box", borderRadius: ATTACHMENT_RADIUS, border: `1px solid ${t.line}`, background: t.cell, flexShrink: 0, minWidth: 0 }}>
      <FileMark kind={attachment.kind} size={Math.min(32, side - 16)} />
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontFamily: FIGTREE, fontSize: textStep.meta, fontWeight: 500, lineHeight: "16px", color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{attachment.name}</span>
        {size ? <span style={{ fontFamily: DM_MONO, fontSize: META, lineHeight: "16px", color: t.label, fontVariantNumeric: "tabular-nums" }}>{size}</span> : null}
      </span>
    </span>
  );
}

function PlaceholderChip({ attachment, side }: { attachment: Attachment; side: number }) {
  return (
    <span data-testid="attachment-placeholder" style={{ height: side, maxWidth: 260, display: "inline-flex", alignItems: "center", padding: `0 ${space[3]}px`, boxSizing: "border-box", borderRadius: ATTACHMENT_RADIUS, border: `1px dashed ${t.line}`, color: t.label, flexShrink: 0, minWidth: 0, fontFamily: FIGTREE, fontSize: META, lineHeight: "16px" }}>
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ATTACHMENT_COPY.placeholder(attachment.name)}</span>
    </span>
  );
}

/** One attachment as it is drawn, at `side`. */
export function AttachmentItem({ attachment, side }: { attachment: Attachment; side: number }) {
  if (!attachment.mediaId) return <PlaceholderChip attachment={attachment} side={side} />;
  return attachment.kind === "picture" ? <Thumb attachment={attachment} side={side} /> : <FileChip attachment={attachment} side={side} />;
}

const rowStyle = (indent: number): CSSProperties => ({ display: "flex", alignItems: "flex-start", gap: space[2], overflowX: "auto", overflowY: "hidden", paddingLeft: indent, minWidth: 0, scrollbarWidth: "thin" });

/** The tile's strip: one row that scrolls sideways, with "+n" past what it shows. Clicks stay on the strip, so the tile is not selected. */
export function TileAttachmentStrip({ attachments, phone, indent = 0 }: { attachments: readonly Attachment[]; phone: boolean; indent?: number }) {
  if (attachments.length === 0) return null;
  const side = phone ? ATTACHMENT_SIZE.phone : ATTACHMENT_SIZE.tile;
  const shown = attachments.slice(0, phone ? TILE_SHOWN.phone : TILE_SHOWN.desktop);
  const more = attachments.length - shown.length;
  return (
    <div data-testid="attachment-strip" data-size={side} aria-label={ATTACHMENT_COPY.count(attachments.length)} role="list" style={rowStyle(indent)}>
      {shown.map((attachment) => (
        <span key={attachment.id} role="listitem" aria-label={attachment.name} style={{ display: "inline-flex", flexShrink: 0 }}>
          <AttachmentItem attachment={attachment} side={side} />
        </span>
      ))}
      {more > 0 ? (
        <span data-testid="attachment-more" role="listitem" style={{ height: side, minWidth: side, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: ATTACHMENT_RADIUS, background: t.cell, color: t.text2, fontFamily: DM_MONO, fontSize: META, flexShrink: 0 }}>
          {ATTACHMENT_COPY.more(more)}
        </span>
      ) : null}
    </div>
  );
}

/** The viewer's items for the pictures among `attachments`, with their full-size signed links. */
async function viewerItemsOf(pictures: readonly Attachment[]): Promise<{ items: ViewerItem[]; srcByPath: Map<string, string> }> {
  const rows = await Promise.all(pictures.map((picture) => (picture.mediaId ? getMediaById(picture.mediaId).catch(() => null) : Promise.resolve(null))));
  const srcByPath = new Map<string, string>();
  const items: ViewerItem[] = [];
  for (const [index, row] of rows.entries()) {
    if (!row) continue;
    const url = await signedMediaUrl(row, { width: "original" }).catch(() => null);
    if (url) srcByPath.set(row.path, url);
    const media = { id: row.id, node_id: null, bucket: row.bucket, path: row.path, kind: row.kind, width: row.width ?? null, height: row.height ?? null, poster_path: null, duration: null, post_position: null, post_text: null } as unknown as GalleryMedia;
    items.push({ attrs: { mediaId: row.path, w: null, h: null, alt: pictures[index].note ?? "", crop: null, aspect: null, zoom: null, warn: [], width: 100, caption: "" } as unknown as ViewerItem["attrs"], media });
  }
  return { items, srcByPath };
}

function ReaderStripBody({ attachments, side, indent, after }: { attachments: readonly Attachment[]; side: number; indent: number; after?: ReactNode }) {
  const view = useMediaViewer();
  const pictures = attachments.filter((attachment) => attachment.kind === "picture" && attachment.mediaId);
  const open = (attachment: Attachment, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!attachment.mediaId) return;
    if (attachment.kind !== "picture") {
      openAttachmentFile(attachment.mediaId);
      return;
    }
    const returnTo = event.currentTarget;
    void viewerItemsOf(pictures).then(({ items, srcByPath }) => {
      const index = Math.max(0, pictures.findIndex((picture) => picture.id === attachment.id));
      if (items.length > 0) view?.({ items, index: Math.min(index, items.length - 1), srcByPath, returnTo });
    });
  };
  return (
    <div data-testid="attachment-strip" data-size={side} role="list" aria-label={ATTACHMENT_COPY.count(attachments.length)} style={{ ...rowStyle(indent), alignItems: "flex-start" }}>
      {attachments.map((attachment) => (
        <div key={attachment.id} role="listitem" style={{ display: "flex", flexDirection: "column", gap: space[1], flexShrink: 0, maxWidth: attachment.kind === "picture" ? side : 220 }}>
          {attachment.mediaId ? (
            <button type="button" aria-label={ATTACHMENT_COPY.open(attachment.name)} onClick={(event) => open(attachment, event)} style={{ ...bare, display: "inline-flex", borderRadius: ATTACHMENT_RADIUS }}>
              <AttachmentItem attachment={attachment} side={side} />
            </button>
          ) : (
            <AttachmentItem attachment={attachment} side={side} />
          )}
          {attachment.note ? (
            <span data-testid="attachment-note" style={{ fontFamily: FIGTREE, fontSize: META, lineHeight: "16px", color: t.label, overflowWrap: "anywhere" }}>
              {attachment.note}
            </span>
          ) : null}
        </div>
      ))}
      {after}
    </div>
  );
}

/** The reader's one meta line under a message: model, effort and what the app added, 12/16 Text 3. */
export function MessageMetaLine({ line, indent = 0 }: { line: string | null; indent?: number }) {
  if (!line) return null;
  return (
    <p data-testid="message-meta" style={{ fontFamily: FIGTREE, fontSize: META, lineHeight: "16px", color: t.label, margin: 0, paddingLeft: indent, overflowWrap: "anywhere" }}>
      {line}
    </p>
  );
}

/** The build page's strip: 72 (48 on a phone), each one opening, each note under it. Brings its own viewer where the page has none. */
export function ReaderAttachmentStrip({ attachments, phone = false, indent = 0 }: { attachments: readonly Attachment[]; phone?: boolean; indent?: number }) {
  const hasViewer = Boolean(useMediaViewer());
  if (attachments.length === 0) return null;
  const side = phone ? ATTACHMENT_SIZE.phone : ATTACHMENT_SIZE.reader;
  const body = <ReaderStripBody attachments={attachments} side={side} indent={indent} />;
  return hasViewer ? body : <MediaViewerProvider>{body}</MediaViewerProvider>;
}
