// The mobile header (Synth 05): below 768px, 64 tall on the Page shade with no line and no fill. The beaver on its own at
// 40, and at the right three 44px round icon buttons: Search (opens a full-width search sheet), Activity and Menu. The menu
// sheet holds the nav (Home, Builds, OpenBuilds, Library), the account's pages, the theme control and Sign out. Signed out,
// Activity is Sign in, as the desktop header offers neither Activity nor Library to a reader who is not signed in.
//
// `MobileHeaderView` is pure (callbacks in, a bar out); `MobileHeader` owns the two sheets, the route and the account.

import { SITE_NAME } from "@/lib/site";
import { Bell, Menu, Search } from "lucide-react";
import { memo, useState, type CSSProperties } from "react";
import { r } from "@/lib/theme/radius";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Icon } from "@/components/brand/Icon";
import { Button } from "@/components/brand/Button";
import { IconButton } from "@/components/brand/IconButton";
import { ThemeSegmented } from "@/components/theme/ThemeSegmented";
import { useAuth } from "@/contexts/AuthContext";
import { useResolvedTheme } from "@/contexts/ThemeContext";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { LazyBottomSheet } from "./LazyBottomSheet";
import type { FrameViewer } from "./frameTypes";
import { RoutedHeaderSearch } from "./HeaderSearch";
import { SITE_NAV } from "./siteNav";
import { deeper, openOver } from "@/pages/site/signin/signinUrl";
import { PHONE_HEADER_HEIGHT, PHONE_LOGO_WIDTH } from "./chromeSize";
import { BeaverLogo } from "./BeaverLogo";
import { FrameLink } from "./FrameLink";
import { isActivityPath, PRIMARY_LINKS } from "./siteNav";

export interface MobileHeaderViewProps {
  viewer: FrameViewer | null;
  onSearchOpen: () => void;
  /** Opens the menu sheet. */
  onAccountOpen: () => void;
  onSignIn: () => void;
  /** Unread notifications, for the Activity button's name and its dot. */
  unread?: number;
  /** On /notifications. */
  activityCurrent?: boolean;
  theme?: "dusk" | "noon";
}

const ROUND_44: CSSProperties = { width: 44, height: 44, borderRadius: r.full };

function RefinedMobileHeaderView({ viewer, onSearchOpen, onAccountOpen, onSignIn, unread = 0, activityCurrent = false, theme = "dusk" }: MobileHeaderViewProps) {
  return (
    <header
      data-testid="mobile-header"
      data-ui="mobile-header"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        height: PHONE_HEADER_HEIGHT,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px 0 16px",
        boxSizing: "border-box",
        background: t.frame,
      }}
    >
      <FrameLink to={SITE_NAV.home} aria-label={`${SITE_NAME} home`} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
        <BeaverLogo theme={theme} size={PHONE_LOGO_WIDTH} />
      </FrameLink>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <IconButton icon={Search} glyph="search" boxed={false} label="Search" size={32} data-hover-fill="" onClick={onSearchOpen} style={ROUND_44} />
        {viewer ? (
          <FrameLink
            to={SITE_NAV.activity}
            aria-label={unread > 0 ? `Activity, ${unread} unread` : "Activity"}
            aria-current={activityCurrent ? "page" : undefined}
            data-hover-fill=""
            style={{ ...ROUND_44, position: "relative", boxSizing: "border-box", display: "inline-flex", alignItems: "center", justifyContent: "center", color: activityCurrent ? t.text : t.text2, background: activityCurrent ? t.controlOn : "transparent", border: `1px solid ${activityCurrent ? t.controlBorder : "transparent"}` }}
          >
            <Icon lucide={Bell} glyph="bell" size={18} />
            {unread > 0 && <span aria-hidden="true" data-testid="unread-dot" style={{ position: "absolute", top: 11, right: 11, width: 5, height: 5, background: t.tabBar }} />}
          </FrameLink>
        ) : (
          <Button variant="secondary" size={32} onClick={onSignIn}>
            Sign in
          </Button>
        )}
        <IconButton icon={Menu} boxed={false} label="Menu" size={32} data-hover-fill="" onClick={onAccountOpen} style={ROUND_44} />
      </div>
    </header>
  );
}

