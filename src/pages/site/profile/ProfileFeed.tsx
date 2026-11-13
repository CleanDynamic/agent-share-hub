/* UX-10 P6: the profile's feed. PURE: typed props, no fetching; `ProfilePage` maps the rows to entries.

   A `Segmented` filter above it (All, Builds, Topics, Replies, Notes; an option with nothing in it is hidden, All never is), then
   the person's things newest first, the pins leading with a `Pinned` line. Each is the card the site already draws:

     build       its first post (`FeedPost`, as Home draws a build) or its Map card (`MapCard`, as Builds' Maps draws one); a rebuild
                 carries `Rebuilt from @maya` above it
     topic       the post card (`PostCard`), unchanged
     reply       the post card with `Replied to @kit in <space>` above it, linking to the reply
     repro_note  Home's note card, headed `Reproduced @kit's Podcast clipper on Opus 5.5: it worked`

   Every card keeps its own engagement row; nothing new is counted. On your own profile each item has a `···` with Pin to profile
   or Unpin, and a build's has Show as first post and Show as Map card. Show more at the end, as Home has it; no infinite scroll.

   THE FEED is a `feed` list of `article`s, each labelled by its heading, with aria-setsize -1 while more can load. */

import type { CSSProperties, ReactNode } from "react";

import { PostControl } from "@/components/post/postControls";
import { PostCard } from "@/components/post/PostCard";
import type { PostCardData } from "@/components/post/postCardModel";
import { FeedPost, type FeedPostProps } from "@/components/gallery/FeedPost";
import { Segmented } from "@/components/brand/Segmented";
import { DashedSlot } from "@/components/vision/DashedSlot";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { MapCard, type MapCardView } from "@/pages/site/builds/BuildsMapsView";
import { NoteItem } from "@/pages/site/home/HomeView";
import type { HomeReproNote } from "@/pages/site/home/homeModel";

import type { EmptyFeed } from "./profileFeedModel";

export type FeedFilterValue = "all" | "builds" | "topics" | "replies" | "notes";
export type BuildDisplayValue = "first_post" | "map";

interface EntryBase {
  key: string;
  /** The item's id, for its menu. */
  id: string;
  /** The heading the article is labelled by. */
  heading: string;
  pinned: boolean;
}

export interface BuildEntry extends EntryBase {
  kind: "build";
  display: BuildDisplayValue;
  /** `Rebuilt from @maya` on a rebuild; null otherwise. */
  rebuiltFrom: string | null;
  post: Omit<FeedPostProps, "now">;
  map: MapCardView;
}

export interface TopicEntry extends EntryBase {
  kind: "topic";
  card: PostCardData;
}

export interface ReplyEntry extends EntryBase {
  kind: "reply";
  card: PostCardData;
  repliedTo: { text: string; to: string };
}

export interface NoteEntry extends EntryBase {
  kind: "repro_note";
  note: HomeReproNote;
  /** `Reproduced @kit's Podcast clipper on Opus 5.5: `, before `it worked`. */
  lead: string;
}

export type FeedEntry = BuildEntry | TopicEntry | ReplyEntry | NoteEntry;

export interface ProfileFeedProps {
  filter: FeedFilterValue;
  options: readonly { value: FeedFilterValue; label: string }[];
  onFilter: (filter: FeedFilterValue) => void;
  entries: readonly FeedEntry[];
  status: "loading" | "ready" | "error";
  onRetry: () => void;
  empty: EmptyFeed;
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
  isOwn: boolean;
  /** Pin to profile is offered while fewer than three are pinned. */
  canPin: boolean;
  onPin: (entry: FeedEntry) => void;
  onUnpin: (entry: FeedEntry) => void;
  onDisplay: (buildId: string, display: BuildDisplayValue) => void;
  now: number;
}

export const FEED_COPY = {
  filter: "Show",
  pinned: "Pinned",
  pin: "Pin to profile",
  unpin: "Unpin",
  asPost: "Show as first post",
  asMap: "Show as Map card",
  more: "Show more",
  loadingMore: "Loading",
  failed: "The feed didn't load.",
  retry: "Retry",
  menu: (heading: string) => `More for ${heading}`,
} as const;

const LINE: CSSProperties = { fontFamily: FIGTREE, fontSize: 12, lineHeight: "16px", color: t.label };

