/* UX-06, Synth 11: the topic page as it stands before its reads arrive: the route table's Placeholder for
   /openbuilds/topics/:id, and the page's own loading state, sized like the page in its panels (the link to the space, the
   post, the pills, three replies; the space's section in the side panel). It holds nothing else, so the Placeholder
   carries none of the page's code. */

import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { t } from "@/lib/theme/tokens";

import { OpenBuildsColumns } from "./OpenBuildsFrame";
import { PlaceholderTitle } from "@/components/pagestate/PlaceholderTitle";

function ReplyBones({ last }: { last: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "24px minmax(0, 1fr)", columnGap: 12, padding: "16px 0", borderBottom: last ? "none" : `1px solid ${t.hairline}` }}>
      <Skeleton width={24} height={24} radius={12} />
      <div>
        <Skeleton width="30%" height={16} radius={4} />
        <Skeleton width="80%" height={16} radius={4} style={{ marginTop: 8 }} />
        <Skeleton width="20%" height={16} radius={4} style={{ marginTop: 8 }} />
      </div>
    </div>
  );
}

export function PostLoadingView() {
  return (
    <>
    <PlaceholderTitle>Post</PlaceholderTitle>
    <LoadingRegion what="post" announce>
      <OpenBuildsColumns
        testId="openbuilds-post-loading"
        sideLabel="About this post"
        main={
          <div aria-hidden="true">
            <Skeleton width={120} height={16} radius={4} />
            <div style={{ display: "grid", gridTemplateColumns: "40px minmax(0, 1fr)", columnGap: 12, padding: "16px 0" }}>
              <Skeleton width={40} height={40} radius={20} />
              <div>
                <Skeleton width="35%" height={20} radius={4} />
                <Skeleton width="70%" height={24} radius={4} style={{ marginTop: 8 }} />
                <Skeleton height={60} radius={12} style={{ marginTop: 8 }} />
              </div>
            </div>
            <div style={{ height: 32, marginTop: 16, paddingBottom: 12, display: "flex", gap: 8 }}>
              <Skeleton width={96} height={32} radius={16} />
              <Skeleton width={120} height={32} radius={16} />
            </div>
            {[0, 1, 2].map((index) => (
              <ReplyBones key={index} last={index === 2} />
            ))}
          </div>
        }
        side={
          <div aria-hidden="true" style={{ padding: "0 16px" }}>
            <Skeleton width="50%" height={24} radius={4} />
            <Skeleton width="80%" height={20} radius={4} style={{ marginTop: 8 }} />
            <Skeleton width="40%" height={16} radius={4} style={{ marginTop: 8 }} />
            <Skeleton width={104} height={32} radius={16} style={{ marginTop: 12 }} />
          </div>
        }
      />
    </LoadingRegion>
    </>
  );
}
