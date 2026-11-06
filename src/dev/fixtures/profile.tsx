/* UX-10 — the profile's sample data, as `ProfileView` takes it: a head, a feed of each kind, and a side column.

   DEV ONLY (imported from `src/pages/dev/**`, `src/dev/**` and tests alone). Builds come from Home's vision fixture (a build with
   its first post, and a rebuild), so the first post draws as Home draws it. Every name, number and sentence is sample content. */

import { toCardData } from "@/components/post/postCardModel";
import type { DesignState } from "@/dev/useDesignTheme";
import type { GalleryPostBuild } from "@/lib/build/gallery";
import { NO_CARD_WORK } from "@/lib/openbuilds/cardWork";
import type { Post } from "@/lib/openbuilds/types";
import { DEFAULT_SETTINGS } from "@/lib/profile/settings";
import { visionHomeItems, VISION_HOME_NOW } from "@/dev/fixtures/vision/home";
import type { ProfileFeedItem } from "@/lib/profile/getProfileFeed";
import type { FeedEntry } from "@/pages/site/profile/ProfileFeed";
import type { ProfileViewProps } from "@/pages/site/profile/ProfileView";
import { entryOf } from "@/pages/site/profile/profileEntries";
import { emptyFeed, feedOptions, metaParts, othersLines, recordParts } from "@/pages/site/profile/profileFeedModel";
import { TRACK_ITEMS } from "@/pages/site/profile/profileModel";

const noop = () => undefined;
export const PROFILE_NOW = VISION_HOME_NOW;
const minutes = (n: number) => new Date(PROFILE_NOW - n * 60_000).toISOString();

const MAYA = { id: "u-maya", handle: "maya", name: "Maya Kent", avatarUrl: null };

const homeBuild = (kind: "build" | "rebuild"): GalleryPostBuild => {
  const item = visionHomeItems.find((one) => one.kind === kind) as unknown as { build: GalleryPostBuild };
  return { ...item.build, models_used: [] };
};

const post = (id: string, body: string, over: Partial<Post> = {}): Post => ({
  id,
  authorId: MAYA.id,
  parentId: null,
  rootId: id,
  body,
  aboutBuildId: null,
  aboutNodeId: null,
  rewardGbp: null,
  stillOpen: false,
  tags: [],
  closesAt: null,
  pinnedBy: null,
  pinnedAt: null,
  hiddenBy: null,
  hiddenReason: null,
  likeCount: 3,
  createdAt: minutes(90),
  updatedAt: minutes(90),
  author: MAYA,
  attachments: [],
  spaces: [],
  replyCount: 4,
  ...over,
});

const TOPIC = post("t-scoring", "How do you score a call summary?\nI keep reading mine by hand. Is there a rubric anyone trusts?", { spaces: [{ id: "s1", slug: "evals", name: "Evals" }] });
const KIT_TOPIC = post("t-kit", "Podcast clipper keeps cutting mid-word\nAnyone else?", { author: { id: "u-kit", handle: "kit", name: "Kit", avatarUrl: null }, authorId: "u-kit", spaces: [{ id: "s2", slug: "audio", name: "Audio" }] });
const REPLY = post("r-1", "Trim to the nearest silence first. It fixed it for me on Opus 5.5.", { parentId: KIT_TOPIC.id, rootId: KIT_TOPIC.id, createdAt: minutes(200), replyCount: 0 });

export const profileItems: ProfileFeedItem[] = [
  { kind: "topic", key: "topic:t-scoring", id: TOPIC.id, at: minutes(5), pinned: 1, post: TOPIC },
  { kind: "build", key: "build:call-notes", id: "call-notes", at: minutes(60), pinned: null, build: homeBuild("build"), display: null },
  { kind: "repro_note", key: "repro_note:n1", id: "n1", at: minutes(120), pinned: null, note: { buildId: "b-clip", slug: "podcast-clipper", title: "Podcast clipper", makerHandle: "kit", model: "Opus 5.5", worked: true, note: "Worked first time on a 40 minute episode." } },
  { kind: "reply", key: "reply:r-1", id: REPLY.id, at: minutes(200), pinned: null, post: REPLY, root: KIT_TOPIC },
  { kind: "build", key: "build:call-notes-local", id: "call-notes-local", at: minutes(600), pinned: null, build: homeBuild("rebuild"), display: "map" },
];

