/* UX-05 Part 2: the pieces the feed and the space page share: the page head (heading, a line, the one primary on the
   right; on a phone the primary under them at full width, 44 high), the load-error line, and the loading view (the route
   table's Placeholder for /openbuilds and the page's own loading state), sized like the layout. */

import type { CSSProperties, ReactNode } from "react";

import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { PostControl } from "@/components/post/postControls";
import { FeedBones, HeadBones, HomeColumns, Rule, SectionBones, useHomeLayout } from "@/pages/site/home/HomeFrame";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

const H1: CSSProperties = { margin: 0, fontFamily: FIGTREE, fontSize: 20, fontWeight: 500, lineHeight: "28px", letterSpacing: "-0.015em", color: t.text };
const LINE: CSSProperties = { margin: "2px 0 0", fontFamily: FIGTREE, fontSize: 13, lineHeight: "20px", color: t.text2 };
const META: CSSProperties = { margin: "4px 0 0", fontFamily: FIGTREE, fontSize: 12, lineHeight: "16px", color: t.label };

/** The head: the page's `h1`, a line under it, optional meta, and the actions at the right (full width under them on a phone). */
export function PageHead({ title, line, meta, actions, primary }: { title: string; line?: string; meta?: ReactNode; actions?: ReactNode; primary?: ReactNode }) {
  const phone = useIsPhone();
  return (
    <header style={{ display: "flex", flexDirection: phone ? "column" : "row", alignItems: phone ? "stretch" : "flex-start", justifyContent: "space-between", gap: phone ? 16 : 24, padding: "0 4px 24px" }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={H1}>{title}</h1>
        {line ? <p style={LINE}>{line}</p> : null}
        {meta ? <p style={META}>{meta}</p> : null}
      </div>
      {actions || primary ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexDirection: phone ? "column" : "row", alignSelf: phone ? "stretch" : "flex-start" }}>
          {actions}
          {primary}
        </div>
      ) : null}
    </header>
  );
}

/** One sentence and Retry (CA-28's wording). */
export function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert" style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 20px", fontFamily: FIGTREE, fontSize: 12.5, color: t.text2 }}>
      <span style={{ flexGrow: 1 }}>{what}</span>
      <PostControl onClick={onRetry}>Retry</PostControl>
    </div>
  );
}

/** One line and one action, for an empty list. */
export function EmptyLine({ line, children }: { line: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "24px 20px", fontFamily: FIGTREE, fontSize: 13, color: t.text2 }}>
      <span style={{ flexGrow: 1 }}>{line}</span>
      {children}
    </div>
  );
}

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
