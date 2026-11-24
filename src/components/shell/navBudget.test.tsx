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
   account sheet lists Profile, Library, Drafts (UX-15 added Settings). "Make: New build, Drafts" is
   the hicks-law group — the header's New build button and its Drafts link sit
   together — so the signed-in header is five links and one button, and the dock
   stays at five tiles.
   Synth 05: the header's nav is Home, Builds, OpenBuilds, Library (Drafts is in the account menu, Connect a tool in the
   footer), and the phone header's menu holds the nav and the account's pages.
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
  it("a signed-in reader's header has 4 links and the New build button", () => {
    header(true);
    expect(primaryLinks()).toEqual(["Home", "Builds", "OpenBuilds", "Library"]);
    expect(screen.getAllByRole("button", { name: "New build" })).toHaveLength(1);
  });

  it("a signed-out visitor's header has Home, Builds and OpenBuilds", () => {
    header(false);
    expect(primaryLinks()).toEqual(["Home", "Builds", "OpenBuilds"]);
    expect(screen.getAllByRole("button", { name: "New build" })).toHaveLength(1);
  });

  it("the phone dock offers exactly 5 destinations", () => {
    render(
      <MemoryRouter>
        <DockView current="home" unread={0} />
      </MemoryRouter>,
    );
    // Prompt 19: New is a button that opens the New sheet, so the five are four links and one button.
    const dock = within(screen.getByRole("navigation", { name: "Primary" }));
    expect([...dock.getAllByRole("link"), ...dock.getAllByRole("button")]).toHaveLength(5);
    expect(Array.from(screen.getByRole("navigation", { name: "Primary" }).children).map((el) => el.getAttribute("aria-label"))).toEqual([
      "Home",
      "Builds",
      "New",
      "OpenBuilds",
      "Activity",
    ]);
  });

  it("the desktop chrome has exactly one search field", () => {
    header(true);
    expect(screen.getAllByRole("search")).toHaveLength(1);
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.getByRole("combobox", { name: "Search builds" })).toBeInTheDocument();
  });

  it("the phone's account drawer lists the account's pages in the prompt's order, then the theme switch and Sign out", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Ada Lovelace, account menu" }));
    // The drawer is a dialog: focus is trapped in it, Escape closes it.
    const drawer = await screen.findByRole("dialog", { name: "Account" });
    expect(within(drawer).getAllByRole("link").map((a) => a.textContent)).toEqual(["Your profile", "Your library", "Drafts", "Messages", "Settings", "API docs"]);
    expect(within(drawer).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/profile/ada", "/library", "/drafts", "/messages", "/settings", "/api-docs"]);
    expect(within(drawer).getByRole("switch", { name: "Dark theme" })).toBeTruthy();
    expect(within(drawer).getByRole("button", { name: "Sign out" })).toBeTruthy();
    expect(within(drawer).getByText("@ada")).toBeTruthy();
  });
});
