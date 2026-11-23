/* Synth 11: the feed's loading view: the route table's Placeholder for /openbuilds and the space page, and the page's own
   loading state, sized like the layout. The feed: the page's h1 for screen readers, then the feed template's panels
   (`FeedTemplateBones`): the left panel's head and rows, the centre's line and Post (shown, not yet working), the tabs row,
   the pills row with "Newest first", then posts 8 apart; the right panel's head and rows. A space's address shares this
   view, and the space's name is not known yet, so there it is the space's one 680 panel with its head as bones. The error
   line and the empty line are in OpenBuildsFeedParts. */

import type { CSSProperties } from "react";
import { useLocation } from "react-router-dom";

import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { PostPrimary } from "@/components/post/postControls";
import { PANEL_RADIUS } from "@/components/shell/chromeSize";
import { useColumnPanels } from "@/components/shell/frameChrome";
import { FeedTemplateBones, RowBones } from "@/components/shell/PageBones";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { FEED_HEAD } from "./OpenBuildsFeedParts";

/** The posts drawn while the feed loads. */
const POST_BONES = 2;
/** A post's height while it loads: the list's own estimate for a card it has not drawn yet (`containIntrinsicSize`). */
const POST_HEIGHT = 220;

const meta: CSSProperties = { margin: 0, fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label };

/** The tabs row while it loads, at the row's own height. */
function TabsBones() {
  return <div style={{ height: 53, boxSizing: "border-box" }} />;
}

/** A post while the feed loads: the author line, the lead line, two lines of the post. */
function PostBones() {
  return (
    <div style={{ height: POST_HEIGHT, boxSizing: "border-box", padding: "4px 16px", display: "grid", gridTemplateColumns: "40px minmax(0, 1fr)", columnGap: 12 }}>
      <Skeleton width={40} height={40} radius="50%" />
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <Skeleton width="40%" height={20} radius={4} />
        <Skeleton width="70%" height={20} radius={4} />
        <Skeleton width="90%" height={16} radius={4} />
        <Skeleton width="60%" height={16} radius={4} />
      </div>
    </div>
  );
}

function PostsBones() {
  return (
    <div data-testid="openbuilds-feed-loading" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: POST_BONES }, (_, index) => (
        <PostBones key={index} />
      ))}
    </div>
  );
}

/** A side panel's head while it loads. */
function HeadBones() {
  return (
    <div style={{ height: 32, display: "flex", alignItems: "center" }}>
      <Skeleton width="50%" height={20} radius={4} />
    </div>
  );
}

/** A space while it loads: its one panel, the head as bones, the tabs row, the order line's place and the posts. */
function SpaceBones() {
  useColumnPanels(true);
  return (
    <div style={{ boxSizing: "border-box", width: "100%", maxWidth: 680, margin: "0 auto", background: t.surface, borderRadius: PANEL_RADIUS, overflow: "clip", paddingBottom: 48 }}>
      <div style={{ padding: "16px 16px 8px" }}>
        <Skeleton width={96} height={16} radius={4} />
        <Skeleton width={240} height={36} radius={4} style={{ marginTop: 8 }} />
        <Skeleton width="60%" height={20} radius={4} style={{ marginTop: 8 }} />
        <Skeleton width="40%" height={16} radius={4} style={{ marginTop: 8 }} />
      </div>
      <TabsBones />
      <div style={{ height: 40 }} />
      <PostsBones />
    </div>
  );
}

/** The feed as it stands before its reads arrive: the route table's Placeholder, and the page's own loading state. */
export function OpenBuildsFeedLoadingView() {
  const space = useLocation().pathname.startsWith("/openbuilds/spaces/");
  return (
    <LoadingRegion what="posts" announce>
      <div style={{ minHeight: "100vh" }}>
        {space ? (
          <SpaceBones />
        ) : (
          <>
            <h1 className="sr-only" style={{ margin: 0 }}>
              {FEED_HEAD.title}
            </h1>
            <FeedTemplateBones
              left={
                <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <HeadBones />
                  <RowBones count={4} height={44} what="your spaces" />
                </section>
              }
              centre={
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 16px 4px" }}>
                    <p style={{ ...meta, fontSize: 15, lineHeight: "20px", color: t.text2 }}>{FEED_HEAD.line}</p>
                    <PostPrimary disabled>Post</PostPrimary>
                  </div>
                  <TabsBones />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: 56, boxSizing: "border-box", padding: "12px 16px" }}>
                    <p style={meta}>Newest first</p>
                  </div>
                  <PostsBones />
                </>
              }
              right={
                <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <HeadBones />
                  <RowBones count={3} height={56} what="busy spaces" />
                </section>
              }
            />
          </>
        )}
      </div>
    </LoadingRegion>
  );
}
