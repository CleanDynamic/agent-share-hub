/* Prompt 20 Part A: Home on a phone (below 768px). Home IS the feed, in X's structure with the Synth look: the top bar (the
   frame's), the tabs, then one column of posts to the dock. No drafts, sessions, published builds, tiles or headings: the
   desktop's left panel lives in Drafts on a phone. The page's h1 is for screen readers only.

   PURE like `HomeView`: the same props, no fetching. `HomeView` hands them here when `useIsPhone()`; nothing at 768 and up
   changes. The posts are at X's proportions (prompt 29a, `xFeed.ts`): a 12 16 12 12 item, a 48 avatar and an 8 gap, the text
   column holding everything else, 24 between posts, the bars sliding away on scroll (`phoneBars.ts`). There is no new-posts
   pill: a pull to refresh brings new posts (`PullToRefresh`, the beaver in the top bar dunking while the feed refreshes). */

import { PriorityImageScope } from "@/components/post/media/priorityImage";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { PhoneFeedBones } from "./PhoneHomeLoading";

import { Avatar } from "@/components/brand/Avatar";
import { MobileIcon } from "@/components/brand/MobileIcon";
import { PageFailed, PageState } from "@/components/pagestate/PageState";
import { readOf } from "@/components/pagestate/pageStateModel";
import { PullToRefresh } from "@/components/feed/PullToRefresh";
import { FeedPost } from "@/components/gallery/FeedPost";
import { X_FEED, X_ROW_GAP, xGrid, xMeta, xName } from "@/components/gallery/xFeed";
import type { MediaSrcMap } from "@/components/gallery/cardMedia";
import { PhoneRow } from "@/components/phone/PhoneRow";
import { PhoneTabs } from "@/components/phone/PhoneTabs";
import { PostCard } from "@/components/post/PostCard";
import { PANEL_GUTTER, PHONE_TOPBAR } from "@/components/shell/chromeSize";
import { useColumnPanels } from "@/components/shell/frameChrome";
import { LazyBottomSheet } from "@/components/shell/LazyBottomSheet";
import { MoreSheet } from "@/components/shell/MoreSheet";
import { HIDE_TRAVEL, useBarsHidden, useHideBarsOnScroll } from "@/components/shell/phoneBars";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { siteUrl } from "@/lib/site";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { phoneSlide, phoneSlideOpacity } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { atHandle, HOME_FILTERS, refreshedLine, STILL_OPEN_HREF, STILL_OPEN_PHRASE, type HomeBuildPost, type HomeFilter, type HomeFeedItem, type HomeRebuildPost } from "./homeModel";
import type { HomeScope, HomeViewProps } from "./HomeView";
import { RebuildPost } from "./RebuildPost";
import { useNear } from "./useNear";

/** Prompt 29a: the item's padding at X's proportions, 12 16 12 12, so two posts are 24 apart with no line. */
const ITEM: CSSProperties = { padding: X_FEED.phone.padding, boxSizing: "border-box" };

/** Where the dock and the safe area leave room under the last post. */
const BOTTOM: CSSProperties = { paddingBottom: "calc(72px + env(safe-area-inset-bottom))", margin: `0 -${PANEL_GUTTER}px` };

/** The page's name, for screen readers only. */
function Title() {
  return (
    <h1 className="sr-only" style={{ margin: 0 }}>
      Home
    </h1>
  );
}

/* ═════════ the tabs, and the kind sheet ═════════ */

const KIND_ROW: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  minHeight: 52,
  padding: "0 16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  border: 0,
  background: "transparent",
  color: t.text,
  fontFamily: FIGTREE,
  fontSize: 17,
  fontWeight: 500,
  lineHeight: "22px",
  textAlign: "left",
  cursor: "pointer",
};

function KindRow({ label, on, onPick }: { label: string; on: boolean; onPick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onPick} {...handlers} style={{ ...KIND_ROW, ...ring(state.focusVisible) }}>
      {label}
      {on ? (
        <span aria-hidden="true" style={{ color: t.brandAccent, display: "inline-flex" }}>
          <MobileIcon name="check" size={20} />
        </span>
      ) : null}
    </button>
  );
}

