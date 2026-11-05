/* UX-06 Part 1: the post page. PURE: typed props, no fetching, no `useAuth()`, no router hooks but `Link`.

   `OpenBuildsColumns` (main and a 320 side column; below 1001 the side column follows the main one). In the main column: the
   crumbs (12 `--label`, `OpenBuilds / Claude Code`), the post at page size (`PostCard` with its heading as the page's `h1`), then the
   switch (`Segmented`: `Thread · 6` and, once a reply holds a build, `Wall · 3 builds`; `Oldest first` at the row's right), then the
   Thread or the Wall. The reply box and the Wall are the container's (`replyBox`, `wall`): this view only says where they stand.

   The side column: the module box with the space, then `In this post`. */

import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Segmented } from "@/components/brand/Segmented";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { PostCard } from "@/components/post/PostCard";
import { PostControl } from "@/components/post/postControls";
import type { PostCardData } from "@/components/post/postCardModel";
import type { RowEngagement } from "@/components/social/EngagementRow";
import { PlainRow } from "@/components/vision/PlainRow";
import { SectionHead } from "@/components/vision/SectionHead";
import type { StripTileData } from "@/components/vision/StepStripTiles";
import { PageLink } from "@/lib/routing/PageLink";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { OpenBuildsColumns } from "./OpenBuildsFrame";
import { EmptyLine } from "./OpenBuildsFeedParts";
import { ReplyList, type ReplyActions } from "./PostReplies";
import { threadLabel, wallLabel, type PostTab, type ReplyItem } from "./postModel";

export interface PostSideSpace {
  name: string;
  to: string;
  /** "Made by @sam · 412 members". */
  meta: string;
  description: string;
  /** Null signed out of the space's reach (invite only): no control. */
  joined: boolean | null;
  onJoin: () => void;
  onLeave: () => void;
}

export interface PostSideRow {
  label: string;
  value: number;
  /** A row that opens something: `Builds in replies` opens the Wall. */
  to?: string;
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
  side: { space: PostSideSpace | null; rows: readonly PostSideRow[] };
}

const label = (size: number, color: string = t.label) => ({ fontFamily: FIGTREE, fontSize: size, lineHeight: "16px", color, margin: 0 });

/** A crumb: a page link in `--label`, underlined at once under a fine pointer's hover. */
function Crumb({ to, children }: { to: string; children: string }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <PageLink to={to} {...handlers} style={{ color: t.label, textDecoration: state.hovered ? "underline" : "none", textUnderlineOffset: 3, borderRadius: r.control, ...ring(state.focusVisible) }}>
      {children}
    </PageLink>
  );
}

function SpaceName({ to, children }: { to: string; children: string }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <PageLink to={to} {...handlers} style={{ fontFamily: FIGTREE, fontSize: 14, fontWeight: 500, lineHeight: 1.3, color: t.text, textDecoration: state.hovered ? "underline" : "none", textUnderlineOffset: 3, borderRadius: r.control, ...ring(state.focusVisible) }}>
      {children}
    </PageLink>
  );
}

function SideColumn({ space, rows }: PostViewProps["side"]) {
  return (
    <>
      {space ? (
        <section aria-label="Space" style={{ background: t.module, border: `1px solid ${t.moduleBorder}`, borderRadius: r.card, padding: 16 }}>
          <SpaceName to={space.to}>{space.name}</SpaceName>
          <p style={{ ...label(12), marginTop: 2 }}>{space.meta}</p>
          {space.description ? <p style={{ ...label(12.5, t.text2), lineHeight: "20px", marginTop: 8 }}>{space.description}</p> : null}
          {space.joined !== null ? (
            <div style={{ marginTop: 12 }}>
              {space.joined ? (
                <PostControl aria-pressed onClick={space.onLeave}>
                  Joined
                </PostControl>
              ) : (
                <PostControl onClick={space.onJoin}>Join</PostControl>
              )}
            </div>
          ) : null}
        </section>
      ) : null}
      {rows.length > 0 ? (
        <section aria-label="In this post" style={{ marginTop: space ? 28 : 0 }}>
          <SectionHead title="In this post" headingLevel={2} />
          <div style={{ marginTop: 12 }}>
            {rows.map((row, index) => (
              <PlainRow key={row.label} label={row.to ? <SameLink to={row.to}>{row.label}</SameLink> : row.label} value={row.value} last={index === rows.length - 1} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

/** A link to this page with new parameters: no fade. */
function SameLink({ to, children }: { to: string; children: string }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link to={to} {...handlers} style={{ color: t.text2, textDecoration: state.hovered ? "underline" : "none", textUnderlineOffset: 3, borderRadius: r.control, ...ring(state.focusVisible) }}>
      {children}
    </Link>
  );
}

export function PostView(view: PostViewProps) {
  const phone = useIsPhone();
  const items = [{ value: "thread" as const, label: threadLabel(view.replies) }, ...(view.builds > 0 ? [{ value: "wall" as const, label: wallLabel(view.builds) }] : [])];
  const tab: PostTab = view.builds > 0 ? view.tab : "thread";
  const box = view.replyBox && view.replyBox.at !== "foot" ? { at: view.replyBox.at, node: view.replyBox.node } : undefined;

  const main = (
    <div>
      <nav aria-label="Where this post is" style={{ ...label(12), display: "flex", flexWrap: "wrap", gap: 6 }}>
        {view.crumbs.map((crumb, index) => (
          <span key={crumb.to} style={{ display: "inline-flex", gap: 6 }}>
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            <Crumb to={crumb.to}>{crumb.label}</Crumb>
          </span>
        ))}
      </nav>

      <PostCard card={view.card} page clamp={false} engagement={view.engagement} renderTile={view.renderTile} reactions={view.reactions} onReport={view.onReport} onMessage={view.onMessage} />

      <div style={{ display: "flex", flexDirection: phone ? "column" : "row", alignItems: phone ? "stretch" : "center", justifyContent: "space-between", gap: 12, marginTop: 8, paddingBottom: 12, borderBottom: `1px solid ${t.hairline}` }}>
        <Segmented label="Show" items={items} value={tab} onChange={(value) => view.onTab(value as PostTab)} size={phone ? 50 : 32} fontSize={12} fullWidth={phone} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 16, alignSelf: phone ? "flex-end" : undefined }}>
          {tab === "wall" ? view.wallRow : null}
          <span style={label(12)}>Oldest first</span>
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
              <span style={label(12.5, t.text2)}>{view.thread.filter.label}</span>
              <PostControl onClick={view.thread.filter.onShowAll}>Show all replies</PostControl>
            </div>
          ) : null}
          {view.thread.items.length === 0 ? (
            <EmptyLine line={view.thread.filter ? "No replies here yet." : "No replies yet."}>{null}</EmptyLine>
          ) : (
            <ReplyList items={view.thread.items} actions={view.actions} box={box} />
          )}
          {view.replyBox?.at === "foot" ? <div style={{ paddingTop: 16, borderTop: `1px solid ${t.hairline}` }}>{view.replyBox.node}</div> : null}
        </div>
      )}
    </div>
  );

  return <OpenBuildsColumns testId="openbuilds-post" sideLabel="About this post" main={main} side={<SideColumn {...view.side} />} />;
}

export default PostView;
