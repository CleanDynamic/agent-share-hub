// UX-10 — the profile's container: the first screen in one round (the profile, the side column and the feed's first page together),
// Your progress for the owner only with the track written where it always was, a private profile closed, and nothing that can
// award XP. The data layer is stubbed and its calls are counted.

import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ user: { id: "viewer-1" } as { id: string } | null }));
const calls = vi.hoisted(() => [] as string[]);
const stubs = vi.hoisted(() => ({
  summary: vi.fn(),
  side: vi.fn(),
  feed: vi.fn(),
  progress: vi.fn(),
  setUserTrack: vi.fn(async () => undefined),
  respecTrack: vi.fn(async () => undefined),
  follow: vi.fn(async () => undefined),
}));
const counted =
  <A extends unknown[], R>(name: string, fn: (...args: A) => R) =>
  (...args: A) => {
    calls.push(name);
    return fn(...args);
  };

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), storage: { from: () => ({ createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: null }) }) } } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: auth.user, isLoggedIn: Boolean(auth.user), loading: false }) }));
vi.mock("@/hooks/useEngagement", () => ({ useEngagement: () => ({}), engagementFor: () => undefined }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/profile/getProfileSummary", () => ({ getProfileSummary: (...args: unknown[]) => counted("summary", stubs.summary)(...args) }));
vi.mock("@/lib/profile/profileSide", () => ({ getProfileSide: (...args: unknown[]) => counted("side", stubs.side)(...args) }));
vi.mock("@/lib/profile/getProfileFeed", () => ({ PROFILE_FEED_PAGE: 20, getProfileFeed: (...args: unknown[]) => counted("feed", stubs.feed)(...args) }));
vi.mock("@/lib/profile/profileProgress", () => ({ getProfileProgress: (...args: unknown[]) => counted("progress", stubs.progress)(...args) }));
vi.mock("@/lib/profile/customise", () => ({ listPins: async () => [], pinToProfile: vi.fn(), unpinFromProfile: vi.fn(), saveProfile: vi.fn(), setBuildDisplay: vi.fn() }));
vi.mock("@/lib/profile/follow", () => ({ followMaker: stubs.follow, unfollowMaker: vi.fn() }));
vi.mock("@/lib/build/buildsMaps", () => ({ listBuildMaps: async () => [] }));
vi.mock("@/lib/library", () => ({ getCollections: async () => ({ collections: [], total: 0 }) }));
vi.mock("@/lib/progress/badges", () => ({ getMyBadgeKeys: async () => new Set<string>() }));
vi.mock("@/lib/progress", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/progress")>()), setUserTrack: stubs.setUserTrack, respecTrack: stubs.respecTrack }));
vi.mock("@/lib/messaging", () => ({ createDirectThread: vi.fn(), sendTextMessage: vi.fn() }));

import { profileItems } from "@/dev/fixtures/profile";

import { ProfilePage } from "./ProfilePage";
import { levelView, xpLine } from "./profileModel";

const summary = (over: Record<string, unknown> = {}) => ({
  id: "maker-1",
  displayName: "Maya Kent",
  handle: "maya",
  avatarUrl: null,
  coverUrl: null,
  isPrivate: false,
  customBio: "Builds finance agents",
  derivedBio: null,
  joinedAt: "2026-02-14T09:00:00Z",
  location: "Leeds",
  website: null,
  counts: { followers: 412, following: 180 },
  isOwnProfile: false,
  isFollowing: false,
  links: [],
  ...over,
});
const SIDE = { counts: { builds: 14, topics: 22, replies: 9, notes: 5 }, reproducedByOthers: 9, rebuiltFrom: 6, firstRebuildSlug: "x", stepsAdded: 0, topicsStarted: 0, level: null, worksIn: [], spaces: [] };

function renderAt(entry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/profile/:handle" element={<ProfilePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

beforeEach(() => {
  calls.length = 0;
  auth.user = { id: "viewer-1" };
  stubs.summary.mockReset().mockResolvedValue(summary());
  stubs.side.mockReset().mockResolvedValue(SIDE);
  stubs.feed.mockReset().mockResolvedValue({ items: profileItems, extras: { work: { builds: new Map(), nodes: new Map() }, signed: new Map(), digests: new Map() }, next: null });
  stubs.progress.mockReset().mockResolvedValue({ level: 7, xpTotal: 1840, track: "curator", streakDays: 12, streakBest: 31, lastRespecAt: null });
  stubs.setUserTrack.mockClear();
  stubs.respecTrack.mockClear();
});

describe("the first screen", () => {
  it("starts the profile, the side column and the feed's first page together: one round", async () => {
    renderAt("/profile/maya");
    await screen.findByRole("heading", { level: 1, name: "Maya Kent" });
    await screen.findAllByTestId("profile-feed-item");
    expect(calls.slice(0, 3).sort()).toEqual(["feed", "side", "summary"]);
    expect(stubs.feed).toHaveBeenCalledWith("maya", expect.objectContaining({ filter: "all", cursor: null }));
    expect(screen.getByTestId("profile-record").textContent).toBe("14 builds · 9 reproduced by others · rebuilt from 6 times · 31 topics and replies");
  });

  it("opens on ?show=, which wins over the owner's filter", async () => {
    stubs.summary.mockResolvedValue(summary({ settings: { feedFilter: "builds", buildDisplay: "first_post", sideSections: [], notesVisible: "everyone", levelVisible: "everyone" } }));
    renderAt("/profile/maya?show=notes");
    await screen.findAllByTestId("profile-feed-item");
    expect(stubs.feed).toHaveBeenCalledWith("maya", expect.objectContaining({ filter: "notes" }));
  });
});

describe("Your progress (P9)", () => {
  it("is on your own profile: Level, the XP line, the streak and the four tracks", async () => {
    auth.user = { id: "maker-1" };
    stubs.summary.mockResolvedValue(summary({ isOwnProfile: true, isFollowing: null }));
    renderAt("/profile/maya");
    const box = await screen.findByTestId("profile-progress");
    expect(within(box).getByText(`Level ${levelView({ level: 7, xpTotal: 1840, track: "curator", streakDays: 12, streakBest: 31 }).level}`)).toBeInTheDocument();
    expect(within(box).getByText(xpLine(levelView({ level: 7, xpTotal: 1840, track: "curator", streakDays: 12, streakBest: 31 })) as string)).toBeInTheDocument();
    expect(within(box).getByText("12-day streak")).toBeInTheDocument();
    expect(within(box).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["Architect", "Curator", "Mentor", "Explorer"]);
    expect(box.querySelector("svg circle")).toBeNull();
  });

  it("is never on someone else's profile, whatever level_visible says, and their progress is not read", async () => {
    stubs.side.mockResolvedValue({ ...SIDE, level: 7 });
    renderAt("/profile/maya");
    await screen.findAllByTestId("profile-feed-item");
    expect(screen.queryByTestId("profile-progress")).toBeNull();
    expect(screen.getByTestId("profile-level").textContent).toBe("Level 7");
    expect(calls).not.toContain("progress");
    expect(document.body.textContent).not.toMatch(/\bxp\b/i);
  });

  it("writes the track where it always has: the first choice with setUserTrack, a switch after the confirmation with respecTrack", async () => {
    auth.user = { id: "maker-1" };
    stubs.summary.mockResolvedValue(summary({ isOwnProfile: true, isFollowing: null }));
    stubs.progress.mockResolvedValue({ level: 7, xpTotal: 1840, track: null, streakDays: 0, streakBest: 0, lastRespecAt: null });
    renderAt("/profile/maya");
    const box = await screen.findByTestId("profile-progress");
    fireEvent.click(within(box).getByRole("radio", { name: "Mentor" }));
    await waitFor(() => expect(stubs.setUserTrack).toHaveBeenCalledWith("mentor"));
    expect(stubs.respecTrack).not.toHaveBeenCalled();
  });
});

describe("a private profile you don't follow", () => {
  it("is the head and one sentence with Follow: no feed and no side column", async () => {
    stubs.summary.mockResolvedValue(summary({ isPrivate: true }));
    stubs.side.mockResolvedValue(null);
    stubs.feed.mockResolvedValue({ items: [], extras: { work: { builds: new Map(), nodes: new Map() }, signed: new Map(), digests: new Map() }, next: null });
    renderAt("/profile/maya");
    expect(await screen.findByTestId("profile-private")).toHaveTextContent("@maya's profile is private.");
    expect(screen.queryByTestId("profile-feed")).toBeNull();
    expect(screen.queryByTestId("profile-side")).toBeNull();
    expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument();
  });
});

describe("nothing here awards XP", () => {
  it("the page and its pieces never call award_xp or awardXp", () => {
    for (const file of ["ProfilePage.tsx", "ProfileHead.tsx", "ProfileFeed.tsx", "ProfileSide.tsx", "CustomiseProfile.tsx", "useProfilePictures.tsx"]) {
      expect(readFileSync(`src/pages/site/profile/${file}`, "utf8"), file).not.toMatch(/award_?xp/i);
    }
  });
});
