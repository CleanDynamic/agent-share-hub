/* Synth 11: /openbuilds, the feed. PURE: typed props, no fetching, no `useAuth()`, no router hooks but `Link`.

   The header carries OpenBuilds as the current item, so the page's h1 is for screen readers only. Three panels
   (`HomeColumns`, `300px minmax(0, 1fr) 340px` from 1101): the reader's spaces on the left, headed by their count; in the
   centre the one line and Post, the Your spaces / Everyone tabs, the All / Still open pills with "Newest first" at the right,
   then the topic cards 8 apart; on the right, the spaces with the most new posts this week. From 761 to 1100 the left panel
   goes and the repo's `All your spaces` menu stands above the feed; at 760 and below one column, the right panel's section
   after the feed. */

import { PageFailed, PageState } from "@/components/pagestate/PageState";
import type { ReadLike } from "@/components/pagestate/pageStateModel";
import type { CSSProperties, ReactNode } from "react";

import { FilterChip } from "@/components/brand/FilterChip";
import { Glyph } from "@/components/brand/Glyph";
import { PostCard, type CardModeration } from "@/components/post/PostCard";
import { PostControl, PostPrimary } from "@/components/post/postControls";
import type { PostCardData } from "@/components/post/postCardModel";
import type { RowEngagement } from "@/components/social/EngagementRow";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { SectionHead } from "@/components/vision/SectionHead";
import { TextTabs } from "@/components/vision/TextTabs";
import { PhonePills } from "@/components/phone/PhonePills";
import { PhoneTabs } from "@/components/phone/PhoneTabs";
import { RoundPostButton } from "@/components/phone/RoundPostButton";
import { PHONE_TOPBAR } from "@/components/shell/chromeSize";
import { useColumnPanels } from "@/components/shell/frameChrome";
import { HIDE_TRAVEL, useBarsHidden, useHideBarsOnScroll } from "@/components/shell/phoneBars";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { move } from "@/lib/theme/motion";
import { useNavigate } from "react-router-dom";
import { ring, touchArea } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { HomeColumns, useHomeLayout } from "@/pages/site/home/HomeFrame";

import { FEED_HEAD } from "./OpenBuildsFeedParts";
import type { FeedScope } from "./openBuildsFeedModel";
import { signInSentence } from "@/lib/copy/copy";

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
  /** G4: the reader's spaces read; PageState draws its failed state. */
  spaces: { read: ReadLike; rows: FeedSpaceRow[] };
  /** G4: the feed read; PageState draws its failed and empty states. */
  posts: { read: ReadLike; items: FeedItem[]; more?: { loading: boolean; onMore: () => void } };
  busy: BusyRow[];
  /** G9: every region failed, these being its reads: the page shows one failed state. */
  pageFailed?: readonly ReadLike[];
}

/* ── pieces ── */

const words = (size: 13 | 15, color: string, extra: CSSProperties = {}): CSSProperties => ({ margin: 0, fontFamily: FIGTREE, fontSize: size, lineHeight: size === 15 ? "20px" : "16px", color, ...extra });
const ellipsis: CSSProperties = { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

/** "4 spaces": the left panel's head states what it holds. */
const spacesHeading = (count: number): string => `${count} ${count === 1 ? "space" : "spaces"}`;

/** One of the reader's spaces: the name 15/600, "3 new" 13 in Text 2 at the right (hidden at zero); a Card fill under a fine pointer. */
function SpaceLink({ to, children, fresh }: { to: string; children: string; fresh?: number }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to={to}
      {...handlers}
      style={{ boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 44, padding: "0 16px", background: state.hovered ? t.module : "transparent", color: t.text, textDecoration: "none", ...ring(state.focusVisible) }}
    >
      <span style={{ ...words(15, t.text, { fontWeight: 600 }), ...ellipsis }}>{children}</span>
      {fresh ? <span style={{ ...words(13, t.text2), flexShrink: 0 }}>{`${fresh} new`}</span> : null}
    </Link>
  );
}

/** A plus before a control's label; the label alone is the control's name. */
function WithPlus({ children }: { children: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <Glyph name="plus" size={16} />
      {children}
    </span>
  );
}

