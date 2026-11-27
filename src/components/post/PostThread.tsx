// PostThread: a whole thread, drawn the same way in the feeds, the composer
// preview and the build page. It is the one thread component.
//
// READ SIDE ONLY, AND CONTROLLED. `mode` is the parent's: "closed" shows post 1
// and a toggle, "open" shows every post with the toggle reading "Show less", and
// "page" (the build page) shows post 1 and the same toggle, which it holds itself.
// In `page` mode the toggle is at the left of one row under the posts, and
// `footer` (the engagement icons) at its right. The toggle calls onOpen / onClose;
// a change of resetKey closes an open thread, so a recycled row does not show the
// next build's thread already unfolded.
//
// THE POSTS AFTER THE FIRST are the same maker's: no avatar, no author row, only
// each post's words and pictures, THREAD_GAP apart (the distance between two
// builds in the feed). With `connector` a 2px line runs down the avatar column
// from under the avatar to the last post, with a node level with each following
// post's first line. The build line and the actions are the parent's, drawn once
// under the thread.
//
// THE UNFOLD is a grid whose single row goes from 0fr to 1fr, so it opens to a
// height the content has already reserved (every picture holds its aspect-ratio).
// Same duration and easing as the motion module's standard, none under reduced
// motion. The posts below the first stay in the DOM while closed, clipped and
// inert, because a layout transition needs its target laid out.
//
// FOCUS. A press that opens moves focus to the first revealed post (tabindex -1);
// a press that closes moves it back to the toggle.

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import type { MediaSrcMap } from "@/components/gallery/cardMedia";
import { UNFOLD_MS } from "@/components/gallery/CardThread";
import type { GalleryMedia } from "@/lib/build";
import type { Post } from "@/lib/build/thread";
import { failedLine, RETRY_LABEL } from "@/lib/copy/copy";
import { useInteractive } from "@/lib/theme/interactive";
import { ring } from "@/lib/theme/controls";
import { hoverIsFine, prefersReducedMotion, STANDARD } from "@/lib/theme/motion";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { X_FEED, type XSize } from "@/components/gallery/xFeed";

import { PostBody } from "./PostBody";
import { FEED_THREAD_GAP, feedType, postType, THREAD_GAP, xFeedType } from "./postType";

export type PostThreadMode = "closed" | "open" | "page";

/** The state of the posts after the first: their pictures are fetched when the thread opens. */
export type ThreadRest = "ready" | "loading" | "failed";

/** Where the connector runs, in the thread's own coordinates. */
export interface ThreadConnector {
  /** The line's centre, from the thread's left edge: negative, it is in the column to the left. */
  x: number;
  /** Where the line starts, from the top of the thread's first post. */
  top: number;
}

export interface PostThreadProps {
  /** From splitThread. */
  posts: readonly Post[];
  mediaById: ReadonlyMap<string, GalleryMedia>;
  srcByPath: MediaSrcMap;
  mode: PostThreadMode;
  onOpen?: () => void;
  onClose?: () => void;
  /** Below 768px. */
  phone?: boolean;
  /** A different thread: an open one is closed. */
  resetKey?: string;
  /** The posts after the first are on their way ("loading": one dot skeleton post in their place) or did not arrive. */
  rest?: ThreadRest;
  onRetry?: () => void;
  /** `page` only: drawn at the right of the row under the posts, opposite the toggle. */
  footer?: ReactNode;
  /** Wraps the words of post 1's first heading (the feed post's link to its build). */
  headingLink?: (content: ReactNode) => ReactNode;
  /** Show more is about to be pressed: hovered on a fine pointer, or focused. The feed starts the rest of the thread. */
  onIntent?: () => void;
  /** The connector and its nodes, for a thread drawn beside an avatar column. */
  connector?: ThreadConnector;
  /** The first post's text is cut after this many lines while the thread is closed; a cut text alone makes Show more appear. */
  clampLines?: number;
  /** Replaces post 1's body (a rebuild's note and its "Rebuilt from" card stay with the first post). */
  first?: ReactNode;
  /** Prompt 20: the phone feed's thread: 15/20 words, 24 between posts, the toggle in 15 Text 3. */
  feed?: boolean;
  /**
   * Prompt 29a: Home's thread at X's proportions: the post text 17/22 (phone) or 15/20 (desktop), 24 between posts, and
   * "Show more" 12 under the pictures at the post text size in Text 3, with a 44 (phone) or 32 (desktop) hit area.
   */
  x?: XSize;
}

/** The size of a node on the connector, and the line's width. */
const NODE = 10;
const LINE = 2;

