// postPreview: the draft, as the Gallery's feed item reads a build (PT-07).
//
// Pure. The composer holds a build row, the title as typed, the thread as the editor has it and the thread's media; the
// feed item (FeedPost) reads a GalleryBuild. This is the one place the two are put together, so the preview cannot
// disagree with the Gallery about what a draft is: it is the same thread, split the same way, under the same maker.
//
// NOTHING IS WRITTEN AND NOTHING IS FETCHED. A draft with no build row yet (the first change has not made it) gets
// stand-in values for the fields a feed item never draws.

import type { GalleryBuild, GalleryMedia } from "./gallery";
import type { Build } from "./types";
import type { ThreadDoc } from "./thread";

/** The width a post is drawn at on a desktop: the Gallery's column. */
export const PREVIEW_DESKTOP_WIDTH = 628;
/** The width a phone's column is drawn at. */
export const PREVIEW_PHONE_WIDTH = 320;

export type PreviewWidth = "phone" | "desktop";

/** The line under the preview. */
export const PREVIEW_NOTE = "Updates as you type. Everything above the first post break is what people see before Show more.";

/** The id a draft with no build row carries in the preview. Never sent anywhere. */
export const PREVIEW_ID = "draft-preview";

/** How far the desktop width is scaled down to fit a column: 1 at the full width, never more. */
export function previewScale(column: number): number {
  if (!Number.isFinite(column) || column <= 0) return 1;
  return Math.min(1, column / PREVIEW_DESKTOP_WIDTH);
}

export interface DraftPreviewInput {
  /** The build row, or null before the first change makes it. */
  build: Build | null;
  /** The title as typed, which can be ahead of the row. */
  title: string;
  /** The thread as the editor has it. */
  doc: ThreadDoc;
  /** The thread's media rows. */
  media: readonly GalleryMedia[];
  /** The signed-in maker, for a draft with no row to take it from. */
  makerId: string | null;
  /** When the preview opened: the draft is "now". */
  now: number;
}

/** The draft as a feed item reads a build. */
export function draftGalleryBuild({ build, title, doc, media, makerId, now }: DraftPreviewInput): GalleryBuild {
  return {
    id: build?.id ?? PREVIEW_ID,
    creator_id: build?.creator_id ?? makerId ?? "",
    slug: build?.slug ?? "",
    title,
    outcome: build?.outcome ?? null,
    shape: build?.shape ?? "",
    status: build?.status ?? "draft",
    made_for: build?.made_for ?? null,
    made_with: build?.made_with ?? null,
    live_url: build?.live_url ?? null,
    repo_url: build?.repo_url ?? null,
    hero_node_id: build?.hero_node_id ?? null,
    cover_media_id: build?.cover_media_id ?? null,
    completeness: build?.completeness ?? null,
    reproduction_count: build?.reproduction_count ?? 0,
    last_confirmed_at: null,
    last_confirmed_model: null,
    published_at: new Date(now).toISOString(),
    parent_build_id: build?.parent_build_id ?? null,
    rebuild_count: build?.rebuild_count ?? 0,
    rebuild_note: build?.rebuild_note ?? null,
    source_title_at_fork: build?.source_title_at_fork ?? null,
    source_handle_at_fork: build?.source_handle_at_fork ?? null,
    post_doc: doc,
    nodes: [],
    media: [...media],
  };
}
