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
// WHY THE URLS ARE UNTRANSFORMED, which is a real cost and not an oversight:
// build-media is a private bucket, so an <img> needs a signed URL. Supabase
// signs a transform INTO the token, and the batch signing endpoint takes no
// transform — so there is a choice between one request serving originals and
// one request per image serving card-sized derivatives. The gallery is held to
// two requests, so it takes the first, and leans on loading="lazy" so the bytes
// for an off-screen card are never fetched at all. The proper fix is a
// card-sized derivative written at upload time; it belongs in the media layer,
// not here.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BUILD_MEDIA_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  type GalleryBuild,
  type GalleryMedia,
  type GalleryNode,
} from "@/lib/build";
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

/**
 * Every media row this build's card may render, for the page to sign in one go.
 *
 * Deliberately a superset of what any single body uses: the same build is only
 * ever rendered by one body, but working out which one here would mean
 * duplicating the shape switch. Signing three extra rows is cheaper than two
 * places that can disagree.
 */
export function cardMedia(build: GalleryBuild): GalleryMedia[] {
  const rows: GalleryMedia[] = [];
  const push = (row: GalleryMedia | null) => {
    if (row && !rows.some((existing) => existing.id === row.id)) rows.push(row);
  };

  push(heroMedia(build));
  push(evidenceMedia(build));
  for (const variant of variantsOf(build, firstNodeOfType(build, "generated_media"))) {
    push(variant.media);
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
 * One signed URL per row, in one request per bucket.
 *
 * Returns an empty map until the signatures come back, so nothing renders a
 * URL that is about to be replaced — and every body treats a missing src as
 * "no media", which is the same branch it takes for a build that has none.
 * A card is therefore never empty while this is in flight.
 */
export function useSignedMedia(rows: GalleryMedia[]): MediaSrcMap {
  // A stable key over the paths, so re-renders that produce an equal list do
  // not re-sign. Paths are unique per object; sorting makes order irrelevant.
  const key = rows
    .map((row) => `${row.bucket ?? BUILD_MEDIA_BUCKET}::${row.path}`)
    .sort()
    .join("\n");

  const [srcByPath, setSrcByPath] = useState<MediaSrcMap>(NO_SRC);

  useEffect(() => {
    if (!key) {
      setSrcByPath(NO_SRC);
      return;
    }

    let cancelled = false;
    const byBucket = new Map<string, string[]>();
    for (const entry of key.split("\n")) {
      const [bucket, path] = entry.split("::");
      const paths = byBucket.get(bucket) ?? [];
      paths.push(path);
      byBucket.set(bucket, paths);
    }

    void Promise.all(
      [...byBucket].map(async ([bucket, paths]) => {
        const { data } = await supabase.storage
          .from(bucket)
          .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
        return (data ?? []).filter((row) => row.path && !row.error);
      })
    )
      .then((results) => {
        if (cancelled) return;
        const next = new Map<string, string>();
        for (const rowsForBucket of results) {
          for (const row of rowsForBucket) {
            if (row.path) next.set(row.path, row.signedUrl);
          }
        }
        setSrcByPath(next);
      })
      .catch(() => {
        // Storage is down or the objects are gone. The cards fall through to
        // their non-media branches, which is exactly the right outcome.
        if (!cancelled) setSrcByPath(NO_SRC);
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return srcByPath;
}

/** The src for one row, or null while it is unsigned. */
export function srcFor(
  srcByPath: MediaSrcMap,
  media: GalleryMedia | null | undefined
): string | null {
  if (!media) return null;
  return srcByPath.get(media.path) ?? null;
}
