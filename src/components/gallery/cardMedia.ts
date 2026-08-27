// What a gallery card shows, and how it gets a URL for it.
//
// TWO JOBS, AND THEY HAVE TO AGREE.
//
// The bodies pick the media they render. The page has to sign those same rows
// before any body runs, because signing them one at a time is how a grid of
// twenty-four cards turns into twenty-four requests. So the selection lives
// here as pure functions, the page calls cardMedia() to collect what the whole
// page needs, and the bodies call the same helpers to pick what they show. One
// definition each, used from both sides.
//
// WHY THE SIGNING IS NOW ONE REQUEST PER IMAGE, which reverses the call this
// file used to make and is not an oversight either way:
// build-media is a private bucket, so an <img> needs a signed URL. Supabase
// signs a transform INTO the token — the batch endpoint takes no transform, and
// appending width to a batch-signed URL is silently ignored by the render
// endpoint (measured: the same 1630px original comes back for width=640 and
// width=240 alike). So the choice is exactly two options: one request serving
// full-size originals into 300px slots, or one request per image serving
// card-sized derivatives.
//
// It now takes the second, because the thing the gallery is short of is BYTES,
// not round trips. On a real card image the difference measured against the dev
// project is 273KB original against 105KB at card width — and a signing call is
// a ~600 byte JSON POST, issued for every row in one Promise.allSettled over an
// already-open HTTP/2 connection. Twenty-four of those cost one round trip's
// latency; twenty-four originals cost six megabytes.
//
// The count is kept down by signing only what a card can actually put on
// screen: the ONE row its body leads with, plus the variant grid for the one
// shape that renders a grid. That is why cardMedia is no longer a superset.

import { useEffect, useState } from "react";
import {
  BUILD_MEDIA_BUCKET,
  resolveCover,
  signedMediaUrl,
  type GalleryBuild,
  type GalleryMedia,
  type GalleryNode,
  type MediaRef,
} from "@/lib/build";
import { MEDIA_WIDTH } from "@/components/build/MediaFigure";
import type { Json } from "@/integrations/supabase/types";

/** At most this many media rows per card. A variant grid is the only plural. */
export const VARIANT_GRID_MAX = 4;

// =============================================================================
// Reading a node payload
// =============================================================================

/** A payload as an object, or an empty one. Never throws on a null column. */
export function payloadOf(node: GalleryNode | null | undefined): Record<string, Json> {
  const payload = node?.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  return payload as Record<string, Json>;
}

