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
/** Between two posts when a thread is open. */
export const POST_GAP = 24;
/** A list's left indent, and the space between its items. */
export const LIST_INDENT = 20;
export const LIST_ITEM_GAP = 4;
/** The picture row's gap, and a row's widest count. */
export const ROW_GAP = 8;

export interface PostTypeScale {
  title: CSSProperties;
  heading: CSSProperties;
  body: CSSProperties;
  small: CSSProperties;
  code: CSSProperties;
  /** The height of a block's first line in px, for lining a counter up with it. */
  firstLine: { title: number; heading: number; body: number; small: number };
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
  const titleSize = phone ? 24 : 28;
  const headingSize = phone ? 18 : 20;
  return {
    title: { ...text(titleSize, 500, 1.1, "-0.03em"), textWrap: "balance" },
    heading: { ...text(headingSize, 500, 1.2, "-0.02em"), textWrap: "balance" },
    body: { ...text(16, 400, 1.55, "0"), textWrap: "pretty" },
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
    },
  };
}
