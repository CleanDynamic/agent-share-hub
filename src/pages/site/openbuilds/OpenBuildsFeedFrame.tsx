/* UX-05 Part 2: the feed's loading view: the route table's Placeholder for /openbuilds and the space page, and the page's own
   loading state, sized like the layout. It holds nothing else (the head, the error line and the empty line are in
   OpenBuildsFeedParts), so the Placeholder carries none of the page's code. */

import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { FeedBones, HeadBones, HomeColumns, Rule, SectionBones, useHomeLayout } from "@/pages/site/home/HomeFrame";
import { t } from "@/lib/theme/tokens";

/** The tabs row while it loads: a hairline at the row's own height. */
function TabsBones() {
  return <div style={{ height: 41, boxSizing: "border-box", borderBottom: `1px solid ${t.hairline}` }} />;
}

/** The feed as it stands before its reads arrive: the route table's Placeholder, and the page's own loading state. */
export function OpenBuildsFeedLoadingView() {
  const layout = useHomeLayout();
  return (
    <LoadingRegion what="posts" announce>
      <div style={{ minHeight: "100vh" }}>
        <div style={{ padding: "0 4px 24px" }}>
          <Skeleton width={160} height={28} radius={4} />
          <Skeleton width="50%" height={16} radius={4} style={{ marginTop: 6 }} />
        </div>
        <HomeColumns
          layout={layout}
          left={
            <>
              <SectionBones rows={4} height={40} what="your spaces" />
            </>
          }
          centre={
            <>
              <TabsBones />
              <FeedBones />
            </>
          }
          right={
            layout === "one" ? null : (
              <>
                <HeadBones />
                <Rule />
                <SectionBones rows={3} height={48} what="busy spaces" />
              </>
            )
          }
        />
      </div>
    </LoadingRegion>
  );
}
