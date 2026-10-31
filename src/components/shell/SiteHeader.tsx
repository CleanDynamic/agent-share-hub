// The site header (UI-P17): the sticky glass bar of the site frame, desktop only.
//
// Lockup · Home / Builds / OpenBuilds / Library with the lamp under the current
// one · search · New build · Activity · theme · account. It is the one
// full-width blurred surface on desktop, so nothing inside it blurs.
//
// TWO COMPONENTS. `SiteHeaderView` is pure — props only, so the dev compare page
// renders it with the sample viewer; `SiteHeader` reads the route, `useAuth()`,
// the theme and the unread count and renders the view. `ShellHeader`, `NavSearch`
// and the old bell are untouched: they stay for `FlatShell`.
//
// "CURRENT" IS A SECTION, NOT AN EXACT MATCH (`sectionForPath`): a build page and
// the rebuild page are Gallery; import, compose and Activity are none — the bell
// shows Activity instead. The lamp is `--lit` with `--nav-lamp-glow`: amber is
// light, never text.
//
// LIBRARY AND ACTIVITY ARE SIGNED-IN ONLY, as they are in `allNavItems`: both
// routes sit behind `ProtectedRoute`, so a signed-out header does not offer them.
//
// THE DENSITY PASS (UI-P55). The bar is 52 (64 before) and, as the board draws it,
// its 1px edge sits outside those 52, so the column starts at 53 on every board.
// The links are 13px with 0 10px each side, the gaps 20 / 10 / 6, and the search,
// New build, the bell and the theme control are 31 (38 before). The lockup and
// the brand controls take the drawn sizes and render them through the table
// (21 → 18). The side gutters below 1328 are not drawn on any board and keep the
// 1280 column's edges, so they stay.

import { Bell, Moon, Search, Sun } from "lucide-react";
import { lazy, memo, startTransition, Suspense, useEffect, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/brand/Button";
import { Icon } from "@/components/brand/Icon";
import { IconButton } from "@/components/brand/IconButton";
import { Lockup } from "@/components/brand/Lockup";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { countDraftBuilds } from "@/lib/build/draftCount";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { useCurrentPath, useGo } from "@/lib/routing/go";
import { useIdleReady } from "@/lib/routing/lazyHost";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { AccountButton } from "./AccountButton";
import { HEADER_HEIGHT } from "./chromeSize";
import { FrameLink } from "./FrameLink";
import type { FrameViewer } from "./frameTypes";
import { HeaderSearch, useGallerySearch } from "./HeaderSearch";
import { LazyBottomSheet } from "./LazyBottomSheet";
import { isActivityPath, isBuildsPath, PRIMARY_LINKS, SITE_NAV, sectionForPath, type PrimarySection } from "./siteNav";
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
  onToggleTheme: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onNewBuild: () => void;
  /** "New build" draws as secondary on /compose/*, where Publish is the page's one primary (UI-P47). */
  newBuildSecondary?: boolean;
  /** Search submit. Defaults to nothing (the compare page). */
  onSearch?: (query: string) => boolean | void;
  searchInitial?: string;
}

/* THE HEADER BETWEEN THE BOARDS (UI-P39). The reference draws 1280 and nothing
   else, so below it the header gives ground in steps and drops nothing:
   ≥1260 is the reference's gaps; 960–1259 tightens them; below 960 tightens
   them again. The search is the reference's 280 to 1100 and 200 below it, and
   below 900 an icon button that opens the search sheet. New build loses its
   label below 980 and keeps it as its accessible name. */
const MID_MIN = 960;
const FULL_MIN = 1260;
const SEARCH_FULL_MIN = 1100;
const SEARCH_FIELD_MIN = 900;
const NEW_LABEL_MIN = 980;

const visuallyHidden: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
};

/* SV-26 P2: the account menu and its menu library load apart from the first page (`AccountMenu.tsx`). Until they are
   here the same account button stands in its place; it warms the menu on hover or focus, and a press opens the menu as
   soon as its code arrives. At idle the menu takes over, in a transition, so the button on screen stays until then. */
const loadAccountMenu = () => import("./AccountMenu");
const AccountMenu = lazy(() => loadAccountMenu().then((m) => ({ default: m.AccountMenu })));

