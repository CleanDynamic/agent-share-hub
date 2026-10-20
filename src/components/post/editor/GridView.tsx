// GridView: a post's pictures in the composer's editor (CA-07).
//
// The node view of postMediaGrid. ProseMirror draws none of the grid's children and hands it every event inside it
// (extensions.ts), so the tiles, their buttons and their order are all React's. It reads the pictures from the node and
// the files from the picture store, and changes the document only through pictures.ts.

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useSyncExternalStore } from "react";

import { PostMedia } from "@/components/post/PostMedia";
import type { ThreadPostMedia } from "@/lib/build/thread";

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
  const pictures: ThreadPostMedia[] = [];
  node.forEach((child) => pictures.push(child.toJSON() as ThreadPostMedia));

  return (
    <NodeViewWrapper data-post-media-grid="" contentEditable={false} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {pictures.map((picture, index) => (
        <PostMedia key={index} node={picture} mediaById={snapshot.rows} srcByPath={snapshot.src} phone={phone} inRow />
      ))}
    </NodeViewWrapper>
  );
}

export default GridView;
