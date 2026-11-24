/* Prompt 20 Part A: Home on a phone (below 768px). Home IS the feed, in X's structure with the Synth look: the top bar (the
   frame's), the tabs, then one column of posts to the dock. No drafts, sessions, published builds, tiles or headings: the
   desktop's left panel lives in Drafts on a phone. The page's h1 is for screen readers only.

   PURE like `HomeView`: the same props, no fetching. `HomeView` hands them here when `useIsPhone()`; nothing at 768 and up
   changes. Every number below is the prompt's: a 12 16 item, a 40 avatar and a 12 gap, the text column holding everything
   else, 24 between a build's posts, the bars sliding away on scroll (`phoneBars.ts`). */

import { PriorityImageScope } from "@/components/post/media/priorityImage";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { PhoneFeedBones } from "./PhoneHomeLoading";

import { Avatar } from "@/components/brand/Avatar";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { MobileIcon } from "@/components/brand/MobileIcon";
import { PageFailed, PageState } from "@/components/pagestate/PageState";
import { readOf } from "@/components/pagestate/pageStateModel";
import { FeedPost } from "@/components/gallery/FeedPost";
import type { MediaSrcMap } from "@/components/gallery/cardMedia";
import { useThreadRest } from "@/components/gallery/useThreadRest";
import { PhoneNameLink } from "@/components/phone/PhoneNameLink";
import { PhoneRow } from "@/components/phone/PhoneRow";
import { PhoneTabs } from "@/components/phone/PhoneTabs";
import { PostCard } from "@/components/post/PostCard";
import { PostThread } from "@/components/post/PostThread";
import { PANEL_GUTTER, PHONE_TAB, PHONE_TOPBAR } from "@/components/shell/chromeSize";
import { useColumnPanels } from "@/components/shell/frameChrome";
import { LazyBottomSheet } from "@/components/shell/LazyBottomSheet";
import { MoreSheet } from "@/components/shell/MoreSheet";
import { HIDE_TRAVEL, useBarsHidden, useHideBarsOnScroll } from "@/components/shell/phoneBars";
import { EngagementRow } from "@/components/social/EngagementRow";
import { splitThread, threadOf, type GalleryMedia } from "@/lib/build";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { siteUrl } from "@/lib/site";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { move } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, SENTIENT } from "@/lib/theme/type";

import { atHandle, HOME_FILTERS, shortAgo, STILL_OPEN_HREF, STILL_OPEN_PHRASE, type HomeBuildPost, type HomeFilter, type HomeFeedItem, type HomePerson, type HomeRebuildPost } from "./homeModel";
import type { HomeScope, HomeViewProps } from "./HomeView";
import { useNear } from "./useNear";

/** The item's side margin and its top and bottom: 12 16, so two builds are 24 apart. */
const ITEM: CSSProperties = { padding: "12px 16px", boxSizing: "border-box" };

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
      data-hidden={hidden ? "" : undefined}
      style={{ position: "sticky", top: TABS_TOP, zIndex: 19, background: t.bg, transform: hidden ? `translateY(-${HIDE_TRAVEL}px)` : "translateY(0)", transition: move() }}
    >
      <PhoneTabs<HomeScope>
        label="Feed scope"
        equal
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
              {tab.label}
              {filter !== "all" && kind ? <span style={{ fontWeight: 500, color: t.text2 }}>{`· ${kind.label}`}</span> : null}
              <span aria-hidden="true" style={{ color: t.label, display: "inline-flex" }}>
                <MobileIcon name="chev" size={16} />
              </span>
            </span>
          ) : (
            tab.label
          )
        }
      />
    </div>
  );
}

/* ═════════ "3 new since you looked" ═════════ */

const PILL: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  boxSizing: "border-box",
  height: 32,
  padding: "0 12px",
  border: 0,
  borderRadius: r.full,
  background: t.inverse,
  color: t.onInverse,
  fontFamily: FIGTREE,
  fontSize: 13,
  fontWeight: 500,
  lineHeight: "16px",
  cursor: "pointer",
};

