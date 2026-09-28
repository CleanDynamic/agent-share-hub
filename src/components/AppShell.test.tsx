import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/contexts/ThemeContext";

/* ────────────────────────────────────────────────
   AppShell frame tests.

   These lock in the behaviour the flat shell inherited from
   NeoScaleShell, the frame it replaced: nav visibility filtering
   (authOnly), badge sources, active-route highlighting,
   single-outlet routing and the mobile rails-hidden mode with the
   existing mobile chrome. That shell was deleted in BG-P17, which is
   what makes these assertions the only remaining record of what the
   frame is supposed to do.
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
const badges = { msg: "", notif: "", draft: "", hasUnseenSaves: false, msgCount: 0, notifCount: 0 };
let breakpoint = "xl";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => authState }));
vi.mock("@/hooks/useUnreadMessages", () => ({
  useUnreadMessages: () => ({ display: badges.msg, count: badges.msgCount }),
}));
vi.mock("@/hooks/useUnreadNotifications", () => ({
  useUnreadNotifications: () => ({ display: badges.notif, count: badges.notifCount }),
}));
vi.mock("@/hooks/useDraftCount", () => ({ useDraftCount: () => ({ display: badges.draft }) }));
vi.mock("@/hooks/useNavBadges", () => ({ useNavBadges: () => ({ hasUnseenSaves: badges.hasUnseenSaves }) }));
vi.mock("@/hooks/useBreakpoint", () => ({ useBreakpoint: () => breakpoint }));
vi.mock("@/hooks/useProgress", () => ({
  useProgress: () => ({ level: 1, xpInLevel: 0, xpForNext: 100, progress: { xp_total: 0 } }),
}));

/* Heavy leaf components the frame mounts — stubbed to keep the test on the frame. */
vi.mock("@/components/workspace/WorkspaceShell", () => ({ WorkspaceShell: () => <div /> }));
vi.mock("@/components/ambient/NavProgressChip", () => ({ default: () => <div /> }));
const topBarProps: { pageContext?: { type: string; title?: string } } = {};
vi.mock("@/components/shell/MobileTopBar", () => ({
  MobileTopBar: (props: typeof topBarProps) => {
    Object.assign(topBarProps, props);
    return <div data-testid="mobile-top-bar" />;
  },
}));
const bottomNavProps: {
  unreadMessageCount?: number;
  unreadNotificationCount?: number;
  onNavigate?: (route: "home" | "gallery" | "upload" | "bounties" | "profile") => void;
} = {};
vi.mock("@/components/shell/MobileBottomNav", () => ({
  MobileBottomNav: (props: typeof bottomNavProps) => {
    Object.assign(bottomNavProps, props);
    return <div data-testid="mobile-bottom-nav" />;
  },
}));
vi.mock("@/components/shell/ProfileDrawer", () => ({
  ProfileDrawer: () => <div data-testid="profile-drawer" />,
}));

const { AppShell } = await import("@/components/AppShell");

function renderAt(path: string) {
  return render(
    <ThemeProvider>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<div data-testid="page">home page</div>} />
          <Route path="/gallery" element={<div data-testid="page">gallery page</div>} />
          <Route path="/b2/:slug" element={<div data-testid="page">build page</div>} />
          <Route path="/bounties" element={<div data-testid="page">bounties page</div>} />
          <Route path="/library" element={<div data-testid="page">library page</div>} />
          <Route path="/upload" element={<div data-testid="page">upload page</div>} />
          <Route path="/drafts" element={<div data-testid="page">drafts page</div>} />
          <Route path="/messages" element={<div data-testid="page">messages page</div>} />
          <Route path="/notifications" element={<div data-testid="page">notifications page</div>} />
          <Route path="/profile" element={<div data-testid="page">profile page</div>} />
          <Route path="/analytics" element={<div data-testid="page">analytics page</div>} />
          <Route path="/compose/new" element={<div data-testid="page">composer</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
    </ThemeProvider>,
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
  badges.msgCount = 0;
  badges.notifCount = 0;
  breakpoint = "xl";
});

