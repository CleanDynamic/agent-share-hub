// FeedPost: one build in the Gallery's feed, as a post with the maker on top (PT-04).
//
// NO BOX. The item has no fill, border, shadow or radius and no lamp above it;
// the list draws a 1px hairline between items. Two columns, 12px apart: a 40px
// author column and the content. The thread opens in place, and while it is
// open PostThread draws a 2px connector down the author column from 4px under
// the avatar to the last post's node (the build line and the actions are not
// part of it).
//
// THE GRID IS FOUR CELLS, NOT TWO COLUMNS OF STACKED BLOCKS, because the line
// has to stop where the posts stop and the build line sits below them in the
// same column as the post: the author column spans the first two rows, and the
// third row (build line, actions) is content only.
//
// WHAT IT SIGNS. Post 1's pictures arrive signed with the page's other card
// media (feedMedia). The rest of the thread is fetched and signed once, as one
// query (useThreadRest): started when Show more is hovered on a fine pointer or
// focused, so the press opens from the cache; a press with nothing fetched yet
// opens at once with a dot skeleton post where the others will land. Every picture
// reserves its height from its node's w and h, so nothing moves as pictures
// arrive.
//
// A BUILD WITH NO THREAD (no post_doc and no post entries) is its title as the
// Title line and its cover through the existing chain, coverMedia then
// CoverFallback, so no item is empty.