function PillButton({ count, authors, onPress, floating }: { count: number; authors: readonly HomePerson[]; onPress: () => void; floating?: boolean }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button type="button" data-testid={floating ? "home-new-pill-floating" : "home-new-pill"} onClick={onPress} {...handlers} style={{ ...PILL, ...(floating ? { padding: `0 12px 0 ${authors.length > 0 ? 6 : 12}px` } : null), ...ring(state.focusVisible) }}>
      {floating && authors.length > 0 ? (
        <span aria-hidden="true" style={{ display: "inline-flex" }}>
          {authors.slice(0, 3).map((who, index) => (
            <span key={who.id} style={{ display: "inline-flex", marginLeft: index === 0 ? 0 : -6, borderRadius: 6, boxShadow: `0 0 0 2px ${t.inverse}` }}>
              <Avatar size={20} userId={who.id} name={who.name} src={who.avatarUrl} />
            </span>
          ))}
        </span>
      ) : null}
      {`${count} new since you looked`}
    </button>
  );
}

/** In the flow at the top of the feed, centred, 12 above the first post; once scrolled past it floats 8 under the tabs (or the inset when the bars are away). Choosing it scrolls to the top and shows the new posts. */
function NewPill({ count, authors, onShow, hidden }: { count: number; authors: readonly HomePerson[]; onShow: () => void; hidden: boolean }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [past, setPast] = useState(false);
  const any = count > 0;
  useEffect(() => {
    const node = anchor.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setPast(!entry.isIntersecting && entry.boundingClientRect.bottom < (entry.rootBounds?.top ?? 0)));
    observer.observe(node);
    return () => observer.disconnect();
  }, [any]);
  if (count <= 0) return null;
  const show = () => {
    window.scrollTo({ top: 0 });
    onShow();
  };
  return (
    <>
      <div ref={anchor} style={{ display: "flex", justifyContent: "center", paddingTop: 12 }}>
        <PillButton count={count} authors={authors} onPress={show} />
      </div>
      {past ? (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            top: `calc(env(safe-area-inset-top) + 8px)`,
            zIndex: 18,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
            transform: hidden ? "translateY(0)" : `translateY(${PHONE_TOPBAR + PHONE_TAB}px)`,
            transition: move(),
          }}
        >
          <span style={{ pointerEvents: "auto" }}>
            <PillButton floating count={count} authors={authors} onPress={show} />
          </span>
        </div>
      ) : null}
    </>
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
          phoneFeed
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

function RebuildPost({ item, srcByPath, now, onNear }: { item: HomeRebuildPost; srcByPath: MediaSrcMap; now: number; onNear?: (ids: string[]) => void }) {
  const ref = useNear<HTMLElement>(item.build.id, onNear);
  const [more, setMore] = useState(false);
  const source = atHandle(item.source.handle);
  const handle = atHandle(item.maker.handle);
  const line = [handle, shortAgo(item.at, now)].filter(Boolean).join(" · ");

  const doc = useMemo(() => threadOf(item.build, item.build.media), [item.build]);
  const posts = useMemo(() => (doc ? splitThread(doc) : []), [doc]);
  const threaded = posts.length > 1;
  const { phase, rest, restState, open, close, warm, retry } = useThreadRest({ buildId: item.build.id, enabled: threaded });
  const mediaById = useMemo(() => {
    const map = new Map<string, GalleryMedia>(item.build.media.map((row) => [row.id, row]));
    for (const row of rest?.rows ?? []) map.set(row.id, row);
    return map;
  }, [item.build.media, rest]);
  const srcAll = useMemo<MediaSrcMap>(() => (rest && rest.src.size > 0 ? new Map([...srcByPath, ...rest.src]) : srcByPath), [srcByPath, rest]);

  // The note, then "Rebuilt from" as a Card linking to the source build. No "rebuilt" line above the author row.
  const start = (
    <>
      {item.note ? <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 15, lineHeight: "20px", color: t.text, overflowWrap: "anywhere" }}>{item.note}</p> : null}
      <div style={{ marginTop: item.note ? 12 : 0, padding: "12px 14px", background: t.module, borderRadius: r.card }}>
        <span style={{ display: "block", ...meta13 }}>Rebuilt from</span>
        <span style={{ display: "block", fontFamily: SENTIENT, fontSize: 15, lineHeight: "20px", color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.source.title}</span>
        {source ? <span style={{ display: "block", ...meta13 }}>{source}</span> : null}
      </div>
    </>
  );
  return (
    <Frame height={320} kind="rebuild">
      <article ref={ref} aria-label={item.build.title} style={{ display: "grid", gridTemplateColumns: "40px minmax(0, 1fr)", columnGap: 12 }}>
        <Avatar size={40} userId={item.maker.id} name={item.maker.name} hue={item.maker.hue} src={item.maker.avatarUrl} />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, minHeight: 20, marginBottom: 4, whiteSpace: "nowrap", minWidth: 0 }}>
            <PhoneNameLink handle={item.maker.handle}>{item.maker.name}</PhoneNameLink>
            <span style={{ fontFamily: FIGTREE, fontSize: 15, lineHeight: "20px", color: t.label, overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{line}</span>
            <span style={{ flex: 1 }} />
            <MoreDots onPress={() => setMore(true)} />
          </div>
          {threaded ? (
            <PostThread
              feed
              phone
              posts={posts}
              first={start}
              mediaById={mediaById}
              srcByPath={srcAll}
              mode={phase === "open" ? "open" : "closed"}
              onOpen={open}
              onClose={close}
              onIntent={warm}
              rest={restState}
              onRetry={retry}
              connector={{ x: -(40 + 12) + 20, top: 16 }}
              resetKey={item.build.id}
            />
          ) : (
            start
          )}
          <div style={{ marginTop: 12 }}>
            <PlainLink to={`/b2/${item.build.slug}`} style={{ fontFamily: FIGTREE, fontSize: 13, fontWeight: 500, lineHeight: "16px" }}>
              {item.build.title}
            </PlainLink>
          </div>
          {item.engagement ? (
            <EngagementRow
              phoneFeed
              variant="card"
              withRebuild
              build={{ id: item.build.id, slug: item.build.slug, title: item.build.title, rebuild_count: item.build.rebuild_count }}
              counts={item.engagement.counts}
              liked={item.engagement.liked}
              saved={item.engagement.saved}
            />
          ) : null}
        </div>
      </article>
      <MoreSheet open={more} onOpenChange={setMore} link={siteUrl(`/b2/${item.build.slug}`)} name={item.build.title} items={[{ label: "Open rebuild", to: `/b2/${item.build.slug}` }]} />
    </Frame>
  );
}