/** The kinds of the current tab, in a content-height sheet with no title: All, Builds, Rebuilds, Topics. Choosing one closes it. */
export function KindSheet({ open, onOpenChange, filter, onPick }: { open: boolean; onOpenChange: (open: boolean) => void; filter: HomeFilter; onPick: (filter: HomeFilter) => void }) {
  return (
    <LazyBottomSheet open={open} onOpenChange={onOpenChange} title="Kind" hideTitle>
      <div role="radiogroup" aria-label="Kind" data-testid="home-kind-sheet" style={{ paddingBottom: 8 }}>
        {HOME_FILTERS.map((item) => (
          <KindRow
            key={item.value}
            label={item.label}
            on={item.value === filter}
            onPick={() => {
              onPick(item.value);
              onOpenChange(false);
            }}
          />
        ))}
      </div>
    </LazyBottomSheet>
  );
}

/** The tabs row's own height, drawn while the feed loads. */
const TABS_TOP = `calc(env(safe-area-inset-top) + ${PHONE_TOPBAR}px)`;

function Tabs({ scope, onScopeChange, filter, hidden, onKind }: { scope: HomeScope; onScopeChange: (scope: HomeScope) => void; filter: HomeFilter; hidden: boolean; onKind: () => void }) {
  const kind = HOME_FILTERS.find((item) => item.value === filter);
  return (
    <div
      data-testid="home-phone-tabs"
      data-motion="bar"
      data-hidden={hidden ? "" : undefined}
      style={{ position: "sticky", top: TABS_TOP, zIndex: 19, background: t.bg, boxShadow: `inset 0 -1px 0 ${t.control}`, transform: hidden ? `translateY(-${HIDE_TRAVEL}px)` : "translateY(0)", transition: phoneSlide(), opacity: phoneSlideOpacity(hidden) }}
    >
      <PhoneTabs<HomeScope>
        label="Feed scope"
        centred
        value={scope}
        tabs={[
          { value: "following", label: "Following" },
          { value: "everyone", label: "Everyone" },
        ]}
        // Tapping the current tab again opens the kinds, as X puts its feed options on "For you".
        onChange={(next) => (next === scope ? onKind() : onScopeChange(next))}
        renderLabel={(tab, current) =>
          current ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span data-tab-word="">{tab.label}</span>
              {filter !== "all" && kind ? <span style={{ fontWeight: 500, color: t.text2 }}>{`· ${kind.label}`}</span> : null}
              <span aria-hidden="true" style={{ color: t.label, display: "inline-flex" }}>
                <MobileIcon name="chev" size={16} />
              </span>
            </span>
          ) : (
            <span data-tab-word="">{tab.label}</span>
          )
        }
      />
    </div>
  );
}

/* ═════════ the posts ═════════ */

function Frame({ height, kind, children }: { height: number; kind: string; children: ReactNode }) {
  return (
    <div data-kind={kind} data-testid="home-feed-item" style={{ ...ITEM, contentVisibility: "auto", containIntrinsicSize: `auto ${height}px` }}>
      {children}
    </div>
  );
}

function BuildPost({ item, srcByPath, now, onNear }: { item: HomeBuildPost; srcByPath: MediaSrcMap; now: number; onNear?: (ids: string[]) => void }) {
  const ref = useNear<HTMLDivElement>(item.build.id, onNear);
  const [more, setMore] = useState(false);
  const handle = item.maker.handle;
  return (
    <Frame height={560} kind="build">
      <div ref={ref}>
        <FeedPost
          x="phone"
          build={item.build}
          srcByPath={srcByPath}
          makerHandle={item.maker.handle}
          makerName={item.maker.name}
          makerAvatar={item.maker.avatarUrl ?? null}
          modelsUsed={item.modelsUsed}
          classification={item.classification}
          engagement={item.engagement}
          now={now}
          onMore={() => setMore(true)}
        />
      </div>
      <MoreSheet
        open={more}
        onOpenChange={setMore}
        link={siteUrl(`/b2/${item.build.slug}`)}
        name={item.build.title}
        items={[{ label: "Open build", to: `/b2/${item.build.slug}` }, ...(handle ? [{ label: `@${handle}`, to: `/profile/${encodeURIComponent(handle)}` }] : [])]}
      />
    </Frame>
  );
}

function PlainLink({ to, style, children }: { to: string; style?: CSSProperties; children: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link to={to} {...handlers} style={{ color: t.text, textDecoration: "none", borderRadius: 4, ...ring(state.focusVisible), ...style }}>
      {children}
    </Link>
  );
}

const meta13: CSSProperties = { fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label };

function RebuildItem({ item, srcByPath, now, onNear }: { item: HomeRebuildPost; srcByPath: MediaSrcMap; now: number; onNear?: (ids: string[]) => void }) {
  const [more, setMore] = useState(false);
  return (
    <Frame height={320} kind="rebuild">
      <RebuildPost item={item} srcByPath={srcByPath} now={now} size="phone" onNear={onNear} onMore={() => setMore(true)} />
      <MoreSheet open={more} onOpenChange={setMore} link={siteUrl(`/b2/${item.build.slug}`)} name={item.build.title} items={[{ label: "Open rebuild", to: `/b2/${item.build.slug}` }]} />
    </Frame>
  );
}

