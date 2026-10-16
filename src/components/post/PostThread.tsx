// PostThread: a whole thread, drawn the same way in the Gallery, the composer
// preview and the build page (PT-03).
//
// READ SIDE ONLY, AND CONTROLLED. `mode` is the parent's: "closed" shows post 1
// and a toggle, "open" shows every post with the toggle reading "Show less", and
// "page" (the build page) shows every post and no toggle. The toggle calls
// onOpen / onClose; a change of resetKey calls onClose when the thread is open,
// so a recycled row does not show the next build's thread already unfolded.
//
// THE LINE BETWEEN POSTS IS NOT DRAWN HERE. The author column in PT-04 and
// PT-08 draws it.
//
// THE UNFOLD is CardThread's: a grid whose single row goes from 0fr to 1fr, so
// it opens to a height the content has already reserved (every picture holds
// its aspect-ratio), measured nowhere. Same duration, none under reduced
// motion, and no fade. The posts below the first stay in the DOM while closed,
// clipped and inert, because a layout transition needs its target laid out.

import { useEffect, useId, useRef, type CSSProperties } from "react";

import { Glyph } from "@/components/brand/Glyph";
import type { MediaSrcMap } from "@/components/gallery/cardMedia";
import { UNFOLD_MS } from "@/components/gallery/CardThread";
import type { GalleryMedia } from "@/lib/build";
import type { Post } from "@/lib/build/thread";
import { useInteractive } from "@/lib/theme/interactive";
import { ring } from "@/lib/theme/controls";
import { prefersReducedMotion, STANDARD } from "@/lib/theme/motion";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { PostBody } from "./PostBody";
import { POST_GAP, postType } from "./postType";

export type PostThreadMode = "closed" | "open" | "page";

export interface PostThreadProps {
  /** From splitThread. */
  posts: readonly Post[];
  mediaById: ReadonlyMap<string, GalleryMedia>;
  srcByPath: MediaSrcMap;
  mode: PostThreadMode;
  onOpen?: () => void;
  onClose?: () => void;
  capTall?: boolean;
  /** Below 768px. */
  phone?: boolean;
  /** A different thread: an open one is closed. */
  resetKey?: string;
  /** The rest of the thread is on its way: the toggle reads "Loading…" and is disabled. */
  loading?: boolean;
}

/** Room kept at the end of a post's first line for its counter, "10 / 10" in 11px mono. */
const COUNTER_INSET = 48;

export function PostThread({
  posts,
  mediaById,
  srcByPath,
  mode,
  onOpen,
  onClose,
  capTall = false,
  phone = false,
  resetKey,
  loading = false,
}: PostThreadProps) {
  const regionId = useId();

  // resetKey changing closes an open thread. Not on mount: the key it starts with is not a change.
  const lastKey = useRef(resetKey);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (lastKey.current === resetKey) return;
    lastKey.current = resetKey;
    if (mode === "open") close.current?.();
    // mode is read when the key changes, not a reason to run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  if (posts.length === 0) return null;

  const [first, ...rest] = posts;
  const total = posts.length;
  const foldable = mode !== "page" && total > 1;
  const open = mode !== "closed";
  const counters = open && total > 1;

  const body = (post: Post, inset: number) => (
    <PostBody post={post} mediaById={mediaById} srcByPath={srcByPath} capTall={capTall} phone={phone} firstLineInset={inset} />
  );

  const later = rest.map((post, index) => (
    <div key={index + 1} data-post={index + 2} style={{ position: "relative", paddingTop: POST_GAP }}>
      {counters ? <Counter n={index + 2} total={total} post={post} phone={phone} /> : null}
      {body(post, counters ? COUNTER_INSET : 0)}
    </div>
  ));

  return (
    <div data-post-thread="" data-thread-mode={mode} style={{ display: "flex", flexDirection: "column" }}>
      <div data-post={1}>{body(first, 0)}</div>
      {rest.length > 0 ? (
        mode === "page" ? (
          later
        ) : (
          <UnfoldRegion open={open} id={regionId}>
            {later}
          </UnfoldRegion>
        )
      ) : null}
      {foldable ? (
        <Toggle
          open={open}
          more={rest.length}
          controls={regionId}
          phone={phone}
          loading={loading}
          onPress={() => (open ? onClose?.() : onOpen?.())}
        />
      ) : null}
    </div>
  );
}