export function PostThread({
  posts,
  mediaById,
  srcByPath,
  mode,
  onOpen,
  onClose,
  phone = false,
  resetKey,
  rest: restState = "ready",
  onRetry,
  footer,
  headingLink,
  onIntent,
  connector,
  clampLines,
  first: firstSlot,
  feed = false,
  x,
}: PostThreadProps) {
  const gap = x ? X_FEED[x].threadGap : feed ? FEED_THREAD_GAP : THREAD_GAP;
  const regionId = useId();
  const page = mode === "page";
  const [pageOpen, setPageOpen] = useState(false);
  const [cut, setCut] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  /** Where focus goes once the thread has changed: set by a press, so a reset or a reload never moves it. */
  const focusNext = useRef<"post" | "toggle" | null>(null);

  // resetKey changing closes an open thread. Not on mount: the key it starts with is not a change.
  const lastKey = useRef(resetKey);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (lastKey.current === resetKey) return;
    lastKey.current = resetKey;
    focusNext.current = null;
    setPageOpen(false);
    if (mode === "open") close.current?.();
    // mode is read when the key changes, not a reason to run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const open = page ? pageOpen : mode !== "closed";
  const settled = open && restState === "ready";

  // The press that opened moves focus to the first revealed post, once it is drawn; the press that closed, back to the toggle.
  useLayoutEffect(() => {
    if (focusNext.current === "post" && settled) {
      focusNext.current = null;
      regionRef.current?.querySelector<HTMLElement>("[data-post='2']")?.focus({ preventScroll: false });
    } else if (focusNext.current === "toggle" && !open) {
      focusNext.current = null;
      toggleRef.current?.focus();
    }
  }, [open, settled]);

  if (posts.length === 0) return null;

  const [first, ...rest] = posts;
  const total = posts.length;
  const foldable = total > 1 || cut;
  const lines = (x ? xFeedType(X_FEED[x].text, X_FEED[x].line) : feed ? feedType() : postType(phone)).firstLine;
  const connected = connector !== undefined && open && settled && rest.length > 0;

  const press = () => {
    // With no later posts only the text opens, and it is already where the reader is looking.
    focusNext.current = open ? "toggle" : rest.length > 0 ? "post" : null;
    if (page) setPageOpen((was) => !was);
    else if (open) onClose?.();
    else onOpen?.();
  };

  const line = (style: { top?: number; bottom?: number; height?: number }) =>
    connector ? (
      <span
        aria-hidden="true"
        data-thread-line=""
        style={{ position: "absolute", left: connector.x - LINE / 2, width: LINE, borderRadius: 1, background: t.control, ...style }}
      />
    ) : null;

  const later = rest.map((post, index) => {
    const last = index === rest.length - 1;
    const lead = post.content[0] as { type?: string; attrs?: { level?: number; size?: string } } | undefined;
    const firstLine =
      lead?.type === "heading"
        ? lead.attrs?.level === 1
          ? lines.title
          : lines.heading
        : lead?.type === "paragraph"
          ? lead.attrs?.size === "small"
            ? lines.small
            : lines.body
          : 16;
    const nodeTop = gap + firstLine / 2;
    return (
      <div
        key={index + 1}
        data-post={index + 2}
        tabIndex={index === 0 ? -1 : undefined}
        style={{ position: "relative", paddingTop: gap, outline: "none" }}
      >
        {connected ? line(last ? { top: -1, height: nodeTop + 1 } : { top: -1, bottom: -1 }) : null}
        {connected && connector ? (
          <span
            aria-hidden="true"
            data-thread-node=""
            style={{ position: "absolute", left: connector.x - NODE / 2, top: nodeTop - NODE / 2, width: NODE, height: NODE, borderRadius: 3, background: t.threadNode }}
          />
        ) : null}
        <PostBody post={post} mediaById={mediaById} srcByPath={srcByPath} phone={phone} compact={page} feed={feed} x={x} />
      </div>
    );
  });

  return (
    <div data-post-thread="" data-thread-mode={mode} style={{ display: "flex", flexDirection: "column" }}>
      <div data-post={1} id={rest.length === 0 ? regionId : undefined} style={{ position: "relative" }}>
        {connected && connector ? line({ top: connector.top, bottom: -1 }) : null}
        {firstSlot ?? (
          <PostBody post={first} mediaById={mediaById} srcByPath={srcByPath} phone={phone} headingLink={headingLink} compact={page} feed={feed} x={x} clampLines={open ? undefined : clampLines} onCut={setCut} />
        )}
      </div>
      {rest.length > 0 ? (
        <UnfoldRegion open={open} id={regionId} regionRef={regionRef}>
          {open && restState === "loading" ? <RestSkeleton gap={gap} /> : null}
          {open && restState === "failed" ? <RestFailed onRetry={onRetry} gap={gap} /> : null}
          {restState === "ready" ? later : null}
        </UnfoldRegion>
      ) : null}
      {page ? (
        <div data-post-foot="" style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, minWidth: 0 }}>
          {foldable ? (
            <Toggle buttonRef={toggleRef} open={open} more={rest.length} controls={regionId} phone={phone} plain onPress={press} onIntent={open ? undefined : onIntent} />
          ) : null}
          <span style={{ flexGrow: 1 }} />
          {footer}
        </div>
      ) : foldable ? (
        <Toggle buttonRef={toggleRef} open={open} more={rest.length} controls={regionId} phone={phone} feed={feed} x={x} onPress={press} onIntent={open ? undefined : onIntent} />
      ) : null}
    </div>
  );
}

