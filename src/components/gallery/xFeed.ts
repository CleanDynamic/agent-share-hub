/* Prompt 29a Part A: Home's feed posts at X's proportions, on the phone (below 768px) and on desktop (the 600 centre column).
   One table of numbers, read by every part of a Home post (FeedPost, the rebuild post, PostCard's topic, PostThread, PostBody's
   pictures, the engagement row), so the phone and desktop differ only here. Values are CSS px. The rounded square avatars and the
   no-lines rule are kept on purpose: these are the two places Home differs from X. */

import type { CSSProperties } from "react";

export type XSize = "phone" | "desktop";

export interface XFeedMetrics {
  /** The item's padding: top, right, bottom, left. */
  padding: CSSProperties["padding"];
  /** The item's left padding alone (where the connector's column starts). */
  padLeft: number;
  avatar: number;
  /** Between the avatar and the text column. */
  avatarGap: number;
  /** The author row and the post text: size and line height. */
  text: number;
  line: number;
  /** More: the drawn box and its hit area. */
  moreBox: number;
  moreHit: number;
  /** Between the text and the pictures, the build line, the actions and a Show more. */
  gap: number;
  /** The pictures' radius. */
  pictureRadius: number;
  /** "Rebuilt from": padding, radius, and its picture's radius. */
  rebuildPad: number;
  rebuildRadius: number;
  rebuildPictureRadius: number;
  /** The actions: icon size, count size, hit area. */
  icon: number;
  count: number;
  hit: number;
  /** Comment, Rebuild and Like as a share of the text column; Save sits at its right edge. */
  positions: readonly [number, number, number];
  /** Between two posts of an opened thread. */
  threadGap: number;
}

export const X_FEED: Record<XSize, XFeedMetrics> = {
  phone: {
    padding: "12px 16px 12px 12px",
    padLeft: 12,
    avatar: 48,
    avatarGap: 8,
    text: 17,
    line: 22,
    moreBox: 22,
    moreHit: 44,
    gap: 12,
    pictureRadius: 14,
    rebuildPad: 14,
    rebuildRadius: 14,
    rebuildPictureRadius: 10,
    icon: 20,
    count: 15,
    hit: 44,
    positions: [0, 0.207, 0.42],
    threadGap: 24,
  },
  desktop: {
    padding: "12px 16px",
    padLeft: 16,
    avatar: 40,
    avatarGap: 8,
    text: 15,
    line: 20,
    moreBox: 20,
    moreHit: 32,
    gap: 12,
    pictureRadius: 16,
    rebuildPad: 12,
    rebuildRadius: 16,
    rebuildPictureRadius: 12,
    icon: 19,
    count: 13,
    hit: 32,
    positions: [0, 0.225, 0.453],
    threadGap: 24,
  },
};

/** Between the author row and the post text. */
export const X_ROW_GAP = 2;

/** The grid of a post: the avatar column and the text column. */
export const xGrid = (size: XSize): CSSProperties => ({
  display: "grid",
  gridTemplateColumns: `${X_FEED[size].avatar}px minmax(0, 1fr)`,
  columnGap: X_FEED[size].avatarGap,
});

/** The thread's connector, in the text column's coordinates: centred on the avatar, starting 4 under it. */
export const xConnector = (size: XSize) => {
  const m = X_FEED[size];
  return { x: -(m.avatar + m.avatarGap) + m.avatar / 2, top: m.avatar + 4 - (m.line + X_ROW_GAP) };
};

/** The author row's two parts: the name (700, Text) and "@handle · age" (Text 3), at the post size. */
export const xName = (size: XSize): CSSProperties => ({ fontSize: X_FEED[size].text, fontWeight: 700, lineHeight: `${X_FEED[size].line}px` });
export const xMeta = (size: XSize): CSSProperties => ({ fontSize: X_FEED[size].text, fontWeight: 400, lineHeight: `${X_FEED[size].line}px` });
