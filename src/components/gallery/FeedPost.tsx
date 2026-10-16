// FeedPost: one build in the Gallery's feed, as a post with the maker on top (PT-04).
//
// NO BOX. The item has no fill, border, shadow or radius and no lamp above it;
// the list draws a 1px hairline between items. Two columns, 12px apart: a 40px
// author column and the content. The thread opens in place, and while it is
// open a 2px hairline runs down the author column from just under the avatar to
// the end of the last post (the build line and the actions are not part of it).
//
// THE GRID IS FOUR CELLS, NOT TWO COLUMNS OF STACKED BLOCKS, because the line
// has to stop where the posts stop and the build line sits below them in the
// same column as the post: the author column spans the first two rows, and the
// third row (build line, actions) is content only.
//
// WHAT IT SIGNS. Post 1's pictures arrive signed with the page's other card
// media (feedMedia). The rest of the thread is fetched and signed once, when
// the reader presses Show more, and the posts open after that. Every picture
// reserves its height from its node's w and h, so nothing moves as pictures
// arrive.
//
// A BUILD WITH NO THREAD (no post_doc and no post entries) is its title as the
// Title line and its cover through the existing chain, coverMedia then
// CoverFallback, so no item is empty.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Avatar } from "@/components/brand/Avatar";
import { CoverFallback } from "@/components/brand/CoverFallback";
import { MadeWithMarks } from "@/components/brand/MadeWithMarks";
import { Plaque, type PlaqueBuild } from "@/components/brand/Plaque";
import { PostThread } from "@/components/post/PostThread";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { EngagementRow, type RowEngagement } from "@/components/social/EngagementRow";
import { getThreadMedia, splitThread, threadOf, type GalleryBuild, type GalleryMedia, type Post } from "@/lib/build";
import { shortAge } from "@/lib/social/time";
import { useInteractive } from "@/lib/theme/interactive";
import { ring } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { CARD_THREAD_WIDTH, coverMedia, mediaAlt, signCardMedia, type MediaSrcMap } from "./cardMedia";

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
  /** The open ask's line ("1 part unsolved · £120"), or null. Absent: none. */
  openAsk?: string | null;
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
}

type Phase = "closed" | "loading" | "open";

/** Fields of a media row a PostMedia reads, which BuildMedia also carries. */
type ThreadRow = GalleryMedia;

const column: CSSProperties = { minWidth: 0 };

