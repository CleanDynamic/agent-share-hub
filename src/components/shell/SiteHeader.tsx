// The site header (Synth 05): the beaver on its own, the nav, search, New build, Activity, theme and the account, on the
// Page shade with no line and no fill. 88 tall at the top of a page and 56 once it has scrolled (`useHeaderCompact`).
//
// TWO COMPONENTS. `SiteHeaderView` is pure — props only, so the dev compare page renders it with the sample viewer;
// `SiteHeader` reads the route, `useAuth()`, the theme and the unread count and renders the view.
//
// "CURRENT" IS A SECTION, NOT AN EXACT MATCH (`sectionForPath`): a build page and the rebuild page are Builds; import,
// compose, Drafts and Activity are none. The current tab has `aria-current="page"` and a 3px Mint bar.
//
// LIBRARY AND ACTIVITY ARE SIGNED-IN ONLY: both routes sit behind `ProtectedRoute`, so a signed-out header does not offer
// them. Drafts is in the account menu.

import { Bell, Monitor, Moon, Search, Sun } from "lucide-react";
import { lazy, memo, startTransition, Suspense, useEffect, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/brand/Button";
import { Icon } from "@/components/brand/Icon";
import { IconButton } from "@/components/brand/IconButton";
import { BEAVER_RATIO, BeaverLogo } from "./BeaverLogo";
import { HeaderJumpSearch } from "./HeaderJumpSearch";
import type { PostingWindow } from "@/pages/site/openbuilds/PostingWindows";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { countDraftBuilds } from "@/lib/build/draftCount";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { useCurrentPath, useGo } from "@/lib/routing/go";
import { useIdleReady } from "@/lib/routing/lazyHost";
import { useIntent } from "@/lib/routing/useIntent";
import { deeper, openOver } from "@/pages/site/signin/signinUrl";
import { r } from "@/lib/theme/radius";
import { space } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { NewBuildTrigger } from "./CreateMenu";

import { AccountButton } from "./AccountButton";
import { FRAME_MAX_WIDTH, HEADER_COMPACT_HEIGHT, HEADER_HEIGHT, LOGO_COMPACT_WIDTH, LOGO_WIDTH, PANEL_GUTTER } from "./chromeSize";
import { useHeaderCompact } from "./useHeaderCompact";
import { FrameLink } from "./FrameLink";
import type { FrameViewer } from "./frameTypes";
import { HeaderSearch, useGallerySearch } from "./HeaderSearch";
import { LazyBottomSheet } from "./LazyBottomSheet";
import { isActivityPath, isBuildsPath, PRIMARY_LINKS, SITE_NAV, sectionForPath, type PrimarySection } from "./siteNav";
import { move } from "@/lib/theme/motion";
import { useMinWidth } from "./useMinWidth";

export interface SiteHeaderViewProps {
  /** Which primary link has the lamp, or none. */
  current: PrimarySection | null;
  /** On /notifications: the bell takes `--tab`. */
  activityCurrent?: boolean;
  /** Unread notifications. 0 draws no badge; above nine reads "9+". */
  unread: number;
  /** Drafts the reader has. 0 (or absent) draws no badge after "Drafts". */
  drafts?: number;
  /** The signed-in reader, or null. */
  viewer: FrameViewer | null;
  /** The painted theme, for the theme control. */
  theme: "noon" | "dusk";
  /** The reader's choice (dark, light, system), for the theme control's icon. Absent: the painted theme. */
  themeChoice?: "noon" | "dusk" | "system";
  onToggleTheme: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onNewBuild: () => void;
  /** "New build" draws as secondary on /compose/*, where Publish is the page's one primary (UI-P47). */
  newBuildSecondary?: boolean;
  /** Search submit. Defaults to nothing (the compare page). */
  onSearch?: (query: string) => boolean | void;
  searchInitial?: string;
  onCreate?: (kind: "build" | "import" | "post" | "connect") => void;
}

const MID_MIN = 960;
const FULL_MIN = 1260;
const SEARCH_FULL_MIN = 1100;
const SEARCH_FIELD_MIN = 900;

/* SV-26 P2: the account menu and its menu library load apart from the first page (`AccountMenu.tsx`). Until they are
   here the same account button stands in its place; it warms the menu on hover or focus, and a press opens the menu as
   soon as its code arrives. At idle the menu takes over, in a transition, so the button on screen stays until then. */
const loadAccountMenu = () => import("./AccountMenu");
const AccountMenu = lazy(() => loadAccountMenu().then((m) => ({ default: m.AccountMenu })));

function LazyAccountMenu({ viewer, onSignOut, avatarSize = 24, drafts = 0, theme, onToggleTheme }: { viewer: FrameViewer; onSignOut: () => void; avatarSize?: number; drafts?: number; theme: "dusk" | "noon"; onToggleTheme: () => void }) {
  const idle = useIdleReady();
  const [ready, setReady] = useState(false);
  const [openOnMount, setOpenOnMount] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (idle) startTransition(() => setReady(true));
  }, [idle]);
  const press = () =>
    startTransition(() => {
      setOpenOnMount(true);
      setReady(true);
    });
  const standIn = (
    <AccountButton
      viewer={viewer}
      avatarSize={avatarSize}
      onPointerEnter={() => void loadAccountMenu().catch(() => undefined)}
      onFocus={() => {
        setFocused(true);
        void loadAccountMenu().catch(() => undefined);
      }}
      onBlur={() => setFocused(false)}
      onPointerDown={(event) => {
        if (event.button === 0 && !event.ctrlKey) press();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
          event.preventDefault();
          press();
        }
      }}
    />
  );
  return (
    <Suspense fallback={standIn}>
      {ready ? <AccountMenu viewer={viewer} onSignOut={onSignOut} avatarSize={avatarSize} drafts={drafts} theme={theme} onToggleTheme={onToggleTheme} defaultOpen={openOnMount} focusOnMount={focused} /> : standIn}
    </Suspense>
  );
}

