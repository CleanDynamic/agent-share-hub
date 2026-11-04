/* UX-06: the post page as it stands before its reads arrive: the route table's Placeholder for /openbuilds/topics/:id, and the
   page's own loading state, sized like the page (the crumbs, the post, the switch, three replies; the space's box at the side). It
   holds nothing else, so the Placeholder carries none of the page's code. */

import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";

import { OpenBuildsColumns } from "./OpenBuildsFrame";

function ReplyBones({ last }: { last: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "24px minmax(0, 1fr)", columnGap: 12, padding: "16px 0", borderBottom: last ? "none" : `1px solid ${t.hairline}` }}>
      <Skeleton width={24} height={24} radius={12} />
      <div>
        <Skeleton width="30%" height={12} radius={4} />
        <Skeleton width="80%" height={12} radius={4} style={{ marginTop: 8 }} />
        <Skeleton width="20%" height={12} radius={4} style={{ marginTop: 8 }} />
      </div>
    </div>
  );
}

export function PostLoadingView() {
  return (
    <LoadingRegion what="post" announce>
      <OpenBuildsColumns
        testId="openbuilds-post-loading"
        sideLabel="About this post"
        main={
          <div aria-hidden="true">
            <Skeleton width={160} height={12} radius={4} />
            <div style={{ display: "grid", gridTemplateColumns: "40px minmax(0, 1fr)", columnGap: 12, padding: "20px 0 16px" }}>
              <Skeleton width={40} height={40} radius={20} />
              <div>
                <Skeleton width="35%" height={16} radius={4} />
                <Skeleton width="70%" height={24} radius={4} style={{ marginTop: 8 }} />
                <Skeleton height={60} radius={6} style={{ marginTop: 8 }} />
              </div>
            </div>
            <div style={{ height: 32, marginTop: 8, paddingBottom: 12, borderBottom: `1px solid ${t.hairline}` }}>
              <Skeleton width={200} height={32} radius={6} />
            </div>
            {[0, 1, 2].map((index) => (
              <ReplyBones key={index} last={index === 2} />
            ))}
          </div>
        }
        side={
          <div aria-hidden="true" style={{ background: t.module, border: `1px solid ${t.moduleBorder}`, borderRadius: r.card, padding: 16 }}>
            <Skeleton width="50%" height={16} radius={4} />
            <Skeleton width="70%" height={12} radius={4} style={{ marginTop: 8 }} />
            <Skeleton width={64} height={32} radius={6} style={{ marginTop: 12 }} />
          </div>
        }
      />
    </LoadingRegion>
  );
}
