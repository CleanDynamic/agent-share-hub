// GridView: a post's pictures in the composer's editor (CA-07).
//
// The node view of postMediaGrid. ProseMirror draws none of the grid's children and hands it every event inside it
// (extensions.ts), so the tiles, their buttons and their order are all React's. It reads the pictures from the node and
// the files from the picture store, and changes the document only through pictures.ts.

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useSyncExternalStore } from "react";

import { GridTile } from "@/components/post/media/GridTile";
import { GridFrame, gridLayout, sourcesOf } from "@/components/post/media/PostMediaGrid";
import { mediaAttrsOf } from "@/lib/build/thread";

import type { PictureHost } from "./pictures";

/** What the extension hands its views. */
export interface PictureOptions {
  host: PictureHost;
  /** Below 768px. */
  phone: boolean;
}

export function GridView(props: NodeViewProps) {
  const { node } = props;
  const { host, phone } = props.extension.options as PictureOptions;
  const snapshot = useSyncExternalStore(host.store.subscribe, host.store.getSnapshot);
  const pictures: { attrs: ReturnType<typeof mediaAttrsOf>; uploadId: string | null }[] = [];
  node.forEach((child) => pictures.push({ attrs: mediaAttrsOf(child.toJSON()), uploadId: (child.attrs.uploadId as string | null) ?? null }));
  const layout = gridLayout(sourcesOf(pictures.map((picture) => picture.attrs), snapshot.rows));
  void phone;

  return (
    <NodeViewWrapper data-grid-view="" contentEditable={false}>
      <GridFrame
        layout={layout}
        count={pictures.length}
        renderCell={(index, style, cell) => {
          const { attrs, uploadId } = pictures[index];
          return (
            <div key={uploadId ?? `${attrs.mediaId}-${index}`} data-grid-tile={index} style={style}>
              <GridTile
                attrs={attrs}
                media={snapshot.rows.get(attrs.mediaId)}
                srcByPath={snapshot.src}
                cellRatio={cell.ratio}
                align={cell.align}
                index={index}
                count={pictures.length}
                preview={uploadId ? (snapshot.previews.get(uploadId) ?? null) : null}
              />
            </div>
          );
        }}
      />
    </NodeViewWrapper>
  );
}

export default GridView;
