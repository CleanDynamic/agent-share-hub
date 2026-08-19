import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* ────────────────────────────────────────────────
   AppShell frame tests.

   These lock in the behaviour the flat shell inherited from
   NeoScaleShell: nav visibility filtering (authOnly / creatorOnly),
   badge sources, active-route highlighting, single-outlet routing and
   the mobile rails-hidden mode with the existing mobile chrome.
──────────────────────────────────────────────── */

interface MockProfile {
  display_name: string;
  username: string;
  avatar_url: string | null;
}

const authState: {
  isLoggedIn: boolean;
  isCreator: boolean;
  profile: MockProfile | null;
  user: { email: string } | null;
  signOut: () => void;
} = {
  isLoggedIn: false,
  isCreator: false,
  profile: null,
  user: null,
  signOut: vi.fn(),
};
const badges = { msg: "", notif: "", draft: "", hasUnseenSaves: false };
let breakpoint = "xl";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => authState }));
vi.mock("@/contexts/UploadPickerContext", () => ({
  useUploadPicker: () => ({ openUploadTypePicker: vi.fn() }),
}));
vi.mock("@/hooks/useUnreadMessages", () => ({ useUnreadMessages: () => ({ display: badges.msg }) }));
vi.mock("@/hooks/useUnreadNotifications", () => ({ useUnreadNotifications: () => ({ display: badges.notif }) }));
vi.mock("@/hooks/useDraftCount", () => ({ useDraftCount: () => ({ display: badges.draft }) }));
vi.mock("@/hooks/useNavBadges", () => ({ useNavBadges: () => ({ hasUnseenSaves: badges.hasUnseenSaves }) }));
vi.mock("@/hooks/useBreakpoint", () => ({ useBreakpoint: () => breakpoint }));
vi.mock("@/hooks/useProgress", () => ({
  useProgress: () => ({ level: 1, xpInLevel: 0, xpForNext: 100, progress: { xp_total: 0 } }),
}));

/* Heavy leaf components the frame mounts — stubbed to keep the test on the frame. */
vi.mock("@/components/shell/RightRailExplore", () => ({
  RightRailExplore: () => <div data-testid="right-rail-explore" />,
}));
vi.mock("@/components/workspace/WorkspaceShell", () => ({ WorkspaceShell: () => <div /> }));
vi.mock("@/components/ambient/NavProgressChip", () => ({ default: () => <div /> }));
vi.mock("@/components/shell/MobileTopBar", () => ({
  MobileTopBar: () => <div data-testid="mobile-top-bar" />,
}));
vi.mock("@/components/shell/MobileBottomNav", () => ({
  MobileBottomNav: () => <div data-testid="mobile-bottom-nav" />,
}));
vi.mock("@/components/shell/ProfileDrawer", () => ({
  ProfileDrawer: () => <div data-testid="profile-drawer" />,
}));
vi.mock("@/components/shell/RightRailDrawer", () => ({
  RightRailDrawer: () => <div data-testid="right-rail-drawer" />,
}));

