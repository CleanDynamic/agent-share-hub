import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { parkedEntryPoints } from "@/test/parkedEntryPoints";

/* ────────────────────────────────────────────────────────────────────────────
   RC-P28 — guilds, leaderboards and reputation are parked
   (src/lib/progress/flags.ts), so the frame offers no way into any of them: no
   link to /guilds, /leaderboards or /reputation and nothing naming one, on the
   desktop rail, the phone bars or the phone drawer (hicks-law › Remedies 1
   Remove). The chrome is real, the level chip and its flyout included (the
   flyout is in the DOM at rest, at opacity 0); only the hooks that read data
   and the workspace leaf are stubbed, as in navBudget.test.tsx.
   ──────────────────────────────────────────────────────────────────────────── */

const authState: {
  isLoggedIn: boolean;
  profile: { display_name: string; username: string; avatar_url: string | null } | null;
  user: { email: string } | null;
  signOut: () => void;
} = { isLoggedIn: false, profile: null, user: null, signOut: vi.fn() };
let breakpoint = "xl";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => authState }));
vi.mock("@/hooks/useUnreadMessages", () => ({ useUnreadMessages: () => ({ display: "" }) }));
vi.mock("@/hooks/useUnreadNotifications", () => ({ useUnreadNotifications: () => ({ display: "" }) }));
vi.mock("@/hooks/useDraftCount", () => ({ useDraftCount: () => ({ display: "" }) }));
vi.mock("@/hooks/useNavBadges", () => ({ useNavBadges: () => ({ hasUnseenSaves: false }) }));
vi.mock("@/hooks/useBreakpoint", () => ({ useBreakpoint: () => breakpoint }));
vi.mock("@/hooks/useProgress", () => ({
  useProgress: () => ({ level: 3, xpInLevel: 40, xpForNext: 100, progress: { xp_total: 412 } }),
}));
vi.mock("@/components/workspace/WorkspaceShell", () => ({ WorkspaceShell: () => null }));

const { AppShell } = await import("@/components/AppShell");

function renderShell() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/analytics"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/analytics" element={<p>progress page</p>} />
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

describe("the frame while guilds, leaderboards and reputation are parked", () => {
  it("the desktop rail and level chip offer no way into a parked feature", () => {
    signIn();
    renderShell();

    expect(screen.getByRole("tooltip")).toHaveTextContent("Lifetime XP");
    expect(within(screen.getByRole("navigation", { name: "Primary" })).getAllByRole("listitem")).toHaveLength(9);
    expect(parkedEntryPoints(document.body)).toEqual([]);
  });

  it("the signed-out desktop frame offers none either", () => {
    renderShell();

    expect(screen.getByText("Join free")).toBeInTheDocument();
    expect(parkedEntryPoints(document.body)).toEqual([]);
  });

  it("the phone bars and the open drawer, level chip included, offer none", () => {
    breakpoint = "mobile";
    signIn();
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Profile" }));

    expect(screen.getByRole("dialog", { name: "Profile menu" })).toHaveTextContent("Lifetime XP");
    expect(parkedEntryPoints(document.body)).toEqual([]);
  });
});
