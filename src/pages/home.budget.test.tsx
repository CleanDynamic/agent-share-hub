// Home's choice budgets, counted in the rendered page (RC-P11)
// ⟦hicks-law › Enforcing It in the Code⟧.
//
// Exactly two tabs, at most one filled button, and none of the retired tabs'
// names anywhere: Trending, For you and Bounties were Home's tabs, and a
// budget test that only counted would not notice one of them coming back
// under the same count.

import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const countFollowing = vi.fn();
const getBuildFeed = vi.fn();

vi.mock("@/lib/profile/followCount", () => ({
  countFollowing: (userId: string) => countFollowing(userId),
}));
vi.mock("@/lib/profile/suggestedMakers", () => ({ listSuggestedMakers: async () => [] }));
vi.mock("@/lib/feed/getBuildFeed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/feed/getBuildFeed")>()),
  getBuildFeed: (options: unknown) => getBuildFeed(options),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: vi.fn() }) } },
}));

let auth: Record<string, unknown> = {};
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

import Home from "@/pages/Home";

const SIGNED_IN = {
  isLoggedIn: true,
  loading: false,
  user: { id: "u1" },
  profile: { username: "maya", display_name: "Maya Okafor", avatar_url: null },
};
const SIGNED_OUT = { isLoggedIn: false, loading: false, user: null, profile: null };

function renderAt(entry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[entry]}>
          <Home />
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

const RETIRED = /trending|for you|bounties/i;

describe("Home's choice budgets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom has no scrollIntoView; the tab bar calls it to keep the current
    // tab in view.
    Element.prototype.scrollIntoView = vi.fn();
    countFollowing.mockResolvedValue(0);
    getBuildFeed.mockResolvedValue({ items: [], nextBefore: null });
  });

  it("has exactly two tabs, Following then Everyone", async () => {
    auth = SIGNED_IN;
    renderAt("/");
    await screen.findByTestId("feed-empty");

    const tabs = screen.getAllByTestId(/^feed-tab-/);
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Following", "Everyone"]);
  });

  it("has at most one filled button, signed in or out", async () => {
    for (const who of [SIGNED_IN, SIGNED_OUT]) {
      auth = who;
      const { unmount } = renderAt("/");
      await screen.findByTestId("feed-empty");
      expect(document.querySelectorAll('[data-visual-slot="btn-primary"]').length).toBeLessThanOrEqual(1);
      unmount();
    }
  });

  it("names none of the retired tabs anywhere, on either tab", async () => {
    auth = SIGNED_IN;
    for (const entry of ["/?tab=following", "/?tab=everyone"]) {
      const { unmount } = renderAt(entry);
      await screen.findByTestId("feed-empty");
      await waitFor(() => expect(getBuildFeed).toHaveBeenCalled());

      for (const role of ["button", "link", "tab", "heading"] as const) {
        expect(screen.queryAllByRole(role, { name: RETIRED })).toHaveLength(0);
      }
      expect(screen.queryAllByText(RETIRED)).toHaveLength(0);
      unmount();
    }
  });
});
