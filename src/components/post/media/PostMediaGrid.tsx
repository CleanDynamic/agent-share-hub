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

import type { CSSProperties, ReactNode } from "react";

import type { MediaSrcMap } from "@/components/gallery/cardMedia";
import type { GalleryMedia } from "@/lib/build";
import { mediaAttrsOf, type PostMediaAttrs } from "@/lib/build/thread";
import { t } from "@/lib/theme/tokens";

import { croppedRatio, type CropSource } from "./cropStyle";
import { GridTile } from "./GridTile";

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
  /** Draws a tile's content in place of GridTile: the reader's warning cover, the viewer's opener (Part 7). */
  renderTile?: (index: number, tile: ReactNode, attrs: PostMediaAttrs) => ReactNode;
  /** The ALT badge opens the description (Part 7). Absent: it is a mark. */
  onAlt?: (index: number, badge: HTMLElement) => void;
}

/** A reader's grid. */
export function PostMediaGrid({ pictures, mediaById, srcByPath, renderTile, onAlt }: PostMediaGridProps) {
  const attrs = pictures.map(mediaAttrsOf);
  if (attrs.length === 0) return null;
  const layout = gridLayout(sourcesOf(attrs, mediaById));
  return (
    <GridFrame
      layout={layout}
      count={attrs.length}
      renderCell={(index, style, cell) => {
        const tile = (
          <GridTile
            attrs={attrs[index]}
            media={mediaById.get(attrs[index].mediaId)}
            srcByPath={srcByPath}
            cellRatio={cell.ratio}
            align={cell.align}
            index={index}
            count={attrs.length}
            reader
            onAlt={onAlt ? (badge) => onAlt(index, badge) : undefined}
          />
        );
        return (
          <div key={index} data-grid-tile={index} style={style}>
            {renderTile ? renderTile(index, tile, attrs[index]) : tile}
          </div>
        );
      }}
    />
  );
}

export default PostMediaGrid;