/** One dot skeleton post where the others will appear: a line of words and a picture, as tall as a post of one picture. */
function RestSkeleton({ gap = THREAD_GAP }: { gap?: number }) {
  return (
    <LoadingRegion what="more posts" style={{ paddingTop: gap }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <Skeleton width="80%" height={20} radius={4} />
        <Skeleton height={160} radius={6} />
      </div>
    </LoadingRegion>
  );
}

/** The repo's failed line, with Try again, where the other posts will appear. */
function RestFailed({ onRetry, gap = THREAD_GAP }: { onRetry?: () => void; gap?: number }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <div
      data-post-failed=""
      role="alert"
      style={{ paddingTop: gap, display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 12, fontFamily: FIGTREE, fontSize: 13, lineHeight: 1.4, color: t.text2 }}
    >
      <span>{failedLine("posts").replace(/ Try again\.$/, "")}</span>
      <button
        type="button"
        {...handlers}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onRetry?.();
        }}
        style={{ minHeight: 32, padding: 0, border: 0, background: "transparent", fontFamily: FIGTREE, fontSize: 13, fontWeight: 500, color: t.text, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", ...ring(state.focusVisible) }}
      >
        {RETRY_LABEL}
      </button>
    </div>
  );
}

/** The grid-template-rows unfold; see the note at the top. */
function UnfoldRegion({ open, id, regionRef, children }: { open: boolean; id: string; regionRef: React.RefObject<HTMLDivElement>; children: React.ReactNode }) {
  return (
    <div
      id={id}
      ref={(el) => {
        (regionRef as { current: HTMLDivElement | null }).current = el;
        // inert keeps the clipped posts out of the tab order and away from a screen reader.
        el?.toggleAttribute("inert", !open);
      }}
      data-post-region={open ? "open" : "closed"}
      style={{
        display: "grid",
        gridTemplateRows: open ? "1fr" : "0fr",
        transition: prefersReducedMotion() ? "none" : `grid-template-rows ${UNFOLD_MS}ms ${STANDARD}`,
      }}
    >
      {/* Clipped across, not along: the connector's nodes sit in the column to the left of the posts. */}
      <div style={{ overflowY: "clip", overflowX: "visible", minHeight: 0 }}>{children}</div>
    </div>
  );
}

/** "Show more · 2 more posts", and "Show less" once open. The build page's is "1 of 3 posts · Show more". */
function Toggle({
  open,
  more,
  controls,
  phone,
  plain = false,
  feed = false,
  x,
  buttonRef,
  onPress,
  onIntent,
}: {
  /** Prompt 29a: Home at X's proportions (see `PostThreadProps.x`). */
  x?: XSize;
  /** The phone feed's: 15 in Text 3, 44 tall. */
  feed?: boolean;
  /** The build page's: an underlined text button, with no box. */
  plain?: boolean;
  open: boolean;
  more: number;
  controls: string;
  phone: boolean;
  buttonRef: React.RefObject<HTMLButtonElement>;
  onPress: () => void;
  onIntent?: () => void;
}) {
  // Hover counts only on a fine pointer (HOVER_QUERY), where it comes before a press; focus counts everywhere.
  const { state, handlers } = useInteractive<HTMLButtonElement>({
    onMouseEnter: () => {
      if (hoverIsFine()) onIntent?.();
    },
    onFocus: () => onIntent?.(),
  });
  // X's proportions: 12 of visible space above the words, the hit area reaching round them without moving anything.
  const xm = x ? X_FEED[x] : null;
  const reach = xm ? (xm.hit - xm.line) / 2 : 0;
  const label = open ? "Show less" : plain ? `1 of ${more + 1} posts · Show more` : more === 0 ? "Show more" : `Show more · ${more === 1 ? "1 more post" : `${more} more posts`}`;
  return (
    <button
      ref={buttonRef}
      type="button"
      data-post-toggle=""
      aria-expanded={open}
      aria-controls={controls}
      {...handlers}
      onClick={(event) => {
        // A thread in a feed post sits inside the post's link.
        event.preventDefault();
        event.stopPropagation();
        onPress();
      }}
      style={{
        alignSelf: "flex-start",
        boxSizing: "border-box",
        minHeight: phone ? 44 : 32,
        marginTop: plain || feed ? 0 : 4,
        padding: 0,
        border: 0,
        borderRadius: 4,
        background: "transparent",
        fontFamily: FIGTREE,
        fontSize: feed ? 15 : 13,
        fontWeight: feed ? 400 : 500,
        lineHeight: feed ? "20px" : 1.4,
        color: feed ? t.label : state.hovered || state.pressed ? t.text : t.text2,
        textDecoration: plain ? "underline" : "none",
        textUnderlineOffset: 3,
        cursor: "pointer",
        ...(xm
          ? { minHeight: xm.hit, marginTop: xm.gap - reach, marginBottom: -reach, fontSize: xm.text, fontWeight: 400, lineHeight: `${xm.line}px`, color: t.label }
          : null),
        ...ring(state.focusVisible),
      }}
    >
      {label}
    </button>
  );
}
