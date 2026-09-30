// RC-P21 — the profile, rendered.
//
// The claims: a maker's standing is four figures from one getMakerStats call;
// the tabs are Builds, Rebuilds and Solutions (and a Drafts link on your own
// profile), each the gallery's own cards counted by one engagement request for
// the whole list, each in the address; each empty tab is one sentence and at
// most one secondary action; a refused read says so; and the legacy zones'
// filters and sort menu are gone. The data layer is stubbed at
// src/lib/profile and src/lib/social; the page and the cards are real.

import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  user: { id: "maker-1" } as { id: string } | null,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: auth.user, profile: null, isLoggedIn: auth.user !== null, loading: false }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
    storage: { from: () => ({ createSignedUrl: vi.fn(), upload: vi.fn(), getPublicUrl: vi.fn() }) },
  },
}));

const getEngagementCounts = vi.fn(async () => ({}));
vi.mock("@/lib/social", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/social")>()),
  getEngagementCounts: (...args: unknown[]) => getEngagementCounts(...(args as [])),
  getMyLikes: vi.fn(async () => new Set()),
  getMySaves: vi.fn(async () => new Set()),
}));

const getProfileSummary = vi.fn();
vi.mock("@/lib/profile/getProfileSummary", () => ({
  getProfileSummary: (...args: unknown[]) => getProfileSummary(...args),
}));

const getMakerStats = vi.fn();
vi.mock("@/lib/profile/makerStats", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/profile/makerStats")>()),
  getMakerStats: (...args: unknown[]) => getMakerStats(...args),
}));

const listMakerBuilds = vi.fn();
const listMakerSolvedBuilds = vi.fn();
vi.mock("@/lib/profile/makerBuilds", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/profile/makerBuilds")>()),
  listMakerBuilds: (...args: unknown[]) => listMakerBuilds(...args),
  listMakerSolvedBuilds: (...args: unknown[]) => listMakerSolvedBuilds(...args),
}));

vi.mock("@/hooks/useProfileGameData", () => ({ useProfileGameData: () => ({ data: undefined }) }));
vi.mock("@/components/profile/MatchBanner", () => ({ MatchBanner: () => null }));

import Profile from "@/pages/Profile";
import type { GalleryBuild } from "@/lib/build/gallery";
import { MakerStatsError } from "@/lib/profile/makerStats";
import type { ProfileSummary } from "@/lib/profile/types";
import { parkedEntryPoints } from "@/test/parkedEntryPoints";

function summary(over: Partial<ProfileSummary> = {}): ProfileSummary {
  return {
    id: "maker-1",
    displayName: "Maren",
    handle: "maren",
    avatarUrl: null,
    coverUrl: null,
    isVerified: false,
    isTrustedSolver: false,
    isPrivate: false,
    derivedBio: null,
    customBio: null,
    joinedAt: "2026-01-10T00:00:00.000Z",
    location: null,
    website: null,
    domain: null,
    counts: { followers: 12, following: 3 },
    isOwnProfile: true,
    isFollowing: null,
    ...over,
  };
}

function card(n: number): GalleryBuild {
  return {
    id: `build-${n}`,
    creator_id: "maker-1",
    slug: `build-${n}`,
    title: `Build ${n}`,
    outcome: "Does a thing.",
    shape: "other",
    status: "published",
    made_for: [],
    made_with: [],
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    cover_media_id: null,
    completeness: 90,
    reproduction_count: 3,
    last_confirmed_at: null,
    last_confirmed_model: null,
    published_at: "2026-09-01T00:00:00.000Z",
    parent_build_id: null,
    rebuild_count: 0,
    rebuild_note: null,
    source_title_at_fork: null,
    source_handle_at_fork: null,
    nodes: [],
    media: [],
    bounties: [],
  };
}

function Where() {
  const location = useLocation();
  return <span data-testid="where">{`${location.pathname}${location.search}`}</span>;
}

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Where />
          <Routes>
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:handle" element={<Profile />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

const cardTitles = () =>
  screen.getAllByTestId("profile-card").map((item) => within(item).getByRole("heading").textContent);

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: "maker-1" };
  getProfileSummary.mockResolvedValue(summary());
  getMakerStats.mockResolvedValue({ builds: 3, reproductionsReceived: 1204, rebuildsOfTheirWork: 7, gapsSolved: 2 });
  listMakerBuilds.mockResolvedValue({ builds: [], next: null });
  listMakerSolvedBuilds.mockResolvedValue({ builds: [], next: null });
});