export function FeedPost({
  build,
  srcByPath,
  makerHandle,
  makerName,
  makerAvatar,
  modelsUsed,
  plaqueBuild,
  openAsk = null,
  engagement,
  now,
  phone: phoneOverride,
  preview = false,
}: FeedPostProps) {
  const windowPhone = useIsPhone();
  const phone = phoneOverride ?? windowPhone;
  const handle = (makerHandle ?? "").trim();
  const name = (makerName ?? "").trim() || handle || "Maker";
  const profileHref = handle && !preview ? `/profile/${encodeURIComponent(handle)}` : null;
  const title = (build.title ?? "").trim() || "Untitled build";

  /* ── the thread ── */

  const doc = useMemo(() => threadOf(build, build.media), [build]);
  const threadPosts = useMemo(() => (doc ? splitThread(doc) : []), [doc]);
  const cover = useMemo(() => coverMedia(build), [build]);
  const threaded = threadPosts.length > 0;

  // A build with no thread: its title, then its cover.
  const titlePosts = useMemo<Post[]>(
    () => [
      {
        content: [
          { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: title }] },
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
                    caption: "",
                  },
                },
              ]
            : []),
        ],
      },
    ],
    [build, cover, title],
  );
  const posts = threaded ? threadPosts : titlePosts;

  // Show more: asked for once, signed, then opened.
  const [phase, setPhase] = useState<Phase>("closed");
  const [rest, setRest] = useState<{ rows: ThreadRow[]; src: MediaSrcMap } | null>(null);
  const asking = useRef(false);

  const open = useCallback(async () => {
    if (asking.current || phase !== "closed") return;
    // A preview already holds every picture; there is nothing to ask for.
    if (rest || preview) {
      setPhase("open");
      return;
    }
    asking.current = true;
    setPhase("loading");
    try {
      const rows = (await getThreadMedia(build.id)) as ThreadRow[];
      const src = await signCardMedia(rows.map((row) => ({ ...row, slotWidth: CARD_THREAD_WIDTH })));
      setRest({ rows, src });
    } catch {
      // The posts still open; their pictures hold their reserved places.
    } finally {
      asking.current = false;
      setPhase("open");
    }
  }, [build.id, phase, preview, rest]);

  const close = useCallback(() => setPhase("closed"), []);

  // Another build in this item's place: its own thread, closed.
  useEffect(() => {
    setPhase("closed");
    setRest(null);
    asking.current = false;
  }, [build.id]);

  const mediaById = useMemo(() => {
    const map = new Map<string, GalleryMedia>(build.media.map((row) => [row.id, row]));
    if (cover) map.set(cover.id, cover);
    for (const row of rest?.rows ?? []) map.set(row.id, row);
    return map;
  }, [build.media, cover, rest]);

  const srcAll = useMemo<MediaSrcMap>(() => (rest && rest.src.size > 0 ? new Map([...srcByPath, ...rest.src]) : srcByPath), [srcByPath, rest]);

  const isOpen = phase === "open" && threaded && threadPosts.length > 1;

  /* ── the cells ── */

  const age = shortAge(build.published_at, now);

  return (
    <article
      data-feed-post=""
      data-open={isOpen ? "" : undefined}
      aria-label={title}
      style={{
        display: "grid",
        gridTemplateColumns: "40px minmax(0, 1fr)",
        columnGap: 12,
        padding: "20px 0 16px",
        boxSizing: "border-box",
        width: "100%",
        color: t.text,
      }}
    >
      {/* Author column: the avatar, and the line down the open thread. */}
      <div data-feed-author-column="" style={{ gridColumn: 1, gridRow: "1 / 3", position: "relative", width: 40 }}>
        {profileHref ? (
          // The name beside it is the same link; this one stays out of the tab order and the reader's way.
          <Link
            to={profileHref}
            tabIndex={-1}
            aria-hidden="true"
            // 44 on a phone, pulled back by its own extra 2 either side so the avatar stays where it was.
            style={{ display: "block", width: phone ? 44 : 40, height: phone ? 44 : 40, margin: phone ? -2 : 0, borderRadius: 999 }}
          >
            <Avatar size={40} userId={build.creator_id} name={name} src={makerAvatar} />
          </Link>
        ) : (
          <Avatar size={40} userId={build.creator_id} name={name} src={makerAvatar} />
        )}
        {isOpen ? (
          <span
            aria-hidden="true"
            data-feed-thread-line=""
            style={{ position: "absolute", top: 46, bottom: 0, left: 19, width: 2, borderRadius: 1, background: t.hairline }}
          />
        ) : null}
      </div>

      {/* Author row: name, @handle · age, the tools. */}
      <div
        data-feed-author-row=""
        style={{ ...column, gridColumn: 2, gridRow: 1, display: "flex", alignItems: "center", gap: 6, minHeight: 24, marginBottom: 4, whiteSpace: "nowrap" }}
      >
        <QuietLink to={profileHref} testId="feed-author-name" touch={phone} style={{ flex: "0 100 auto", fontSize: 15, fontWeight: 600, ...ellipsis }} colour={t.text}>
          {name}
        </QuietLink>
        <span style={{ display: "flex", flex: "0 1 auto", minWidth: 0, fontFamily: FIGTREE, fontSize: 14, lineHeight: 1.4, color: t.label }}>
          {handle ? <span style={{ minWidth: 0, ...ellipsis }}>{`@${handle}`}</span> : null}
          {age ? <span style={{ flex: "none", whiteSpace: "pre" }}>{handle ? ` · ${age}` : age}</span> : null}
        </span>
        <span style={{ marginLeft: 2, display: "inline-flex", flex: "none" }}>
          <MadeWithMarks madeWith={build.made_with} modelsUsed={modelsUsed} phone={phone} />
        </span>
      </div>

      {/* The post. */}
      <div data-feed-post-body="" style={{ ...column, gridColumn: 2, gridRow: 2 }}>
        <PostThread
          posts={posts}
          mediaById={mediaById}
          srcByPath={srcAll}
          mode={isOpen ? "open" : "closed"}
          onOpen={threaded ? () => void open() : undefined}
          onClose={close}
          loading={phase === "loading"}
          capTall
          phone={phone}
          resetKey={build.id}
        />
        {!threaded && !cover ? (
          <div style={{ marginTop: 12, aspectRatio: "3 / 2", borderRadius: 6, overflow: "hidden" }}>
            <CoverFallback seed={build.id} radius={0} />
          </div>
        ) : null}
      </div>

      {/* The build line, then the actions. */}
      <div style={{ ...column, gridColumn: 2, gridRow: 3, marginTop: 12 }}>
        <div data-feed-build-line="" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 12, rowGap: 6, minWidth: 0 }}>
          <QuietLink to={preview ? null : `/b2/${build.slug}`} testId="feed-build-title" touch={phone} colour={t.text} style={{ fontSize: 13, fontWeight: 500, maxWidth: "100%", ...ellipsis }}>
            {title}
          </QuietLink>
          {preview ? (
            <span data-testid="feed-draft" style={{ fontFamily: FIGTREE, fontSize: 12, fontWeight: 500, lineHeight: 1.4, color: t.text2 }}>
              Draft
            </span>
          ) : plaqueBuild ? (
            <Plaque build={plaqueBuild} size="card" now={now} />
          ) : null}
          {openAsk ? (
            <span
              data-testid="feed-open-ask"
              style={{ fontFamily: DM_MONO, fontSize: 11, lineHeight: 1.3, color: t.text2, fontVariantNumeric: "tabular-nums" }}
            >
              {openAsk}
            </span>
          ) : null}
        </div>
        {engagement ? (
          <EngagementRow
            variant="card"
            withRebuild
            build={{ id: build.id, slug: build.slug, title: build.title, rebuild_count: build.rebuild_count }}
            counts={engagement.counts}
            liked={engagement.liked}
            saved={engagement.saved}
            style={{ marginTop: 12, maxWidth: 520, justifyContent: "space-between" }}
          />
        ) : null}
      </div>
    </article>
  );
}

const ellipsis: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 };

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
  children,
}: {
  to: string | null;
  colour: string;
  style?: CSSProperties;
  testId?: string;
  /** Below 768px: the link is a 44px target. */
  touch?: boolean;
  children: ReactNode;
}) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  const base: CSSProperties = {
    fontFamily: FIGTREE,
    lineHeight: 1.4,
    color: colour,
    textDecoration: "none",
    ...(touch && to ? { display: "block", lineHeight: "44px" } : null),
    ...style,
  };
  if (!to) return <span data-testid={testId} style={base}>{children}</span>;
  return (
    <Link
      to={to}
      data-testid={testId}
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