/** "2 / 4", at the right end of a post's first line. */
function Counter({ n, total, post, phone }: { n: number; total: number; post: Post; phone: boolean }) {
  const scale = postType(phone);
  const lead = post.content[0]?.type;
  const height =
    lead === "heading"
      ? (post.content[0] as { attrs?: { level?: number } }).attrs?.level === 1
        ? scale.firstLine.title
        : scale.firstLine.heading
      : lead === "paragraph"
        ? (post.content[0] as { attrs?: { size?: string } }).attrs?.size === "small"
          ? scale.firstLine.small
          : scale.firstLine.body
        : 16;
  const style: CSSProperties = {
    position: "absolute",
    top: POST_GAP,
    right: 0,
    height,
    display: "flex",
    alignItems: "center",
    fontFamily: DM_MONO,
    fontSize: 11,
    fontWeight: 400,
    lineHeight: 1,
    color: t.label,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  };
  return (
    <span data-post-counter="" style={style}>
      {`${n} / ${total}`}
    </span>
  );
}

/** The grid-template-rows unfold; see the note at the top. */
function UnfoldRegion({ open, id, children }: { open: boolean; id: string; children: React.ReactNode }) {
  return (
    <div
      id={id}
      data-post-region={open ? "open" : "closed"}
      // inert keeps the clipped posts out of the tab order and away from a screen reader.
      ref={(el) => {
        el?.toggleAttribute("inert", !open);
      }}
      style={{
        display: "grid",
        gridTemplateRows: open ? "1fr" : "0fr",
        transition: prefersReducedMotion() ? "none" : `grid-template-rows ${UNFOLD_MS}ms ${STANDARD}`,
      }}
    >
      <div style={{ overflow: "hidden", minHeight: 0 }}>{children}</div>
    </div>
  );
}

/** "Show more · 3 more posts ⌄", and "Show less ⌃" once open. */
function Toggle({
  open,
  more,
  controls,
  phone,
  loading,
  onPress,
}: {
  open: boolean;
  more: number;
  controls: string;
  phone: boolean;
  loading: boolean;
  onPress: () => void;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      data-post-toggle=""
      aria-expanded={open}
      aria-controls={controls}
      disabled={loading}
      {...handlers}
      onClick={(event) => {
        // A thread in a Gallery card sits inside the card's link.
        event.preventDefault();
        event.stopPropagation();
        onPress();
      }}
      style={{
        alignSelf: "flex-start",
        boxSizing: "border-box",
        height: phone ? 44 : 36,
        marginTop: 12,
        // Pulled back by its own padding so the words line up with the post's.
        marginLeft: -8,
        padding: "0 8px",
        border: "none",
        borderRadius: 6,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: FIGTREE,
        color: t.text,
        cursor: loading ? "default" : "pointer",
        // Hover is a step in colour; pressed sinks to the well.
        background: state.pressed ? t.well : state.hovered ? t.tile : "transparent",
        ...ring(state.focusVisible),
      }}
    >
      {loading ? (
        <span style={{ fontSize: 14, fontWeight: 500, color: t.text2 }}>Loading…</span>
      ) : open ? (
        <>
          <span style={{ fontSize: 14, fontWeight: 500, color: t.text }}>Show less</span>
          <Glyph name="up" size={16} color={t.text2} />
        </>
      ) : (
        <>
          <span style={{ fontSize: 14, fontWeight: 500, color: t.text }}>Show more</span>
          <span style={{ fontSize: 13, fontWeight: 400, color: t.text2 }}>{more === 1 ? "1 more post" : `${more} more posts`}</span>
          <Glyph name="chevd" size={16} color={t.text2} />
        </>
      )}
    </button>
  );
}
