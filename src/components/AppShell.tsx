import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Home as HomeIcon,
  LayoutGrid,
  Target,
  Book,
  Plus,
  Edit3,
  MessageSquare,
  Bell,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUploadPicker } from "@/contexts/UploadPickerContext";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { useDraftCount } from "@/hooks/useDraftCount";
import { useNavBadges } from "@/hooks/useNavBadges";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useProgress } from "@/hooks/useProgress";
import { FlatShell, type FlatShellNavItem } from "@/components/shell/FlatShell";
import { matchWideRoute } from "@/components/shell/wideRoutes";
import { RightRailExplore } from "@/components/shell/RightRailExplore";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { MobileTopBar, type PageContextType } from "@/components/shell/MobileTopBar";
import { MobileBottomNav, type MobileRoute } from "@/components/shell/MobileBottomNav";
import { ProfileDrawer, type DrawerRoute } from "@/components/shell/ProfileDrawer";
import { RightRailDrawer } from "@/components/shell/RightRailDrawer";
import NavProgressChip from "@/components/ambient/NavProgressChip";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

/* ────────────────────────────────────────────────
   AppShell — the wired container around FlatShell.

   It replaced NeoScaleShell as the layout frame, keeping that shell's nav
   items, visibility filtering, badge sources, right-rail content and mobile
   chrome, but rendering them through the flat 2D FlatShell frame with a
   single router <Outlet />. NeoScaleShell was deleted in BG-P17; where the
   comments below say a behaviour is unchanged from it, they are recording
   where that behaviour came from, not pointing at a file to go and read.
──────────────────────────────────────────────── */

/* Route ↔ nav-page mapping (carried over from the retired NeoScaleShell).
   RC-P05: a build page belongs to the Gallery, every way of starting or
   bringing in a build belongs to New build, and Analytics — which left the
   nav — is part of the reader's own profile. */
const ROUTE_TO_NAV: Record<string, string> = {
  "/":              "home",
  "/gallery":       "gallery",
  "/library":       "library",
  "/saved":         "library",
  "/upload":        "upload",
  "/profile":       "profile",
  "/messages":      "messages",
  "/notifications": "notifications",
  "/drafts":        "drafts",
  "/analytics":     "profile",
};

function routeToNav(pathname: string): string {
  if (pathname.startsWith("/b2/")) return "gallery";
  if (pathname.startsWith("/bounties")) return "bounties";
  if (
    pathname.startsWith("/upload") ||
    pathname.startsWith("/compose") ||
    pathname.startsWith("/rebuild") ||
    pathname.startsWith("/import")
  ) return "upload";
  return ROUTE_TO_NAV[pathname] ?? "other";
}

