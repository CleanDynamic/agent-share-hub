// UX-11: requests are gone. A content item whose post_type is "bounty" no longer has a page: its address goes to Home. Other
// content types (blueprint, blog) keep theirs.

import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ post: null as Record<string, unknown> | null }));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "reader-1" }, isLoggedIn: true }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useCanvasDocument", () => ({ useCanvasDocument: () => ({ loading: false, stages: [], blocks: [] }) }));
vi.mock("@/lib/content-detail", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPostForViewer: async () => ({
    post: state.post,
    author: { id: "c9ea1000-0000-4000-8000-000000000001", username: "maya", display_name: "Maya", avatar_url: null },
    viewer: { isFollowing: false },
    relatedPosts: [],
  }),
  recordPostView: vi.fn(),
  recordReadingProgress: vi.fn(),
  getComments: async () => [],
  useCommentsRealtime: () => undefined,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ eq: async () => ({ count: 0 }), single: async () => ({ data: null }) }) }) }) },
}));
vi.mock("@/components/SeoHead", () => ({ SeoHead: () => null }));
vi.mock("@/components/article/ArticleViewer", () => ({ ArticleViewer: () => <p>what was asked</p> }));
vi.mock("@/components/canvas/StageTimeline", () => ({ StageTimeline: () => null }));
vi.mock("@/components/content-detail/ResultsViewerSection", () => ({ ResultsViewerSection: () => null }));
vi.mock("@/components/content-detail/FloatingEngagementBar", () => ({
  FloatingEngagementBar: (props: { onEdit?: unknown }) => (
    <div data-testid="engagement-bar" data-edit={String(Boolean(props.onEdit))} />
  ),
}));
vi.mock("@/components/content-detail/AIExportMenu", () => ({ AIExportMenu: () => null }));
vi.mock("@/components/reblog/ReblogsListModal", () => ({ ReblogsListModal: () => null }));
vi.mock("@/components/remix/AttributionChip", () => ({ default: () => null }));
vi.mock("@/components/remix/DescendantBadge", () => ({ default: () => null }));
vi.mock("@/components/remix/RemixButton", () => ({ default: () => null }));
vi.mock("@/lib/remix/hooks", () => ({ useLineageParent: () => ({ data: null }), useRemixCount: () => ({ data: 0 }) }));

vi.mock("@/components/content-detail/ContentDetailShell", () => ({
  ContentDetailShell: (props: { post: { title: string }; children?: ReactNode }) => (
    <main>
      <h1>{props.post.title}</h1>
      {props.children}
    </main>
  ),
}));

import ContentDetail from "./ContentDetail";

function openAt(postType: "bounty" | "blueprint") {
  state.post = {
    id: "c0ffee00-0000-4000-8000-000000000001",
    slug: "an-old-post",
    title: "An old post",
    description: "Something published.",
    post_type: postType,
    creator_id: "c9ea1000-0000-4000-8000-000000000001",
    article_body: { type: "doc" },
    created_at: "2026-08-28T09:00:00Z",
    published_at: "2026-08-28T09:00:00Z",
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/content/an-old-post"]}>
        <Routes>
          <Route path="/" element={<p>Home</p>} />
          <Route path="/content/:id" element={<ContentDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("/content/:id after requests", () => {
  it("sends a bounty content item to Home", async () => {
    openAt("bounty");
    expect(await screen.findByText("Home")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "An old post" })).toBeNull();
  });

  it("still shows a blueprint", async () => {
    openAt("blueprint");
    expect(await screen.findByRole("heading", { name: "An old post" })).toBeTruthy();
    expect(screen.queryByText("Home")).toBeNull();
  });
});
