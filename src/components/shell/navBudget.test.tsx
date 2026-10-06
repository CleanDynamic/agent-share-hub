import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/contexts/ThemeContext";

import { DockView } from "./Dock";
import { MobileHeader } from "./MobileHeader";
import { SiteHeaderView } from "./SiteHeader";

/* ────────────────────────────────────────────────────────────────────────────
   RC-P05 — the navigation's choice budgets, counted in the rendered DOM.

   hicks-law › Budgets: the desktop header's links, exactly five on the phone
   dock, a short account sheet. These tests count what renders — by role and by
   accessible name in order — never a constant in the source, so an extra entry
   fails here however it arrived. A failing budget test means the change is
   wrong, not the test: changing a budget is the owner's decision.

   UI-P46 moved the budget to the site frame's real chrome (the rail these tests
   used to count is gone): Drafts joins the header after Library, and the
   account sheet lists Profile, Library, Drafts. "Make: New build, Drafts" is
   the hicks-law group — the header's New build button and its Drafts link sit
   together — so the signed-in header is five links and one button, and the dock
   stays at five tiles.
   ──────────────────────────────────────────────────────────────────────────── */

const authState: {
  isLoggedIn: boolean;
  profile: { display_name: string; username: string; avatar_url: string | null } | null;
  user: { id: string; email: string } | null;
  signOut: () => void;
} = { isLoggedIn: false, profile: null, user: null, signOut: vi.fn() };

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => authState }));

// The test setup's matchMedia says "no" to every query, which reads as a narrow window.
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: query.includes("min-width"),
  media: query,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}));

const viewer = { id: "u1", name: "Ada Lovelace", handle: "ada", hue: 1 };

function header(signedIn: boolean) {
  render(
    <MemoryRouter>
      <SiteHeaderView
        current={null}
        unread={0}
        viewer={signedIn ? viewer : null}
        theme="noon"
        onToggleTheme={vi.fn()}
        onSignIn={vi.fn()}
        onSignOut={vi.fn()}
        onNewBuild={vi.fn()}
      />
    </MemoryRouter>,
  );
}

const primaryLinks = () =>
  within(screen.getByRole("navigation", { name: "Primary" }))
    .getAllByRole("link")
    .map((a) => a.textContent?.trim());

beforeEach(() => {
  authState.isLoggedIn = false;
  authState.profile = null;
  authState.user = null;
});

describe("navigation budgets (hicks-law › Budgets)", () => {
  it("a signed-in reader's header has 5 links and the New build button", () => {
    header(true);
    expect(primaryLinks()).toEqual(["Home", "Gallery", "Bounties", "Library", "Drafts"]);
    expect(screen.getAllByRole("button", { name: "New build" })).toHaveLength(1);
  });

  it("a signed-out visitor's header has Home, Gallery and Bounties", () => {
    header(false);
    expect(primaryLinks()).toEqual(["Home", "Gallery", "Bounties"]);
    expect(screen.getAllByRole("button", { name: "New build" })).toHaveLength(1);
  });

  it("the phone dock offers exactly 5 destinations", () => {
    render(
      <MemoryRouter>
        <DockView current="home" unread={0} />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("aria-label"))).toEqual([
      "Home",
      "Gallery",
      "New",
      "Bounties",
      "Activity",
    ]);
  });

  it("the desktop chrome has exactly one search field", () => {
    header(true);
    expect(screen.getAllByRole("search")).toHaveLength(1);
    expect(screen.getAllByRole("searchbox")).toHaveLength(1);
    expect(screen.getByRole("searchbox", { name: "Search builds" })).toBeInTheDocument();
  });

  it("the phone's account sheet lists Profile, Library and Drafts, then Sign out", () => {
    authState.isLoggedIn = true;
    authState.profile = { display_name: "Ada Lovelace", username: "ada", avatar_url: null };
    authState.user = { id: "u1", email: "ada@example.com" };
    render(
      <ThemeProvider>
        <MemoryRouter>
          <MobileHeader />
        </MemoryRouter>
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Account" }));
    const sheet = screen.getByRole("dialog", { name: "Account" });
    expect(within(sheet).getAllByRole("link").map((a) => a.textContent)).toEqual(["Profile", "Library", "Drafts"]);
    expect(within(sheet).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "/profile/ada",
      "/library",
      "/drafts",
    ]);
  });
});
