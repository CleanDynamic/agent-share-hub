/* UX-05 Part 3: a space's page. PURE: typed props, no fetching, no `useAuth()`, no router hooks but `Link`.

   The head (name as `h1`, description, the made-by line, and the primary by role), two tabs, and under Posts the order line and the
   space's cards. Moderators also get Settings and, on each card, the `···` menu. One column, centred at Home's feed width. */

import { PageState } from "@/components/pagestate/PageState";
import { readOf, type ReadLike } from "@/components/pagestate/pageStateModel";
import type { ReactNode } from "react";

import { PostControl, PostPrimary } from "@/components/post/postControls";
import { Breadcrumb } from "@/components/shell/Breadcrumb";
import { pageColumns } from "@/components/shell/pageGrid";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { TextTabs } from "@/components/vision/TextTabs";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { PageHead } from "./OpenBuildsFeedParts";
import { PostList, type FeedItem, type FeedStatus } from "./OpenBuildsFeedView";
import { primaryFor, type SpaceTab } from "./spaceModel";

export interface SpaceViewProps {
  name: string;
  description: string;
  /** "Made by @sam · moderated by @sam, @ola · 412 members · anyone can post". */
  meta: string;
  /** "Newest first · set by @sam". */
  orderLine: string;
  rules: string;
  role: "none" | "member" | "moderator";
  tab: SpaceTab;
  onTab: (tab: SpaceTab) => void;
  onJoin: () => void;
  onPost: () => void;
  onSettings: () => void;
  /** G4: `read` is the feed's read, for PageState's failed, retrying and empty states. */
  posts: { status: FeedStatus; items: FeedItem[]; onRetry: () => void; read?: ReadLike; more?: { loading: boolean; onMore: () => void } };
}

const TABS: readonly { value: SpaceTab; label: string }[] = [
  { value: "posts", label: "Posts" },
  { value: "rules", label: "Rules" },
];

export function SpaceView(view: SpaceViewProps) {
  const phone = useIsPhone();
  const member = primaryFor(view.role) === "post";
  const primary: ReactNode = member ? (
    <PostPrimary onClick={view.onPost} block>
      Post here
    </PostPrimary>
  ) : (
    <PostPrimary onClick={view.onJoin} block>
      Join
    </PostPrimary>
  );

  return (
    <div>
      <PageHead
        title={view.name}
        line={view.description || undefined}
        meta={view.meta}
        actions={view.role === "moderator" ? <PostControl onClick={view.onSettings}>Settings</PostControl> : undefined}
        primary={primary}
        breadcrumb={<Breadcrumb />}
      />
    {/* Desktop: the page grid's feed template, the space in columns 4 to 9. The phone keeps its 700 column. */}
    <div style={phone ? undefined : pageColumns("feed")}>
    <div style={phone ? { maxWidth: 700, margin: "0 auto", paddingBottom: 48 } : { gridColumn: 2, minWidth: 0, paddingBottom: 48 }}>
      <div style={{ borderBottom: `1px solid ${t.hairline}`, padding: "0 4px" }}>
        <TextTabs tabs={TABS} value={view.tab} onChange={view.onTab} label="Space" height={32} rule={false} />
      </div>
      {view.tab === "rules" ? (
        <div role="tabpanel" aria-label="Rules" style={{ padding: "20px 4px", fontFamily: FIGTREE, fontSize: 13, lineHeight: "20px", whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: view.rules ? t.text : t.text2 }}>
          {view.rules || "No rules yet."}
        </div>
      ) : (
        <div role="tabpanel" aria-label="Posts">
          <p style={{ margin: 0, padding: "8px 4px 0", fontFamily: FIGTREE, fontSize: 12, lineHeight: "16px", color: t.label }}>{view.orderLine}</p>
          <PageState
            read={view.posts.read ?? (view.posts.status === "error" ? readOf("error", undefined, view.posts.onRetry) : readOf("ready", view.posts.items))}
            thing="posts"
            region="Posts"
            skeleton={null}
            style={{ padding: "16px 20px" }}
            empty={{ when: () => view.posts.items.length === 0, line: "No posts here yet.", action: member ? { label: "Post here", onClick: view.onPost } : { label: "Join", onClick: view.onJoin } }}
          >
            {() => <PostList items={view.posts.items} more={view.posts.more} />}
          </PageState>
        </div>
      )}
    </div>
    </div>
    </div>
  );
}

export default SpaceView;
