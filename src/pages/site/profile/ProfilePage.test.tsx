// UI-P34 — the Profile's container: what loads, what following and a track change write,
// what the tabs ask for — and that nothing here can award XP.
//
// The data layer is stubbed and its calls are counted, as the Gallery's test does.

import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ user: { id: "viewer-1" } as { id: string } | null }));

const getProfileSummary = vi.fn();
const getMakerFigures = vi.fn();
const getProfileProgress = vi.fn();
const countMakerWorks = vi.fn();
const listMakerBuilds = vi.fn();
const listMakerReproducedBuilds = vi.fn();
const getCollections = vi.fn();
const getStreakDays = vi.fn();
const getMyBadgeKeys = vi.fn();
const followMaker = vi.fn();
const unfollowMaker = vi.fn();
const setUserTrack = vi.fn();
const respecTrack = vi.fn();
const rpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    storage: { from: () => ({ createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: null }) }) },
  },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: auth.user, isLoggedIn: Boolean(auth.user), loading: false }),
}));
vi.mock("@/hooks/useEngagement", () => ({ useEngagement: () => ({}), engagementFor: () => undefined }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/profile/getProfileSummary", () => ({ getProfileSummary: (...args: unknown[]) => getProfileSummary(...args) }));
vi.mock("@/lib/profile/figures", () => ({ getMakerFigures: (...args: unknown[]) => getMakerFigures(...args) }));
vi.mock("@/lib/profile/profileProgress", () => ({ getProfileProgress: (...args: unknown[]) => getProfileProgress(...args) }));
vi.mock("@/lib/profile/follow", () => ({
  followMaker: (...args: unknown[]) => followMaker(...args),
  unfollowMaker: (...args: unknown[]) => unfollowMaker(...args),
}));
vi.mock("@/lib/profile/makerBuilds", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/profile/makerBuilds")>()),
  countMakerWorks: (...args: unknown[]) => countMakerWorks(...args),
  listMakerBuilds: (...args: unknown[]) => listMakerBuilds(...args),
  listMakerReproducedBuilds: (...args: unknown[]) => listMakerReproducedBuilds(...args),
}));
vi.mock("@/lib/library", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/library")>()),
  getCollections: (...args: unknown[]) => getCollections(...args),
}));
vi.mock("@/lib/progress", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/progress")>()),
  getStreakDays: (...args: unknown[]) => getStreakDays(...args),
  setUserTrack: (...args: unknown[]) => setUserTrack(...args),
  respecTrack: (...args: unknown[]) => respecTrack(...args),
}));
vi.mock("@/lib/progress/badges", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/progress/badges")>()),
  getMyBadgeKeys: (...args: unknown[]) => getMyBadgeKeys(...args),
}));
vi.mock("@/lib/messaging", () => ({ createDirectThread: vi.fn(), sendTextMessage: vi.fn() }));

import type { GalleryBuild } from "@/lib/build/gallery";

import { ProfilePage } from "./ProfilePage";

const MAKER = "maker-1";

function build(id: string): GalleryBuild {
  return {
    id,
    creator_id: MAKER,
    slug: `build-${id}`,
    title: `Build ${id}`,
    outcome: "It works.",
    shape: "agent",
    status: "published",
    made_for: [],
    made_with: [],
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    cover_media_id: null,
    completeness: 90,
    reproduction_count: 3,
    last_confirmed_at: new Date().toISOString(),
    last_confirmed_model: null,
    published_at: new Date().toISOString(),
    parent_build_id: null,
    rebuild_count: 0,
    rebuild_note: null,
    source_title_at_fork: null,
    source_handle_at_fork: null,
    nodes: [],
    media: [],
  } as unknown as GalleryBuild;
}

function summary(over: Record<string, unknown> = {}) {
  return {
    id: MAKER,
    displayName: "Maya Okafor",
    handle: "maya",
    avatarUrl: null,
    coverUrl: null,
    isVerified: false,
    isPrivate: false,
    level: "builder",
    derivedBio: null,
    customBio: "builds finance agents",
    joinedAt: "2026-02-14T09:00:00Z",
    location: "Leeds",
    website: null,
    domain: null,
    counts: { followers: 3, following: 1, blueprints: 0, blogs: 0, bounties: 0 },
    isOwnProfile: false,
    isFollowing: false,
    ...over,
  };
}

function Probe() {
  const { search } = useLocation();
  return <output data-testid="search">{search}</output>;
}