import { useMemo, useRef, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { IntentLink as Link } from "@/lib/routing/IntentLink";

import { Avatar } from "@/components/brand/Avatar";
import { MobileIcon } from "@/components/brand/MobileIcon";
import { CoverFallback } from "@/components/brand/CoverFallback";
import type { PlaqueBuild } from "@/components/brand/Plaque";
import { PatternMarks } from "@/components/gallery/PatternMarks";
import type { Pattern } from "@/lib/build/patterns";
import { RegulatedTag } from "@/components/classify/ClassificationBits";
import { classificationFacts, classificationLines } from "@/lib/classify/lines";
import type { Classification } from "@/lib/classify/types";
import { MediaViewerProvider } from "@/components/post/media/MediaViewer";
import { PostThread } from "@/components/post/PostThread";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { EngagementRow, type RowEngagement } from "@/components/social/EngagementRow";
import { chosenCover, splitThread, threadOf, type GalleryBuild, type GalleryMedia, type Post } from "@/lib/build";
import type { GalleryPostBuild } from "@/lib/build/gallery";
import { DefaultCover } from "@/components/phone/DefaultCover";
import { shortAge } from "@/lib/social/time";
import { useInteractive } from "@/lib/theme/interactive";
import { ring } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { coverMedia, mediaAlt, type MediaSrcMap } from "./cardMedia";
import { useThreadRest } from "./useThreadRest";
import { X_FEED, X_ROW_GAP, xConnector, xGrid, xMeta, xName, type XSize } from "./xFeed";

export interface FeedPostProps {
  build: GalleryBuild;
  /** Signed once for the page: post 1's pictures, or the cover. */
  srcByPath: MediaSrcMap;
  makerHandle: string | null;
  makerName: string | null;
  makerAvatar: string | null;
  /** builds.models_used, for the marks beyond made_with. */
  modelsUsed: readonly string[];
  /** Absent in a preview, which draws "Draft" where the plaque goes. */
  plaqueBuild?: PlaqueBuild;
  /** CA-13 P12: the patterns the build uses; at most two are marked. */
  patterns?: readonly Pattern[];
  /** CA-16 P6: the build's classification: its facts after the build's name, and a Regulated area tag beside them. Nothing when absent or empty. */
  classification?: Classification | null;
  /** The reader's share of the page's engagement. Absent: no action row. */
  engagement?: RowEngagement;
  now?: number;
  /** Draw at the phone's sizes (true) or the desktop's (false), whatever the window is. Absent: the window decides. */
  phone?: boolean;
  /**
   * The composer's preview (PT-07): the draft as the Gallery will draw it. Nothing is fetched and nothing links away,
   * Show more opens the posts in place, and the word "Draft" stands where the plaque does.
   */
  preview?: boolean;
  /** Prompt 20: the phone Home's post: 15/600 name, 15 meta, the phone feed's type, pictures and actions, and a More button that calls `onMore`. */
  phoneFeed?: boolean;
  onMore?: () => void;
  /**
   * Prompt 29a: Home's post at X's proportions, "phone" below 768px or "desktop" in the 600 centre column: the avatar 48 or 40,
   * the text column 8 to its right, the author row and post text 17/22 or 15/20, pictures at radius 14 or 16, the actions at X's
   * places. The item frame holds the padding. Absent: the post as before (the Gallery, the profile, the composer's preview).
   */
  x?: XSize;
}

const column: CSSProperties = { minWidth: 0 };

/** The author column's width and the gap to the content: where the thread's connector runs. */
/** The lines of a feed post's first paragraph before Show more: the post is cut here until the reader opens it. */
export const FEED_TEXT_LINES = 6;
const AVATAR = 40;
const GUTTER = 12;

export function FeedPost({
  build,
  srcByPath,
  makerHandle,
  makerName,
  makerAvatar,
  patterns,
  classification,
  engagement,
  now,
  phone: phoneOverride,
  preview = false,
  phoneFeed = false,
  onMore,
  x,
}: FeedPostProps) {
  const windowPhone = useIsPhone();
  const phone = x ? x === "phone" : phoneFeed || (phoneOverride ?? windowPhone);
  const xm = x ? X_FEED[x] : null;
  const handle = (makerHandle ?? "").trim();
  const name = (makerName ?? "").trim() || handle || "Maker";
  const profileHref = handle && !preview ? `/profile/${encodeURIComponent(handle)}` : null;
  const title = (build.title ?? "").trim() || "Untitled build";
  const lines = useMemo(() => classificationLines(classification), [classification]);
  // Synth 07: the facts are plain text after the build's name: What was built · Role of AI · Skill needed.
  const facts = useMemo(() => classificationFacts(classification).join(" · "), [classification]);

  /* ── the thread ── */

  const doc = useMemo(() => threadOf(build, build.media), [build]);
  const threadPosts = useMemo(() => (doc ? splitThread(doc) : []), [doc]);
  // 29g: on a phone a build's picture is only the one its maker chose (chosenCover), never a guess from its evidence, which can be
  // a capture of the OpenBuilds editor; with none it draws the default cover. The desktop keeps its chain.
  const cover = useMemo(() => (phone ? chosenCover(build, build.media) : coverMedia(build)), [build, phone]);
  const threaded = threadPosts.length > 0;
  const sessionCount = (build as Partial<GalleryPostBuild>).sessionCount;

  // A build with no thread: its title, then its cover. On a phone a post has no title: the picture alone, or the default cover.
  const titlePosts = useMemo<Post[]>(
    () => [
      {
        content: [
          ...(phone ? [] : [{ type: "heading" as const, attrs: { level: 1 as const }, content: [{ type: "text" as const, text: title }] }]),
          ...(cover
            ? [
                {
                  type: "postMedia" as const,
                  attrs: {
                    mediaId: cover.id,
                    width: 100,
                    w: cover.width ?? null,
                    h: cover.height ?? null,
                    alt: mediaAlt(build, cover),
                    crop: null,
                    aspect: null,
                    zoom: null,
                    warn: [],
                    caption: "",
                  },
                },
              ]
            : []),
        ],
      },
    ],
    [build, cover, title, phone],
  );
  const posts = threaded ? threadPosts : titlePosts;
  /** 29g: a phone build with no post and no chosen picture: the default cover stands where the post would. */
  const defaultCover = phone && !threaded && !cover;

  // Show more: the thread opens at once; the pictures of the later posts are asked for once, signed and cached.
  const { phase, rest, restState, open, close, warm, retry } = useThreadRest({ buildId: build.id, enabled: threaded && threadPosts.length > 1, preview });

  const mediaById = useMemo(() => {
    const map = new Map<string, GalleryMedia>(build.media.map((row) => [row.id, row]));
    if (cover) map.set(cover.id, cover);
    for (const row of rest?.rows ?? []) map.set(row.id, row);
    return map;
  }, [build.media, cover, rest]);

  const srcAll = useMemo<MediaSrcMap>(() => (rest && rest.src.size > 0 ? new Map([...srcByPath, ...rest.src]) : srcByPath), [srcByPath, rest]);

  const isOpen = phase === "open" && threaded;

  /* ── the cells ── */

  const age = shortAge(build.published_at, now);


  /* UX-03 P1: the post opens its build. Its first heading is the link (the post's one tab stop for the build); a press on the
     rest of the body goes through the overlay link under it. A preview links nowhere. */
  const buildHref = preview ? null : `/b2/${build.slug}`;
  const headed = buildHref !== null && (posts[0]?.content ?? []).some((node) => node.type === "heading");
  const overlay = useRef<HTMLAnchorElement>(null);

  const thread = (
    <PostThread
      posts={posts}
      mediaById={mediaById}
      srcByPath={srcAll}
      mode={isOpen ? "open" : "closed"}
      onOpen={threaded ? open : undefined}
      onIntent={threaded ? warm : undefined}
      onClose={close}
      rest={restState}
      onRetry={retry}
      clampLines={FEED_TEXT_LINES}
      connector={x ? xConnector(x) : { x: -(AVATAR + GUTTER) + AVATAR / 2, top: phone && !phoneFeed ? -4 : 16 }}
      phone={phone}
      feed={phoneFeed}
      x={x}
      resetKey={build.id}
      headingLink={headed && buildHref ? (words) => <HeadingLink to={buildHref}>{words}</HeadingLink> : undefined}
    />
  );
  return (
    <article
      data-feed-post=""
      data-open={isOpen ? "" : undefined}
      aria-label={title}
      data-x={x}
      style={{
        display: "grid",
        gridTemplateColumns: "40px minmax(0, 1fr)",
        columnGap: 12,
        ...(x ? xGrid(x) : null),
        padding: phoneFeed || x ? 0 : "4px 0",
        boxSizing: "border-box",
        width: "100%",
        color: t.text,
      }}
    >
      {/* Author column: the avatar, and the line down the open thread. */}
      <div data-feed-author-column="" style={{ gridColumn: 1, gridRow: "1 / 3", position: "relative", width: xm ? xm.avatar : 40 }}>
        {profileHref ? (
          // The name beside it is the same link; this one stays out of the tab order and the reader's way.
          <Link
            to={profileHref}
            tabIndex={-1}
            aria-hidden="true"
            // 44 on a phone, pulled back by its own extra 2 either side so the avatar stays where it was.
            style={xm ? { display: "block", width: xm.avatar, height: xm.avatar, borderRadius: 999 } : { display: "block", width: phone && !phoneFeed ? 44 : 40, height: phone && !phoneFeed ? 44 : 40, margin: phone && !phoneFeed ? -2 : 0, borderRadius: 999 }}
          >
            <Avatar size={xm ? xm.avatar : 40} userId={build.creator_id} name={name} src={makerAvatar} phone={Boolean(xm)} />
          </Link>
        ) : (
          <Avatar size={xm ? xm.avatar : 40} userId={build.creator_id} name={name} src={makerAvatar} phone={Boolean(xm)} />
        )}
      </div>

      {/* Author row: name, @handle · age, the tools. */}
      {x && xm ? (
        <div data-feed-author-row="" style={{ ...column, gridColumn: 2, gridRow: 1, display: "flex", alignItems: "center", gap: 4, minHeight: xm.line, marginBottom: X_ROW_GAP, whiteSpace: "nowrap" }}>
          <QuietLink to={profileHref} testId="feed-author-name" reach={phone} style={{ flex: "0 1 auto", maxWidth: "70%", ...xName(x), ...ellipsis }} colour={t.text}>
            {name}
          </QuietLink>
          <span style={{ display: "flex", flex: "0 1 auto", minWidth: 0, fontFamily: FIGTREE, ...xMeta(x), color: t.label }}>
            {handle ? <span style={{ minWidth: 0, ...ellipsis }}>{`@${handle}`}</span> : null}
            {age ? <span style={{ flex: "none", whiteSpace: "pre" }}>{handle ? ` · ${age}` : age}</span> : null}
          </span>
          {onMore ? <span style={{ flex: 1 }} /> : null}
          {onMore ? <MoreButton onPress={onMore} box={xm.moreBox} hit={xm.moreHit} /> : null}
        </div>
      ) : (
      <div
        data-feed-author-row=""
        style={{ ...column, gridColumn: 2, gridRow: 1, display: "flex", alignItems: "center", gap: phoneFeed ? 4 : 6, minHeight: phoneFeed ? 22 : 24, marginBottom: phoneFeed ? 4 : 4, whiteSpace: "nowrap" }}
      >
        <QuietLink to={profileHref} testId="feed-author-name" touch={phone && !phoneFeed} reach={phoneFeed} style={{ flex: phoneFeed ? "0 0 auto" : "0 100 auto", ...(phoneFeed ? { maxWidth: "70%" } : null), ...(phone ? xName("phone") : { fontSize: 13, fontWeight: 500 }), ...ellipsis }} colour={t.text}>
          {name}
        </QuietLink>
        <span style={{ display: "flex", flex: "0 1 auto", minWidth: 0, fontFamily: FIGTREE, fontSize: phone ? 15 : 13, lineHeight: phone ? "20px" : 1.4, color: t.label }}>
          {handle ? <span style={{ minWidth: 0, ...ellipsis }}>{`@${handle}`}</span> : null}
          {age ? <span style={{ flex: "none", whiteSpace: "pre" }}>{handle ? ` · ${age}` : age}</span> : null}
        </span>
        {phoneFeed && onMore ? <span style={{ flex: 1 }} /> : null}
        {phoneFeed && onMore ? <MoreButton onPress={onMore} /> : null}
      </div>
      )}

      {/* The post. */}
      <div data-feed-post-body="" style={{ ...column, gridColumn: 2, gridRow: 2, position: "relative" }}>
        {buildHref ? (
          <Link
            ref={overlay}
            to={buildHref}
            tabIndex={-1}
            aria-hidden="true"
            data-feed-post-overlay=""
            onClick={(event) => {
              if (hasSelection()) event.preventDefault();
            }}
            style={{ position: "absolute", inset: 0 }}
          />
        ) : null}
        <div
          style={{ position: "relative", minWidth: 0 }}
          onClick={buildHref ? (event) => forwardToBuild(event, overlay.current) : undefined}
        >
          {/* CA-07: the draft's pictures open full screen in Preview; a Gallery card is a link to the build instead. */}
          {defaultCover ? (
            <div aria-hidden="true">
              <DefaultCover title={title} sessionCount={sessionCount} radius={xm ? xm.pictureRadius : 12} />
            </div>
          ) : preview ? (
            <MediaViewerProvider>{thread}</MediaViewerProvider>
          ) : (
            thread
          )}
          {!threaded && !cover && !phone ? (
            <div style={{ marginTop: 12, aspectRatio: "3 / 2", borderRadius: 6, overflow: "hidden" }}>
              <CoverFallback seed={build.id} radius={0} />
            </div>
          ) : null}
        </div>
      </div>

      {/* The build line, then the actions. */}
      <div style={{ ...column, gridColumn: 2, gridRow: 3, marginTop: xm ? xm.gap : phoneFeed ? 4 : 12 }}>
        <div data-feed-build-line="" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 12, rowGap: 6, minWidth: 0 }}>
          <QuietLink to={buildHref} tabIndex={headed ? -1 : undefined} testId="feed-build-title" touch={phone && !x} reach={x === "phone"} colour={t.text} style={{ fontSize: 13, fontWeight: 500, maxWidth: "100%", ...(x ? { lineHeight: "16px" } : null), ...ellipsis }}>
            {title}
          </QuietLink>
          {facts ? (
            <span data-testid="feed-build-facts" style={{ fontFamily: FIGTREE, fontSize: 13, lineHeight: x ? "16px" : 1.4, color: phoneFeed || x ? t.text2 : t.label, minWidth: 0 }}>
              {facts}
            </span>
          ) : null}
          {lines.regulated ? <RegulatedTag /> : null}
          {preview ? (
            <span data-testid="feed-draft" style={{ fontFamily: FIGTREE, fontSize: 13, fontWeight: 500, lineHeight: 1.4, color: t.text2 }}>
              Draft
            </span>
          ) : null}
          <PatternMarks patterns={patterns} />
        </div>
        {engagement ? (
          <EngagementRow
            variant="card"
            withRebuild
            build={{ id: build.id, slug: build.slug, title: build.title, rebuild_count: build.rebuild_count }}
            counts={engagement.counts}
            liked={engagement.liked}
            saved={engagement.saved}
            style={phoneFeed || x ? undefined : { marginTop: 12, maxWidth: 425, justifyContent: "space-between" }}
            phoneFeed={phoneFeed && !x}
            x={x}
          />
        ) : null}
      </div>
    </article>
  );
}

