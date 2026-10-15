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
//
// THE DENSITY PASS (UI-P55). The bar is 52 (64 before) and, as the board draws it,
// its 1px edge sits outside those 52, so the column starts at 53 on every board.
// The links are 13px with 0 10px each side, the gaps 20 / 10 / 6, and the search,
// New build, the bell and the theme control are 31 (38 before). The lockup and
// the brand controls take the drawn sizes and render them through the table
// (21 → 18). The side gutters below 1328 are not drawn on any board and keep the
// 1280 column's edges, so they stay.

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bell, Moon, Search, Sun } from "lucide-react";
import { memo, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { Avatar } from "@/components/brand/Avatar";
import { Button } from "@/components/brand/Button";
import { Icon } from "@/components/brand/Icon";
import { IconButton } from "@/components/brand/IconButton";
import { Lockup } from "@/components/brand/Lockup";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { countDraftBuilds } from "@/lib/build/sessions";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { MENU_ITEM_CLASS, ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

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

function AccountMenu({ viewer, onSignOut, avatarSize = 34 }: { viewer: FrameViewer; onSignOut: () => void; avatarSize?: number }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const profileHref = viewer.handle ? `/profile/${viewer.handle}` : SITE_NAV.profile;
  const item: CSSProperties = {
    display: "flex",
    alignItems: "center",
    height: 30,
    padding: "0 9px",
    borderRadius: 10,
    fontFamily: FIGTREE,
    fontSize: 12,
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
          <Avatar size={avatarSize} userId={viewer.id} name={viewer.name} hue={viewer.hue} src={viewer.avatarUrl} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          style={{
            minWidth: 190,
            padding: 4,
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
          <DropdownMenu.Separator style={{ height: 1, margin: "4px 4px", background: t.line }} />
          <DropdownMenu.Item asChild className={MENU_ITEM_CLASS}>
            <button type="button" onClick={onSignOut} style={item}>Sign out</button>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
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
  height: 48,
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
        height: 48,
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

      <nav aria-label="Primary" style={{ display: "flex", alignItems: "stretch", height: 48, paddingLeft: 4 }}>
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
        <AccountMenu viewer={viewer} onSignOut={onSignOut} avatarSize={26} />
      ) : (
        <Button variant="secondary" size={30} onClick={onSignIn} style={REFINED_30}>
          Sign in
        </Button>
      )}

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

export function SiteHeaderView(props: SiteHeaderViewProps) {
  return <RefinedSiteHeaderView {...props} />;
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