function TopicPost({ item, actions }: { item: Extract<HomeFeedItem, { kind: "topic" }>; actions?: HomeViewProps["topics"] }) {
  return (
    <Frame height={260} kind="topic">
      <PostCard
        phone="home"
        x="phone"
        card={item.card}
        topic={
          actions
            ? {
                likes: item.likes,
                liked: item.liked,
                onLike: () => actions.onLike(item.postId, !item.liked),
                replies: item.replies,
                onReply: () => actions.onReply(item.postId),
                save: actions.save ? { saved: actions.save.isSaved(item.postId), onSave: () => actions.save!.onSave(item.postId, !actions.save!.isSaved(item.postId)) } : undefined,
              }
            : undefined
        }
      />
      {actions?.box?.at === item.postId ? (
        <div style={{ ...xGrid("phone"), paddingTop: 12 }}>
          <div data-testid="home-reply-box" style={{ gridColumn: 2, minWidth: 0 }}>
            {actions.box.node}
          </div>
        </div>
      ) : null}
    </Frame>
  );
}

/* ═════════ loading ═════════ */

/** A post while the feed loads: the avatar, two lines of words, a picture, the actions. In the dot field. */
/* ═════════ the page ═════════ */

/** The next page loads when the reader is two screens from the end. */
function useNearEnd(active: boolean, onNear: () => void, key: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef(onNear);
  latest.current = onNear;
  useEffect(() => {
    const node = ref.current;
    if (!active || !node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) latest.current();
    }, { rootMargin: "0px 0px 200% 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [active, key]);
  return ref;
}

export function PhoneHome(props: HomeViewProps) {
  useColumnPanels(true);
  const { feed, filter, now, srcByPath, onPostsNear, scope, onScopeChange } = props;
  const [kindOpen, setKindOpen] = useState(false);
  useHideBarsOnScroll(kindOpen);
  const hidden = useBarsHidden();
  const end = useNearEnd(feed.status === "ready" && feed.hasMore && !feed.loadingMore, feed.onMore, feed.items.length);
  const tabs = <Tabs scope={scope} onScopeChange={onScopeChange} filter={filter} hidden={hidden} onKind={() => setKindOpen(true)} />;

  if (props.pageFailed) {
    return (
      <div data-testid="home-view" data-layout="phone" style={BOTTOM}>
        <Title />
        <PageFailed reads={props.pageFailed} region="Home" style={{ padding: 16 }} />
      </div>
    );
  }

  const visible = feed.items.filter((item) => filter === "all" || (filter === "builds" ? item.kind === "build" : filter === "rebuilds" ? item.kind === "rebuild" : item.kind === "topic" || item.kind === "reply_group"));
  const openRows = props.requests.status === "ready" ? props.requests.data : [];
  const openLine = openRows.length > 0 ? `${openRows.length} ${STILL_OPEN_PHRASE[props.stillOpenScope ?? "spaces"]}` : null;
  const moduleAt = Math.min(5, visible.length);

  const body =
    feed.status !== "ready" || (feed.items.length === 0 && props.newCount === 0) ? (
      <PageState
        read={feed.status === "ready" ? readOf("ready", feed.items) : feed.status === "error" ? { data: undefined, error: feed.error ?? { message: "feed read failed" }, status: "error", fetchStatus: feed.retrying ? "fetching" : "idle", refetch: feed.onRetry } : readOf("loading")}
        thing="the feed"
        region="The feed"
        skeleton={<PhoneFeedBones count={3} />}
        style={{ padding: 16 }}
        empty={{
          when: () => true,
          line: scope === "following" ? "Nobody you follow has posted yet." : "Nothing has been posted yet.",
          action: scope === "following" ? { label: "See everyone", onClick: () => onScopeChange("everyone") } : undefined,
          testId: "home-feed-empty",
        }}
      >
        {() => null}
      </PageState>
    ) : (
      <>
        <PriorityImageScope>
          <div data-testid="home-feed" style={{ display: "flex", flexDirection: "column" }}>
            {visible.flatMap((item, index) => {
              const node =
                item.kind === "build" ? (
                  <BuildPost key={item.key} item={item} srcByPath={srcByPath} now={now} onNear={onPostsNear} />
                ) : item.kind === "rebuild" ? (
                  <RebuildItem key={item.key} item={item} srcByPath={srcByPath} now={now} onNear={onPostsNear} />
                ) : item.kind === "topic" ? (
                  <TopicPost key={item.key} item={item} actions={props.topics} />
                ) : (
                  <ReplyGroup key={item.key} item={item} />
                );
              return index + 1 === moduleAt && openLine ? [node, <PhoneRow key="open" data-testid="home-open-row" to={STILL_OPEN_HREF} title={openLine} lead={{ kind: "icon", icon: "ob" }} trail={{ kind: "chevron" }} />] : [node];
            })}
          </div>
        </PriorityImageScope>
        {visible.length === 0 ? <p style={{ ...meta13, margin: 0, padding: "0 16px 16px" }}>None of these among the latest.{feed.hasMore ? " Scroll to look further back." : ""}</p> : null}
        {feed.loadingMore ? <PhoneFeedBones count={2} /> : null}
        <div ref={end} aria-hidden="true" />
        {feed.hasMore ? null : <PhoneEnd cards={props.endCards} />}
      </>
    );

  return (
    <div data-testid="home-view" data-layout="phone" style={{ fontFamily: FIGTREE, color: t.text, ...BOTTOM }}>
      <Title />
      {/* Prompt 29a: no "new since you looked" pill on a phone. New posts arrive with the pull to refresh, and the count that fed
          the pill is what the refresh announces. The tabs move with the feed, so the pull opens space under the top bar. */}
      {props.onRefresh ? (
        <PullToRefresh onRefresh={props.onRefresh} doneLine={refreshedLine} disabled={kindOpen}>
          {tabs}
          {body}
        </PullToRefresh>
      ) : (
        <>
          {tabs}
          {body}
        </>
      )}
      <KindSheet open={kindOpen} onOpenChange={setKindOpen} filter={filter} onPick={props.onFilterChange} />
    </div>
  );
}

function ReplyGroup({ item }: { item: Extract<HomeFeedItem, { kind: "reply_group" }> }) {
  const name = item.topic.author.name;
  const line = [atHandle(item.topic.author.handle), item.topic.age].filter(Boolean).join(" · ");
  return (
    <Frame height={200} kind="reply_group">
      <article aria-label={`${item.count} in ${item.topic.heading || "Untitled post"}`} style={xGrid("phone")}>
        <Avatar size={X_FEED.phone.avatar} userId={item.topic.author.id} name={name} src={item.topic.author.avatarUrl} phone />
        <PlainLink to={item.to} style={{ display: "block", minWidth: 0 }}>
          <span style={{ display: "flex", gap: 4, whiteSpace: "nowrap", fontFamily: FIGTREE }}>
            <span style={xName("phone")}>{name}</span>
            <span style={{ ...xMeta("phone"), color: t.label, overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{line}</span>
          </span>
          <span style={{ display: "block", marginTop: X_ROW_GAP, fontFamily: FIGTREE, fontSize: X_FEED.phone.text, fontWeight: 600, lineHeight: `${X_FEED.phone.line}px`, overflowWrap: "anywhere" }}>{item.topic.heading || "Untitled post"}</span>
          <span data-testid="home-reply-group-count" style={{ display: "block", marginTop: 4, fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.text2 }}>
            {item.count}
          </span>
        </PlainLink>
      </article>
    </Frame>
  );
}

function PhoneEnd({ cards }: { cards: HomeViewProps["endCards"] }) {
  return (
    <div data-testid="home-feed-end" style={{ padding: "24px 16px 0", textAlign: "center" }}>
      <div style={{ fontFamily: FIGTREE, fontSize: 15, fontWeight: 500, lineHeight: "20px", color: t.text }}>You&rsquo;re up to date</div>
      <PlainLink to="/builds" style={{ display: "inline-flex", alignItems: "center", minHeight: 44, fontFamily: FIGTREE, fontSize: 13, color: t.label, textDecoration: "underline", textUnderlineOffset: 3 }}>
        More builds
      </PlainLink>
      {cards.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, paddingTop: 8, textAlign: "left" }}>
          {cards.map((card) => (
            <Link key={card.id} to={card.href} style={{ display: "block", padding: 12, background: t.module, borderRadius: r.card, color: t.text, textDecoration: "none" }}>
              <span style={{ display: "block", fontFamily: FIGTREE, fontSize: 15, fontWeight: 600, lineHeight: "20px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.title}</span>
              {card.facts ? <span style={{ display: "block", ...meta13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.facts}</span> : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default PhoneHome;