/* THE HEADER BETWEEN THE BOARDS. The pack draws 1440 and nothing else, so below it the header gives ground in steps and
   drops nothing: from 1260 the search is 340, from 1100 it is 300, below that 220; below 900 it is an icon button that
   opens the search sheet. The nav tabs tighten from 12 to 8 either side below 960. */
const TAB_PAD_FULL = 12;
const TAB_PAD_TIGHT = 8;

/** The tab's own bar: 3px Mint, 12 in from each side, radius 2, on the bottom edge; light adds a 1px Ink line under it. */
const TAB_BAR: CSSProperties = {
  position: "absolute",
  left: 12,
  right: 12,
  bottom: 0,
  height: 3,
  borderRadius: 2,
  background: t.tabBar,
  boxShadow: `0 1px 0 ${t.tabBarEdge}`,
};

const ROUND: CSSProperties = { width: 40, height: 40, borderRadius: r.full };

const loadCreateMenu = () => import("./CreateMenu");
const CreateMenu = lazy(() => loadCreateMenu().then((m) => ({ default: m.CreateMenu })));
const PostingWindows = lazy(() => import("@/pages/site/openbuilds/PostingWindows"));
function LazyCreateMenu({ onChoose }: { onChoose: (kind: "build" | "import" | "post" | "connect") => void }) {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const warm = () => { void loadCreateMenu(); };
  const standIn = <NewBuildTrigger aria-expanded={false} onPointerEnter={warm} onFocus={warm} onClick={() => { setOpen(true); setReady(true); }} />;
  return <Suspense fallback={standIn}>{ready ? <CreateMenu onChoose={onChoose} defaultOpen={open} /> : standIn}</Suspense>;
}

