// postType: the type scale of a post (PT-03).
//
// Every place a post is drawn reads this: PostBody on the Gallery, the composer
// preview and the build page, and the editor in PT-05. Sizes are chosen by the
// `phone` flag the caller already holds (below 768px) rather than by a media
// query, so a dev page can draw a 362px column on a desktop browser.
//
// ITALIC AND UNDERLINE ARE ALLOWED HERE, ON PURPOSE. The rule against italic
// and underlined type is for the site's own text: its labels, headings and
// buttons. The words in a post are the creator's, and a creator who stresses a
// word or marks a file name is writing, not decorating. PostBody renders the
// italic and underline marks as em and u. A later review should not strip them.

import type { CSSProperties } from "react";

import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

/** Between two blocks inside one post. */
export const BLOCK_GAP = 12;
/**
 * Between two posts of one build when a thread is open: the distance between two builds in the feed, from the bottom of
 * one post's actions row to the top of the next post's author row (the item's 4 below, the list's 8, the next item's 4).
 */
export const THREAD_GAP = 16;
/** A list's left indent, and the space between its items. */
export const LIST_INDENT = 20;
export const LIST_ITEM_GAP = 4;

export interface PostTypeScale {
  title: CSSProperties;
  heading: CSSProperties;
  body: CSSProperties;
  /** CA-07: the post's words in the composer only, larger and tighter as X sets them. Readers keep `body`. */
  composer: CSSProperties;
  small: CSSProperties;
  code: CSSProperties;
  /** The height of a block's first line in px, for lining a counter up with it. */
  firstLine: { title: number; heading: number; body: number; small: number; composer: number };
}

const text = (size: number, weight: number, leading: number, tracking: string): CSSProperties => ({
  fontFamily: FIGTREE,
  fontSize: size,
  fontWeight: weight,
  lineHeight: leading,
  letterSpacing: tracking,
  color: t.text,
  margin: 0,
});

/** The scale at this width. `phone` is true below 768px. */
export function postType(phone: boolean): PostTypeScale {
  const titleSize = 20;
  const headingSize = phone ? 18 : 20;
  return {
    title: { ...text(titleSize, 500, 1.1, "-0.03em"), textWrap: "balance" },
    heading: { ...text(headingSize, 500, 1.2, "-0.02em"), textWrap: "balance" },
    body: { ...text(16, 400, 1.55, "0"), textWrap: "pretty" },
    /* 29f: the phone composer is 17/22 (the row in `12-editor.jpg`); desktop keeps 20. */
    composer: { ...text(phone ? 17 : 20, 400, phone ? 22 / 17 : 1.25, "0"), textWrap: "pretty" },
    small: { ...text(13, 400, 1.5, "0"), color: t.text2, textWrap: "pretty" },
    code: {
      fontFamily: DM_MONO,
      fontSize: 13,
      fontWeight: 400,
      lineHeight: 1.6,
      color: t.text,
      background: t.well,
      border: `1px solid ${t.wellBorder}`,
      borderRadius: 6,
      padding: 12,
      margin: 0,
      overflowX: "auto",
      whiteSpace: "pre",
    },
    firstLine: {
      title: titleSize * 1.1,
      heading: headingSize * 1.2,
      body: 16 * 1.55,
      small: 13 * 1.5,
      composer: phone ? 22 : 20 * 1.25,
    },
  };
}

/** Between two posts of one build on the phone feed (prompt 20): the visible gap between two builds, 12 under and 12 over. */
export const FEED_THREAD_GAP = 24;

/** The phone feed's scale (prompt 20): post text 15/20, a lead 15/600, meta 13/16. Pictures and lists keep the shared rules. */
export function feedType(): PostTypeScale {
  const base = postType(true);
  const line = (size: number, weight: number, leading: string, colour: string = t.text): CSSProperties => ({
    ...base.body,
    fontSize: size,
    fontWeight: weight,
    lineHeight: leading,
    letterSpacing: "0",
    color: colour,
  });
  return {
    ...base,
    title: { ...line(17, 600, "22px"), letterSpacing: "-0.01em", textWrap: "balance" },
    heading: { ...line(15, 600, "20px"), textWrap: "balance" },
    body: { ...line(15, 400, "20px"), textWrap: "pretty" },
    small: { ...line(13, 400, "16px", t.text2), textWrap: "pretty" },
    firstLine: { title: 22, heading: 20, body: 20, small: 16, composer: base.firstLine.composer },
  };
}

/**
 * Prompt 29a: Home's posts at X's proportions. The phone's text is 17/22, desktop's 15/20; a lead (a heading) is the same size at
 * 600. Pictures and lists keep the shared rules.
 */
export function xFeedType(size: number, leading: number): PostTypeScale {
  const base = feedType();
  const line = `${leading}px`;
  return {
    ...base,
    title: { ...base.title, fontSize: size, fontWeight: 600, lineHeight: line, letterSpacing: "0" },
    heading: { ...base.heading, fontSize: size, fontWeight: 600, lineHeight: line },
    body: { ...base.body, fontSize: size, lineHeight: line },
    firstLine: { ...base.firstLine, title: leading, heading: leading, body: leading },
  };
}
