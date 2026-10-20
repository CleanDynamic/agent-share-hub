// PostMediaGrid: a post's pictures as X draws them (CA-07).
//
// One block after the words: radius 16, a 1px hairline round it and 2px hairline lines between the pictures. One
// picture is its own shape (after its crop) held between 3:4 and 2:1, shown whole inside that range; beyond it, a tall
// picture is cut from the top and a wide one from the middle. Two sit side by side in a 16:9 block; three are one tall
// on the left and two stacked; four are two by two. Each of two to four fills its cell, cut from the middle after its
// own crop.
//
// THE HEIGHT IS SET BEFORE ANY BYTES LOAD, from w, h, crop and the count (`gridLayout`), so nothing moves when a
// picture arrives. The editor's node view (GridView) draws the same frame with its own controls in each cell
// (`GridFrame`); readers get `PostMediaGrid`.

import { useState, type CSSProperties, type ReactNode } from "react";

import type { MediaSrcMap } from "@/components/gallery/cardMedia";
import type { GalleryMedia } from "@/lib/build";
import { mediaAttrsOf, type MediaWarning, type PostMediaAttrs } from "@/lib/build/thread";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { croppedRatio, type CropSource } from "./cropStyle";
import { AltSheet } from "./AltSheet";
import { GridTile, tileKind, tileLabel } from "./GridTile";
import { useMediaViewer } from "./MediaViewer";
import { PICTURE_INK, PICTURE_SHADE } from "./shade";

/** A single picture is held between these shapes (width over height). */
export const MIN_RATIO = 3 / 4;
export const MAX_RATIO = 2;
/** Two, three and four sit in a block of this shape. */
export const BLOCK_RATIO = 16 / 9;
/** The lines between pictures. */
export const GRID_GAP = 2;
export const GRID_RADIUS = 16;

export interface GridCell {
  /** The cell's width over height, for cropStyle. */
  ratio: number;
  /** Where a cut keeps the picture. */
  align: "middle" | "top";
  /** Its place in the CSS grid. */
  area: CSSProperties;
}