describe("Profile", () => {
  it("draws the four figures from one getMakerStats call, for the maker being read", async () => {
    getProfileSummary.mockResolvedValue(summary({ id: "maker-2", isOwnProfile: false, isFollowing: false }));
    renderAt("/profile/maren");

    const row = await screen.findByTestId("maker-figures");
    await waitFor(() =>
      expect(within(row).getAllByTestId("maker-figure-value").map((value) => value.textContent)).toEqual([
        "3",
        "1,204",
        "7",
        "2",
      ]),
    );
    expect(within(row).getAllByTestId("maker-figure").map((figure) => figure.lastElementChild?.textContent)).toEqual([
      "builds",
      "got working by others",
      "rebuilt by others",
      "gaps solved",
    ]);
    expect(getMakerStats).toHaveBeenCalledTimes(1);
    expect(getMakerStats).toHaveBeenCalledWith("maker-2");
  });

  it("gives the header's two earned numbers the same answer as the figures row", async () => {
    renderAt("/profile");

    const header = await screen.findByTestId("profile-header");
    await waitFor(() => expect(header.textContent).toContain("1204 reproduced"));
    expect(header.textContent).toContain("rebuilt 7 times");
    expect(getMakerStats).toHaveBeenCalledTimes(1);
  });

  it("opens on Builds: the maker's builds as the gallery's cards, counted in one engagement request", async () => {
    listMakerBuilds.mockResolvedValue({ builds: [card(1), card(2), card(3)], next: null });
    renderAt("/profile");

    await waitFor(() => expect(screen.getAllByTestId("profile-card")).toHaveLength(3));
    expect(cardTitles()).toEqual(["Build 1", "Build 2", "Build 3"]);
    expect(screen.getAllByTestId("profile-card")[0].querySelector('[data-visual-slot="gallery-card"]')).not.toBeNull();
    expect(listMakerBuilds).toHaveBeenCalledWith("maker-1", { rebuildsOnly: false, after: null });
    await waitFor(() => expect(getEngagementCounts).toHaveBeenCalledTimes(1));
    expect(getEngagementCounts).toHaveBeenCalledWith(["build-1", "build-2", "build-3"]);
  });

  it("asks for the next page from the last card's cursor, with a secondary Show more", async () => {
    const next = { reproductionCount: 3, lastConfirmedAt: null, publishedAt: "2026-09-01T00:00:00.000Z", id: "build-1" };
    listMakerBuilds.mockResolvedValueOnce({ builds: [card(1)], next }).mockResolvedValueOnce({ builds: [card(2)], next: null });
    renderAt("/profile");

    const more = await screen.findByRole("button", { name: "Show more" });
    expect(more.getAttribute("data-visual-slot")).toBe("btn-secondary");
    fireEvent.click(more);
    await waitFor(() => expect(screen.getAllByTestId("profile-card")).toHaveLength(2));
    expect(listMakerBuilds).toHaveBeenLastCalledWith("maker-1", { rebuildsOnly: false, after: next });
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("keeps the tab in the address, and each tab asks for its own list", async () => {
    renderAt("/profile");
    await screen.findByTestId("profile-empty-builds");

    fireEvent.click(screen.getByRole("tab", { name: "Rebuilds" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/profile?tab=rebuilds"));
    await waitFor(() => expect(listMakerBuilds).toHaveBeenCalledWith("maker-1", { rebuildsOnly: true, after: null }));
    expect(screen.getByRole("tab", { name: "Rebuilds" }).getAttribute("aria-selected")).toBe("true");

    fireEvent.click(screen.getByRole("tab", { name: "Solutions" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/profile?tab=solutions"));
    await waitFor(() => expect(listMakerSolvedBuilds).toHaveBeenCalledWith("maker-1", { after: null }));

    fireEvent.click(screen.getByRole("tab", { name: "Builds" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/profile"));
  });

  it("offers Drafts, as a link to /drafts, on your own profile only", async () => {
    const own = renderAt("/profile");
    const link = await screen.findByTestId("profile-drafts-link");
    expect(link.getAttribute("href")).toBe("/drafts");
    expect(link.getAttribute("role")).toBeNull();
    own.unmount();

    getProfileSummary.mockResolvedValue(summary({ id: "maker-2", isOwnProfile: false, isFollowing: false }));
    renderAt("/profile/maren");
    await screen.findByTestId("profile-empty-builds");
    expect(screen.queryByTestId("profile-drafts-link")).toBeNull();
  });

  it("says so on your own empty Builds tab, with a secondary New build", async () => {
    renderAt("/profile");
    const empty = await screen.findByTestId("profile-empty-builds");

    expect(empty.textContent).toContain("You haven't published a build yet.");
    const action = within(empty).getByRole("link", { name: "New build" });
    expect(action.getAttribute("href")).toBe("/compose/new");
    expect(action.getAttribute("data-visual-slot")).toBe("btn-secondary");
  });

  it("says so on someone else's empty Builds tab, with no action", async () => {
    getProfileSummary.mockResolvedValue(summary({ id: "maker-2", isOwnProfile: false, isFollowing: false }));
    renderAt("/profile/maren");
    const empty = await screen.findByTestId("profile-empty-builds");

    expect(empty.textContent).toBe("Nothing published yet.");
    expect(within(empty).queryAllByRole("link")).toHaveLength(0);
    expect(within(empty).queryAllByRole("button")).toHaveLength(0);
  });

  it("says so on an empty Rebuilds tab", async () => {
    renderAt("/profile?tab=rebuilds");
    expect((await screen.findByTestId("profile-empty-rebuilds")).textContent).toBe("No rebuilds yet.");
  });

  it("says so on an empty Solutions tab, and points your own profile at the open bounties", async () => {
    const own = renderAt("/profile?tab=solutions");
    const empty = await screen.findByTestId("profile-empty-solutions");
    expect(empty.textContent).toContain("No solved gaps yet.");
    expect(within(empty).getByRole("link", { name: "See open bounties" }).getAttribute("href")).toBe("/bounties");
    own.unmount();

    getProfileSummary.mockResolvedValue(summary({ id: "maker-2", isOwnProfile: false, isFollowing: false }));
    renderAt("/profile/maren?tab=solutions");
    const theirs = await screen.findByTestId("profile-empty-solutions");
    expect(theirs.textContent).toBe("No solved gaps yet.");
    expect(within(theirs).queryAllByRole("link")).toHaveLength(0);
  });

  it("says a refused figures read is a refusal, and offers Try again", async () => {
    getMakerStats.mockRejectedValue(new MakerStatsError("maker-1", "42501", 403));
    renderAt("/profile");

    const refusal = await screen.findByTestId("maker-figures-error");
    expect(refusal.textContent).toContain("You don't have access to this.");
    fireEvent.click(within(refusal).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(getMakerStats).toHaveBeenCalledTimes(2));
  });

  it("says a failed tab read went wrong, never that the maker has nothing", async () => {
    listMakerBuilds.mockRejectedValue(new Error("listMakerBuilds failed (user maker-1)"));
    renderAt("/profile");

    const failed = await screen.findByTestId("profile-tab-error");
    expect(failed.textContent).toContain("Something went wrong.");
    expect(screen.queryByTestId("profile-empty-builds")).toBeNull();
  });

  it("has none of the old zones: no legacy filters and no sort menu", async () => {
    renderAt("/profile");
    await screen.findByTestId("profile-empty-builds");

    for (const gone of ["Blueprints", "Blogs", "Reblogs", "Bounties", "Ratings", "Verifications", "Collections", "Activity", "Network"]) {
      expect(screen.queryByRole("tab", { name: gone })).toBeNull();
      expect(screen.queryByRole("button", { name: gone })).toBeNull();
    }
    expect(screen.queryAllByRole("button", { name: /sort/i })).toHaveLength(0);
  });

  /* RC-P28a — the header speaks the build model only: the two counts of people
     as text, and no legacy post counts, no blueprint ladder chip. */
  it("counts people in the header, as text, and says nothing of the legacy post model", async () => {
    renderAt("/profile");
    const header = await screen.findByTestId("profile-header");
    const counts = within(header).getByTestId("profile-counts");

    expect(counts.textContent).toBe("12followers3following");
    expect(within(counts).queryAllByRole("button")).toHaveLength(0);
    for (const legacy of [/blueprint/i, /\bblogs?\b/i, /\bbounties\b/i, /\bBUILDER\b/, /\bCREATOR\b/, /\bSAGE\b/]) {
      expect(header.textContent).not.toMatch(legacy);
    }
  });

  /* RC-P28 — guilds, leaderboards and reputation are parked: no profile offers
     a way into any of them, your own or someone else's. */
  it("offers no way into guilds, leaderboards or reputation, on your own profile or someone else's", async () => {
    listMakerBuilds.mockResolvedValue({ builds: [card(1)], next: null });
    const own = renderAt("/profile");
    await waitFor(() => expect(screen.getAllByTestId("profile-card")).toHaveLength(1));
    await waitFor(() => expect(screen.getAllByTestId("maker-figure-value")).toHaveLength(4));
    expect(parkedEntryPoints(document.body)).toEqual([]);
    own.unmount();

    getProfileSummary.mockResolvedValue(summary({ id: "maker-2", isOwnProfile: false, isFollowing: false }));
    renderAt("/profile/maren");
    await waitFor(() => expect(screen.getAllByTestId("profile-card")).toHaveLength(1));
    await waitFor(() => expect(screen.getAllByTestId("maker-figure-value")).toHaveLength(4));
    expect(parkedEntryPoints(document.body)).toEqual([]);
  });
});
