// The profile's choice budgets, counted in the rendered page (RC-P21)
// ⟦hicks-law › Enforcing It in the Code⟧.
//
// At most four tabs in the row (Builds, Rebuilds, Solutions, and Drafts on your
// own profile); exactly four figures in the standing row; exactly one filled
// button in the header ⟦von-restorff-effect⟧: Follow or Following on someone
// else's profile, Edit profile on your own; and no sort control.

import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ user: { id: "reader-1" } as { id: string } | null }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: auth.user, profile: null, isLoggedIn: auth.user !== null, loading: false }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
    storage: { from: () => ({ createSignedUrl: vi.fn() }) },
  },
}));

const getProfileSummary = vi.fn();
vi.mock("@/lib/profile/getProfileSummary", () => ({
  getProfileSummary: (...args: unknown[]) => getProfileSummary(...args),
}));
vi.mock("@/lib/profile/makerStats", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/profile/makerStats")>()),
  getMakerStats: vi.fn(async () => ({ builds: 3, reproductionsReceived: 9, rebuildsOfTheirWork: 2, gapsSolved: 1 })),
}));
vi.mock("@/lib/profile/makerBuilds", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/profile/makerBuilds")>()),
  listMakerBuilds: vi.fn(async () => ({ builds: [], next: null })),
  listMakerSolvedBuilds: vi.fn(async () => ({ builds: [], next: null })),
}));
vi.mock("@/hooks/useProfileGameData", () => ({ useProfileGameData: () => ({ data: undefined }) }));
vi.mock("@/components/profile/MatchBanner", () => ({ MatchBanner: () => null }));

import Profile from "@/pages/Profile";
import type { ProfileSummary } from "@/lib/profile/types";

function summary(over: Partial<ProfileSummary>): ProfileSummary {
  return {
    id: "reader-1",
    displayName: "Reader",
    handle: "reader",
    avatarUrl: null,
    coverUrl: null,
    isVerified: false,
    isTrustedSolver: false,
    isPrivate: false,
    level: "reader",
    derivedBio: null,
    customBio: null,
    joinedAt: "2026-01-10T00:00:00.000Z",
    location: null,
    website: null,
    domain: null,
    counts: { followers: 1, following: 1, blueprints: 0, blogs: 0, bounties: 0 },
    isOwnProfile: true,
    isFollowing: null,
    ...over,
  };
}

function renderProfile(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:handle" element={<Profile />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

/** Every choice in the tab row: its tabs, and any link beside them. */
function tabRowChoices(): string[] {
  const row = screen.getByTestId("profile-tab-row");
  return [...row.querySelectorAll('[role="tab"], a')].map((element) => element.textContent ?? "");
}

/**
 * Filled buttons in the header: every primary carries the btn-primary slot
 * (src/lib/theme/controls.ts). jsdom drops var() values from inline styles, so
 * the fill itself is measured in a real browser by e2e/tier3/profile-builds.
 */
function filledInHeader(): HTMLElement[] {
  const header = screen.getByTestId("profile-header");
  return [...header.querySelectorAll<HTMLElement>('[data-visual-slot="btn-primary"]')];
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: "reader-1" };
});

describe("the profile's choice budgets", () => {
  it("has at most four tabs: four on your own profile", async () => {
    getProfileSummary.mockResolvedValue(summary({}));
    renderProfile("/profile");
    await screen.findByTestId("profile-tab-row");

    expect(tabRowChoices()).toEqual(["Builds", "Rebuilds", "Solutions", "Drafts"]);
    expect(tabRowChoices().length).toBeLessThanOrEqual(4);
    expect(within(screen.getByTestId("profile-tab-row")).getAllByRole("tab")).toHaveLength(3);
  });

  it("has at most four tabs: three on someone else's", async () => {
    getProfileSummary.mockResolvedValue(summary({ id: "maker-2", isOwnProfile: false, isFollowing: false }));
    renderProfile("/profile/maren");
    await screen.findByTestId("profile-tab-row");

    expect(tabRowChoices()).toEqual(["Builds", "Rebuilds", "Solutions"]);
  });

  it("has exactly four figures in the standing row", async () => {
    getProfileSummary.mockResolvedValue(summary({}));
    renderProfile("/profile");
    const row = await screen.findByTestId("maker-figures");

    await waitFor(() => expect(within(row).getAllByTestId("maker-figure-value")).toHaveLength(4));
    expect(within(row).getAllByRole("listitem")).toHaveLength(4);
    expect(row.children).toHaveLength(4);
  });

  it("has exactly one filled button in the header on your own profile: Edit profile", async () => {
    getProfileSummary.mockResolvedValue(summary({}));
    renderProfile("/profile");
    await screen.findByTestId("profile-header");

    const filled = filledInHeader();
    expect(filled).toHaveLength(1);
    expect(filled[0].textContent).toBe("Edit profile");
  });

  it("has exactly one filled button in the header on someone else's: Follow", async () => {
    getProfileSummary.mockResolvedValue(summary({ id: "maker-2", isOwnProfile: false, isFollowing: false }));
    renderProfile("/profile/maren");
    await screen.findByTestId("profile-header");

    const filled = filledInHeader();
    expect(filled).toHaveLength(1);
    expect(filled[0].textContent).toBe("Follow");
  });

  it("keeps exactly one filled button once you follow: Following", async () => {
    getProfileSummary.mockResolvedValue(summary({ id: "maker-2", isOwnProfile: false, isFollowing: true }));
    renderProfile("/profile/maren");
    await screen.findByTestId("profile-header");

    const filled = filledInHeader();
    expect(filled).toHaveLength(1);
    expect(filled[0].textContent).toBe("Following");
  });

  it("has no sort control", async () => {
    getProfileSummary.mockResolvedValue(summary({}));
    renderProfile("/profile");
    await screen.findByTestId("profile-tab-row");

    expect(screen.queryAllByRole("button", { name: /sort/i })).toHaveLength(0);
    expect(screen.queryAllByRole("combobox", { name: /sort/i })).toHaveLength(0);
  });
});