export function profileEntries(items: readonly ProfileFeedItem[] = profileItems): FeedEntry[] {
  return items.map((item) =>
    entryOf(item, {
      maker: MAYA,
      ownerDisplay: "first_post",
      extras: { work: NO_CARD_WORK, signed: new Map(), digests: new Map() },
      srcByPath: new Map(),
      engagement: () => ({ counts: { likes: 12, comments: 3 }, liked: false, saved: false }),
      maps: new Map(),
      mapsFailed: false,
      now: PROFILE_NOW,
    }),
  );
}

const COUNTS = { builds: 14, topics: 22, replies: 9, notes: 5 };

/** The profile as the view takes it: someone else's (`own` false) or your own. */
export function profileFixture(state: DesignState = "populated", own = false): ProfileViewProps {
  const empty = state === "empty";
  const entries = empty ? [] : profileEntries();
  const side = {
    counts: empty ? { builds: 0, topics: 0, replies: 0, notes: 0 } : COUNTS,
    reproducedByOthers: empty ? 0 : 9,
    rebuiltFrom: empty ? 0 : 6,
    firstRebuildSlug: "call-notes-local",
    stepsAdded: empty ? 0 : 11,
    topicsStarted: empty ? 0 : 4,
  };
  return {
    head: {
      userId: MAYA.id,
      name: MAYA.name,
      handle: MAYA.handle,
      avatarUrl: null,
      avatarAlt: null,
      header: null,
      meta: metaParts({ handle: "maya", place: "Leeds", joined: "Feb 2026", followers: 412, following: 180 }),
      level: own ? 7 : null,
      oneLine: "Builds finance agents a person can check",
      links: ["https://maya.dev", "https://github.com/maya"],
      record: recordParts("maya", { ...side, builds: side.counts.builds, topicsAndReplies: side.counts.topics + side.counts.replies }),
      isOwn: own,
      following: false,
      onFollow: noop,
      onUnfollow: noop,
      onMessage: noop,
      onEdit: noop,
      onCopyLink: noop,
      onChangeHeader: own ? noop : undefined,
      onChangePicture: own ? noop : undefined,
    },
    feed: {
      filter: "all",
      options: feedOptions(side.counts),
      onFilter: noop,
      entries,
      status: state === "loading" ? "loading" : state === "error" ? "error" : "ready",
      onRetry: noop,
      empty: emptyFeed("all", own),
      hasMore: !empty,
      loadingMore: false,
      onMore: noop,
      isOwn: own,
      canPin: true,
      onPin: noop,
      onUnpin: noop,
      onDisplay: noop,
      now: PROFILE_NOW,
    },
    side: {
      order: DEFAULT_SETTINGS.sideSections,
      about: empty ? null : "I build agents for small finance teams.\nEvery step shows its working, so a person can check it.",
      worksIn: empty ? [] : ["Claude Code", "Opus 5.5", "Cursor"],
      spaces: empty
        ? []
        : [
            { slug: "evals", name: "Evals", standing: "Created" },
            { slug: "finance-agents", name: "Finance agents", standing: "Moderator" },
            { slug: "audio", name: "Audio", standing: "Member" },
          ],
      others: othersLines("maya", side),
      collections: [],
      marks: empty ? [] : ["First build", "Reproduced by ten"],
      progress: own ? { level: 7, xpLine: "1,840 / 2,400 xp", streak: "12-day streak", track: "curator", tracks: TRACK_ITEMS, onTrack: noop } : null,
    },
  };
}
