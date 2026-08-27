// cover: the one media row that stands for a build on a card.
//
// THE PROBLEM THIS SOLVES
// A card has to show something. Until now the only pointer a build carried was
// hero_node_id, which names a NODE rather than a picture, so getting an image
// out of it meant chasing that node's payload — and a build whose hero is a
// live_app, or which has no hero at all, produced nothing. Meanwhile the
// gallery had grown its own answer in src/components/gallery/cardMedia.ts and
// the build page had a third in src/pages/BuildPage.tsx.
//
// So there is one chain, here, and it is total: every step falls through to the
// next, and the last one is honest about returning nothing.
//
//   1. cover_media_id        the creator said which image. Nothing overrides it.
//   2. the hero node's media  what BuildPage has resolved since NS-P04.
//   3. the first evidence     screenshots and results are the pictures a build
//      node's media           already has, in the creator's own tree order.
//   4. null                   a build genuinely carrying no image. Cards lead
//                             with the outcome, set large; that is a designed
//                             branch, not a failure.
//
// WHY IT IS PURE, AND TAKES ITS INPUTS AS ARGUMENTS
// resolveCover queries nothing. Its caller has the build record and the media
// list already — BuildPage loads both, compose holds both in its workspace —
// and a resolver that fetched would be a resolver that cannot be tested and
// that turns a grid of cards back into a query per card. That discipline is
// what the rest of src/lib/build/ is built on and this file does not break it.

import { updateBuild } from "./builds";
import type { Build, BuildMedia, BuildNode } from "./types";

/**
 * The node types in the registry's `evidence` category.
 *
 * A constant rather than a lookup because resolveCover is pure: it is handed a
 * tree and a media list, not the node_types registry, and a resolver that took
 * the registry too would be a resolver no card body could call cheaply.
 *
 * These five ARE the evidence category as node_types is seeded (NS-P02) and
 * must be kept in step with it. A type added to that category and not to this
 * list costs a build its automatic cover; it costs nothing else.
 *
 * The order here is deliberately NOT a preference order — unlike EVIDENCE_TYPES
 * in src/components/gallery/cardMedia.ts, which ranks screenshots above eval
 * runs because a card wants the most pictorial thing. This is a membership set,
 * and the chain below walks the TREE in the creator's own order. The creator
 * put their best evidence first; that is a better signal than a fixed ranking.
 */
export const EVIDENCE_NODE_TYPES: ReadonlySet<string> = new Set([
  "comparison_table",
  "eval_run",
  "recording",
  "result",
  "screenshot",
]);

/** The header fields the chain reads. Any build row satisfies this. */
export type CoverSource = Pick<Build, "cover_media_id" | "hero_node_id">;

/**
 * The node fields the chain reads, nested if the caller has a nested tree.
 *
 * Deliberately narrower than BuildNode. The build page hands this a NodeTree;
 * the gallery card (NS-P31) hands it the flat, position-ordered node window
 * that came back on the card query, which carries no children and only the
 * columns a card body reads. Asking for a whole BuildNode would have made the
 * gallery cast, and a cast is how two surfaces start disagreeing about which
 * image a build leads with.
 */
export type CoverNode = Pick<BuildNode, "id" | "type" | "payload" | "is_gap"> & {
  readonly children?: readonly CoverNode[];
};

/**
 * The media fields the chain reads. Any build_media row satisfies this, as
 * does the gallery's narrower embedded row.
 */
export type CoverMedia = Pick<BuildMedia, "id" | "node_id">;

/**
 * The media id a node points at, or null.
 *
 * media_id is the field key every type carrying one media reference declares.
 * generated_media instead holds a list of variants, and the one that speaks
 * for the node is the chosen one — falling back to the first, so a node whose
 * creator has not chosen yet still has a hero candidate.
 *
 * MOVED HERE FROM src/components/build/MediaFigure.tsx, unchanged, because the
 * build page and the cover chain were about to read a payload the same way in
 * two places. It is payload reading with no React in it, so the data layer is
 * where it belongs; BuildPage now imports it from here. MediaFigure keeps its
 * own copy for the compose frame until NS-P28 touches that file.
 */