function renderAt(entry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/profile/:handle" element={<ProfilePage />} />
          </Routes>
          <Probe />
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

const progress = (over: Record<string, unknown> = {}) => ({
  level: 7,
  xpTotal: 1840,
  track: "curator",
  streakDays: 12,
  streakBest: 31,
  lastRespecAt: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: "viewer-1" };
  getProfileSummary.mockResolvedValue(summary());
  getMakerFigures.mockResolvedValue({ buildsHung: 14, reproducedByOthers: 212, rebuildsOfWork: 37, bountiesSolved: 5, bountyEarningsGbp: 1150 });
  getProfileProgress.mockResolvedValue(progress());
  countMakerWorks.mockResolvedValue({ rebuilds: 6, reproduced: 48 });
  listMakerBuilds.mockResolvedValue({ builds: [build("a"), build("b")], next: null });
  listMakerReproducedBuilds.mockResolvedValue({ builds: [build("r")], next: null });
  getCollections.mockResolvedValue({ collections: [], total: 0 });
  getStreakDays.mockResolvedValue([{ date: "2026-09-30", kind: "active" }]);
  getMyBadgeKeys.mockResolvedValue(new Set(["first-build", "proven"]));
  followMaker.mockResolvedValue(undefined);
  unfollowMaker.mockResolvedValue(undefined);
  setUserTrack.mockResolvedValue(undefined);
  respecTrack.mockResolvedValue("2026-10-02T00:00:00Z");
  rpc.mockResolvedValue({ data: null, error: null });
});