function LazyAccountMenu({ viewer, onSignOut, avatarSize = 34 }: { viewer: FrameViewer; onSignOut: () => void; avatarSize?: number }) {
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
      {ready ? <AccountMenu viewer={viewer} onSignOut={onSignOut} avatarSize={avatarSize} defaultOpen={openOnMount} focusOnMount={focused} /> : standIn}
    </Suspense>
  );
}

/* ── UI-P87, refined ──
   On `--frame` with no background and no border, 48 high, `0 20px`, gap 8: the lockup (18 / 14), a 1px × 16 `--line`
   divider, the links (13/500 `--text2`, `0 12px` as the board draws them; the current one `--text` with a 2px
   `--nav-mark` bar 10 in from each side and `--nav-lamp-glow`; Drafts keeps its count at 11/500 `--label`), a spacer,
   the search (240×30, "/"), New build as a secondary button 30 high with no icon, the bell as a ghost 30 icon link with
   the unread count as a 12px `--lit-mark` badge, the theme as a ghost 30 icon button, and the avatar at 26. On
   /notifications the bell takes the `--control-on` fill and the `--control-border` edge, never a colour. The steps the
   header gives ground in between the boards are the current header's. */

const refinedLink: CSSProperties = {
  position: "relative",
  height: HEADER_HEIGHT,
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontFamily: FIGTREE,
  fontSize: 13,
  fontWeight: 500,
};

/* The header's buttons are drawn 30 high with the 32 button's `0 16px` and 13px label (the refined `Button` steps
   28 → 32, and the board draws 30). */
const REFINED_30: CSSProperties = { height: 30, padding: "0 16px", fontSize: 13 };

const refinedBadge: CSSProperties = {
  position: "absolute",
  top: 3,
  right: 3,
  minWidth: 12,
  height: 12,
  padding: "0 3px",
  boxSizing: "border-box",
  borderRadius: 6,
  background: t.litMark,
  color: t.onLit,
  fontFamily: FIGTREE,
  fontSize: 9,
  fontWeight: 600,
  lineHeight: "12px",
  textAlign: "center",
};

