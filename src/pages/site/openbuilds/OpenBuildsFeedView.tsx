/* UX-05 Part 2: /openbuilds, the feed. PURE: typed props, no fetching, no `useAuth()`, no router hooks but `Link`.

   The head, then Home's three columns (`HomeColumns`, as Home draws them): Your spaces on the left, the posts in the middle
   under two tabs and a Segmented, and Busy this week on the right. Below 1101 the left column becomes one control under the
   tabs, `All your spaces`, opening a menu of the reader's spaces; on a phone the right column is not drawn. */

import type { CSSProperties, ReactNode } from "react";

import { Segmented } from "@/components/brand/Segmented";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { PostCard, type CardModeration } from "@/components/post/PostCard";
import { PostControl, PostPrimary } from "@/components/post/postControls";
import type { PostCardData } from "@/components/post/postCardModel";
import type { RowEngagement } from "@/components/social/EngagementRow";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SectionHead } from "@/components/vision/SectionHead";
import { TextTabs } from "@/components/vision/TextTabs";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { HomeColumns, useHomeLayout } from "@/pages/site/home/HomeFrame";

import { EmptyLine, LoadError, PageHead } from "./OpenBuildsFeedFrame";
import type { FeedScope } from "./openBuildsFeedModel";

export type FeedStatus = "loading" | "error" | "ready";

export interface FeedSpaceRow {
  id: string;
  slug: string;
  name: string;
  /** Posts since the reader last looked. Hidden at zero. */
  fresh: number;
}

export interface BusyRow {
  id: string;
  slug: string;
  name: string;
  /** "Made by @sam · 412 members". */
  meta: string;
  onJoin: () => void;
}

export interface FeedItem {
  card: PostCardData;
  engagement?: RowEngagement;
  moderation?: CardModeration;
}

export interface OpenBuildsFeedViewProps {
  signedIn: boolean;
  scope: FeedScope;
  onScope: (scope: FeedScope) => void;
  open: boolean;
  onOpen: (open: boolean) => void;
  onPost: () => void;
  onMakeSpace: () => void;
  /** Where Sign in goes and comes back to. */
  signInTo: string;
  spaces: { status: FeedStatus; rows: FeedSpaceRow[]; onRetry: () => void };
  posts: { status: FeedStatus; items: FeedItem[]; onRetry: () => void; more?: { loading: boolean; onMore: () => void } };
  busy: BusyRow[];
}

/* ── pieces ── */

const rowText = (extra: CSSProperties = {}): CSSProperties => ({ fontFamily: FIGTREE, fontSize: 13, lineHeight: "20px", ...extra });

function SpaceLink({ to, current, children, fresh }: { to: string; current?: boolean; children: string; fresh?: number }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to={to}
      aria-current={current ? "page" : undefined}
      {...handlers}
      style={{ boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 40, color: current || state.hovered ? t.text : t.text2, textDecoration: "none", ...rowText({ fontWeight: current ? 500 : 400 }), ...ring(state.focusVisible) }}
    >
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{children}</span>
      {fresh ? <span style={{ flexShrink: 0, fontSize: 12, color: t.label }}>{`${fresh} new`}</span> : null}
    </Link>
  );
}

function YourSpaces({ view }: { view: OpenBuildsFeedViewProps }) {
  const { spaces } = view;
  if (!view.signedIn) {
    return (
      <section aria-label="Your spaces" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SectionHead title="Your spaces" />
        <p style={{ margin: 0, ...rowText({ color: t.text2 }) }}>Sign in to join spaces.</p>
        <div>
          <PostControl to={view.signInTo}>Sign in</PostControl>
        </div>
      </section>
    );
  }
  return (
    <section aria-label="Your spaces" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionHead title="Your spaces" />
      {spaces.status === "error" ? (
        <LoadError what="Spaces didn't load." onRetry={spaces.onRetry} />
      ) : (
        <div>
          <SpaceLink to="/openbuilds" current={view.scope === "mine"}>
            All your spaces
          </SpaceLink>
          {spaces.rows.map((row) => (
            <div key={row.id} style={{ borderTop: `1px solid ${t.hairline}` }}>
              <SpaceLink to={`/openbuilds/spaces/${row.slug}`} fresh={row.fresh}>
                {row.name}
              </SpaceLink>
            </div>
          ))}
        </div>
      )}
      <div>
        <PostControl onClick={view.onMakeSpace}>Make a space</PostControl>
      </div>
      <Link to="/openbuilds/requests" style={{ ...rowText({ fontSize: 12.5, color: t.text2 }), textDecoration: "none" }}>
        Older requests
      </Link>
    </section>
  );
}

