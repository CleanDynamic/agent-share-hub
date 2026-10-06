// The site header (UI-P17): the sticky glass bar of the site frame, desktop only.
//
// Lockup · Home / Gallery / Bounties / Library with the lamp under the current
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

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bell, Moon, Plus, Search, Sun } from "lucide-react";
import { memo, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { Avatar } from "@/components/brand/Avatar";
import { Button } from "@/components/brand/Button";
import { IconButton } from "@/components/brand/IconButton";
import { Lockup } from "@/components/brand/Lockup";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { countDraftBuilds } from "@/lib/build/sessions";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { GLASS_BLUR, MENU_ITEM_CLASS, ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { BottomSheet } from "./BottomSheet";
import { FrameLink } from "./FrameLink";
import type { FrameViewer } from "./frameTypes";
import { HeaderSearch, useGallerySearch } from "./HeaderSearch";
import { isActivityPath, PRIMARY_LINKS, SITE_NAV, sectionForPath, type PrimarySection } from "./siteNav";
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

const linkBase: CSSProperties = {
  position: "relative",
  height: 64,
  display: "flex",
  alignItems: "center",
  fontFamily: FIGTREE,
  fontSize: 14,
};

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

const badge: CSSProperties = {
  position: "absolute",
  top: -4,
  right: -4,
  minWidth: 16,
  height: 16,
  borderRadius: 8,
  background: t.action,
  color: t.onAction,
  fontFamily: DM_MONO,
  fontSize: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxSizing: "border-box",
  padding: "0 3px",
};

const draftsBadge: CSSProperties = {
  marginLeft: 6,
  padding: "0 6px",
  borderRadius: 6,
  background: t.cell,
  color: t.text2,
  fontFamily: DM_MONO,
  fontSize: 11,
  lineHeight: "18px",
};

function Lamp({ width, place }: { width: number; place: CSSProperties }) {
  return <span aria-hidden="true" style={{ position: "absolute", width, height: 6, borderRadius: "50%", background: t.lit, boxShadow: t.navLampGlow, ...place }} />;
}

function AccountMenu({ viewer, onSignOut }: { viewer: FrameViewer; onSignOut: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const profileHref = viewer.handle ? `/profile/${viewer.handle}` : SITE_NAV.profile;
  const item: CSSProperties = {
    display: "flex",
    alignItems: "center",
    height: 36,
    padding: "0 12px",
    borderRadius: 10,
    fontFamily: FIGTREE,
    fontSize: 13,
    fontWeight: 500,
    textDecoration: "none",
    outline: "none",
    cursor: "pointer",
    border: 0,
    background: "transparent",
    width: "100%",
    textAlign: "left",
  };
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Account"
          {...handlers}
          style={{ padding: 0, border: 0, background: "transparent", borderRadius: "50%", cursor: "pointer", display: "flex", ...ring(state.focusVisible) }}
        >
          <Avatar size={34} userId={viewer.id} name={viewer.name} hue={viewer.hue} src={viewer.avatarUrl} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          style={{
            minWidth: 190,
            padding: 6,
            borderRadius: 14,
            background: t.solid,
            border: `1px solid ${t.glassBorder}`,
            boxShadow: t.shadowFloat,
            color: t.text,
            zIndex: 50,
          }}
        >
          <DropdownMenu.Item asChild className={MENU_ITEM_CLASS}>
            <Link to={profileHref} style={item}>Profile</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={MENU_ITEM_CLASS}>
            <Link to={SITE_NAV.library} style={item}>Library</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={MENU_ITEM_CLASS}>
            <Link to={SITE_NAV.drafts} style={item}>Drafts</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator style={{ height: 1, margin: "4px 6px", background: t.line }} />
          <DropdownMenu.Item asChild className={MENU_ITEM_CLASS}>
            <button type="button" onClick={onSignOut} style={item}>Sign out</button>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function SiteHeaderView({
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
  newBuildSecondary = false,
  onSearch,
  searchInitial,
}: SiteHeaderViewProps) {
  const wide = useMinWidth(1328);
  const full = useMinWidth(FULL_MIN);
  const compact = !useMinWidth(MID_MIN);
  const searchFull = useMinWidth(SEARCH_FULL_MIN);
  const searchField = useMinWidth(SEARCH_FIELD_MIN);
  const newLabel = useMinWidth(NEW_LABEL_MIN);
  const [searchOpen, setSearchOpen] = useState(false);
  const signedIn = viewer !== null;
  const gap = full ? 28 : compact ? 8 : 14;
  const linkPad = full ? "0 14px" : compact ? "0 8px" : "0 10px";
  const unreadLabel = unread > 9 ? "9+" : String(unread);

  return (
    <header
      data-testid="site-header"
      data-ui="site-header"
      style={{
        position: "relative",
        height: 64,
        background: t.header,
        borderBottom: `1px solid ${t.headerBorder}`,
        backdropFilter: GLASS_BLUR,
        WebkitBackdropFilter: GLASS_BLUR,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1280,
          margin: "0 auto",
          height: 64,
          display: "flex",
          alignItems: "center",
          gap,
          padding: wide ? 0 : compact ? "0 16px" : "0 24px",
          boxSizing: "border-box",
        }}
      >
        <Lockup size={21} to={SITE_NAV.home} />

        <nav aria-label="Primary" style={{ display: "flex", alignItems: "center" }}>
          {PRIMARY_LINKS.filter((link) => !link.authOnly || signedIn).map((link) => {
            const isCurrent = link.key === current;
            return (
              <FrameLink
                key={link.key}
                to={link.href}
                aria-current={isCurrent ? "page" : undefined}
                style={{ ...linkBase, padding: linkPad, fontWeight: isCurrent ? 600 : 500, color: isCurrent ? t.text : t.text2 }}
              >
                {link.label}
                {link.key === "drafts" && drafts > 0 && (
                  <span data-testid="drafts-count" style={draftsBadge}>{drafts}</span>
                )}
                {isCurrent && <Lamp width={26} place={{ left: "50%", marginLeft: -13, bottom: -1 }} />}
              </FrameLink>
            );
          })}
        </nav>

        <span style={{ flexGrow: 1 }} />

        {searchField ? (
          <HeaderSearch onSubmit={onSearch ?? (() => undefined)} initialValue={searchInitial} width={searchFull ? 280 : 200} />
        ) : (
          <IconButton icon={Search} label="Search" size={38} onClick={() => setSearchOpen(true)} />
        )}

        <Button variant={newBuildSecondary ? "secondary" : "primary"} size={38} icon={Plus} onClick={onNewBuild} style={newLabel ? undefined : { width: 38, padding: 0 }}>
          {newLabel ? "New build" : <span style={visuallyHidden}>New build</span>}
        </Button>

        {signedIn && (
          <FrameLink
            to={SITE_NAV.activity}
            aria-label={unread > 0 ? `Activity, ${unread} unread` : "Activity"}
            aria-current={activityCurrent ? "page" : undefined}
            style={{
              position: "relative",
              width: 38,
              height: 38,
              borderRadius: r.control,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: t.text,
              background: activityCurrent ? t.tab : "transparent",
              border: `1px solid ${t.line}`,
              boxSizing: "border-box",
            }}
          >
            <Bell size={17} strokeWidth={1.6} aria-hidden="true" />
            {unread > 0 && <span aria-hidden="true" style={badge}>{unreadLabel}</span>}
          </FrameLink>
        )}

        <IconButton
          size={38}
          icon={theme === "dusk" ? Moon : Sun}
          label={theme === "dusk" ? "Theme: Dusk" : "Theme: Noon"}
          onClick={onToggleTheme}
        />

        {viewer ? (
          <AccountMenu viewer={viewer} onSignOut={onSignOut} />
        ) : (
          <Button variant="secondary" size={38} onClick={onSignIn}>
            Sign in
          </Button>
        )}
      </div>

      {searchField ? null : (
        <BottomSheet open={searchOpen} onOpenChange={setSearchOpen} title="Search">
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
        </BottomSheet>
      )}
    </header>
  );
}

/** The container: the route, the reader, the theme and the unread count, around the pure view. */
function SiteHeaderContainer() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
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
      current={sectionForPath(pathname)}
      activityCurrent={isActivityPath(pathname)}
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
      onNewBuild={() => navigate(SITE_NAV.create)}
      newBuildSecondary={pathname.startsWith("/compose/")}
      onSearch={search}
      searchInitial={pathname === "/gallery" ? (params.get("q") ?? "") : ""}
    />
  );
}

/* UI-P40: memoised, and it takes no props, so a page's data changing (which
   re-renders the frame around it) never re-renders the chrome. It updates on
   its own hooks only. */
export const SiteHeader = memo(SiteHeaderContainer);

export default SiteHeader;