function RefinedSiteHeaderView({
  current,
  activityCurrent = false,
  unread,
  drafts = 0,
  viewer,
  theme,
  themeChoice,
  onToggleTheme,
  onSignIn,
  onSignOut,
  onNewBuild,
  onSearch,
  searchInitial,
  onCreate,
}: SiteHeaderViewProps) {
  const full = useMinWidth(FULL_MIN);
  const compact = !useMinWidth(MID_MIN);
  const searchFull = useMinWidth(SEARCH_FULL_MIN);
  const searchField = useMinWidth(SEARCH_FIELD_MIN);
  const edge = useMinWidth(FRAME_MAX_WIDTH + 16);
  const [searchOpen, setSearchOpen] = useState(false);
  const signedIn = viewer !== null;
  const tabPad = compact ? TAB_PAD_TIGHT : TAB_PAD_FULL;
  const shrunk = useHeaderCompact();
  const barHeight = shrunk ? HEADER_COMPACT_HEIGHT : HEADER_HEIGHT;
  const choice = themeChoice ?? theme;
  const ThemeIcon = choice === "system" ? Monitor : choice === "dusk" ? Moon : Sun;
  const themeLabel = choice === "system" ? "Theme: System" : choice === "dusk" ? "Theme: Dark" : "Theme: Light";

  return (
    <header
      data-testid="site-header"
      data-ui="site-header"
      style={{
        /* The 1280 container, centred: the beaver is 80 from the window's edge at 1440. Below 1296 the window's edge is 8 away. */
        width: "100%",
        maxWidth: FRAME_MAX_WIDTH,
        margin: "0 auto",
        height: barHeight,
        display: "flex",
        alignItems: "center",
        gap: space[2],
        padding: edge ? 0 : `0 ${PANEL_GUTTER}px`,
        boxSizing: "border-box",
      }}
    >
      <FrameLink to={SITE_NAV.home} aria-label="OpenBuilds.ai home" style={{ flexShrink: 0, display: "block" }}>
        <span style={{ display: "block", width: shrunk ? LOGO_COMPACT_WIDTH : LOGO_WIDTH, height: Math.round((shrunk ? LOGO_COMPACT_WIDTH : LOGO_WIDTH) * BEAVER_RATIO) }}>
          <BeaverLogo theme={theme} size={LOGO_WIDTH} style={{ transformOrigin: "left top", transform: shrunk ? `scale(${LOGO_COMPACT_WIDTH / LOGO_WIDTH})` : "none", transition: move() }} />
        </span>
      </FrameLink>
      <nav aria-label="Primary" style={{ display: "flex", alignItems: "stretch", height: barHeight, marginLeft: 28 - space[2] }}>
        {PRIMARY_LINKS.filter((link) => !link.authOnly || signedIn).map((link) => {
          const isCurrent = link.key === current;
          return (
            <FrameLink
              key={link.key}
              to={link.href}
              aria-current={isCurrent ? "page" : undefined}
              style={{ position: "relative", display: "flex", alignItems: "center", height: barHeight, padding: `0 ${tabPad}px`, fontFamily: FIGTREE, fontSize: 15, fontWeight: isCurrent ? 600 : 500, color: isCurrent ? t.text : t.label, whiteSpace: "nowrap" }}
              hoverStyle={{ color: t.text }}
            >
              {link.label}
              {isCurrent && <span aria-hidden="true" data-testid="nav-bar" style={{ ...TAB_BAR, left: tabPad, right: tabPad }} />}
            </FrameLink>
          );
        })}
      </nav>

      <span style={{ flexGrow: 1 }} />

      {searchField ? <HeaderJumpSearch signedIn={signedIn} width={full ? 340 : searchFull ? 300 : 220} initialValue={searchInitial} onSubmit={onSearch ?? (() => undefined)} /> : <IconButton icon={Search} glyph="search" boxed={false} label="Search" size={32} data-hover-fill="" onClick={() => setSearchOpen(true)} style={ROUND} />}

      <LazyCreateMenu onChoose={(kind) => { if (!viewer) onSignIn(); else if (onCreate) onCreate(kind); else if (kind === "build") onNewBuild(); }} />

      {signedIn && (
        <FrameLink
          to={SITE_NAV.activity}
          aria-label={unread > 0 ? `Activity, ${unread} unread` : "Activity"}
          aria-current={activityCurrent ? "page" : undefined}
          data-hover-fill=""
          style={{
            ...ROUND,
            position: "relative",
            boxSizing: "border-box",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: activityCurrent ? t.text : t.text2,
            background: activityCurrent ? t.controlOn : "transparent",
            border: `1px solid ${activityCurrent ? t.controlBorder : "transparent"}`,
          }}
          hoverStyle={{ color: t.text }}
        >
          <Icon lucide={Bell} glyph="bell" size={18} />
          {unread > 0 && <span aria-hidden="true" data-testid="unread-dot" style={{ position: "absolute", top: 8, right: 8, width: 5, height: 5, borderRadius: 0, background: t.tabBar }} />}
        </FrameLink>
      )}

      <IconButton icon={ThemeIcon} glyph={choice === "system" ? undefined : choice === "dusk" ? "moon" : "sun"} boxed={false} label={themeLabel} size={32} data-hover-fill="" onClick={onToggleTheme} style={{ ...ROUND }} />

      {viewer ? <LazyAccountMenu viewer={viewer} onSignOut={onSignOut} avatarSize={32} drafts={drafts} theme={theme} onToggleTheme={onToggleTheme} /> : <SignInControl onSignIn={onSignIn} />}

      {searchField ? null : (
        <LazyBottomSheet open={searchOpen} onOpenChange={setSearchOpen} title="Search">
          <HeaderSearch
            variant="sheet"
            autoFocus
            initialValue={searchInitial}
            onSubmit={(query) => {
              const used = onSearch?.(query);
              if (used) setSearchOpen(false);
              return used;
            }}
          />
        </LazyBottomSheet>
      )}
    </header>
  );
}