function YourSpaces({ view }: { view: OpenBuildsFeedViewProps }) {
  const { spaces } = view;
  if (!view.signedIn) {
    return (
      <section aria-label="Your spaces" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SectionHead title="Your spaces" headingLevel={2} />
        <p style={{ ...words(15, t.text2), padding: "0 16px" }}>{signInSentence("joinSpaces")}</p>
        <div style={{ padding: "0 16px" }}>
          <PostControl to={view.signInTo}>Sign in</PostControl>
        </div>
      </section>
    );
  }
  const ready = spaces.read.status === "success" || spaces.rows.length > 0;
  return (
    <section aria-label="Your spaces" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <SectionHead title={ready ? spacesHeading(spaces.rows.length) : "Your spaces"} headingLevel={2} />
      <PageState read={spaces.read} thing="your spaces" region="Your spaces" skeleton={null} style={{ padding: "0 16px" }}>
        {() => (
          <div>
            {spaces.rows.map((row) => (
              <SpaceLink key={row.id} to={`/openbuilds/spaces/${row.slug}`} fresh={row.fresh}>
                {row.name}
              </SpaceLink>
            ))}
          </div>
        )}
      </PageState>
      <div style={{ padding: "4px 16px 0" }}>
        <PostControl onClick={view.onMakeSpace}>
          <WithPlus>Make a space</WithPlus>
        </PostControl>
      </div>
    </section>
  );
}

const BUSY_HEADING = "Most new posts this week";

function BusyThisWeek({ rows }: { rows: BusyRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section aria-label={BUSY_HEADING} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <SectionHead title={BUSY_HEADING} headingLevel={2} />
      <div>
        {rows.map((row) => (
          <div key={row.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 56, padding: "6px 16px", boxSizing: "border-box" }}>
            <div style={{ minWidth: 0 }}>
              <Link to={`/openbuilds/spaces/${row.slug}`} style={{ ...words(15, t.text, { fontWeight: 600 }), ...ellipsis, display: "block", textDecoration: "none" }}>
                {row.name}
              </Link>
              <div style={{ ...words(13, t.label), ...ellipsis }}>{row.meta}</div>
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

/** The topic cards, 8 apart with no lines between, and Show more. */
export function PostList({ items, more, phone = false }: { items: FeedItem[]; more?: { loading: boolean; onMore: () => void }; phone?: boolean }) {
  return (
    <div>
      {/* Prompt 20: on a phone each topic is a 12 16 item on the Page shade, 24 apart, with no panel and no lines. */}
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? 0 : 8 }}>
        {items.map((item) => (
          <div key={item.card.id} style={{ padding: phone ? "12px 16px" : "0 16px", contentVisibility: "auto", containIntrinsicSize: "auto 220px" }}>
            <PostCard card={item.card} engagement={item.engagement} moderation={item.moderation} phone={phone ? "list" : undefined} />
          </div>
        ))}
      </div>
      {more ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "16px 0 0" }}>
          <PostControl onClick={more.onMore}>{more.loading ? "Loading" : "Show more"}</PostControl>
        </div>
      ) : null}
    </div>
  );
}

/** The list's body: the cards, the states. */
function Posts({ view, phone = false }: { view: OpenBuildsFeedViewProps; phone?: boolean }) {
  const { posts } = view;
  return (
    <PageState
      read={posts.read}
      thing="posts"
      region="Posts"
      skeleton={null}
      style={{ padding: "16px" }}
      empty={{
        when: () => posts.items.length === 0,
        ...(view.scope === "mine"
          ? { line: "Nothing new in your spaces.", action: { label: "See everyone", onClick: () => view.onScope("everyone") } }
          : { line: "No posts yet.", action: { label: "Post", onClick: view.onPost } }),
      }}
    >
      {() => <PostList items={posts.items} more={posts.more} phone={phone} />}
    </PageState>
  );
}

const OPEN_ITEMS = [
  { value: "all", label: "All" },
  { value: "open", label: "Still open" },
] as const;

/** The page's name, for screen readers only: the header's current item already names it. */
export function FeedTitle() {
  return (
    <h1 className="sr-only" style={{ margin: 0 }}>
      {FEED_HEAD.title}
    </h1>
  );
}