/** A payload field as trimmed text, or null. */
export function textField(
  node: GalleryNode | null | undefined,
  key: string
): string | null {
  const value = payloadOf(node)[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** A payload field as a finite number, or null. 0 is a value, not an absence. */
export function numberField(
  node: GalleryNode | null | undefined,
  key: string
): number | null {
  const value = payloadOf(node)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** A payload list field as an array of objects. Empty for anything else. */
export function listField(
  node: GalleryNode | null | undefined,
  key: string
): Record<string, Json>[] {
  const value = payloadOf(node)[key];
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is Record<string, Json> =>
      Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
  );
}

// =============================================================================
// Finding a node
// =============================================================================

/** The first placed node of any of these types, in position order. */
export function firstNodeOfType(
  build: GalleryBuild,
  ...types: string[]
): GalleryNode | null {
  const wanted = new Set(types);
  const found = build.nodes
    // A gap is the creator saying "this part is missing". A card must never
    // lead with one: it would show an admitted hole as if it were the work.
    .filter((node) => !node.is_gap && wanted.has(node.type))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return found[0] ?? null;
}

/** The evidence a card falls back to, in the order a reader wants it. */
export const EVIDENCE_TYPES = [
  "screenshot",
  "result",
  "recording",
  "comparison_table",
  "eval_run",
] as const;

// =============================================================================
// Finding media
// =============================================================================

/** One media row by id. Null when the id is absent or outside the window. */
export function mediaById(
  build: GalleryBuild,
  id: Json | null | undefined
): GalleryMedia | null {
  if (typeof id !== "string" || !id) return null;
  return build.media.find((row) => row.id === id) ?? null;
}

/** The media rows attached to one node, whether or not its payload names them. */
export function mediaForNode(
  build: GalleryBuild,
  node: GalleryNode | null | undefined
): GalleryMedia[] {
  if (!node) return [];
  return build.media.filter((row) => row.node_id === node.id);
}

/**
 * The build's hero image, if it has one a card can render.
 *
 * Resolved through build_media.node_id rather than through the hero node's
 * payload, because the node itself may not be in the card's window: only the
 * types a body reads are embedded, and a hero can be any type carrying media.
 * The media row's own link to the node survives that filter.
 *
 * Falls back to the payload's media_id for a node whose upload was attached by
 * reference rather than by node — both paths exist in the record.
 */
export function heroMedia(build: GalleryBuild): GalleryMedia | null {
  if (!build.hero_node_id) return null;

  const attached = build.media.find((row) => row.node_id === build.hero_node_id);
  if (attached) return attached;

  const node = build.nodes.find((entry) => entry.id === build.hero_node_id);
  return mediaById(build, payloadOf(node).media_id ?? null);
}

/** The first evidence node's media, for the card that has no hero. */
export function evidenceMedia(build: GalleryBuild): GalleryMedia | null {
  for (const type of EVIDENCE_TYPES) {
    const node = firstNodeOfType(build, type);
    if (!node) continue;
    const direct = mediaForNode(build, node)[0];
    if (direct) return direct;
    const referenced = mediaById(build, payloadOf(node).media_id ?? null);
    if (referenced) return referenced;
  }
  return null;
}

/**
 * The build's cover, resolved the way every other surface resolves it.
 *
 * cover_media_id comes FIRST and nothing overrides it — that is the creator
 * saying which picture stands for this build, and a card that ranked its own
 * guess above it would disagree with the preview they approved on publish.
 *
 * resolveCover is handed the card's own node window, flat and in position
 * order. Flat is not a compromise: the window carries no parent links, and
 * position order over a partial tree is the same reading order a nested walk
 * would produce for the nodes that are present.
 *
 * Then the node-derived answers this file has always given, unchanged, as the
 * fallback — heroMedia reads the media row's own node_id link, which survives
 * the type filter that can drop the hero NODE from the window and so still
 * finds pictures resolveCover cannot see.
 */
export function coverMedia(build: GalleryBuild): GalleryMedia | null {
  const inOrder = [...build.nodes].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0)
  );
  return (
    resolveCover(build, inOrder, build.media) ??
    heroMedia(build) ??
    evidenceMedia(build)
  );
}

export interface Variant {
  media: GalleryMedia;
  chosen: boolean;
  note: string | null;
}

/**
 * The variants of a generated_media node, chosen ones first.
 *
 * A creator who ran four generations and kept one is telling the reader which
 * one, and a grid that buries it in position order throws that away.
 */
export function variantsOf(build: GalleryBuild, node: GalleryNode | null): Variant[] {
  if (!node) return [];

  const declared: Variant[] = [];
  for (const entry of listField(node, "variants")) {
    const media = mediaById(build, entry.media_id ?? null);
    if (!media) continue;
    declared.push({
      media,
      chosen: entry.chosen === true,
      note: typeof entry.note === "string" ? entry.note.trim() || null : null,
    });
  }

  // A node whose uploads were attached directly, with no variants list yet.
  if (declared.length === 0) {
    for (const media of mediaForNode(build, node)) {
      declared.push({ media, chosen: false, note: null });
    }
  }

  const ordered = [...declared].sort(
    (a, b) => Number(b.chosen) - Number(a.chosen)
  );
  return ordered.slice(0, VARIANT_GRID_MAX);
}

/** A card row, and the width of the slot it lands in. */
export interface CardMedia extends GalleryMedia {
  /**
   * The transform width this row is signed at. Named slotWidth because
   * GalleryMedia.width already means something else: the image's own pixels.
   */
  slotWidth: number;
}

/** The body of a card. Everything but the variant grid lands here. */
export const CARD_MEDIA_WIDTH = MEDIA_WIDTH.card;

/** One cell of a media build's variant grid — a quarter of the body. */
export const CARD_VARIANT_WIDTH = MEDIA_WIDTH.variant;

/**
 * Every media row this build's card may render, each at the width of its slot.
 *
 * NO LONGER A SUPERSET, and that is the point of the change. Signing carries a
 * transform per row now, so an extra row is an extra request rather than an
 * extra line in one — and the rows that used to be extra were never rendered:
 * a build is drawn by exactly one body, chosen by SHAPE, and only the media
 * shape draws a variant grid. So the shape is read here, which is one switch
 * rather than the whole body table duplicated.
 *
 * The cover goes first so that a row which is BOTH the cover and a variant is
 * signed at the larger width. Oversized in a small cell costs bytes; undersized
 * in the body is a blurred card, and only one of those is visible.
 */
