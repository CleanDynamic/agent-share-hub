/* Synth 11: the topic page. PURE: typed props, no fetching, no `useAuth()`, no router hooks but `Link`.

   The header carries OpenBuilds as the current item. Two panels (`OpenBuildsColumns`: main and 340 from 1101, the side 300
   from 761 to 1100, one column below with the side sections after the replies). In the main panel: a 13 Text 3 link to the
   topic's space, the post at page size (`PostCard` with its lead line as the page's h1 at 20/600), then the pills
   (`Thread 6` and, once a reply holds a build, `Wall 3 builds`; `Oldest first` 13 Text 3 at the right), then the Thread or
   the Wall. The reply box and the Wall are the container's (`replyBox`, `wall`): this view only says where they stand.

   The side panel: the space as a section headed by its fact (`412 members`), then the builds in the post's replies, headed
   by their count. */

import { PageEmpty } from "@/components/pagestate/PageState";
import type { CSSProperties, ReactNode } from "react";

import { FilterChip } from "@/components/brand/FilterChip";
import { PostCard } from "@/components/post/PostCard";
import { PostControl } from "@/components/post/postControls";
import type { PostCardData } from "@/components/post/postCardModel";
import type { RowEngagement } from "@/components/social/EngagementRow";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { SectionHead } from "@/components/vision/SectionHead";
import type { StripTileData } from "@/components/vision/StepStripTiles";
import { PageLink } from "@/lib/routing/PageLink";
import { ring, touchArea } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { OpenBuildsColumns } from "./OpenBuildsFrame";
import { ReplyList, type ReplyActions } from "./PostReplies";
import { threadLabel, wallLabel, type PostTab, type ReplyItem } from "./postModel";

export interface PostSideSpace {
  name: string;
  to: string;
  /** The section's head: "412 members". */
  members: string;
  /** "Made by @sam". Null: no maker to name. */
  madeBy: string | null;
  description: string;
  /** Null signed out of the space's reach (invite only): no control. */
  joined: boolean | null;
  onJoin: () => void;
  onLeave: () => void;
}

/** A build in the post's replies, as a row of the side panel. */
export interface PostSideBuild {
  key: string;
  /** The build's name, 15/600. */
  name: string;
  /** "@maya · Rebuilt from @sam", 13 Text 3. */
  meta: string;
  /** Its page; null for a build still in a draft. */
  to: string | null;
}

export interface PostViewProps {
  crumbs: readonly { label: string; to: string }[];
  card: PostCardData;
  engagement?: RowEngagement;
  /** UX-07 P7: the topic's reaction row, when its spaces switched one on. */
  reactions?: ReactNode;
  /** UX-09 P8: Report in the topic's `···` menu (everyone but its author). */
  onReport?: () => void;
  /** UX-09 Q4: "Message @maya" in the topic's `···` menu (everyone but its author). */
  onMessage?: { label: string; onSelect: () => void };
  /** UX-15 P5: `Block @maya` in the topic's `···`. Absent: not offered. */
  onBlock?: { label: string; onSelect: () => void };
  /** Each step of the post's build drawn inside its menu (the container's, since a menu item may read drafts). */
  renderTile?: (tile: StripTileData, inner: ReactNode) => ReactNode;
  tab: PostTab;
  onTab: (tab: PostTab) => void;
  /** Every reply, at every depth. */
  replies: number;
  /** Replies that hold a build. Zero: the Wall segment is not drawn. */
  builds: number;
  thread: {
    items: readonly ReplyItem[];
    /** The Thread is narrowed: to a step (`Replies on Step 4 · Prompt`) or to a deeper branch. */
    filter: { label: string; onShowAll: () => void } | null;
  };
  actions: ReplyActions;
  /** The one open reply box: at the foot of the Thread, or under the reply it answers. */
  replyBox?: { at: "foot" | string; node: ReactNode };
  /** Part 5: the Wall, drawn when `tab` is wall. */
  wall?: ReactNode;
  /** Part 6: what the Wall puts on the switch's row (Line up steps). */
  wallRow?: ReactNode;
  side: { space: PostSideSpace | null; builds: readonly PostSideBuild[] };
}

const words = (size: 13 | 15, color: string, extra: CSSProperties = {}): CSSProperties => ({ fontFamily: FIGTREE, fontSize: size, lineHeight: size === 15 ? "20px" : "16px", color, margin: 0, ...extra });

/** "2 builds in this post". */
const buildsHeading = (count: number): string => `${count} ${count === 1 ? "build" : "builds"} in this post`;

/** The link to the topic's space above the post: 13 in Text 3, underlined at once under a fine pointer's hover. */
function UpLink({ to, children }: { to: string; children: string }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <PageLink to={to} {...handlers} style={{ color: t.label, textDecoration: state.hovered ? "underline" : "none", textUnderlineOffset: 3, borderRadius: r.chip, ...ring(state.focusVisible) }}>
      {children}
    </PageLink>
  );
}