export function MobileHeaderView(props: MobileHeaderViewProps) {
  return <RefinedMobileHeaderView {...props} />;
}

const row: CSSProperties = {
  display: "flex",
  alignItems: "center",
  /* 48 → 39 by the table, held at the 44px touch floor. */
  minHeight: 44,
  padding: "0 4px",
  fontFamily: FIGTREE,
  fontSize: 13,
  fontWeight: 500,
  color: t.text,
  textDecoration: "none",
  border: 0,
  background: "transparent",
  width: "100%",
  textAlign: "left",
  cursor: "pointer",
};

/** The container: the account, the route, and the two sheets. */
function MobileHeaderContainer() {
  const { pathname, state: locationState } = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, user, profile, signOut } = useAuth();
  const theme = useResolvedTheme();
  const { count: unread } = useUnreadNotifications();
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const viewer: FrameViewer | null =
    isLoggedIn && user
      ? {
          id: user.id,
          name: profile?.display_name || profile?.username || "User",
          handle: profile?.username || "",
          avatarUrl: profile?.avatar_url,
        }
      : null;
  const profileHref = viewer?.handle ? `/profile/${viewer.handle}` : SITE_NAV.profile;
  // UX-10 P11: the reader's own profile link says it is the current page there.
  const onOwnProfile = pathname === profileHref || pathname === SITE_NAV.profile;

  return (
    <>
      <MobileHeaderView
        viewer={viewer}
        onSearchOpen={() => setSearchOpen(true)}
        onAccountOpen={() => setAccountOpen(true)}
        unread={unread}
        activityCurrent={isActivityPath(pathname)}
        theme={theme}
        /* G5: the sign-in dialog opens over this page, full screen on a phone. */
        onSignIn={() => navigate(openOver(pathname, window.location.search), { state: deeper(locationState) })}
      />

      <LazyBottomSheet open={searchOpen} onOpenChange={setSearchOpen} title="Search">
        <RoutedHeaderSearch variant="sheet" autoFocus onDone={() => setSearchOpen(false)} />
      </LazyBottomSheet>

      <LazyBottomSheet open={accountOpen} onOpenChange={setAccountOpen} title="Menu">
        {PRIMARY_LINKS.filter((link) => !link.authOnly || viewer).map((link) => {
          const here = link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return <Link key={link.key} to={link.href} aria-current={here ? "page" : undefined} style={row} onClick={() => setAccountOpen(false)}>{link.label}</Link>;
        })}
        {viewer && (
          <>
            <Link to={profileHref} aria-current={onOwnProfile ? "page" : undefined} style={row} onClick={() => setAccountOpen(false)}>Profile</Link>
            <Link to={SITE_NAV.drafts} aria-current={pathname === SITE_NAV.drafts ? "page" : undefined} style={row} onClick={() => setAccountOpen(false)}>Drafts</Link>
            {/* UX-15: Settings, before the theme control and Sign out. */}
            <Link to={SITE_NAV.settings} aria-current={pathname === SITE_NAV.settings || pathname.startsWith(`${SITE_NAV.settings}/`) ? "page" : undefined} style={row} onClick={() => setAccountOpen(false)}>Settings</Link>
          </>
        )}
        <div style={{ padding: "4px 0" }}>
          <ThemeSegmented size={36} fontSize={13} />
        </div>
        {viewer && (
          <button
            type="button"
            style={row}
            onClick={async () => {
              setAccountOpen(false);
              await signOut();
              navigate("/");
            }}
          >
            Sign out
          </button>
        )}
      </LazyBottomSheet>
    </>
  );
}

/* UI-P40: memoised, and it takes no props, so a page's data changing (which
   re-renders the frame around it) never re-renders the chrome. It updates on
   its own hooks only. */
export const MobileHeader = memo(MobileHeaderContainer);

export default MobileHeader;