/** The centre panel's first row: the one line, and Post at the right. */
export function FeedIntro({ post }: { post: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 16px 4px" }}>
      <p style={words(15, t.text2)}>{FEED_HEAD.line}</p>
      {post}
    </div>
  );
}

/** Prompt 20 Part B: the feed on a phone: the tabs, the reader's spaces as pills (Make a space last), the topics, and the round post button. "Most new posts this week" is not here. */
function PhoneFeed({ view }: { view: OpenBuildsFeedViewProps }) {
  useColumnPanels(true);
  useHideBarsOnScroll(false);
  const hidden = useBarsHidden();
  const navigate = useNavigate();
  const tabs: readonly { value: FeedScope; label: string }[] = [
    { value: "mine", label: "Your spaces" },
    { value: "everyone", label: "Everyone" },
  ];
  const pills = [
    { value: "all", label: "All" },
    { value: "open", label: "Still open" },
    ...view.spaces.rows.map((row) => ({ value: `space:${row.slug}`, label: row.fresh ? `${row.name} ${row.fresh}` : row.name })),
    { value: "make", label: "Make a space" },
  ];
  const pick = (value: string) => {
    if (value === "all") view.onOpen(false);
    else if (value === "open") view.onOpen(true);
    else if (value === "make") view.onMakeSpace();
    else navigate(`/openbuilds/spaces/${value.slice("space:".length)}`);
  };
  return (
    <div data-testid="home-view" data-layout="phone" style={{ fontFamily: FIGTREE, color: t.text, paddingBottom: "calc(72px + env(safe-area-inset-bottom))" }}>
      <FeedTitle />
      {view.signedIn ? (
        <div style={{ position: "sticky", top: `calc(env(safe-area-inset-top) + ${PHONE_TOPBAR}px)`, zIndex: 19, background: t.bg, transform: hidden ? `translateY(-${HIDE_TRAVEL}px)` : "translateY(0)", transition: move() }}>
          <PhoneTabs<FeedScope> equal tabs={tabs} value={view.scope} onChange={view.onScope} label="Posts from" />
        </div>
      ) : null}
      {view.pageFailed ? (
        <PageFailed reads={view.pageFailed} region="OpenBuilds" style={{ padding: 16 }} />
      ) : (
        <>
          <PhonePills pills={pills} value={view.open ? "open" : "all"} onChange={pick} label="Show" />
          <Posts view={view} phone />
        </>
      )}
      <RoundPostButton label="Post" icon="compose" onClick={view.onPost} />
    </div>
  );
}

export function OpenBuildsFeedView(view: OpenBuildsFeedViewProps) {
  const layout = useHomeLayout();
  const phone = useIsPhone();
  if (phone) return <PhoneFeed view={view} />;
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
      <FeedIntro post={<PostPrimary onClick={view.onPost}>Post</PostPrimary>} />
      {view.signedIn ? <TextTabs tabs={tabs} value={view.scope} onChange={view.onScope} label="Posts from" fill /> : null}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "12px 16px" }}>
        <div role="group" aria-label="Show" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {OPEN_ITEMS.map((item) => (
            <FilterChip key={item.value} label={item.label} on={(item.value === "open") === view.open} onClick={() => view.onOpen(item.value === "open")} style={touchArea(phone)} />
          ))}
        </div>
        <span style={words(13, t.label)}>Newest first</span>
      </div>
      {menu ? <div style={{ padding: "0 16px 12px" }}>{menu}</div> : null}
      <Posts view={view} />
    </div>
  );

  return (
    <div>
      <FeedTitle />
      {view.pageFailed ? (
        <HomeColumns flush omitEmptyRight layout={layout} left={null} centre={<PageFailed reads={view.pageFailed} region="OpenBuilds" style={{ padding: "16px" }} />} right={null} />
      ) : (
        <HomeColumns flush omitEmptyRight layout={layout} left={<YourSpaces view={view} />} centre={centre} right={view.busy.length > 0 ? <BusyThisWeek rows={view.busy} /> : null} />
      )}
    </div>
  );
}

export default OpenBuildsFeedView;
