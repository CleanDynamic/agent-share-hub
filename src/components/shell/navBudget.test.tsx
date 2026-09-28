import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/contexts/ThemeContext";

/* ────────────────────────────────────────────────────────────────────────────
   RC-P05 — the navigation's choice budgets, counted in the rendered DOM.

   hicks-law › Budgets sets four numbers for the frame: nine desktop
   destinations in four groups, four signed out, exactly five on the phone bar,
   at most six in the phone drawer. These tests count what renders — by role,
   and by accessible name in order — never a constant in the source, so a
   tenth entry fails here however it arrived (hicks-law › Enforcing It in the
   Code). A failing budget test means the change is wrong, not the test:
   changing a budget is the owner's decision, recorded in the diary first.

   The phone bar and the drawer are the real components, mounted by the real
   AppShell. The desktop rail's rows are list items with no role or name of
   their own (FlatShell draws them), so the desktop tests read each list
   item's text and find the groups at the divider FlatShell draws in the first
   row of a group.
   ──────────────────────────────────────────────────────────────────────────── */

const authState: {
  isLoggedIn: boolean;
  profile: { display_name: string; username: string; avatar_url: string | null } | null;
  user: { email: string } | null;
  signOut: () => void;
} = { isLoggedIn: false, profile: null, user: null, signOut: vi.fn() };
let breakpoint = "xl";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => authState }));
vi.mock("@/contexts/UploadPickerContext", () => ({
  useUploadPicker: () => ({ openUploadTypePicker: vi.fn() }),
}));
vi.mock("@/hooks/useUnreadMessages", () => ({ useUnreadMessages: () => ({ display: "" }) }));
vi.mock("@/hooks/useUnreadNotifications", () => ({ useUnreadNotifications: () => ({ display: "" }) }));
vi.mock("@/hooks/useDraftCount", () => ({ useDraftCount: () => ({ display: "" }) }));
vi.mock("@/hooks/useNavBadges", () => ({ useNavBadges: () => ({ hasUnseenSaves: false }) }));
vi.mock("@/hooks/useBreakpoint", () => ({ useBreakpoint: () => breakpoint }));
vi.mock("@/hooks/useProgress", () => ({
  useProgress: () => ({ level: 1, xpInLevel: 0, xpForNext: 100, progress: { xp_total: 0 } }),
}));

/* Leaves that read data. None of them is a destination being counted. */
vi.mock("@/components/workspace/WorkspaceShell", () => ({ WorkspaceShell: () => null }));
vi.mock("@/components/ambient/NavProgressChip", () => ({ default: () => null }));

const { AppShell } = await import("@/components/AppShell");

function renderShell() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<p>home page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

const signIn = () => {
  authState.isLoggedIn = true;
  authState.profile = { display_name: "Ada Lovelace", username: "ada", avatar_url: null };
  authState.user = { email: "ada@example.com" };
};

beforeEach(() => {
  authState.isLoggedIn = false;
  authState.profile = null;
  authState.user = null;
  breakpoint = "xl";
});

/** The desktop rail's destinations, grouped the way the reader sees them. */
function desktopGroups(): string[][] {
  const rail = screen.getByRole("navigation", { name: "Primary" });
  const groups: string[][] = [];
  for (const row of within(rail).getAllByRole("listitem")) {
    if (groups.length === 0 || row.querySelector(".fs-nav-divider")) groups.push([]);
    groups[groups.length - 1].push(row.textContent?.trim() ?? "");
  }
  return groups;
}

/** Exactly these elements of `role` inside `container`, named in this order. */
function expectNamedInOrder(container: HTMLElement, role: "button", names: string[]) {
  const all = within(container).getAllByRole(role);
  expect(all).toHaveLength(names.length);
  names.forEach((name, index) => {
    expect(all[index]).toBe(within(container).getByRole(role, { name }));
  });
}

describe("navigation budgets (hicks-law › Budgets)", () => {
  it("a signed-in reader sees 9 destinations in 4 groups", () => {
    signIn();
    renderShell();
    const groups = desktopGroups();
    expect(groups).toEqual([
      ["Home", "Gallery", "Bounties", "Library"],
      ["New build", "Drafts"],
      ["Messages", "Notifications"],
      ["Profile"],
    ]);
    expect(groups.flat()).toHaveLength(9);
  });

  it("a signed-out visitor sees Home, Gallery, Bounties and New build", () => {
    renderShell();
    expect(desktopGroups().flat()).toEqual(["Home", "Gallery", "Bounties", "New build"]);
  });

  it("the phone bar offers exactly 5 destinations", () => {
    breakpoint = "mobile";
    signIn();
    renderShell();
    const bar = screen.getByRole("navigation", { name: "Primary" });
    expectNamedInOrder(bar, "button", ["Home", "Gallery", "New build", "Bounties", "Profile"]);
  });

  /* RC-P07 — one search box, the same in every place (hicks-law ›
     Familiarity): the desktop chrome carries exactly one. */
  it("the desktop chrome has exactly one search field", () => {
    signIn();
    renderShell();
    expect(screen.getAllByRole("search")).toHaveLength(1);
    expect(screen.getAllByRole("searchbox")).toHaveLength(1);
    expect(screen.getByRole("searchbox", { name: "Search builds" })).toBeInTheDocument();
  });

  it("the profile drawer lists exactly 6 destinations", () => {
    breakpoint = "mobile";
    signIn();
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Profile" }));
    const drawer = screen.getByRole("dialog", { name: "Profile menu" });
    expectNamedInOrder(within(drawer).getByRole("navigation"), "button", [
      "Library", "Drafts", "Messages", "Notifications", "Analytics", "About",
    ]);
  });
});
