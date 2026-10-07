// The composer's cover: one picture or video that is both what the Gallery
// shows first and the build's evidence (UI-P47).
//
// THE SET IS THE SOURCE OF TRUTH. The cover is the first picture in the post's
// media set (cover.ts); `cover_media_id` is a mirror the set maintains, and
// nothing here writes it. The evidence is a placed node whose payload.media_id
// is that picture, so the build's completeness counts it.
//
// EVERY NODE IS PLACED. Omitting `position` puts a node in the tray, and tray
// nodes do not count towards publishing. `nextTopPosition` reads the tree and
// returns one past the highest top-level position, because the unique index on
// (build_id, parent_id, position) refuses a collision.

import { addPostMedia, getPostMedia, removePostMedia, setPostMedia } from "./cover";
import { EVIDENCE_NODE_TYPES, nodeMediaId } from "./cover";
import { deleteMedia, mediaKindFor, uploadMedia } from "./media";
import { deleteNode, getNodeTree, upsertNode } from "./nodes";
import type { BuildMedia, BuildNode, NodeTree } from "./types";

/** The node type a cover of this kind is recorded as. */
export function coverNodeType(kind: string | null | undefined): "recording" | "screenshot" {
  return kind === "video" ? "recording" : "screenshot";
}

/** One past the highest top-level position, so a new node is placed and never collides. */
export function nextTopPosition(tree: readonly Pick<NodeTree, "parent_id" | "position">[]): number {
  let highest = 0;
  for (const node of tree) {
    if (node.parent_id === null && typeof node.position === "number" && node.position > highest) {
      highest = node.position;
    }
  }
  return highest + 1;
}

/** The mime types the composer's file input accepts: images and video only. */
export function coverMediaTypes(accepted: readonly string[]): string[] {
  return accepted.filter((mime) => {
    const kind = mediaKindFor(mime);
    return kind === "image" || kind === "video";
  });
}

/** Every node in the tree, parents before children. */
function flatten(tree: readonly NodeTree[]): NodeTree[] {
  const out: NodeTree[] = [];
  const walk = (nodes: readonly NodeTree[]) => {
    for (const node of nodes) {
      out.push(node);
      walk(node.children ?? []);
    }
  };
  walk(tree);
  return out;
}

/** The evidence node that carries this picture, if there is one. */
export function coverNodeFor(tree: readonly NodeTree[], mediaId: string): NodeTree | null {
  return (
    flatten(tree).find((node) => EVIDENCE_NODE_TYPES.has(node.type) && nodeMediaId(node) === mediaId) ?? null
  );
}

/** The build's cover: the first picture in the post's media set, or null. */
export async function getComposerCover(buildId: string): Promise<BuildMedia | null> {
  const set = await getPostMedia(buildId);
  return set[0] ?? null;
}

export interface CoverWrite {
  buildId: string;
  file: File;
  onProgress?: (fraction: number) => void;
}

async function placeCoverNode(buildId: string, media: BuildMedia): Promise<BuildNode> {
  const tree = await getNodeTree(buildId);
  return upsertNode({
    build_id: buildId,
    parent_id: null,
    position: nextTopPosition(tree),
    type: coverNodeType(media.kind),
    payload: { media_id: media.id, caption: null },
  });
}

/**
 * Add the cover: upload, put it in the post's set, record it as evidence.
 *
 * A failure after the upload takes the upload back, so a refused write does not
 * leave a file nobody can see.
 */
export async function addComposerCover({ buildId, file, onProgress }: CoverWrite): Promise<BuildMedia> {
  const media = await uploadMedia({ buildId, file, onProgress });
  let inSet = false;
  try {
    await addPostMedia(buildId, media.id);
    inSet = true;
    await placeCoverNode(buildId, media);
    return media;
  } catch (cause) {
    if (inSet) await removePostMedia(buildId, media.id).catch(() => undefined);
    await deleteMedia(media.id).catch(() => undefined);
    throw cause;
  }
}

/**
 * Replace the cover. The new file goes up first, so a failed upload leaves the
 * old cover as it was; the set swaps the one slot in a single write, so the
 * build is never without a cover in between; the old file is deleted last.
 */
export async function replaceComposerCover({
  buildId,
  file,
  onProgress,
  current,
}: CoverWrite & { current: BuildMedia | null }): Promise<BuildMedia> {
  if (!current) return addComposerCover({ buildId, file, onProgress });

  const media = await uploadMedia({ buildId, file, onProgress });
  try {
    const set = await getPostMedia(buildId);
    const ids = set.map((row) => row.id);
    const next = ids.includes(current.id) ? ids.map((id) => (id === current.id ? media.id : id)) : [media.id, ...ids];
    await setPostMedia(buildId, next);

    const tree = await getNodeTree(buildId);
    const node = coverNodeFor(tree, current.id);
    if (node) {
      const payload = node.payload && typeof node.payload === "object" && !Array.isArray(node.payload) ? node.payload : {};
      await upsertNode({
        id: node.id,
        build_id: node.build_id,
        parent_id: node.parent_id,
        position: node.position,
        title: node.title,
        note: node.note,
        source_ref: node.source_ref,
        event_id: node.event_id,
        is_gap: node.is_gap,
        type: coverNodeType(media.kind),
        payload: { ...(payload as Record<string, unknown>), media_id: media.id },
      });
    } else {
      await placeCoverNode(buildId, media);
    }
  } catch (cause) {
    await deleteMedia(media.id).catch(() => undefined);
    throw cause;
  }

  await deleteMedia(current.id).catch(() => undefined);
  return media;
}

/** Remove the cover: out of the set, its evidence node deleted, its file deleted. */
export async function removeComposerCover(buildId: string, current: BuildMedia): Promise<void> {
  await removePostMedia(buildId, current.id);
  const tree = await getNodeTree(buildId);
  const node = coverNodeFor(tree, current.id);
  if (node) await deleteNode(node.id);
  await deleteMedia(current.id);
}
