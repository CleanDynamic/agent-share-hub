/* The phone Home's loading state, in a module of its own: the route table's placeholder draws it, and the placeholder is
   in the first download, so it must not bring PhoneHome's posts, sheets and data layer with it. */

import type { CSSProperties } from "react";

import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { PANEL_GUTTER, PHONE_TAB } from "@/components/shell/chromeSize";
import { useColumnPanels } from "@/components/shell/frameChrome";

const ITEM: CSSProperties = { padding: "12px 16px", boxSizing: "border-box" };

/** Where the dock and the safe area leave room under the last post. */
const BOTTOM: CSSProperties = { paddingBottom: "calc(72px + env(safe-area-inset-bottom))", margin: `0 -${PANEL_GUTTER}px` };

function PostBones() {
  return (
    <div style={{ ...ITEM, display: "grid", gridTemplateColumns: "40px minmax(0, 1fr)", columnGap: 12 }}>
      <Skeleton width={40} height={40} radius={9} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <Skeleton width="45%" height={20} radius={4} />
        <Skeleton width="85%" height={20} radius={4} />
        <Skeleton height={190} radius={16} />
        <Skeleton height={20} radius={4} />
      </div>
    </div>
  );
}

export function PhoneFeedBones({ count = 2 }: { count?: number }) {
  return (
    <LoadingRegion what="the feed" data-testid="home-feed-loading">
      {Array.from({ length: count }, (_, index) => (
        <PostBones key={index} />
      ))}
    </LoadingRegion>
  );
}

/** The route's loading state on a phone: the tabs' row, then post skeletons, no tiles. */
export function PhoneHomeLoading() {
  useColumnPanels(true);
  return (
    <div data-testid="home-view" data-layout="phone" style={BOTTOM}>
      <h1 className="sr-only" style={{ margin: 0 }}>
        Home
      </h1>
      <div style={{ height: PHONE_TAB }} />
      <PhoneFeedBones count={3} />
    </div>
  );
}

