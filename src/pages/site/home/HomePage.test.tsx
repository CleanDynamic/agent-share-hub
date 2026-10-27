// SV-10: the Home container. The feed's tab keeps the old items until the new arrive (SV-03 P7); items newer than the
// last visit wait behind the pill; post_doc is read for the first screen's posts as the feed answers, and for the rest
// in one request per batch as they come near; a signed-out reader's Me too asks them to sign in.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toFeedItem, type BuildFeedRow } from "@/lib/feed/getBuildFeed";

const auth = vi.hoisted(() => ({ user: { id: "u1" } as { id: string } | null }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: auth.user, loading: false }) }));
vi.mock("@/hooks/useProgressPage", () => ({ useMyWeek: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }) }));
vi.mock("@/hooks/useLibrarySessions", () => ({ librarySessionsKey: ["build", "listLibrarySessions"], useLibrarySessions: () => ({ data: [], isLoadingError: false, error: null, refetch: vi.fn() }) }));
vi.mock("@/hooks/useEngagement", () => ({ useEngagement: () => ({ counts: {}, liked: new Set(), saved: new Set(), loaded: true }), engagementFor: () => undefined }));
vi.mock("@/lib/build/whereNext", async (original) => ({ ...(await original<typeof import("@/lib/build/whereNext")>()), getWhereNextForViewer: async () => [] }));
vi.mock("@/lib/build/drafts", () => ({ listDraftsWithSessions: async () => [] }));
vi.mock("@/lib/build/signals", async (original) => ({ ...(await original<typeof import("@/lib/build/signals")>()), countLitToday: async () => 1, countReproducedToday: async () => 1, countRunsThisWeek: async () => 1, listMostReproduced: async () => [] }));
vi.mock("@/lib/progress", async (original) => ({ ...(await original<typeof import("@/lib/progress")>()), getStreakDays: async () => [] }));
vi.mock("@/lib/bounty", () => ({ OPEN_BOUNTIES_PAGE_SIZE: 20, listOpenBountyCards: async () => ({ cards: [], nextCursor: null }), myMeToo: async () => new Set(), toggleMeToo: vi.fn() }));
vi.mock("@/components/gallery/cardMedia", async (original) => ({ ...(await original<typeof import("@/components/gallery/cardMedia")>()), useSignedMedia: () => new Map() }));
const getGalleryBuildsByIds = vi.hoisted(() => vi.fn(async (ids: string[]) => ids.map((id) => ({ id, slug: id, title: id, nodes: [], media: [], models_used: [] }))));
vi.mock("@/lib/build/gallery", async (original) => ({ ...(await original<typeof import("@/lib/build/gallery")>()), listGallery: async () => ({ builds: [], total: 0 }), getGalleryBuildsByIds }));
const getBuildFeed = vi.hoisted(() => vi.fn());
vi.mock("@/lib/feed/getBuildFeed", async (original) => ({ ...(await original<typeof import("@/lib/feed/getBuildFeed")>()), getBuildFeed }));

type Props = {
  feed: { status: string; items: Array<{ key: string; kind: string; build?: { id: string } }> };
  newCount: number;
  onShowNew: () => void;
  onScopeChange: (scope: "everyone" | "following") => void;
  onPostsNear: (ids: string[]) => void;
  onMeToo: (id: string) => void;
};
const seen: { props: Props | null } = { props: null };
vi.mock("./HomeView", () => ({
  HomeView: (props: Props) => {
    seen.props = props;
    return (
      <div>
        <button onClick={() => props.onScopeChange("following")}>Following</button>
        <output data-testid="status">{props.feed.status}</output>
        <output data-testid="rows">{props.feed.items.map((item) => item.key).join(",")}</output>
        <output data-testid="new">{props.newCount}</output>
      </div>
    );
  },
}));

import { HOME_SEEN_KEY } from "./homeModel";
import { HomePage } from "./HomePage";

const row = (id: string, at: string, over: Partial<BuildFeedRow> = {}) =>
  toFeedItem({
    item_kind: "build", item_at: at, build_id: id, slug: id, title: id, outcome: null, shape: "agent", cover_media_id: null, creator_id: "c1",
    creator_username: "maya", creator_display: null, creator_avatar: null, reproduction_count: 0, rebuild_count: 0, parent_build_id: null,
    source_title_at_fork: null, source_handle_at_fork: null, rebuild_note: null, repro_note: null, repro_model: null, repro_user_username: null,
    status: "published", made_for: null, last_confirmed_at: null, last_confirmed_model: null, cover_bucket: null, cover_path: null, cover_kind: null,
    cover_poster_path: null, repro_worked: null, bounty_id: null, bounty_reward_gbp: null, bounty_gap_title: null, ...over,
  });