/** Three dots at 18 in Text 3, a 32 hit area with the touch target reaching 44 round it. */
function MoreDots({ onPress }: { onPress: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button type="button" aria-label="More" onClick={onPress} {...handlers} style={{ flex: "none", position: "relative", width: 32, height: 32, margin: "-6px -8px -6px 0", padding: 0, border: 0, borderRadius: 999, background: "transparent", color: t.label, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", ...ring(state.focusVisible) }}>
      <MobileIcon name="more" size={18} />
      <span aria-hidden="true" style={{ position: "absolute", inset: -6 }} />
    </button>
  );
}

function TopicPost({ item, actions }: { item: Extract<HomeFeedItem, { kind: "topic" }>; actions?: HomeViewProps["topics"] }) {
  return (
    <Frame height={260} kind="topic">
      <PostCard
        phone="home"
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
        <div style={{ display: "grid", gridTemplateColumns: "40px minmax(0, 1fr)", columnGap: 12, paddingTop: 8 }}>
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
                  <RebuildPost key={item.key} item={item} srcByPath={srcByPath} now={now} onNear={onPostsNear} />
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
      <Tabs scope={scope} onScopeChange={onScopeChange} filter={filter} hidden={hidden} onKind={() => setKindOpen(true)} />
      <NewPill count={props.newCount} authors={props.newAuthors ?? []} onShow={props.onShowNew} hidden={hidden} />
      {body}
      <KindSheet open={kindOpen} onOpenChange={setKindOpen} filter={filter} onPick={props.onFilterChange} />
    </div>
  );
}

function ReplyGroup({ item }: { item: Extract<HomeFeedItem, { kind: "reply_group" }> }) {
  const name = item.topic.author.name;
  const line = [atHandle(item.topic.author.handle), item.topic.age].filter(Boolean).join(" · ");
  return (
    <Frame height={200} kind="reply_group">
      <article aria-label={`${item.count} in ${item.topic.heading || "Untitled post"}`} style={{ display: "grid", gridTemplateColumns: "40px minmax(0, 1fr)", columnGap: 12 }}>
        <Avatar size={40} userId={item.topic.author.id} name={name} src={item.topic.author.avatarUrl} />
        <PlainLink to={item.to} style={{ display: "block", minWidth: 0 }}>
          <span style={{ display: "flex", gap: 4, whiteSpace: "nowrap", fontFamily: FIGTREE, fontSize: 15, lineHeight: "20px" }}>
            <span style={{ fontWeight: 600 }}>{name}</span>
            <span style={{ color: t.label, overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{line}</span>
          </span>
          <span style={{ display: "block", marginTop: 4, fontFamily: FIGTREE, fontSize: 15, fontWeight: 600, lineHeight: "20px", overflowWrap: "anywhere" }}>{item.topic.heading || "Untitled post"}</span>
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