/** The phone feed's More: three dots at 18 in Text 3, in a 32 hit area at the right edge (the 44 target is its row's height). */
export function MoreButton({ onPress, box = 32, hit = 44 }: { onPress: () => void; box?: number; hit?: number }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-label="More"
      data-testid="feed-more"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onPress();
      }}
      {...handlers}
      style={{ flex: "none", position: "relative", width: box, height: box, margin: box === 32 ? "-6px -8px -6px 0" : `${-Math.max(0, box - 20) / 2}px 0`, padding: 0, border: 0, borderRadius: 999, background: "transparent", color: t.label, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", ...ring(state.focusVisible) }}
    >
      <MobileIcon name="more" size={18} />
      {/* Touch: the hit area reaches 44 by 44 (32 on desktop) without moving the dots. */}
      <span aria-hidden="true" style={{ position: "absolute", inset: -(hit - box) / 2 }} />
    </button>
  );
}

const ellipsis: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 };

/** Words the reader has selected: a press that ends a selection is copying, not opening the build. */
const hasSelection = (): boolean => (typeof window === "undefined" ? false : (window.getSelection()?.toString() ?? "") !== "");

/** What keeps its own press inside a post's body: Show more, a link in the words, a picture's own control. */
const OWN_PRESS = "a, button, input, textarea, select, label, summary, [role='button']";

