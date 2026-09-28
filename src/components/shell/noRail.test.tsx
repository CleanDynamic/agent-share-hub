import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/contexts/ThemeContext";

/* ────────────────────────────────────────────────────────────────────────────
   RC-P06 — no route renders a right rail.

   The owner removed the right rail everywhere (CONTRACT §3.1). These render the
   real AppShell and FlatShell at desktop width on the routes a reader spends
   most time on — standard and wide — and find nothing named "Explore" and no
   right-hand slot. The one tenant the slot keeps until RC-P08b, the legacy
   editor's workspace on /upload/blueprint, is asserted to still be there.
   ──────────────────────────────────────────────────────────────────────────── */

const authState: {
  isLoggedIn: boolean;
  isCreator: boolean;
  profile: { display_name: string; username: string; avatar_url: string | null } | null;
  user: { email: string } | null;
  signOut: () => void;
} = { isLoggedIn: false, isCreator: false, profile: null, user: null, signOut: vi.fn() };

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => authState }));
vi.mock("@/hooks/useUnreadMessages", () => ({ useUnreadMessages: () => ({ display: null, count: 0 }) }));
vi.mock("@/hooks/useUnreadNotifications", () => ({
  useUnreadNotifications: () => ({ display: null, count: 0 }),
}));
vi.mock("@/hooks/useDraftCount", () => ({ useDraftCount: () => ({ display: "" }) }));
vi.mock("@/hooks/useNavBadges", () => ({ useNavBadges: () => ({ hasUnseenSaves: false }) }));
vi.mock("@/hooks/useBreakpoint", () => ({ useBreakpoint: () => "xl" }));
vi.mock("@/hooks/useProgress", () => ({
  useProgress: () => ({ level: 1, xpInLevel: 0, xpForNext: 100, progress: { xp_total: 0 } }),
}));
vi.mock("@/components/workspace/WorkspaceShell", () => ({
  WorkspaceShell: () => <div data-testid="workspace-shell" />,
}));
vi.mock("@/components/ambient/NavProgressChip", () => ({ default: () => null }));

const { AppShell } = await import("@/components/AppShell");

function renderAt(path: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="*" element={<p>page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  authState.isLoggedIn = true;
  authState.isCreator = true;
  authState.profile = { display_name: "Ada Lovelace", username: "ada", avatar_url: null };
  authState.user = { email: "ada@example.com" };
});

describe("the frame has no right rail (RC-P06)", () => {
  it.each(["/", "/library", "/drafts", "/gallery", "/b2/example", "/bounties"])(
    "renders nothing named Explore and no right-hand slot on %s",
    (path) => {
      renderAt(path);
      expect(screen.queryByLabelText("Explore")).toBeNull();
      expect(screen.queryByRole("complementary", { name: "Explore" })).toBeNull();
      expect(document.querySelector(".fs-right")).toBeNull();
    },
  );

  it("still shows the editor workspace on /upload/blueprint for a signed-in creator", () => {
    renderAt("/upload/blueprint");
    const slot = screen.getByRole("complementary", { name: "Editor workspace" });
    expect(slot).toContainElement(screen.getByTestId("workspace-shell"));
  });
});
