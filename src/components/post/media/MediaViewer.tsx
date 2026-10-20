// MediaViewer: a post's pictures full screen (CA-07 P7).
//
// On the build page and in the composer's Preview (MediaViewerProvider), pressing a picture, or Enter on it, opens it
// over everything: the whole original picture, contained (never the crop), a round Close at the top left, "2 / 4" at
// the top centre when there are several, round previous and next at the middle of each side (hidden at the ends), and
// the ALT badge at the bottom left when the picture has a description. Esc closes; Left and Right move; on a phone a
// sideways swipe moves and a swipe down closes. A video plays with its controls. Focus stays inside and goes back to the
// picture. A Gallery card is a link to the build, so it has no provider and no viewer.

import * as Dialog from "@radix-ui/react-dialog";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { Glyph, type GlyphName } from "@/components/brand/Glyph";
import { stillFor, type MediaSrcMap } from "@/components/gallery/cardMedia";
import type { GalleryMedia } from "@/lib/build";
import type { PostMediaAttrs } from "@/lib/build/thread";
import { FIGTREE } from "@/lib/theme/type";

import { AltSheet } from "./AltSheet";
import { badgeStyle, tileKind, tileLabel } from "./GridTile";
import { PICTURE_INK, PICTURE_SHADE, VIEWER_SCRIM } from "./shade";

export const VIEWER_COPY = { close: "Close", previous: "Previous picture", next: "Next picture", title: "Pictures" } as const;

/** A swipe moves when it goes this far sideways; down this far, it closes. */
const SWIPE = 50;
const ROUND = 44;

export interface ViewerItem {
  attrs: PostMediaAttrs;
  media: GalleryMedia | undefined;
}

export interface ViewerRequest {
  items: readonly ViewerItem[];
  index: number;
  srcByPath: MediaSrcMap;
  /** Where focus goes back to. */
  returnTo: HTMLElement | null;
}

const ViewerContext = createContext<((request: ViewerRequest) => void) | null>(null);

/** Opens the viewer, inside a MediaViewerProvider; null anywhere else. */
export function useMediaViewer(): ((request: ViewerRequest) => void) | null {
  return useContext(ViewerContext);
}

export function MediaViewerProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ViewerRequest | null>(null);
  const open = useCallback((next: ViewerRequest) => setRequest(next), []);
  return (
    <ViewerContext.Provider value={open}>
      {children}
      <MediaViewer request={request} onClose={() => setRequest(null)} />
    </ViewerContext.Provider>
  );
}

function RoundButton({ label, glyph, onPress, style }: { label: string; glyph: GlyphName; onPress: () => void; style: CSSProperties }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onPress();
      }}
      style={{
        position: "absolute",
        width: ROUND,
        height: ROUND,
        padding: 0,
        boxSizing: "border-box",
        borderRadius: 999,
        border: 0,
        background: PICTURE_SHADE,
        color: PICTURE_INK,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        zIndex: 2,
        ...style,
      }}
    >
      <Glyph name={glyph} size={20} color="currentColor" />
    </button>
  );
}

export function MediaViewer({ request, onClose }: { request: ViewerRequest | null; onClose: () => void }) {
  const back = useRef<HTMLElement | null>(null);
  if (request) back.current = request.returnTo;
  return (
    <Dialog.Root open={Boolean(request)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          data-testid="media-viewer"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            back.current?.focus();
          }}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: VIEWER_SCRIM, outline: "none" }}
        >
          {request ? <Body key={request.index} request={request} onClose={onClose} /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Body({ request, onClose }: { request: ViewerRequest; onClose: () => void }) {
  const [index, setIndex] = useState(request.index);
  const [altFrom, setAltFrom] = useState<HTMLElement | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const count = request.items.length;
  const item = request.items[index];
  const kind = tileKind(item.media);
  const label = tileLabel(item.attrs.alt, kind, index, count);
  const still = useMemo(() => (item.media && (kind !== "video" || item.media.poster_path) ? stillFor(request.srcByPath, item.media) : null), [item, kind, request.srcByPath]);
  const video = kind === "video" && item.media ? (request.srcByPath.get(item.media.path) ?? null) : null;

  const go = (by: -1 | 1) => setIndex((at) => Math.max(0, Math.min(count - 1, at + by)));

  return (
    <div
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          go(-1);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          go(1);
        }
      }}
      onPointerDown={(event) => {
        start.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => {
        const from = start.current;
        start.current = null;
        if (!from) return;
        const dx = event.clientX - from.x;
        const dy = event.clientY - from.y;
        if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
        else if (dy > SWIPE * 1.6 && dy > Math.abs(dx)) onClose();
      }}
      style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", touchAction: "pan-y" }}
    >
      <Dialog.Title style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)", margin: 0 }}>{VIEWER_COPY.title}</Dialog.Title>
      {video ? (
        <video src={video} poster={still ?? undefined} controls autoPlay playsInline aria-label={label} data-viewer-media="" style={{ maxWidth: "100vw", maxHeight: "100dvh", objectFit: "contain", display: "block" }} />
      ) : still ? (
        // The whole original, contained: never the crop.
        <img src={still} alt={label} data-viewer-media="" style={{ maxWidth: "100vw", maxHeight: "100dvh", objectFit: "contain", display: "block" }} />
      ) : (
        <span role="img" aria-label={label} data-viewer-media="" />
      )}
      <Dialog.Close asChild>
        <button
          type="button"
          aria-label={VIEWER_COPY.close}
          title={VIEWER_COPY.close}
          style={{ position: "absolute", top: 16, left: 16, width: ROUND, height: ROUND, padding: 0, borderRadius: 999, border: 0, background: PICTURE_SHADE, color: PICTURE_INK, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 2 }}
        >
          <Glyph name="x" size={20} color="currentColor" />
        </button>
      </Dialog.Close>
      {count > 1 ? (
        <span data-viewer-count="" style={{ position: "absolute", top: 28, left: "50%", transform: "translateX(-50%)", fontFamily: FIGTREE, fontSize: 14, fontWeight: 500, color: PICTURE_INK, fontVariantNumeric: "tabular-nums" }}>
          {`${index + 1} / ${count}`}
        </span>
      ) : null}
      {index > 0 ? <RoundButton label={VIEWER_COPY.previous} glyph="chevl" onPress={() => go(-1)} style={{ left: 16, top: "50%", marginTop: -ROUND / 2 }} /> : null}
      {index < count - 1 ? <RoundButton label={VIEWER_COPY.next} glyph="chev" onPress={() => go(1)} style={{ right: 16, top: "50%", marginTop: -ROUND / 2 }} /> : null}
      {item.attrs.alt.trim() ? (
        <button
          type="button"
          aria-label="Image description"
          data-badge="alt"
          onClick={(event) => {
            event.stopPropagation();
            setAltFrom(event.currentTarget);
          }}
          style={{ ...badgeStyle, position: "absolute", left: 16, bottom: 24, cursor: "pointer", zIndex: 2 }}
        >
          ALT
        </button>
      ) : null}
      <AltSheet alt={altFrom ? item.attrs.alt : null} returnTo={altFrom} onClose={() => setAltFrom(null)} />
    </div>
  );
}

export default MediaViewer;
