/* UX-10 P6: the feed's items as the entries ProfileFeed draws. PURE: the page reads, this maps.

   A build's display follows `buildDisplayOf`: its own choice, else the owner's, else its first post when it has one, otherwise
   its Map card. Both drawings are mapped, so the `···` switch needs no read; the Map's drawing fills in when the Maps arrive. */

import type { MediaSrcMap } from "@/components/gallery/cardMedia";
import { replyHref, splitBody, toCardData, topicHref } from "@/components/post/postCardModel";
import type { RowEngagement } from "@/components/social/EngagementRow";
import type { BuildMap } from "@/lib/build/buildsMaps";
import type { BuildsTableBuild, GalleryPostBuild } from "@/lib/build/gallery";
import type { CardExtras } from "@/lib/openbuilds/cardWork";
import type { ProfileFeedItem } from "@/lib/profile/getProfileFeed";
import type { BuildDisplay } from "@/lib/profile/settings";
import { cardOf } from "@/pages/site/builds/mapsModel";

import type { FeedEntry } from "./ProfileFeed";
import { buildDisplayOf, noteHeading, rebuiltFromLine, repliedToLine } from "./profileFeedModel";

export interface EntryContext {
  maker: { id: string; handle: string; name: string; avatarUrl: string | null };
  ownerDisplay: BuildDisplay;
  extras: CardExtras;
  srcByPath: MediaSrcMap;
  engagement: (buildId: string) => RowEngagement | undefined;
  /** The Maps read so far, by build id. */
  maps: ReadonlyMap<string, BuildMap>;
  /** The Maps' read failed. */
  mapsFailed: boolean;
  now: number;
}

/** The Builds table's shape of a build, which the Map card's model reads. */
export function tableBuildOf(build: GalleryPostBuild, maker: EntryContext["maker"]): BuildsTableBuild {
  return {
    id: build.id,
    slug: build.slug,
    title: build.title,
    shape: build.shape,
    madeWith: build.made_with ?? [],
    reproductionCount: build.reproduction_count ?? 0,
    lastConfirmedAt: build.last_confirmed_at ?? null,
    lastConfirmedModel: build.last_confirmed_model ?? null,
    publishedAt: build.published_at ?? null,
    rebuildCount: build.rebuild_count ?? 0,
    ...(build.classifiedAs ? { classifiedAs: build.classifiedAs } : null),
    maker: { handle: maker.handle, name: maker.name },
    open: { count: 0 },
  };
}

/** Whether the build has a first post to show: its write-up's thread. */
export const hasFirstPost = (build: Pick<GalleryPostBuild, "post_doc">): boolean => Boolean(build.post_doc);

export function entryOf(item: ProfileFeedItem, context: EntryContext): FeedEntry {
  const pinned = item.pinned !== null;
  switch (item.kind) {
    case "build": {
      const { build } = item;
      return {
        kind: "build",
        key: item.key,
        id: item.id,
        heading: build.title || "Untitled build",
        pinned,
        display: buildDisplayOf(item.display, context.ownerDisplay, hasFirstPost(build)),
        rebuiltFrom: build.parent_build_id ? rebuiltFromLine(build.source_handle_at_fork ?? null, build.source_title_at_fork ?? null) : null,
        post: {
          build,
          srcByPath: context.srcByPath,
          makerHandle: context.maker.handle,
          makerName: context.maker.name,
          makerAvatar: context.maker.avatarUrl,
          modelsUsed: build.models_used ?? [],
          plaqueBuild: build,
          classification: build.classifiedAs ?? null,
          engagement: context.engagement(build.id),
        },
        map: cardOf(tableBuildOf(build, context.maker), context.maps.get(build.id), context.now, context.mapsFailed),
      };
    }
    case "topic": {
      const card = toCardData(item.post, { ...context.extras, now: context.now, hrefOf: () => topicHref(item.post.id), strip: true });
      return { kind: "topic", key: item.key, id: item.id, heading: card.heading || "Untitled topic", pinned, card };
    }
    case "reply": {
      const to = replyHref(item.post.rootId, item.post.id);
      const card = toCardData(item.post, { ...context.extras, now: context.now, hrefOf: () => to, strip: false });
      const rootHeading = item.root ? splitBody(item.root.body).heading : "";
      return {
        kind: "reply",
        key: item.key,
        id: item.id,
        heading: card.heading || (rootHeading ? `Reply in ${rootHeading}` : "Reply"),
        pinned,
        card,
        repliedTo: { text: repliedToLine(item.root?.author?.handle ?? null, item.root?.spaces[0]?.name ?? null), to },
      };
    }
    case "repro_note": {
      const { note } = item;
      return {
        kind: "repro_note",
        key: item.key,
        id: item.id,
        heading: `${noteHeading(note.makerHandle, note.title, note.model)}${note.worked ? "it worked" : "it didn't work"}`,
        pinned,
        lead: noteHeading(note.makerHandle, note.title, note.model),
        note: {
          kind: "repro_note",
          key: item.key,
          at: item.at,
          runner: { id: context.maker.id, handle: context.maker.handle, name: context.maker.name, avatarUrl: context.maker.avatarUrl },
          buildTitle: note.title,
          href: `/b2/${note.slug}`,
          model: note.model,
          note: note.note,
          worked: note.worked,
        },
      };
    }
  }
}