/**
 * UX-03 P1: a press on the body's words or pictures opens the build, through the overlay link, so the router and the page's
 * intent handling see one ordinary link press. The modifier keys go with it (a new tab stays a new tab).
 */
function forwardToBuild(event: ReactMouseEvent<HTMLDivElement>, link: HTMLAnchorElement | null) {
  if (!link || event.defaultPrevented || event.button !== 0) return;
  const target = event.target as Element | null;
  if (target?.closest(OWN_PRESS) && event.currentTarget.contains(target.closest(OWN_PRESS))) return;
  if (hasSelection()) return;
  link.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, view: window, ctrlKey: event.ctrlKey, metaKey: event.metaKey, shiftKey: event.shiftKey, altKey: event.altKey, button: 0 }),
  );
}

/** The post's first heading as the link to its build: the heading's own type, underlined at once on hover (a fine pointer only). */
function HeadingLink({ to, children }: { to: string; children: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to={to}
      data-testid="feed-post-heading-link"
      {...handlers}
      onClick={(event) => {
        if (hasSelection()) event.preventDefault();
      }}
      style={{ color: "inherit", textDecoration: state.hovered ? "underline" : "none", textUnderlineOffset: 3, borderRadius: 4, ...ring(state.focusVisible) }}
    >
      {children}
    </Link>
  );
}