/** UX-01 P9: hovering or focusing Sign in opens the sign-in page's chunk, as a link in the route table does. */
function SignInControl({ onSignIn }: { onSignIn: () => void }) {
  const intent = useIntent("/login");
  return (
    <Button variant="secondary" size={32} onClick={onSignIn} {...intent}>
      Sign in
    </Button>
  );
}

export function SiteHeaderView(props: SiteHeaderViewProps) {
  return <RefinedSiteHeaderView {...props} />;
}

/** The container: the route, the reader, the theme and the unread count, around the pure view. */
function SiteHeaderContainer() {
  const { pathname, state: locationState } = useLocation();
  // SV-04: the nav marks the page a change is on its way to, at once (go.ts).
  const current = useCurrentPath();
  const navigate = useNavigate();
  const go = useGo() ?? navigate;
  const { isLoggedIn, user, profile, signOut } = useAuth();
  const { resolved, theme: themeChoice, setTheme } = useTheme();
  const { count } = useUnreadNotifications();
  const draftCount = useQuery({
    queryKey: ["build", "countDraftBuilds"],
    queryFn: countDraftBuilds,
    enabled: isLoggedIn,
    staleTime: 60_000,
  });
  const search = useGallerySearch();
  const [params] = useSearchParams();
  const [posting, setPosting] = useState<PostingWindow | null>(null);

  const viewer: FrameViewer | null =
    isLoggedIn && user
      ? {
          id: user.id,
          name: profile?.display_name || profile?.username || "User",
          handle: profile?.username || "",
          avatarUrl: profile?.avatar_url,
        }
      : null;

  return (
    <>
    <SiteHeaderView
      current={sectionForPath(current)}
      activityCurrent={isActivityPath(current)}
      unread={count}
      drafts={isLoggedIn ? (draftCount.data ?? 0) : 0}
      viewer={viewer}
      theme={resolved}
      themeChoice={themeChoice}
      onToggleTheme={() => setTheme(themeChoice === "dusk" ? "noon" : themeChoice === "noon" ? "system" : "dusk")}
      /* G5: the sign-in dialog opens over this page (`?signin=login`), coming back here once signed in. */
      onSignIn={() => navigate(openOver(pathname, window.location.search), { state: deeper(locationState) })}
      onSignOut={async () => {
        await signOut();
        navigate("/");
      }}
      onNewBuild={() => go(SITE_NAV.create)}
      onCreate={(kind) => {
        if (!viewer) { navigate(openOver(pathname, window.location.search), { state: deeper(locationState) }); return; }
        if (kind === "post") setPosting({ kind: "post" });
        else go(kind === "build" ? SITE_NAV.create : kind === "import" ? "/import" : "/connect");
      }}
      newBuildSecondary={pathname.startsWith("/compose/")}
      onSearch={search}
      searchInitial={isBuildsPath(pathname) ? (params.get("q") ?? "") : ""}
    />
    {posting && <Suspense fallback={null}><PostingWindows window={posting} onClose={() => setPosting(null)} onReopen={setPosting} /></Suspense>}
    </>
  );
}

/* UI-P40: memoised, and it takes no props, so a page's data changing (which
   re-renders the frame around it) never re-renders the chrome. It updates on
   its own hooks only. */
export const SiteHeader = memo(SiteHeaderContainer);

export default SiteHeader;