function mount() {
  render(
    <HelmetProvider>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<output data-testid="login" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

beforeEach(() => {
  auth.user = { id: "u1" };
  window.localStorage.clear();
  getGalleryBuildsByIds.mockClear();
  getBuildFeed.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Home · Everyone to Following", () => {
  it("keeps Everyone's items on screen, with no loading state, until Following's arrive", async () => {
    let resolveFollowing: (value: unknown) => void = () => {};
    getBuildFeed.mockImplementation(({ onlyFollowing }: { onlyFollowing: boolean }) =>
      onlyFollowing ? new Promise((resolve) => (resolveFollowing = resolve)) : Promise.resolve({ items: [row("a", "2026-10-01T00:00:00Z"), row("b", "2026-09-30T00:00:00Z")], nextBefore: null }),
    );
    mount();
    await waitFor(() => expect(screen.getByTestId("rows").textContent).toBe("build:a:2026-10-01T00:00:00Z,build:b:2026-09-30T00:00:00Z"));

    fireEvent.click(screen.getByText("Following"));
    await waitFor(() => expect(getBuildFeed).toHaveBeenCalledWith(expect.objectContaining({ onlyFollowing: true })));
    expect(screen.getByTestId("status").textContent).toBe("ready");
    expect(screen.getByTestId("rows").textContent).toContain("build:a:");

    await act(async () => resolveFollowing({ items: [row("c", "2026-10-02T00:00:00Z")], nextBefore: null }));
    await waitFor(() => expect(screen.getByTestId("rows").textContent).toBe("build:c:2026-10-02T00:00:00Z"));
  });
});

describe("Home · new since you looked", () => {
  it("holds the items newer than the last visit behind the pill, and adds them at the top when it is chosen", async () => {
    window.localStorage.setItem(HOME_SEEN_KEY, String(Date.parse("2026-10-01T12:00:00Z")));
    getBuildFeed.mockResolvedValue({ items: [row("new", "2026-10-02T00:00:00Z"), row("old", "2026-10-01T00:00:00Z")], nextBefore: null });
    mount();
    await waitFor(() => expect(screen.getByTestId("new").textContent).toBe("1"));
    expect(screen.getByTestId("rows").textContent).toBe("build:old:2026-10-01T00:00:00Z");
    act(() => seen.props!.onShowNew());
    expect(screen.getByTestId("new").textContent).toBe("0");
    expect(screen.getByTestId("rows").textContent).toBe("build:new:2026-10-02T00:00:00Z,build:old:2026-10-01T00:00:00Z");
  });
});

describe("Home · post_doc only where it is seen", () => {
  it("reads the first screen's posts in one request as the feed answers, and the rest in one request per batch as they come near", async () => {
    const items = ["p1", "p2", "p3", "p4", "p5"].map((id, index) => row(id, `2026-10-0${9 - index}T00:00:00Z`));
    items.splice(1, 0, row("n1", "2026-10-08T12:00:00Z", { item_kind: "repro_note", repro_note: "ok" }));
    getBuildFeed.mockResolvedValue({ items, nextBefore: null });
    mount();
    await waitFor(() => expect(getGalleryBuildsByIds).toHaveBeenCalledTimes(1));
    expect(getGalleryBuildsByIds).toHaveBeenCalledWith(["p1", "p2", "p3"]);

    act(() => {
      seen.props!.onPostsNear(["p4"]);
      seen.props!.onPostsNear(["p5"]);
      seen.props!.onPostsNear(["p1", "n1"]);
    });
    await waitFor(() => expect(getGalleryBuildsByIds).toHaveBeenCalledTimes(2));
    expect(getGalleryBuildsByIds).toHaveBeenLastCalledWith(["p4", "p5"]);
  });
});

describe("Home · Me too", () => {
  it("sends a signed-out reader to sign in", async () => {
    auth.user = null;
    getBuildFeed.mockResolvedValue({ items: [], nextBefore: null });
    mount();
    await waitFor(() => expect(seen.props).not.toBeNull());
    act(() => seen.props!.onMeToo("q1"));
    await waitFor(() => expect(screen.getByTestId("login")).toBeTruthy());
  });
});
