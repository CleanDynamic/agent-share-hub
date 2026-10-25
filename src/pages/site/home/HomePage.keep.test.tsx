// SV-03 P7: a tab change keeps the old content on screen until the new arrives (Everyone to Following).

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" }, loading: false }) }));
vi.mock("@/hooks/useProgressPage", () => ({ useMyWeek: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }) }));
vi.mock("@/lib/build/whereNext", async (original) => ({ ...(await original<typeof import("@/lib/build/whereNext")>()), getWhereNextForViewer: async () => [] }));
vi.mock("@/lib/build/signals", async (original) => ({ ...(await original<typeof import("@/lib/build/signals")>()), countLitToday: async () => 1, countReproducedToday: async () => 1, countRunsThisWeek: async () => 1 }));
vi.mock("@/lib/progress", async (original) => ({ ...(await original<typeof import("@/lib/progress")>()), getStreakDays: async () => [] }));
vi.mock("@/components/gallery/cardMedia", async (original) => ({ ...(await original<typeof import("@/components/gallery/cardMedia")>()), useSignedMedia: () => ({}) }));
const getBuildFeed = vi.fn();
vi.mock("@/lib/feed/getBuildFeed", async (original) => ({ ...(await original<typeof import("@/lib/feed/getBuildFeed")>()), getBuildFeed: (...args: unknown[]) => getBuildFeed(...args) }));
vi.mock("./homeModel", async (original) => ({ ...(await original<typeof import("./homeModel")>()), homeRowOf: (item: { key: string }) => ({ key: item.key }) }));
vi.mock("./HomeView", () => ({
  HomeView: ({ feed, onScopeChange }: { feed: { status: string; rows: Array<{ key: string }> }; onScopeChange: (scope: "everyone" | "following") => void }) => (
    <div>
      <button onClick={() => onScopeChange("following")}>Following</button>
      <output data-testid="status">{feed.status}</output>
      <output data-testid="rows">{feed.rows.map((row) => row.key).join(",")}</output>
    </div>
  ),
}));

import { HomePage } from "./HomePage";

const item = (id: string) => ({ key: id, kind: "build", at: "2026-10-01T00:00:00Z", build: { id, slug: id, title: id, cover: null, media: [], nodes: [] } });
beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Home · Everyone to Following", () => {
  it("keeps Everyone's rows on screen, with no loading state, until Following's arrive", async () => {
    let resolveFollowing: (value: unknown) => void = () => {};
    getBuildFeed.mockImplementation(({ onlyFollowing }: { onlyFollowing: boolean }) =>
      onlyFollowing ? new Promise((resolve) => (resolveFollowing = resolve)) : Promise.resolve({ items: [item("a"), item("b")], nextBefore: null }),
    );
    render(
      <HelmetProvider>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MemoryRouter initialEntries={["/"]}>
            <HomePage />
          </MemoryRouter>
        </QueryClientProvider>
      </HelmetProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("rows").textContent).toBe("a,b"));

    fireEvent.click(screen.getByText("Following"));
    await waitFor(() => expect(getBuildFeed).toHaveBeenCalledWith(expect.objectContaining({ onlyFollowing: true })));
    expect(screen.getByTestId("status").textContent).toBe("ready");
    expect(screen.getByTestId("rows").textContent).toBe("a,b");

    await act(async () => resolveFollowing({ items: [item("c")], nextBefore: null }));
    await waitFor(() => expect(screen.getByTestId("rows").textContent).toBe("c"));
  });
});