const NAV_ICONS = {
  home: <HomeIcon size={20} strokeWidth={2} />,
  gallery: <LayoutGrid size={20} strokeWidth={2} />,
  bounties: <Target size={20} strokeWidth={2} />,
  library: <Book size={20} strokeWidth={2} />,
  upload: <Plus size={20} strokeWidth={2} />,
  drafts: <Edit3 size={20} strokeWidth={2} />,
  messages: <MessageSquare size={20} strokeWidth={2} />,
  notifications: <Bell size={20} strokeWidth={2} />,
  profile: <UserIcon size={20} strokeWidth={2} />,
};

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { openUploadTypePicker } = useUploadPicker();
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  const { isLoggedIn, profile, user, signOut } = useAuth();
  const { display: msgBadge } = useUnreadMessages();
  const { display: notifBadge } = useUnreadNotifications();
  const { display: draftBadge } = useDraftCount();
  const { hasUnseenSaves } = useNavBadges();

  const [isProfileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [isRightRailDrawerOpen, setRightRailDrawerOpen] = useState(false);

  const pathname = location.pathname;
  const activeKey = routeToNav(pathname);

  /* ── BG-P14. The layout mode, from the route table and from nowhere else.
     `WIDE_ROUTES` is empty, so every route below resolves to "standard" and
     renders the frame it renders today; BG-P15 adds the gallery, the build
     page and the import page to that table and they arrive here without a
     line of this file changing. ── */
  const wideRoute = matchWideRoute(pathname);
  const layout = wideRoute ? "wide" : "standard";

  /* ── Blueprint-editor special case (unchanged behaviour): on small
     desktops the left rail hides and the right rail shows the editor
     workspace instead of Explore. ── */
  const isUploadEditor =
    pathname.startsWith("/upload/blueprint") ||
    pathname.startsWith("/upload/blog");
  const isSmallDesktop = breakpoint === "lg" || breakpoint === "md";
  const uploadEditorSmall = isUploadEditor && isSmallDesktop;

  /* ── Nav items — RC-P05: nine destinations in four groups, grouped by the
     reader's intent (hicks-law › Budgets): Browse (Home, Gallery, Bounties,
     Library) · Make (New build, Drafts) · Talk (Messages, Notifications) · You
     (Profile). The groups are the existing dividers and nothing else
     (law-of-proximity). Discover and Analytics left: Discover duplicated the
     Gallery, and Analytics is the progress chip's destination and a row of the
     phone drawer, so a second entry to it added a choice and no place. Same
     badge sources as before. ── */
  type NavEntry = FlatShellNavItem & { authOnly?: boolean };
  const allNavItems: NavEntry[] = [
    { key: "home",     icon: NAV_ICONS.home,     label: "Home",      route: "/" },
    { key: "gallery",  icon: NAV_ICONS.gallery,  label: "Gallery",   route: "/gallery" },
    { key: "bounties", icon: NAV_ICONS.bounties, label: "Bounties",  route: "/bounties" },
    { key: "library",  icon: NAV_ICONS.library,  label: "Library",   route: "/library",  authOnly: true, dot: hasUnseenSaves },
    { key: "upload",   icon: NAV_ICONS.upload,   label: "New build", route: "/compose/new",   divider: true },
    { key: "drafts",   icon: NAV_ICONS.drafts,   label: "Drafts",    route: "/drafts",   authOnly: true, badge: draftBadge, badgeMuted: true },
    { key: "messages", icon: NAV_ICONS.messages, label: "Messages",  route: "/messages", authOnly: true, badge: msgBadge, divider: true },
    { key: "notifications", icon: NAV_ICONS.notifications, label: "Notifications", route: "/notifications", authOnly: true, badge: notifBadge },
    { key: "profile",  icon: NAV_ICONS.profile,  label: "Profile",   route: "/profile", authOnly: true, divider: true },
  ];

  const navItems = allNavItems.filter((item) => !item.authOnly || isLoggedIn);

  /* New build used to intercept the click and open the type picker. It now
     navigates like every other entry, so the nav lands in the build
     workspace. The picker is still reachable from every other New
     affordance — Cmd/Ctrl+N, the mobile drawer, the drafts page. */
  const onNavClick = (item: FlatShellNavItem) => {
    navigate(item.route);
  };

  /* ── User block ── */
  const initialsSafe =
    profile?.display_name?.slice(0, 2).toUpperCase() ||
    profile?.username?.slice(0, 2).toUpperCase() ||
    (user?.email ? user.email.slice(0, 2).toUpperCase() : "?");

  const shellUser = isLoggedIn
    ? {
        name: profile?.display_name || profile?.username || "User",
        initials: initialsSafe,
        avatarUrl: profile?.avatar_url || undefined,
        /* BG-P18b. The rail's account block is a name over a handle now, which
           is the same identity the mobile drawer has always shown. Read from
           the profile already in hand — no query is added. */
        handle: profile?.username || undefined,
      }
    : null;

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  /* ── Right rail: Explore panel, editor workspace, or hidden ── */
  const railHiddenRoute =
    pathname.startsWith("/publish/") ||
    pathname === "/discover" ||
    pathname === "/notifications";
  const rightRail = isUploadEditor && pathname.startsWith("/upload/blueprint")
    ? <WorkspaceShell showNavTab={uploadEditorSmall} />
    : railHiddenRoute
      ? null
      : <RightRailExplore />;

  /* ── Mobile chrome plumbing (carried over from the retired shell) ── */
  const mobileRoute: MobileRoute = (() => {
    const p = pathname;
    if (p === "/" || p === "") return "home";
    if (p.startsWith("/discover") || p.startsWith("/browse") || p.startsWith("/search")) return "discover";
    if (p.startsWith("/upload")) return "upload";
    if (p.startsWith("/messages")) return "messages";
    if (p.startsWith("/profile") || p.startsWith("/notifications") || p.startsWith("/library") || p.startsWith("/drafts") || p.startsWith("/analytics")) return "profile";
    return "home";
  })();

  const pageContextType: PageContextType = (() => {
    const p = pathname;
    if (p === "/" || p === "") return "home";
    if (p.startsWith("/discover") || p.startsWith("/browse") || p.startsWith("/search")) return "discover";
    if (p.startsWith("/messages")) return "messages";
    if (p.startsWith("/notifications")) return "notifications";
    if (p.startsWith("/upload")) return "upload";
    if (p.startsWith("/profile")) return "profile";
    if (p.startsWith("/content/") || p.startsWith("/blueprint/") || p.startsWith("/blog/")) return "content-detail";
    return "home";
  })();

  const drawerRoute: DrawerRoute | null = (() => {
    const p = pathname;
    if (p === "/") return "home";
    if (p.startsWith("/discover") || p.startsWith("/browse") || p.startsWith("/search")) return "discover";
    if (p.startsWith("/library")) return "library";
    if (p.startsWith("/upload")) return "upload";
    if (p.startsWith("/drafts")) return "drafts";
    if (p.startsWith("/messages")) return "messages";
    if (p.startsWith("/notifications")) return "notifications";
    if (p.startsWith("/analytics")) return "analytics";
    if (p.startsWith("/about")) return "about";
    return null;
  })();

  const drawerUser = isLoggedIn
    ? {
        name: profile?.display_name || profile?.username || "User",
        handle: profile?.username || "",
        avatarUrl: profile?.avatar_url || undefined,
        initials: initialsSafe,
        followersCount: (profile as any)?.follower_count ?? 0,
        followingCount: (profile as any)?.following_count ?? 0,
      }
    : null;

  const drawerNavigate = (r: DrawerRoute) => {
    if (r === "upload") {
      openUploadTypePicker();
      return;
    }
    const map: Record<DrawerRoute, string> = {
      home: "/", discover: "/discover", library: "/library", upload: "/upload",
      drafts: "/drafts", messages: "/messages", notifications: "/notifications",
      analytics: "/analytics", about: "/about",
    };
    navigate(map[r]);
  };

  const mobileBottomNavigate = (r: MobileRoute) => {
    if (r === "profile") {
      setProfileDrawerOpen(true);
      return;
    }
    if (r === "upload") {
      openUploadTypePicker();
      return;
    }
    const map: Record<Exclude<MobileRoute, "profile">, string> = {
      home: "/", discover: "/discover", upload: "/upload", messages: "/messages",
    };
    navigate(map[r]);
  };

  return (
    <>
      <FlatShell
        navItems={navItems}
        activeKey={activeKey}
        onNavClick={onNavClick}
        user={shellUser}
        onSignIn={() => navigate("/login")}
        onJoin={() => navigate("/signup")}
        onUserMenu={handleSignOut}
        onLogoClick={() => navigate("/")}
        rightRail={rightRail}
        isMobile={isMobile}
        hideLeftRail={uploadEditorSmall}
        forceRightRail={uploadEditorSmall}
        layout={layout}
        wideRightRail={wideRoute?.rightRail ?? false}
        beforeUserSlot={
          /* The left rail's slot immediately above the account block. BG-P02
             mounted the theme toggle here too; BG-P18b moved it to the
             `themeControl` slot below the account block, because the rail's
             order is wordmark, nav, spacer, account, setting — a setting does
             not sit above the sign-up it would otherwise compete with. What is
             left here is the progress chip, which is about the reader's account
             and belongs beside it. */
          isLoggedIn ? (
            <div style={{ padding: "0 0 12px" }}>
              <NavProgressChipMount onClick={() => navigate("/analytics")} />
            </div>
          ) : null
        }
        themeControl={<ThemeToggle variant="rail" />}
      >
        {/* Single outlet: every route, including "/", renders here. The home
            route keeps the 16px inset its old front-face wrapper provided. */}
        {pathname === "/" ? (
          <div className="fs-home-pad">
            <Outlet />
          </div>
        ) : (
          <Outlet />
        )}
      </FlatShell>

      {/* ═══ MOBILE CHROME — existing components, mounted as the retired shell did ═══ */}
      {isMobile && (
        <MobileTopBar
          pageContext={{ type: pageContextType, title: profile?.display_name || profile?.username }}
          currentUserAvatarUrl={profile?.avatar_url || undefined}
          currentUserInitials={initialsSafe}
          unreadCounts={{
            notifications: Number(notifBadge || 0),
            messages: Number(msgBadge || 0),
          }}
          onProfileDrawerOpen={() => setProfileDrawerOpen(true)}
          onRightRailDrawerOpen={() => setRightRailDrawerOpen(true)}
          onNotificationsOpen={() => navigate("/notifications")}
          onBack={() => navigate(-1)}
        />
      )}
      {isMobile && (
        <MobileBottomNav
          currentRoute={mobileRoute}
          currentUserAvatarUrl={profile?.avatar_url || undefined}
          currentUserInitials={initialsSafe}
          unreadMessageCount={Number(msgBadge || 0)}
          unreadNotificationCount={Number(notifBadge || 0)}
          onNavigate={mobileBottomNavigate}
        />
      )}

      {/* ProfileDrawer — available at all breakpoints */}
      <ProfileDrawer
        isOpen={isProfileDrawerOpen}
        onClose={() => setProfileDrawerOpen(false)}
        currentUser={drawerUser}
        currentRoute={drawerRoute}
        onNavigate={drawerNavigate}
        onSignOut={async () => { await signOut(); navigate("/"); }}
      />

      {/* RightRailDrawer — everywhere below xl, as before */}
      {breakpoint !== "xl" && (
        <RightRailDrawer
          isOpen={isRightRailDrawerOpen}
          onClose={() => setRightRailDrawerOpen(false)}
          onNavigate={(path) => navigate(path)}
        />
      )}
    </>
  );
}

/** Wraps NavProgressChip with live progress data from useProgress. */
function NavProgressChipMount({ onClick }: { onClick?: () => void }) {
  const { level, xpInLevel, xpForNext, progress } = useProgress();
  return (
    <div onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <NavProgressChip
        level={level}
        xpIntoLevel={xpInLevel}
        xpForLevel={xpForNext}
        totalXp={progress?.xp_total}
      />
    </div>
  );
}

export default AppShell;