describe("AppShell nav visibility", () => {
  it("hides authOnly items when signed out", () => {
    renderAt("/");
    expect(navLabels()).toEqual(["Home", "Gallery", "Bounties", "New build"]);
    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(screen.getByText("Join free")).toBeInTheDocument();
  });

  /* RC-P05. The nine destinations of hicks-law's desktop budget, in its order.
     There is no creator-only entry any more: Analytics left the nav. */
  it("shows the nine destinations to a signed-in reader", () => {
    signIn(false);
    renderAt("/");
    expect(navLabels()).toEqual([
      "Home", "Gallery", "Bounties", "Library", "New build", "Drafts",
      "Messages", "Notifications", "Profile",
    ]);
    expect(navLabels()).not.toContain("Analytics");
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  /* Inverted rather than deleted: Analytics used to be the creator's tenth row.
     It is reached from the progress chip and the phone drawer now. */
  it("keeps Analytics out of the nav for a signed-in creator too", () => {
    signIn(true);
    renderAt("/");
    expect(navLabels()).not.toContain("Analytics");
    expect(navLabels()).toHaveLength(9);
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
  /* RC-P05. /browse is a redirect to /gallery in App.tsx now, so its row is
     the Gallery's; a build page belongs to the Gallery, and Analytics to the
     reader's Profile. */
  const cases: Array<[string, string, string]> = [
    ["/", "home page", "Home"],
    ["/gallery", "gallery page", "Gallery"],
    ["/b2/example", "build page", "Gallery"],
    ["/bounties", "bounties page", "Bounties"],
    ["/library", "library page", "Library"],
    ["/upload", "upload page", "New build"],
    ["/drafts", "drafts page", "Drafts"],
    ["/messages", "messages page", "Messages"],
    ["/notifications", "notifications page", "Notifications"],
    ["/profile", "profile page", "Profile"],
    ["/analytics", "analytics page", "Profile"],
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

/* RC-P09c — the desktop nav from a keyboard. FlatShell drew each row and the
   wordmark as a div with a click handler and nothing else, so Tab went from
   the search field past all nine destinations. They are links now: in the tab
   order, the current one marked, followed on Enter. */
describe("AppShell desktop nav from the keyboard", () => {
  const primaryNav = () => screen.getByRole("navigation", { name: "Primary" });

  it("offers every destination as a link in the tab order, the current one marked", () => {
    signIn(true);
    renderAt("/gallery");
    const rows = within(within(primaryNav()).getByRole("list")).getAllByRole("link");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Home", "Gallery", "Bounties", "Library", "New build", "Drafts", "Messages", "Notifications", "Profile",
    ]);
    rows.forEach((row) => expect(row).toHaveAttribute("tabindex", "0"));
    expect(within(primaryNav()).getByRole("link", { current: "page" })).toHaveTextContent("Gallery");
  });

  it("follows a row on Enter", () => {
    signIn(true);
    renderAt("/");
    const gallery = within(primaryNav()).getByRole("link", { name: "Gallery" });
    gallery.focus();
    fireEvent.keyDown(gallery, { key: "Enter" });
    expect(screen.getByTestId("page")).toHaveTextContent("gallery page");
  });

  it("takes the wordmark home on Enter", () => {
    renderAt("/gallery");
    const wordmark = within(primaryNav()).getByRole("link", { name: "buildgallery" });
    expect(wordmark).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(wordmark, { key: "Enter" });
    expect(screen.getByTestId("page")).toHaveTextContent("home page");
  });
});

/* RC-P06 — the right rail is gone from every route (CONTRACT §3.1). These two
   asserted that the Explore panel rendered on content routes and was hidden on
   the routes that opted out; they are rewritten to the one answer that is left. */
describe("AppShell right rail", () => {
  it("renders no right rail on content routes", () => {
    renderAt("/");
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".fs-rail").length).toBe(1);
  });

  it("renders none on the routes that used to opt out either", () => {
    renderAt("/notifications");
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
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

    const centre = document.querySelector(".fs-page-body")!;
    expect(within(centre as HTMLElement).getByTestId("page")).toHaveTextContent("home page");
  });

  /* RC-P05. The Profile item's dot is lit by the two unread counts together.
     The badges read "9+" above nine, and Number("9+") is NaN, so the dot went
     dark exactly when the most was unread; the bar gets the counts. */
  it("hands the phone bar the unread counts, not the badge text", () => {
    breakpoint = "mobile";
    signIn(true);
    badges.msg = "9+";
    badges.msgCount = 12;
    badges.notif = "9+";
    badges.notifCount = 30;
    renderAt("/");
    expect(bottomNavProps.unreadMessageCount).toBe(12);
    expect(bottomNavProps.unreadNotificationCount).toBe(30);
  });

  /* RC-P08 — the phone bar's New build opens the composer, not the old
     Blueprint / Blog / Bounty type picker. */
  it("opens the composer from the phone bar's New build", () => {
    breakpoint = "mobile";
    signIn(true);
    renderAt("/");
    act(() => bottomNavProps.onNavigate!("upload"));
    expect(screen.getByTestId("page")).toHaveTextContent("composer");
  });

  /* RC-P09c — RC-P05 gave the Gallery the page context the old /discover
     used, so a reader who tapped Gallery read "Discover" over it. The Gallery
     takes the wordmark, as Home and Bounties do. */
  it.each(["/gallery", "/b2/example", "/bounties"])("heads %s with the wordmark on the phone", (path) => {
    breakpoint = "mobile";
    signIn(true);
    renderAt(path);
    expect(topBarProps.pageContext?.type).toBe("home");
  });

  it("does not mount mobile chrome on desktop", () => {
    renderAt("/");
    expect(screen.queryByTestId("mobile-top-bar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mobile-bottom-nav")).not.toBeInTheDocument();
  });
});

/* ── BG-P02 — the theme toggle's mount point ── */
describe("theme toggle", () => {
  const toggle = () => screen.queryByRole("radiogroup", { name: "Theme" });

  /* BG-P18b MOVED IT BELOW THE ACCOUNT BLOCK, and this assertion is inverted
     rather than deleted because the ORDER is the decision. BG-P02 mounted the
     toggle in `beforeUserSlot`, above the user block — which on a signed-out
     rail put a setting directly above the one primary action the rail exists
     for. A theme is a setting: it sits last, in the frame's `themeControl`
     slot, under the account block. */
  it("sits at the very bottom of the left rail, below the account block", () => {
    signIn();
    renderAt("/");
    const rail = document.querySelector(".fs-left");
    expect(rail).not.toBeNull();
    expect(rail!.contains(toggle()!)).toBe(true);

    // The frame's order: nav list, beforeUserSlot, account block, theme control.
    const userSection = rail!.querySelector(".fs-user-section")!;
    expect(userSection.compareDocumentPosition(toggle()!))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("is offered to signed-out visitors too — the theme is not an account setting", () => {
    renderAt("/");
    expect(toggle()).not.toBeNull();
  });

  it("offers all three choices, with the current one checked", () => {
    renderAt("/");
    expect(within(toggle()!).getAllByRole("radio").map((r) => r.textContent))
      .toEqual(["Exhibition", "Dusk", "System"]);
    expect(within(toggle()!).getByRole("radio", { checked: true })).toHaveTextContent("Exhibition");
  });

  it("is absent where the frame hides the left rail", () => {
    breakpoint = "mobile";
    renderAt("/");
    expect(toggle()).toBeNull();
  });
});

/* ────────────────────────────────────────────────
   BG-P14 — the layout mode, threaded from the route table.

   The capability landed in this prompt; no route uses it. These lock that in
   from the container's side: whatever `WIDE_ROUTES` comes to hold, a route
   that is not in it renders the standard frame, and the shell asks the table
   rather than deciding for itself.
──────────────────────────────────────────────── */
describe("AppShell layout mode", () => {
  const root = () => document.querySelector(".fs-root")!;

  it("renders every real route standard", () => {
    for (const path of ["/", "/bounties", "/library", "/upload", "/drafts", "/messages", "/profile"]) {
      const view = renderAt(path);
      expect([path, root().getAttribute("data-layout")]).toEqual([path, "standard"]);
      expect([path, root().classList.contains("fs-wide")]).toEqual([path, false]);
      view.unmount();
    }
  });

  /* RC-P06: rewritten from "keeps the right rail on a standard route". */
  it("renders a standard route with no right rail", () => {
    renderAt("/");
    expect(root().getAttribute("data-layout")).toBe("standard");
    expect(document.querySelector(".fs-right")).toBeNull();
  });
});
