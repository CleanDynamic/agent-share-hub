// UX-11: /content/:id shows an old request as read-only history. The request is inserted directly by the fixture
// (src/test/oldRequest.ts). It shows its title, what was asked, its status and any accepted solution, one line saying
// requests have closed ("starting a topic" opens the New topic window), and no control that creates, manages, answers or
// accepts a bounty.

import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { insertOldRequest, type OldRow } from "@/test/oldRequest";

const state = vi.hoisted(() => ({ post: null as Record<string, unknown> | null, accepted: [] as unknown[] }));

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
    bountySolvers: [],
  }),
  recordPostView: vi.fn(),
  recordReadingProgress: vi.fn(),
  getComments: async () => [],
  useCommentsRealtime: () => undefined,
}));
vi.mock("@/lib/bounty-solver", () => ({
  getProvenance: async () => ({ bountyAuthor: null, acceptedSolvers: state.accepted }),
  getSolutions: async () => ({ solutions: [] }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ eq: async () => ({ count: 0 }), single: async () => ({ data: null }) }) }) }) },
}));
vi.mock("@/components/SeoHead", () => ({ SeoHead: () => null }));
vi.mock("@/components/article/ArticleViewer", () => ({ ArticleViewer: () => <p>what was asked</p> }));
vi.mock("@/components/canvas/StageTimeline", () => ({ StageTimeline: () => null }));
vi.mock("@/components/content-detail/ResultsViewerSection", () => ({ ResultsViewerSection: () => null }));
vi.mock("@/components/content-detail/FloatingEngagementBar", () => ({
  FloatingEngagementBar: (props: { onSubmitSolution?: unknown; onEdit?: unknown }) => (
    <div data-testid="engagement-bar" data-submit={String(Boolean(props.onSubmitSolution))} data-edit={String(Boolean(props.onEdit))} />
  ),
}));
vi.mock("@/components/content-detail/AIExportMenu", () => ({ AIExportMenu: () => null }));
vi.mock("@/components/reblog/ReblogsListModal", () => ({ ReblogsListModal: () => null }));
vi.mock("@/components/remix/AttributionChip", () => ({ default: () => null }));
vi.mock("@/components/remix/DescendantBadge", () => ({ default: () => null }));
vi.mock("@/components/remix/RemixButton", () => ({ default: () => null }));
vi.mock("@/lib/remix/hooks", () => ({ useLineageParent: () => ({ data: null }), useRemixCount: () => ({ data: 0 }) }));
vi.mock("@/components/bounty-competition/BlueprintAttributionBanner", () => ({ BlueprintAttributionBanner: () => null }));
vi.mock("@/pages/site/openbuilds/PostingWindows", () => ({
  PostingWindows: ({ window: win }: { window: { kind: string } | null }) => (win ? <div role="dialog" aria-label="New topic window" data-kind={win.kind} /> : null),
}));
vi.mock("@/components/content-detail/ContentDetailShell", () => ({
  ContentDetailShell: (props: { post: { title: string; description: string }; headerSlot?: ReactNode; bountyExtrasSlot?: ReactNode; bylineSlot?: ReactNode; children?: ReactNode }) => (
    <main>
      <h1>{props.post.title}</h1>
      <p>{props.post.description}</p>
      {props.headerSlot}
      {props.bylineSlot}
      {props.children}
      {props.bountyExtrasSlot}
    </main>
  ),
}));

import ContentDetail from "./ContentDetail";

function openAt(status: "open" | "closed" | "solved", accepted: unknown[] = []) {
  const tables: Record<string, OldRow[]> = {};
  const { contentItem } = insertOldRequest(tables, { status });
  state.post = { ...contentItem, post_type: "bounty", article_body: { type: "doc" }, bounty_slots_total: 1 };
  state.accepted = accepted;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/content/the-retry-prompt-keeps-timing-out"]}>
        <Routes>
          <Route path="/content/:id" element={<ContentDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const CONTROLS = [/submit/i, /accept/i, /manage/i, /promote/i, /extend/i, /deadline/i, /reward/i, /pause/i, /close bounty/i];

describe("/content/:id, an old request", () => {
  it.each([
    ["open", "Open when it closed"],
    ["closed", "Closed"],
    ["solved", "Solved"],
  ] as const)("shows a %s request as history: its title, what was asked, its status", async (status, words) => {
    openAt(status);
    expect(await screen.findByRole("heading", { name: "The retry prompt keeps timing out" })).toBeTruthy();
    expect(screen.getByText("The retry prompt gives up after two attempts and the inbox stays unsorted.")).toBeTruthy();
    expect(screen.getByText("what was asked")).toBeTruthy();
    expect(screen.getByTestId("old-request-status").textContent).toBe(`Status: ${words}`);
  });

  it("says requests have closed, and starting a topic opens the New topic window", async () => {
    openAt("open");
    const line = await screen.findByTestId("old-request-closed");
    expect(line.textContent).toBe("Requests have closed. Ask in OpenBuilds by starting a topic.");
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "starting a topic" }));
    expect(screen.getByRole("dialog", { name: "New topic window" }).getAttribute("data-kind")).toBe("post");
  });

  it("shows an accepted solution, read-only", async () => {
    openAt("solved", [
      {
        slotId: "s1",
        slotKind: "stage",
        slotName: "Retry stage",
        acceptedAt: "2026-09-02T09:00:00Z",
        user: { id: "solver-1", username: "kit", display_name: "Kit", avatar_url: null },
      },
    ]);
    await screen.findByTestId("old-request-closed");
    expect((await screen.findAllByText(/@kit|Kit/)).length).toBeGreaterThan(0);
  });

  it("offers no control that creates, manages, answers or accepts a request", async () => {
    openAt("solved");
    await screen.findByTestId("old-request-closed");
    for (const name of CONTROLS) expect(screen.queryByRole("button", { name })).toBeNull();
    const bar = screen.getByTestId("engagement-bar");
    expect(bar.getAttribute("data-submit")).toBe("false");
    // The author's own edit would open the retired editor: not offered on a request either.
    expect(bar.getAttribute("data-edit")).toBe("false");
  });
});