const { AppShell } = await import("@/components/AppShell");

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<div data-testid="page">home page</div>} />
          <Route path="/browse" element={<div data-testid="page">browse page</div>} />
          <Route path="/library" element={<div data-testid="page">library page</div>} />
          <Route path="/upload" element={<div data-testid="page">upload page</div>} />
          <Route path="/drafts" element={<div data-testid="page">drafts page</div>} />
          <Route path="/messages" element={<div data-testid="page">messages page</div>} />
          <Route path="/notifications" element={<div data-testid="page">notifications page</div>} />
          <Route path="/profile" element={<div data-testid="page">profile page</div>} />
          <Route path="/analytics" element={<div data-testid="page">analytics page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const navLabels = () =>
  Array.from(document.querySelectorAll(".fs-nav-item .fs-nav-label")).map((n) => n.textContent);

const signIn = (creator = false) => {
  authState.isLoggedIn = true;
  authState.isCreator = creator;
  authState.profile = { display_name: "Ada Lovelace", username: "ada", avatar_url: null };
  authState.user = { email: "ada@example.com" };
};

beforeEach(() => {
  authState.isLoggedIn = false;
  authState.isCreator = false;
  authState.profile = null;
  authState.user = null;
  badges.msg = "";
  badges.notif = "";
  badges.draft = "";
  badges.hasUnseenSaves = false;
  breakpoint = "xl";
});

describe("AppShell nav visibility", () => {
  it("hides authOnly items when signed out", () => {
    renderAt("/");
    expect(navLabels()).toEqual(["Home", "Discover", "Upload"]);
    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(screen.getByText("Join free")).toBeInTheDocument();
  });

  it("shows authOnly items but hides creatorOnly for a signed-in non-creator", () => {
    signIn(false);
    renderAt("/");
    expect(navLabels()).toEqual([
      "Home", "Discover", "Library", "Upload", "Drafts",
      "Messages", "Notifications", "My Profile",
    ]);
    expect(navLabels()).not.toContain("Analytics");
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("shows Analytics for a signed-in creator", () => {
    signIn(true);
    renderAt("/");
    expect(navLabels()).toContain("Analytics");
  });
});

describe("AppShell badges", () => {
  it("renders badge counts from the badge hooks", () => {
    signIn(true);
    badges.draft = "3";
    badges.msg = "9+";
    badges.notif = "12";
    badges.hasUnseenSaves = true;
    renderAt("/");

    const row = (label: string) =>
      document.querySelector(`.fs-nav-item:has(.fs-nav-label)`) &&
      Array.from(document.querySelectorAll(".fs-nav-item")).find(
        (el) => el.querySelector(".fs-nav-label")?.textContent === label,
      )!;

    expect(within(row("Drafts") as HTMLElement).getByText("3")).toBeInTheDocument();
    expect(row("Drafts")!.querySelector(".fs-nav-badge")).toHaveClass("muted");
    expect(within(row("Messages") as HTMLElement).getByText("9+")).toBeInTheDocument();
    expect(within(row("Notifications") as HTMLElement).getByText("12")).toBeInTheDocument();
    expect(row("Library")!.querySelector(".fs-nav-dot")).toBeInTheDocument();
  });
});

describe("AppShell routing through a single outlet", () => {
  const cases: Array<[string, string, string]> = [
    ["/", "home page", "Home"],
    ["/browse", "browse page", "Discover"],
    ["/library", "library page", "Library"],
    ["/upload", "upload page", "Upload"],
    ["/drafts", "drafts page", "Drafts"],
    ["/messages", "messages page", "Messages"],
    ["/notifications", "notifications page", "Notifications"],
    ["/profile", "profile page", "My Profile"],
    ["/analytics", "analytics page", "Analytics"],
  ];

  it.each(cases)("renders %s in the centre column and highlights %s", (path, text, activeLabel) => {
    signIn(true);
    renderAt(path);
    const centre = document.querySelector(".fs-page-body")!;
    expect(centre).toBeInTheDocument();
    expect(within(centre as HTMLElement).getByTestId("page")).toHaveTextContent(text);
    expect(document.querySelector(".fs-nav-item.active .fs-nav-label")).toHaveTextContent(activeLabel);
  });
});

describe("AppShell right rail", () => {
  it("renders the Explore panel on content routes", () => {
    renderAt("/");
    expect(screen.getByTestId("right-rail-explore")).toBeInTheDocument();
    expect(document.querySelectorAll(".fs-rail").length).toBe(2);
  });

  it("hides the rail on routes that opted out", () => {
    renderAt("/notifications");
    expect(screen.queryByTestId("right-rail-explore")).not.toBeInTheDocument();
    expect(document.querySelector(".fs-right")).toBeNull();
  });
});

describe("AppShell mobile mode", () => {
  it("drops both rails and mounts the existing mobile chrome", () => {
    breakpoint = "mobile";
    signIn(true);
    renderAt("/");

    expect(document.querySelectorAll(".fs-rail").length).toBe(0);
    expect(screen.getByTestId("mobile-top-bar")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-bottom-nav")).toBeInTheDocument();
    expect(screen.getByTestId("profile-drawer")).toBeInTheDocument();
    expect(screen.getByTestId("right-rail-drawer")).toBeInTheDocument();

    const centre = document.querySelector(".fs-page-body")!;
    expect(within(centre as HTMLElement).getByTestId("page")).toHaveTextContent("home page");
  });

  it("does not mount mobile chrome on desktop", () => {
    renderAt("/");
    expect(screen.queryByTestId("mobile-top-bar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mobile-bottom-nav")).not.toBeInTheDocument();
  });
});