function BusyThisWeek({ rows }: { rows: BusyRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section aria-label="Busy this week" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <SectionHead title="Busy this week" meta="Spaces with the most new posts" />
      <div>
        {rows.map((row, index) => (
          <div key={row.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 52, borderTop: index === 0 ? "none" : `1px solid ${t.hairline}` }}>
            <div style={{ minWidth: 0 }}>
              <Link to={`/openbuilds/spaces/${row.slug}`} style={{ ...rowText({ color: t.text }), textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {row.name}
              </Link>
              <div style={{ ...rowText({ fontSize: 12, color: t.label }), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.meta}</div>
            </div>
            <PostControl onClick={row.onJoin} aria-label={`Join ${row.name}`}>
              Join
            </PostControl>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The cards, a hairline between, and Show more. */
export function PostList({ items, more }: { items: FeedItem[]; more?: { loading: boolean; onMore: () => void } }) {
  return (
    <div>
      {items.map((item, index) => (
        <div key={item.card.id} style={{ borderTop: index === 0 ? "none" : `1px solid ${t.hairline}`, padding: "0 20px", contentVisibility: "auto", containIntrinsicSize: "auto 220px" }}>
          <PostCard card={item.card} engagement={item.engagement} moderation={item.moderation} />
        </div>
      ))}
      {more ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "20px 0", borderTop: `1px solid ${t.hairline}` }}>
          <PostControl onClick={more.onMore}>{more.loading ? "Loading" : "Show more"}</PostControl>
        </div>
      ) : null}
    </div>
  );
}

/** The list's body: the cards, the states. */
function Posts({ view }: { view: OpenBuildsFeedViewProps }) {
  const { posts } = view;
  if (posts.status === "error") return <LoadError what="Posts didn't load." onRetry={posts.onRetry} />;
  if (posts.items.length === 0) {
    return view.scope === "mine" ? (
      <EmptyLine line="Nothing new in your spaces.">
        <PostControl onClick={() => view.onScope("everyone")}>See everyone</PostControl>
      </EmptyLine>
    ) : (
      <EmptyLine line="No posts yet.">
        <PostControl onClick={view.onPost}>Post</PostControl>
      </EmptyLine>
    );
  }
  return <PostList items={posts.items} more={posts.more} />;
}

const OPEN_ITEMS = [
  { value: "all", label: "All" },
  { value: "open", label: "Still open" },
] as const;

export function OpenBuildsFeedView(view: OpenBuildsFeedViewProps) {
  const layout = useHomeLayout();
  const phone = useIsPhone();
  const tabs: readonly { value: FeedScope; label: string }[] = [
    { value: "mine", label: "Your spaces" },
    { value: "everyone", label: "Everyone" },
  ];

  const menu: ReactNode =
    layout !== "three" && view.signedIn ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <PostControl>All your spaces</PostControl>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {view.spaces.rows.map((row) => (
            <DropdownMenuItem key={row.id} asChild>
              <Link to={`/openbuilds/spaces/${row.slug}`}>{row.fresh ? `${row.name} · ${row.fresh} new` : row.name}</Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={view.onMakeSpace}>Make a space</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  const centre = (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12, padding: "0 20px", borderBottom: `1px solid ${t.hairline}` }}>
        {view.signedIn ? <TextTabs tabs={tabs} value={view.scope} onChange={view.onScope} label="Posts from" rule={false} /> : <span />}
        <div style={{ paddingBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
          <Segmented
            label="Show"
            items={OPEN_ITEMS}
            value={view.open ? "open" : "all"}
            onChange={(value) => view.onOpen(value === "open")}
            size={phone ? 50 : 28}
            fontSize={12}
          />
        </div>
      </div>
      {menu ? <div style={{ padding: "12px 20px 0" }}>{menu}</div> : null}
      <p style={{ margin: 0, padding: "8px 20px 0", ...rowText({ fontSize: 12, color: t.label }) }}>Newest first</p>
      <Posts view={view} />
    </div>
  );

  return (
    <div>
      <PageHead
        title="OpenBuilds"
        line="Post anything, reply with anything. Spaces are made and run by the people in them."
        primary={
          <PostPrimary onClick={view.onPost} block>
            Post
          </PostPrimary>
        }
      />
      <HomeColumns layout={layout} left={<YourSpaces view={view} />} centre={centre} right={layout === "one" ? null : <BusyThisWeek rows={view.busy} />} />
    </div>
  );
}

export default OpenBuildsFeedView;