export function nodeMediaId(
  node: Pick<BuildNode, "payload"> | null | undefined
): string | null {
  const payload =
    node?.payload && typeof node.payload === "object" && !Array.isArray(node.payload)
      ? (node.payload as Record<string, unknown>)
      : null;
  if (!payload) return null;

  const direct = payload.media_id;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const variants = payload.variants;
  if (Array.isArray(variants)) {
    const records = variants.filter(
      (variant): variant is Record<string, unknown> =>
        Boolean(variant) && typeof variant === "object" && !Array.isArray(variant)
    );
    const chosen = records.find((variant) => variant.chosen === true) ?? records[0];
    const id = chosen?.media_id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }

  return null;
}

/**
 * Every placed node, depth first, in the order the tree renders.
 *
 * Depth first rather than level order because that IS reading order: a
 * screenshot nested under the first step comes before the second step, exactly
 * as it does on the page. The tray is absent by construction — it is not part
 * of the tree — which is right: nothing unplaced should become a build's cover.
 */
function flatten(tree: readonly CoverNode[]): CoverNode[] {
  const out: CoverNode[] = [];
  const walk = (nodes: readonly CoverNode[]) => {
    for (const node of nodes) {
      out.push(node);
      if (node.children && node.children.length > 0) walk(node.children);
    }
  };
  walk(tree);
  return out;
}

/** One media row by id, out of the list already loaded. */
function byId<M extends CoverMedia>(media: readonly M[], id: string | null): M | null {
  if (!id) return null;
  return media.find((row) => row.id === id) ?? null;
}

/**
 * The image that stands for this build, or null if it has none.
 *
 * Each step is skipped, not failed, when the row it names has gone: a
 * cover_media_id whose media was deleted falls through to the hero rather than
 * blanking the card. The database does clear that pointer — the FK is ON DELETE
 * SET NULL — but a caller can be holding a build row read before the delete,
 * and a card that renders nothing because of a race is worse than one that
 * shows the next-best thing.
 */
export function resolveCover<M extends CoverMedia>(
  build: CoverSource | null | undefined,
  tree: readonly CoverNode[],
  media: readonly M[]
): M | null {
  if (!build) return null;

  // 1. The creator's explicit choice.
  const chosen = byId(media, build.cover_media_id);
  if (chosen) return chosen;

  const nodes = flatten(tree);

  // 2. The hero node's media, resolved exactly as BuildPage resolves it:
  //    through the node's PAYLOAD. A hero whose media is attached by node_id
  //    alone is not a hero the page renders either, so this agrees with what a
  //    reader already sees rather than inventing a fourth answer.
  if (build.hero_node_id) {
    const hero = nodes.find((node) => node.id === build.hero_node_id);
    const heroMedia = byId(media, nodeMediaId(hero));
    if (heroMedia) return heroMedia;
  }

  // 3. The first evidence node carrying an image, in tree order.
  //
  //    Attached rows first, then the payload reference — both attachment paths
  //    exist in the record, and cardMedia.evidenceMedia already reads them in
  //    this order. A cover that disagreed with the card the gallery renders
  //    would be a bug the moment a compose preview showed it.
  //
  //    A gap is the creator saying "this part is missing". It is never a cover:
  //    that would put an admitted hole on the card as if it were the work.
  for (const node of nodes) {
    if (node.is_gap || !EVIDENCE_NODE_TYPES.has(node.type)) continue;

    const attached = media.find((row) => row.node_id === node.id);
    if (attached) return attached;

    const referenced = byId(media, nodeMediaId(node));
    if (referenced) return referenced;
  }

  // 4. Nothing. The card leads with the outcome.
  return null;
}

/**
 * Set or clear the build's cover.
 *
 * Passing null is not an error state — it is how a creator says "go back to
 * whatever the chain picks", which is the state every build starts in.
 *
 * No check that the media belongs to this build: the write goes through the
 * same RLS as any other header edit, and a cover pointing at another build's
 * object is unreadable anyway, because the storage policies gate an object on
 * the build id in its path prefix. Adding a verifying read here would cost a
 * round trip on every save to prevent a state that already renders as nothing.
 */
export async function setCover(
  buildId: string,
  mediaId: string | null
): Promise<Build> {
  return updateBuild(buildId, { cover_media_id: mediaId });
}
