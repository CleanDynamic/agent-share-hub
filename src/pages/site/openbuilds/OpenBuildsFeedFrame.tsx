/* UX-05 Part 2: the feed's loading view: the route table's Placeholder for /openbuilds and the space page, and the page's own
   loading state, sized like the layout. The head is the page's own (`PageHead`, with Post shown and not yet working), drawn at
   once; under it the feed template's columns (`FeedTemplateBones`), with the sections' heads and the rows at the loaded pitch:
   the tabs row, the "Newest first" line, then posts, a hairline between. A space's address shares this view, and the space's
   name is not known yet, so there the head is a bone. The error line and the empty line are in OpenBuildsFeedParts. */

import { useLocation } from "react-router-dom";

import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { PostPrimary } from "@/components/post/postControls";
import { FeedTemplateBones, RowBones } from "@/components/shell/PageBones";
import { SectionHead } from "@/components/vision/SectionHead";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { FEED_HEAD, PageHead } from "./OpenBuildsFeedParts";

/** The posts drawn while the feed loads. */
const POST_BONES = 2;
/** A post's height while it loads: the list's own estimate for a card it has not drawn yet (`containIntrinsicSize`). */
const POST_HEIGHT = 220;

/** The tabs row while it loads: a hairline at the row's own height. */
function TabsBones() {
  return <div style={{ height: 39, boxSizing: "border-box", borderBottom: `1px solid ${t.hairline}` }} />;
}

/** A post while the feed loads: the author line, the title, two lines of the post. */
function PostBones({ first }: { first: boolean }) {
  return (
    <div style={{ height: POST_HEIGHT, boxSizing: "border-box", borderTop: first ? "none" : `1px solid ${t.hairline}`, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      <Skeleton width="40%" height={20} radius={4} />
      <Skeleton width="70%" height={20} radius={4} />
      <Skeleton width="90%" height={16} radius={4} />
      <Skeleton width="60%" height={16} radius={4} />
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
          <div style={{ padding: "0 4px 24px" }}>
            <Skeleton width={160} height={28} radius={4} />
            <Skeleton width="50%" height={16} radius={4} style={{ marginTop: 6 }} />
          </div>
        ) : (
          <PageHead title={FEED_HEAD.title} line={FEED_HEAD.line} primary={<PostPrimary disabled block>Post</PostPrimary>} />
        )}
        <FeedTemplateBones
          left={
            <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <SectionHead title="Your spaces" />
              <RowBones count={4} height={32} what="your spaces" />
            </section>
          }
          centre={
            <>
              <TabsBones />
              <p style={{ margin: 0, padding: "8px 20px 0", fontFamily: FIGTREE, fontSize: 12, lineHeight: "20px", color: t.label }}>Newest first</p>
              <div data-testid="openbuilds-feed-loading">
                {Array.from({ length: POST_BONES }, (_, index) => (
                  <PostBones key={index} first={index === 0} />
                ))}
              </div>
            </>
          }
          right={
            <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <SectionHead title="Busy this week" meta="Spaces with the most new posts" />
              <RowBones count={3} height={52} what="busy spaces" />
            </section>
          }
        />
      </div>
    </LoadingRegion>
  );
}