function RefinedSiteHeaderView({
  current,
  activityCurrent = false,
  unread,
  drafts = 0,
  viewer,
  theme,
  onToggleTheme,
  onSignIn,
  onSignOut,
  onNewBuild,
  onSearch,
  searchInitial,
}: SiteHeaderViewProps) {
  const full = useMinWidth(FULL_MIN);
  const compact = !useMinWidth(MID_MIN);
  const searchFull = useMinWidth(SEARCH_FULL_MIN);
  const searchField = useMinWidth(SEARCH_FIELD_MIN);
  const newLabel = useMinWidth(NEW_LABEL_MIN);
  const [searchOpen, setSearchOpen] = useState(false);
  const signedIn = viewer !== null;
  const linkPad = full ? "0 12px" : compact ? "0 6px" : "0 8px";
  const unreadLabel = unread > 9 ? "9+" : String(unread);

  return (
    <header
      data-testid="site-header"
      data-ui="site-header"
      style={{
        width: "100%",
        maxWidth: 1440,
        margin: "0 auto",
        height: HEADER_HEIGHT,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 20px",
        boxSizing: "border-box",
      }}
    >
      <span style={{ display: "flex", paddingRight: 8 }}>
        <Lockup size={14} markSize={18} to={SITE_NAV.home} />
      </span>
      <span aria-hidden="true" style={{ width: 1, height: 16, background: t.line, flexShrink: 0 }} />

      <nav aria-label="Primary" style={{ display: "flex", alignItems: "stretch", height: HEADER_HEIGHT, paddingLeft: 4 }}>
        {PRIMARY_LINKS.filter((link) => !link.authOnly || signedIn).map((link) => {
          const isCurrent = link.key === current;
          return (
            <FrameLink
              key={link.key}
              to={link.href}
              aria-current={isCurrent ? "page" : undefined}
              style={{ ...refinedLink, padding: linkPad, color: isCurrent ? t.text : t.text2 }}
              hoverStyle={{ color: t.text }}
            >
              {link.label}
              {link.key === "drafts" && drafts > 0 && (
                <span
                  data-testid="drafts-count"
                  style={{ fontFamily: FIGTREE, fontSize: 11, fontWeight: 500, color: t.label, fontVariantNumeric: "tabular-nums" }}
                >
                  {drafts}
                </span>
              )}
              {isCurrent && (
                <span
                  aria-hidden="true"
                  data-ui="nav-mark"
                  style={{
                    position: "absolute",
                    left: 10,
                    right: 10,
                    bottom: -1,
                    height: 2,
                    borderRadius: 1,
                    background: t.navMark,
                    boxShadow: t.navLampGlow,
                  }}
                />
              )}
            </FrameLink>
          );
        })}
      </nav>

      <span style={{ flexGrow: 1 }} />

      {searchField ? (
        <HeaderSearch onSubmit={onSearch ?? (() => undefined)} initialValue={searchInitial} width={searchFull ? 240 : 200} />
      ) : (
        <IconButton icon={Search} glyph="search" boxed={false} label="Search" size={30} onClick={() => setSearchOpen(true)} />
      )}

      <Button variant="secondary" size={30} onClick={onNewBuild} style={newLabel ? REFINED_30 : { ...REFINED_30, width: 30, padding: 0 }}>
        {newLabel ? "New build" : <span style={visuallyHidden}>New build</span>}
      </Button>

      {signedIn && (
        <FrameLink
          to={SITE_NAV.activity}
          aria-label={unread > 0 ? `Activity, ${unread} unread` : "Activity"}
          aria-current={activityCurrent ? "page" : undefined}
          style={{
            position: "relative",
            width: 30,
            height: 30,
            boxSizing: "border-box",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            borderRadius: r.control,
            color: activityCurrent ? t.text : t.text2,
            ...(activityCurrent
              ? { background: t.controlOn, border: `1px solid ${t.controlBorder}` }
              : { background: "transparent", border: "1px solid transparent" }),
          }}
          hoverStyle={{ color: t.text }}
        >
          <Icon lucide={Bell} glyph="bell" size={16} />
          {unread > 0 && <span aria-hidden="true" style={refinedBadge}>{unreadLabel}</span>}
        </FrameLink>
      )}

      <IconButton
        size={30}
        boxed={false}
        icon={theme === "dusk" ? Moon : Sun}
        glyph={theme === "dusk" ? "moon" : "sun"}
        label={theme === "dusk" ? "Theme: Dusk" : "Theme: Noon"}
        onClick={onToggleTheme}
      />

      {viewer ? (
        <LazyAccountMenu viewer={viewer} onSignOut={onSignOut} avatarSize={26} />
      ) : (
        <Button variant="secondary" size={30} onClick={onSignIn} style={REFINED_30}>
          Sign in
        </Button>
      )}

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

export function SiteHeaderView(props: SiteHeaderViewProps) {
  return <RefinedSiteHeaderView {...props} />;
}

/** The container: the route, the reader, the theme and the unread count, around the pure view. */
function SiteHeaderContainer() {
  const { pathname } = useLocation();
  // SV-04: the nav marks the page a change is on its way to, at once (go.ts).
  const current = useCurrentPath();
  const navigate = useNavigate();
  const go = useGo() ?? navigate;
  const { isLoggedIn, user, profile, signOut } = useAuth();
  const { resolved, setTheme } = useTheme();
  const { count } = useUnreadNotifications();
  const draftCount = useQuery({
    queryKey: ["build", "countDraftBuilds"],
    queryFn: countDraftBuilds,
    enabled: isLoggedIn,
    staleTime: 60_000,
  });
  const search = useGallerySearch();
  const [params] = useSearchParams();

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
    <SiteHeaderView
      current={sectionForPath(current)}
      activityCurrent={isActivityPath(current)}
      unread={count}
      drafts={isLoggedIn ? (draftCount.data ?? 0) : 0}
      viewer={viewer}
      theme={resolved}
      onToggleTheme={() => setTheme(resolved === "dusk" ? "noon" : "dusk")}
      onSignIn={() => navigate(`/login?redirect=${encodeURIComponent(pathname + window.location.search)}`)}
      onSignOut={async () => {
        await signOut();
        navigate("/");
      }}
      onNewBuild={() => go(SITE_NAV.create)}
      newBuildSecondary={pathname.startsWith("/compose/")}
      onSearch={search}
      searchInitial={isBuildsPath(pathname) ? (params.get("q") ?? "") : ""}
    />
  );
}

/* UI-P40: memoised, and it takes no props, so a page's data changing (which
   re-renders the frame around it) never re-renders the chrome. It updates on
   its own hooks only. */
export const SiteHeader = memo(SiteHeaderContainer);

export default SiteHeader;