export interface GridLayout {
  /** The block's width over height. */
  ratio: number;
  columns: string;
  rows: string;
  cells: GridCell[];
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** The grid's shape for these pictures, known from their sizes and crops alone. */
export function gridLayout(sources: readonly CropSource[]): GridLayout {
  const count = sources.length;
  if (count <= 1) {
    const own = croppedRatio(sources[0] ?? { w: null, h: null, crop: null });
    const ratio = clamp(own, MIN_RATIO, MAX_RATIO);
    return { ratio, columns: "1fr", rows: "1fr", cells: [{ ratio, align: own < MIN_RATIO ? "top" : "middle", area: {} }] };
  }
  if (count === 2) {
    const half = { ratio: 8 / 9, align: "middle" as const };
    return { ratio: BLOCK_RATIO, columns: "1fr 1fr", rows: "1fr", cells: [{ ...half, area: { gridColumn: 1, gridRow: 1 } }, { ...half, area: { gridColumn: 2, gridRow: 1 } }] };
  }
  if (count === 3) {
    return {
      ratio: BLOCK_RATIO,
      columns: "1fr 1fr",
      rows: "1fr 1fr",
      cells: [
        { ratio: 8 / 9, align: "middle", area: { gridColumn: 1, gridRow: "1 / span 2" } },
        { ratio: 16 / 9, align: "middle", area: { gridColumn: 2, gridRow: 1 } },
        { ratio: 16 / 9, align: "middle", area: { gridColumn: 2, gridRow: 2 } },
      ],
    };
  }
  // Four, two by two; an old post with more keeps them all, two a row, until the maker fixes it.
  const rows = Math.ceil(count / 2);
  return {
    ratio: count === 4 ? BLOCK_RATIO : (2 * BLOCK_RATIO) / rows,
    columns: "1fr 1fr",
    rows: `repeat(${rows}, 1fr)`,
    cells: sources.map((_, index) => ({ ratio: 16 / 9, align: "middle" as const, area: { gridColumn: (index % 2) + 1, gridRow: Math.floor(index / 2) + 1 } })),
  };
}

/** The crop sources of some pictures: their sizes (the row's when the node has none) and, for a still, the crop. */
export function sourcesOf(pictures: readonly PostMediaAttrs[], mediaById: ReadonlyMap<string, GalleryMedia>): CropSource[] {
  return pictures.map((attrs) => {
    const media = mediaById.get(attrs.mediaId);
    return { w: attrs.w ?? media?.width ?? null, h: attrs.h ?? media?.height ?? null, crop: media?.kind === "video" ? null : attrs.crop };
  });
}

/** "4 pictures", "1 picture": what the group reads. */
export function gridLabel(count: number): string {
  return count === 1 ? "1 picture" : `${count} pictures`;
}

export interface GridFrameProps {
  layout: GridLayout;
  count: number;
  /** Draws cell `index`, given the style its element takes. */
  renderCell: (index: number, style: CSSProperties, cell: GridCell) => ReactNode;
}

/** The block itself: radius 16, the hairline round it and between the pictures, its shape reserved. */
export function GridFrame({ layout, count, renderCell }: GridFrameProps) {
  return (
    <div
      role="group"
      aria-label={gridLabel(count)}
      data-post-media-grid=""
      data-count={count}
      style={{
        display: "grid",
        gridTemplateColumns: layout.columns,
        gridTemplateRows: layout.rows,
        gap: GRID_GAP,
        aspectRatio: String(Math.round(layout.ratio * 1e4) / 1e4),
        width: "100%",
        boxSizing: "border-box",
        borderRadius: GRID_RADIUS,
        overflow: "hidden",
        border: `1px solid ${t.hairline}`,
        background: t.hairline,
      }}
    >
      {layout.cells.map((cell, index) =>
        renderCell(index, { position: "relative", overflow: "hidden", minWidth: 0, minHeight: 0, background: t.tile, ...cell.area }, cell),
      )}
    </div>
  );
}

export interface PostMediaGridProps {
  /** The grid's postMedia nodes, as stored. */
  pictures: readonly unknown[];
  mediaById: ReadonlyMap<string, GalleryMedia>;
  srcByPath: MediaSrcMap;
  phone?: boolean;
}

/** Every sentence a reader's grid says. */
export const READER_COPY = {
  warning: (warn: readonly MediaWarning[]) => `Content warning: ${warn.map((name) => WARNING_NAMES[name]).join(", ")}`,
  flagged: "The maker flagged this picture.",
  show: "Show",
} as const;

const WARNING_NAMES: Record<MediaWarning, string> = { nudity: "Nudity", violence: "Violence", sensitive: "Sensitive" };

/** A reader's grid: the ALT badge opens the description, a flagged picture is covered, and (inside a MediaViewerProvider) a picture opens full screen. */
export function PostMediaGrid({ pictures, mediaById, srcByPath }: PostMediaGridProps) {
  const attrs = pictures.map(mediaAttrsOf);
  const viewer = useMediaViewer();
  const [alt, setAlt] = useState<{ index: number; from: HTMLElement } | null>(null);
  if (attrs.length === 0) return null;
  const layout = gridLayout(sourcesOf(attrs, mediaById));
  const items = attrs.map((one) => ({ attrs: one, media: mediaById.get(one.mediaId) }));
  return (
    <>
      <GridFrame
        layout={layout}
        count={attrs.length}
        renderCell={(index, style, cell) => (
          <div key={index} data-grid-tile={index} style={style}>
            <ReaderTile
              attrs={attrs[index]}
              media={items[index].media}
              srcByPath={srcByPath}
              cell={cell}
              index={index}
              count={attrs.length}
              onAlt={(from) => setAlt({ index, from })}
              onOpen={viewer ? (from) => viewer({ items, index, srcByPath, returnTo: from }) : undefined}
            />
          </div>
        )}
      />
      <AltSheet alt={alt ? attrs[alt.index]?.alt ?? null : null} returnTo={alt?.from ?? null} onClose={() => setAlt(null)} />
    </>
  );
}

function ReaderTile({
  attrs,
  media,
  srcByPath,
  cell,
  index,
  count,
  onAlt,
  onOpen,
}: {
  attrs: PostMediaAttrs;
  media: GalleryMedia | undefined;
  srcByPath: MediaSrcMap;
  cell: GridCell;
  index: number;
  count: number;
  onAlt: (from: HTMLElement) => void;
  onOpen?: (from: HTMLElement) => void;
}) {
  const [shown, setShown] = useState(false);
  const covered = attrs.warn.length > 0 && !shown;
  const label = tileLabel(attrs.alt, tileKind(media), index, count);
  return (
    <GridTile
      attrs={attrs}
      media={media}
      srcByPath={srcByPath}
      cellRatio={cell.ratio}
      align={cell.align}
      index={index}
      count={count}
      reader
      badges={!covered}
      onAlt={onAlt}
      pictureStyle={covered ? { filter: "blur(28px)", transform: "scale(1.1)" } : undefined}
    >
      {covered ? (
        <span data-warning-cover="" style={{ position: "absolute", inset: 0, zIndex: 2, background: PICTURE_SHADE, color: PICTURE_INK, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, textAlign: "center", boxSizing: "border-box" }}>
          <span style={{ fontFamily: FIGTREE, fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{READER_COPY.warning(attrs.warn)}</span>
          <span style={{ fontFamily: FIGTREE, fontSize: 13, fontWeight: 400, lineHeight: 1.4 }}>{READER_COPY.flagged}</span>
          <button
            type="button"
            onClick={(event) => {
              // A Gallery card is a link; Show belongs to the picture.
              event.preventDefault();
              event.stopPropagation();
              setShown(true);
            }}
            style={{ marginTop: 4, height: 32, padding: "0 16px", borderRadius: 999, border: `1px solid ${PICTURE_INK}`, background: "transparent", color: PICTURE_INK, fontFamily: FIGTREE, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            {READER_COPY.show}
          </button>
        </span>
      ) : onOpen ? (
        <button
          type="button"
          aria-label={label}
          data-open-viewer=""
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onOpen(event.currentTarget);
          }}
          style={{ position: "absolute", inset: 0, zIndex: 0, padding: 0, border: 0, background: "transparent", cursor: "zoom-in" }}
        />
      ) : null}
    </GridTile>
  );
}

export default PostMediaGrid;
