// PostMediaRow: two or three pictures side by side (PT-03).
//
// ALL THE SAME HEIGHT. Each picture's width is proportional to its own aspect
// ratio, (100% minus the gaps) times its ratio over the sum of the ratios, so
// width / ratio is one number for the whole row. Nothing is cropped, nothing is
// measured, and the row's height is known before any picture loads.

import type { CSSProperties } from "react";

import type { MediaSrcMap } from "@/components/gallery/cardMedia";
import type { GalleryMedia } from "@/lib/build";
import type { ThreadPostMediaRow } from "@/lib/build/thread";

import { PostMedia, ratioOf } from "./PostMedia";
import { ROW_GAP } from "./postType";

export interface PostMediaRowProps {
  node: ThreadPostMediaRow;
  mediaById: ReadonlyMap<string, GalleryMedia>;
  srcByPath: MediaSrcMap;
  phone?: boolean;
}

/** Each picture's width as a CSS length, from the aspect ratios in the row. */
export function rowWidths(ratios: readonly number[]): string[] {
  const sum = ratios.reduce((total, ratio) => total + ratio, 0);
  const gaps = ROW_GAP * Math.max(0, ratios.length - 1);
  return ratios.map((ratio) => `calc((100% - ${gaps}px) * ${Math.round((ratio / sum) * 1e6) / 1e6})`);
}

export function PostMediaRow({ node, mediaById, srcByPath, phone = false }: PostMediaRowProps) {
  const items = (Array.isArray(node.content) ? node.content : []).filter((child) => child?.type === "postMedia");
  if (items.length === 0) return null;

  const ratios = items.map((item) => ratioOf(item.attrs, mediaById.get(item.attrs?.mediaId)));
  const widths = rowWidths(ratios);
  const row: CSSProperties = { display: "flex", gap: ROW_GAP, alignItems: "flex-start" };

  return (
    <div data-post-media-row="" style={row}>
      {items.map((item, index) => (
        <div key={index} data-post-media-slot="" data-row-width={widths[index]} style={{ flex: "none", width: widths[index], minWidth: 0 }}>
          <PostMedia node={item} mediaById={mediaById} srcByPath={srcByPath} phone={phone} inRow />
        </div>
      ))}
    </div>
  );
}
