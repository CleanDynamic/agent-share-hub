/* Synth 11: a space's page. PURE: typed props, no fetching, no `useAuth()`, no router hooks but `Link`.

   The header carries OpenBuilds as the current item. One panel, 680 wide and centred at every desktop width: a 13 Text 3
   underlined link to OpenBuilds above the h1 (the space's name, 31/36), its description 15 Text 2 and the made-by line
   13 Text 3, with the primary by role at the right (Post here for members, Join space for visitors) and Settings for
   moderators. Then the Posts and Rules tabs, and under Posts the order line and the space's topic cards in the order the space sets
   (a pinned card says so above its author line). */

import { useRegisterPageBar } from "@/components/shell/phoneBarRegistry";
import { PageState } from "@/components/pagestate/PageState";
import { readOf, type ReadLike } from "@/components/pagestate/pageStateModel";
import type { CSSProperties, ReactNode } from "react";

import { PostControl, PostPrimary } from "@/components/post/postControls";
import { PANEL_RADIUS } from "@/components/shell/chromeSize";
import { useColumnPanels } from "@/components/shell/frameChrome";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { TextTabs } from "@/components/vision/TextTabs";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, hero } from "@/lib/theme/type";

import { PostList, type FeedItem, type FeedStatus } from "./OpenBuildsFeedView";
import { primaryFor, type SpaceTab } from "./spaceModel";

export interface SpaceViewProps {
  name: string;
  description: string;
  /** "Made by @sam · 412 members". */
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

/** The space's panel: 680 at every desktop width, centred; the full column on a phone. */
const SPACE_WIDTH = 680;

const spacePanel: CSSProperties = { boxSizing: "border-box", width: "100%", maxWidth: SPACE_WIDTH, margin: "0 auto", background: t.surface, borderRadius: PANEL_RADIUS, overflow: "clip", minWidth: 0 };

const TABS: readonly { value: SpaceTab; label: string }[] = [
  { value: "posts", label: "Posts" },
  { value: "rules", label: "Rules" },
];

const words = (size: 13 | 15, color: string, extra: CSSProperties = {}): CSSProperties => ({ margin: 0, fontFamily: FIGTREE, fontSize: size, lineHeight: size === 15 ? "20px" : "16px", color, ...extra });

/** The parent: OpenBuilds, 13 in Text 3, underlined at rest. */
export function ParentLink() {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <nav aria-label="Breadcrumb">
      <Link to="/openbuilds" data-testid="space-parent" {...handlers} style={{ ...words(13, state.hovered ? t.text2 : t.label), textDecoration: "underline", textUnderlineOffset: 3, borderRadius: r.chip, ...ring(state.focusVisible) }}>
        OpenBuilds
      </Link>
    </nav>
  );
}

export function SpaceView(view: SpaceViewProps) {
  useColumnPanels(true);
  const phone = useIsPhone();
  const member = primaryFor(view.role) === "post";
  // Prompt 19: the phone's More sheet holds the space's actions (Copy link and Share are the bar's own).
  useRegisterPageBar({
    more: [
      member ? { label: "Post here", onSelect: view.onPost } : { label: "Join space", onSelect: view.onJoin },
      ...(view.role === "moderator" ? [{ label: "Settings", onSelect: view.onSettings }] : []),
    ],
  });
  const primary: ReactNode = member ? (
    <PostPrimary onClick={view.onPost} block>
      Post here
    </PostPrimary>
  ) : (
    <PostPrimary onClick={view.onJoin} block aria-label={`Join ${view.name}`}>
      Join space
    </PostPrimary>
  );

  return (
    <div data-testid="space-view" style={{ ...spacePanel, paddingBottom: 48 }}>
      <header style={{ padding: "16px 16px 8px", display: "flex", flexDirection: phone ? "column" : "row", alignItems: phone ? "stretch" : "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <ParentLink />
          <h1 style={{ ...hero, margin: "8px 0 0", color: t.text, overflowWrap: "anywhere" }}>{view.name}</h1>
          {view.description ? <p style={{ ...words(15, t.text2), marginTop: 8 }}>{view.description}</p> : null}
          <p style={{ ...words(13, t.label), marginTop: 8 }}>{view.meta}</p>
        </div>
        <div style={{ display: "flex", flexDirection: phone ? "column" : "row", alignItems: phone ? "stretch" : "center", gap: 8, flexShrink: 0, paddingTop: phone ? 0 : 24 }}>
          {view.role === "moderator" ? <PostControl onClick={view.onSettings} block>Settings</PostControl> : null}
          {primary}
        </div>
      </header>
      <TextTabs tabs={TABS} value={view.tab} onChange={view.onTab} label="Space" />
      {view.tab === "rules" ? (
        <div role="tabpanel" aria-label="Rules" style={{ ...words(15, view.rules ? t.text : t.text2), padding: "16px", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {view.rules || "No rules yet."}
        </div>
      ) : (
        <div role="tabpanel" aria-label="Posts">
          <p style={{ ...words(13, t.label), padding: "12px 16px" }}>{view.orderLine}</p>
          <PageState
            read={view.posts.read ?? (view.posts.status === "error" ? readOf("error", undefined, view.posts.onRetry) : readOf("ready", view.posts.items))}
            thing="posts"
            region="Posts"
            skeleton={null}
            style={{ padding: "16px" }}
            empty={{ when: () => view.posts.items.length === 0, line: "No posts here yet.", action: member ? { label: "Post here", onClick: view.onPost } : { label: "Join space", onClick: view.onJoin } }}
          >
            {() => <PostList items={view.posts.items} more={view.posts.more} />}
          </PageState>
        </div>
      )}
    </div>
  );
}

export default SpaceView;