const oneLine: CSSProperties = { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

/** A build row in the side panel: the name 15/600 (a link when the build is published), its line 13 Text 3. */
function BuildRow({ build }: { build: PostSideBuild }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  const name: CSSProperties = { ...words(15, t.text, { fontWeight: 600 }), ...oneLine };
  return (
    <li style={{ listStyle: "none", padding: "6px 16px", minHeight: 56, boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
      {build.to ? (
        <PageLink to={build.to} {...handlers} style={{ ...name, textDecoration: state.hovered ? "underline" : "none", textUnderlineOffset: 3, borderRadius: r.chip, ...ring(state.focusVisible) }}>
          {build.name}
        </PageLink>
      ) : (
        <span style={name}>{build.name}</span>
      )}
      <span style={{ ...words(13, t.label), ...oneLine }}>{build.meta}</span>
    </li>
  );
}

function SideColumn({ space, builds }: PostViewProps["side"]) {
  return (
    <>
      {space ? (
        <section aria-label="Space" style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead title={space.members} headingLevel={2} />
          <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            {space.description ? <p style={words(15, t.text2)}>{space.description}</p> : null}
            {space.madeBy ? <p style={words(13, t.label)}>{space.madeBy}</p> : null}
            {space.joined !== null ? (
              <div style={{ marginTop: 4 }}>
                {space.joined ? (
                  <PostControl aria-pressed onClick={space.onLeave}>
                    Joined
                  </PostControl>
                ) : (
                  <PostControl onClick={space.onJoin} aria-label={`Join ${space.name}`}>
                    Join space
                  </PostControl>
                )}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
      {builds.length > 0 ? (
        <section aria-label="Builds in this post" style={{ display: "flex", flexDirection: "column" }}>
          <SectionHead title={buildsHeading(builds.length)} headingLevel={2} />
          <ul style={{ margin: 0, padding: 0 }}>
            {builds.map((build) => (
              <BuildRow key={build.key} build={build} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

export function PostView(view: PostViewProps) {
  const phone = useIsPhone();
  const items = [{ value: "thread" as const, label: threadLabel(view.replies) }, ...(view.builds > 0 ? [{ value: "wall" as const, label: wallLabel(view.builds) }] : [])];
  const tab: PostTab = view.builds > 0 ? view.tab : "thread";
  const box = view.replyBox && view.replyBox.at !== "foot" ? { at: view.replyBox.at, node: view.replyBox.node } : undefined;
  // The link above the post goes up one level: to the topic's space, or to OpenBuilds when it is in none.
  const up = view.crumbs[view.crumbs.length - 1];

  const main = (
    <div>
      {up ? (
        <nav aria-label="Where this post is" style={{ ...words(13, t.label), marginBottom: 12 }}>
          <UpLink to={up.to}>{up.label}</UpLink>
        </nav>
      ) : null}

      <PostCard card={view.card} page clamp={false} engagement={view.engagement} renderTile={view.renderTile} reactions={view.reactions} onReport={view.onReport} onMessage={view.onMessage} onBlock={view.onBlock} />

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 16, paddingBottom: 12 }}>
        <div role="group" aria-label="Show" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {items.map((item) => (
            <FilterChip key={item.value} label={item.label} on={item.value === tab} onClick={() => view.onTab(item.value)} style={touchArea(phone)} />
          ))}
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 16, marginLeft: "auto" }}>
          {tab === "wall" ? view.wallRow : null}
          <span style={words(13, t.label)}>Oldest first</span>
        </span>
      </div>

      {tab === "wall" ? (
        <div role="region" aria-label="Wall">
          {view.wall}
        </div>
      ) : (
        <div role="region" aria-label="Thread">
          {view.thread.filter ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 0", borderBottom: `1px solid ${t.hairline}` }}>
              <span style={words(13, t.text2)}>{view.thread.filter.label}</span>
              <PostControl onClick={view.thread.filter.onShowAll}>Show all replies</PostControl>
            </div>
          ) : null}
          {view.thread.items.length === 0 ? (
            <PageEmpty line={view.thread.filter ? "No replies here yet." : "No replies yet."} />
          ) : (
            <ReplyList items={view.thread.items} actions={view.actions} box={box} />
          )}
          {view.replyBox?.at === "foot" ? <div style={{ paddingTop: 16 }}>{view.replyBox.node}</div> : null}
        </div>
      )}
    </div>
  );

  return <OpenBuildsColumns testId="openbuilds-post" sideLabel="About this post" main={main} side={<SideColumn {...view.side} />} />;
}

export default PostView;