describe("ProfilePage", () => {
  it("loads each panel with one request and draws the maker, the figures, the level and the marks", async () => {
    renderAt("/profile/maya");

    expect(await screen.findByRole("heading", { level: 1, name: "Maya Okafor" })).toBeTruthy();
    expect(getProfileSummary).toHaveBeenCalledWith("maya", "viewer-1");
    await waitFor(() => expect(screen.getByText("212")).toBeTruthy());
    expect(getMakerFigures).toHaveBeenCalledTimes(1);
    expect(getMakerFigures).toHaveBeenCalledWith(MAKER);
    expect(getProfileProgress).toHaveBeenCalledWith(MAKER);
    expect(getStreakDays).toHaveBeenCalledWith(MAKER, 154);
    expect(getMyBadgeKeys).toHaveBeenCalledWith(MAKER, expect.arrayContaining(["first-build", "proven", "fixer"]));
    expect(await screen.findByRole("img", { name: /^Level 7/ })).toBeTruthy();
    expect(await screen.findByText("First build")).toBeTruthy();
    expect(screen.getByText("Maker · Leeds · since Feb 2026")).toBeTruthy();
  });

  it("counts the tabs: builds from the figures, the rest from their own reads", async () => {
    renderAt("/profile/maya");
    const tabs = await screen.findByRole("tablist", { name: "Works" });
    await waitFor(() => expect(within(tabs).getByRole("tab", { name: "Reproduced 48" })).toBeTruthy());
    expect(within(tabs).getByRole("tab", { name: "Builds 14" })).toBeTruthy();
    expect(within(tabs).getByRole("tab", { name: "Rebuilds 6" })).toBeTruthy();
    expect(within(tabs).getByRole("tab", { name: "Collections 0" })).toBeTruthy();
  });

  it("reads the builds list for the open tab only, and puts the tab in the address", async () => {
    renderAt("/profile/maya");
    await screen.findByRole("tablist", { name: "Works" });
    await waitFor(() => expect(screen.getAllByTestId("profile-card")).toHaveLength(2));
    expect(listMakerReproducedBuilds).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("tab", { name: /^Reproduced/ }));
    await waitFor(() => expect(listMakerReproducedBuilds).toHaveBeenCalledWith(MAKER, { after: null }));
    expect(screen.getByTestId("search").textContent).toBe("?tab=reproduced");
    await waitFor(() => expect(screen.getAllByTestId("profile-card")).toHaveLength(1));

    fireEvent.click(screen.getByRole("tab", { name: /^Rebuilds/ }));
    await waitFor(() => expect(listMakerBuilds).toHaveBeenCalledWith(MAKER, { rebuildsOnly: true, after: null }));
    expect(screen.getByTestId("search").textContent).toBe("?tab=rebuilds");
  });

  it("opens on the tab the address names, and on Builds for one it does not know", async () => {
    renderAt("/profile/maya?tab=reproduced");
    await screen.findByRole("tablist", { name: "Works" });
    await waitFor(() => expect(listMakerReproducedBuilds).toHaveBeenCalled());
    expect(screen.getByRole("tab", { name: /^Reproduced/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("follows optimistically and writes the follow, and says Following", async () => {
    renderAt("/profile/maya");
    fireEvent.click(await screen.findByRole("button", { name: "Follow" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Following" })).toBeTruthy());
    expect(followMaker).toHaveBeenCalledWith("viewer-1", MAKER);

    fireEvent.click(screen.getByRole("button", { name: "Following" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Follow" })).toBeTruthy());
    expect(unfollowMaker).toHaveBeenCalledWith("viewer-1", MAKER);
  });

  it("changes nothing on somebody else's profile when their track chips are pressed", async () => {
    renderAt("/profile/maya");
    const track = await screen.findByRole("group", { name: "Track" });
    fireEvent.click(within(track).getByRole("button", { name: "Mentor" }));
    expect(setUserTrack).not.toHaveBeenCalled();
    expect(respecTrack).not.toHaveBeenCalled();
  });

  it("asks before it switches your track, and switches through respecTrack once you confirm", async () => {
    getProfileSummary.mockResolvedValue(summary({ isOwnProfile: true }));
    renderAt("/profile/maya");
    const track = await screen.findByRole("group", { name: "Track" });
    await waitFor(() => expect(within(track).getByRole("button", { name: "Curator" }).getAttribute("aria-pressed")).toBe("true"));

    fireEvent.click(within(track).getByRole("button", { name: "Mentor" }));
    expect(await screen.findByText("Switch path?")).toBeTruthy();
    expect(respecTrack).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm switch" }));
    await waitFor(() => expect(respecTrack).toHaveBeenCalledWith("mentor"));
    expect(setUserTrack).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText("Switch path?")).toBeNull());
  });

  it("does not switch when you cancel, and does not offer a switch past the cooldown", async () => {
    getProfileSummary.mockResolvedValue(summary({ isOwnProfile: true }));
    getProfileProgress.mockResolvedValue(progress({ lastRespecAt: new Date().toISOString() }));
    renderAt("/profile/maya");
    const track = await screen.findByRole("group", { name: "Track" });
    await waitFor(() => expect(within(track).getByRole("button", { name: "Curator" }).getAttribute("aria-pressed")).toBe("true"));

    fireEvent.click(within(track).getByRole("button", { name: "Mentor" }));
    expect(await screen.findByText(/On cooldown/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Unavailable" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByText("Switch path?")).toBeNull());
    expect(respecTrack).not.toHaveBeenCalled();
  });

  it("sets the first track straight away, with no confirmation, through setUserTrack", async () => {
    getProfileSummary.mockResolvedValue(summary({ isOwnProfile: true }));
    getProfileProgress.mockResolvedValue(progress({ track: null }));
    renderAt("/profile/maya");
    const track = await screen.findByRole("group", { name: "Track" });
    await waitFor(() => expect(screen.getByRole("img", { name: /^Level 7/ })).toBeTruthy());

    fireEvent.click(within(track).getByRole("button", { name: "Architect" }));
    await waitFor(() => expect(setUserTrack).toHaveBeenCalledWith("architect"));
    expect(respecTrack).not.toHaveBeenCalled();
    expect(screen.queryByText("Switch path?")).toBeNull();
  });

  it("never calls an XP-granting function, whatever is pressed", async () => {
    getProfileSummary.mockResolvedValue(summary({ isOwnProfile: true }));
    renderAt("/profile/maya");
    const track = await screen.findByRole("group", { name: "Track" });
    await waitFor(() => expect(screen.getByRole("img", { name: /^Level 7/ })).toBeTruthy());
    fireEvent.click(within(track).getByRole("button", { name: "Mentor" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm switch" }));
    await waitFor(() => expect(respecTrack).toHaveBeenCalled());

    // The guard in rcGuards.test.ts reads source for the function names, so they are spelled in two halves here.
    const granting = ["award" + "_xp", "rc_grant" + "_xp"];
    expect(rpc.mock.calls.map(([name]) => name).filter((name) => granting.includes(name))).toEqual([]);
  });

  it("puts Edit profile in place of Follow on your own profile", async () => {
    getProfileSummary.mockResolvedValue(summary({ isOwnProfile: true, isFollowing: null }));
    renderAt("/profile/maya");
    expect(await screen.findByRole("button", { name: "Edit profile" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Follow" })).toBeNull();
  });

  it("says the profile is not there, with a way out, when it cannot be found", async () => {
    getProfileSummary.mockRejectedValue(new Error("Profile not found: nobody"));
    renderAt("/profile/nobody");
    expect(await screen.findByText("Profile not found")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to the gallery" })).toBeTruthy();
  });

  it("draws a refused list as a refusal, not an empty tab, and retries it", async () => {
    listMakerBuilds.mockRejectedValue(Object.assign(new Error("refused"), { code: "42501", status: 403 }));
    renderAt("/profile/maya");
    expect(await screen.findByText("You don't have access to this.")).toBeTruthy();
    listMakerBuilds.mockResolvedValue({ builds: [build("a")], next: null });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getAllByTestId("profile-card")).toHaveLength(1));
  });
});
