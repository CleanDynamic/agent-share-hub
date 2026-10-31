import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/contexts/ThemeContext";

/* ────────────────────────────────────────────────────────────────────────────
   RC-P06 — no route renders a right rail.

   The owner removed the right rail everywhere (CONTRACT §3.1). These render the
   real AppShell and FlatShell at desktop width on the routes a reader spends
   most time on — standard and wide — and find nothing named "Explore" and no
   right-hand slot, /upload/blueprint included now RC-P08b has retired the legacy
   editor's workspace slot.
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
vi.mock("@/components/ambient/NavProgressChip", () => ({ default: () => null }));

const { AppShell } = await import("@/components/AppShell");

function renderAt(path: string) {
  // The site frame's header reads its counts with TanStack Query.
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="*" element={<p>page</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
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

  /* RC-P08b retired the legacy editor's workspace slot, its one remaining tenant, and SV-04 drew every page in one frame:
     /upload/blueprint has no right-hand slot either. */
  it("draws no right-hand slot on /upload/blueprint either, now the editor's workspace slot is gone", () => {
    renderAt("/upload/blueprint");
    expect(screen.queryByRole("complementary", { name: "Editor workspace" })).toBeNull();
    expect(document.querySelector(".fs-right")).toBeNull();
  });
});