export function cardMedia(build: GalleryBuild): CardMedia[] {
  const rows: CardMedia[] = [];
  const push = (row: GalleryMedia | null, slotWidth: number) => {
    if (!row || rows.some((existing) => existing.id === row.id)) return;
    rows.push({ ...row, slotWidth });
  };

  push(coverMedia(build), CARD_MEDIA_WIDTH);

  if ((build.shape ?? "other") === "media") {
    for (const variant of variantsOf(build, firstNodeOfType(build, "generated_media"))) {
      push(variant.media, CARD_VARIANT_WIDTH);
    }
  }

  return rows;
}

// =============================================================================
// Signing
// =============================================================================

/** path -> a URL the browser can load. Absent while a signature is pending. */
export type MediaSrcMap = ReadonlyMap<string, string>;

const NO_SRC: MediaSrcMap = new Map();

/**
 * The still a card shows for a row.
 *
 * For a video that is its poster_path, because a card is a picture of a build
 * and never a player: the poster is an IMAGE, so it takes the transform and
 * arrives at the card's width, where the video itself would arrive whole.
 * For everything else it is the row's own object.
 */
export function stillRef(media: GalleryMedia): MediaRef {
  if (media.kind === "video" && media.poster_path) {
    // kind image, not video: the transform is only applied to images, and a
    // poster is a still.
    return { bucket: media.bucket, path: media.poster_path, kind: "image" };
  }
  return { bucket: media.bucket, path: media.path, kind: media.kind };
}

/**
 * One signed, transformed URL per row.
 *
 * ONE REQUEST PER ROW, deliberately — see the note at the top of this file. The
 * transform has to be signed INTO the token, so the batch endpoint cannot carry
 * it, and a card-sized derivative is worth more here than a saved round trip.
 *
 * Returns an empty map until the signatures come back, so nothing renders a URL
 * that is about to be replaced — and every body treats a missing src as "no
 * media", which is the same branch it takes for a build that has none. A card
 * is therefore never empty while this is in flight.
 *
 * A row whose signature fails is simply absent from the map rather than taking
 * the whole page's imagery down with it: allSettled, not all.
 */
export function useSignedMedia(rows: readonly CardMedia[]): MediaSrcMap {
  // A stable key over what is actually requested — path, kind and width — so
  // re-renders that produce an equal list do not re-sign, and a slot that
  // changes width does. Paths are unique per object; sorting makes order
  // irrelevant.
  const key = rows
    .map((row) => {
      const ref = stillRef(row);
      return [
        ref.bucket ?? BUILD_MEDIA_BUCKET,
        ref.path,
        ref.kind,
        String(row.slotWidth),
      ].join("|");
    })
    .sort()
    .join("\n");

  const [srcByPath, setSrcByPath] = useState<MediaSrcMap>(NO_SRC);

  useEffect(() => {
    if (!key) {
      setSrcByPath(NO_SRC);
      return;
    }

    let cancelled = false;
    const targets = new Map<string, { ref: MediaRef; width: number }>();
    for (const entry of key.split("\n")) {
      const [bucket, path, kind, width] = entry.split("|");
      // First width wins: cardMedia puts the body's row before the grid's, so
      // a row in both slots is signed at the larger of the two.
      if (targets.has(path)) continue;
      targets.set(path, {
        ref: { bucket, path, kind: kind as MediaRef["kind"] },
        width: Number(width),
      });
    }

    void Promise.allSettled(
      [...targets].map(async ([path, { ref, width }]) => {
        return [path, await signedMediaUrl(ref, { width })] as const;
      })
    ).then((results) => {
      if (cancelled) return;
      const next = new Map<string, string>();
      for (const result of results) {
        // A row storage would not sign — an object removed from under its row,
        // a policy that says no — is one missing picture, not a blank grid.
        if (result.status === "fulfilled") next.set(...result.value);
      }
      setSrcByPath(next);
    });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return srcByPath;
}

/** The src for one row's own object, or null while it is unsigned. */
export function srcFor(
  srcByPath: MediaSrcMap,
  media: GalleryMedia | null | undefined
): string | null {
  if (!media) return null;
  return srcByPath.get(media.path) ?? null;
}

/**
 * The src for the still a card shows: a video's poster, else the row itself.
 *
 * This is what a body branches on. A video with a poster is signed at its
 * poster's path and not at its own, so a body asking srcFor for it would be
 * told there is no picture when there is a perfectly good one.
 */
export function stillFor(
  srcByPath: MediaSrcMap,
  media: GalleryMedia | null | undefined
): string | null {
  if (!media) return null;
  return srcByPath.get(stillRef(media).path) ?? null;
}