function ItemMenu({ entry, canPin, onPin, onUnpin, onDisplay }: { entry: FeedEntry; canPin: boolean; onPin: () => void; onUnpin: () => void; onDisplay: (display: BuildDisplayValue) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <PostControl aria-label={FEED_COPY.menu(entry.heading)}>···</PostControl>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {entry.pinned ? <DropdownMenuItem onSelect={onUnpin}>{FEED_COPY.unpin}</DropdownMenuItem> : canPin ? <DropdownMenuItem onSelect={onPin}>{FEED_COPY.pin}</DropdownMenuItem> : null}
        {entry.kind === "build" ? (
          <>
            <DropdownMenuItem disabled={entry.display === "first_post"} onSelect={() => onDisplay("first_post")}>
              {FEED_COPY.asPost}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={entry.display === "map"} onSelect={() => onDisplay("map")}>
              {FEED_COPY.asMap}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The line above a card: Pinned, Rebuilt from, Replied to; and on your own profile, the item's `···`. */
function TopLine({ entry, menu }: { entry: FeedEntry; menu: ReactNode }) {
  const lines: ReactNode[] = [];
  if (entry.pinned) lines.push(<span key="pinned" data-testid="profile-pinned">{FEED_COPY.pinned}</span>);
  if (entry.kind === "build" && entry.rebuiltFrom) lines.push(<span key="rebuilt">{entry.rebuiltFrom}</span>);
  if (entry.kind === "reply") {
    lines.push(
      <Link key="replied" to={entry.repliedTo.to} data-testid="profile-replied-to" style={{ color: t.label, textDecoration: "none" }}>
        {entry.repliedTo.text}
      </Link>,
    );
  }
  if (lines.length === 0 && !menu) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: menu ? 32 : 16, paddingTop: 12 }}>
      <span style={{ ...LINE, display: "flex", flexDirection: "column", gap: 2, minWidth: 0, overflowWrap: "anywhere" }}>{lines}</span>
      {menu}
    </div>
  );
}

function Card({ entry, now }: { entry: FeedEntry; now: number }) {
  switch (entry.kind) {
    case "build":
      return entry.display === "map" ? (
        <div style={{ paddingTop: 12, paddingBottom: 16 }}>
          <MapCard card={entry.map} direction="horizontal" index={0} />
        </div>
      ) : (
        <FeedPost {...entry.post} now={now} />
      );
    case "topic":
    case "reply":
      return <PostCard card={entry.card} />;
    case "repro_note":
      return (
        <NoteItem
          item={entry.note}
          now={now}
          heading={
            <>
              <span style={{ color: t.text }}>{entry.lead}</span>
              {entry.note.worked ? <span style={{ color: t.evidence }}>it worked</span> : <span style={{ color: t.catBreakage }}>it didn&rsquo;t work</span>}
            </>
          }
        />
      );
  }
}

export function ProfileFeed(props: ProfileFeedProps) {
  const { entries, isOwn } = props;
  return (
    <section aria-label="Feed" data-testid="profile-feed" style={{ fontFamily: FIGTREE, minWidth: 0 }}>
      {props.options.length > 1 ? (
        <Segmented<FeedFilterValue> label={FEED_COPY.filter} semantics="radio" size={28} items={props.options} value={props.filter} onChange={props.onFilter} />
      ) : null}
      {props.status === "error" && entries.length === 0 ? (
        <p style={{ margin: "24px 0 0", fontSize: 13, color: t.text2 }}>
          {`${FEED_COPY.failed} `}
          <PostControl onClick={props.onRetry}>{FEED_COPY.retry}</PostControl>
        </p>
      ) : props.status === "ready" && entries.length === 0 ? (
        <div data-testid="profile-feed-empty" style={{ marginTop: 24 }}>
          <DashedSlot>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", width: "100%" }}>
              <span style={{ fontSize: 13, color: t.text2 }}>{props.empty.line}</span>
              {props.empty.action ? <PostControl to={props.empty.action.to}>{props.empty.action.label}</PostControl> : null}
            </span>
          </DashedSlot>
        </div>
      ) : (
        <div role="feed" aria-busy={props.status === "loading" || props.loadingMore} style={{ marginTop: 8 }}>
          {entries.map((entry, index) => (
            <article
              key={entry.key}
              aria-label={entry.heading}
              aria-posinset={index + 1}
              aria-setsize={props.hasMore ? -1 : entries.length}
              data-kind={entry.kind}
              data-testid="profile-feed-item"
              style={{ borderBottom: `1px solid ${t.hairline}`, contentVisibility: index < 3 ? undefined : "auto", containIntrinsicSize: index < 3 ? undefined : "auto 320px" }}
            >
              <TopLine
                entry={entry}
                menu={
                  isOwn ? (
                    <ItemMenu
                      entry={entry}
                      canPin={props.canPin}
                      onPin={() => props.onPin(entry)}
                      onUnpin={() => props.onUnpin(entry)}
                      onDisplay={(display) => props.onDisplay(entry.id, display)}
                    />
                  ) : null
                }
              />
              <Card entry={entry} now={props.now} />
            </article>
          ))}
        </div>
      )}
      {props.hasMore && entries.length > 0 ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
          <PostControl onClick={props.onMore} disabled={props.loadingMore}>
            {props.loadingMore ? FEED_COPY.loadingMore : FEED_COPY.more}
          </PostControl>
        </div>
      ) : null}
    </section>
  );
}

export default ProfileFeed;