/**
 * A link in the item's quiet type: t.text at rest, a step to t.text2 on hover, the
 * well under a press. With no address (a maker without a handle) it is plain text.
 */
function QuietLink({
  to,
  colour,
  style,
  testId,
  touch = false,
  reach = false,
  tabIndex,
  children,
}: {
  to: string | null;
  colour: string;
  style?: CSSProperties;
  testId?: string;
  /** UX-03 P1: -1 when the post's heading is already its tab stop for the build. */
  tabIndex?: number;
  /** Below 768px: the link is a 44px target. */
  touch?: boolean;
  /** Prompt 21: the link's hit area is 44 tall by padding 12 above and below, with the margin taking it back, so nothing moves. */
  reach?: boolean;
  children: ReactNode;
}) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  const base: CSSProperties = {
    fontFamily: FIGTREE,
    lineHeight: 1.4,
    color: colour,
    textDecoration: "none",
    ...(touch && to ? { display: "block", lineHeight: "44px" } : null),
    ...(reach && to ? { display: "block", padding: "12px 0", margin: "-12px 0" } : null),
    ...style,
  };
  if (!to) return <span data-testid={testId} style={base}>{children}</span>;
  return (
    <Link
      to={to}
      data-testid={testId}
      tabIndex={tabIndex}
      {...handlers}
      style={{
        ...base,
        color: state.hovered ? t.text2 : colour,
        background: state.pressed ? t.well : "transparent",
        borderRadius: 4,
        ...ring(state.focusVisible),
      }}
    >
      {children}
    </Link>
  );
}

