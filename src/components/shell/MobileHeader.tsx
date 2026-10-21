// The mobile header (UI-P19): the sticky glass bar of the site frame below 768px.
//
// 48px and its 1px edge (58 before the UI-P55 density pass), `--header` with the
// one blur value, the lockup on the left and on the right a Search button (opens
// a full-width search sheet) and the account control — the avatar (opens the
// account sheet) or a Sign in button. It replaces `MobileTopBar` on site-frame
// routes; `MobileTopBar` stays for `FlatShell`. The avatar's button keeps its
// 44px touch target and the account sheet's rows keep 44; the type and the gaps
// tighten, and the brand controls render their drawn sizes through the table.
//
// `MobileHeaderView` is pure (callbacks in, a bar out); `MobileHeader` owns the
// two sheets, the route and the account. The account sheet is Profile, Library, Drafts,
// the theme control (Noon · Dusk · System) and Sign out. There is no Settings
// row: the app has no settings route to send it to.

import { Search } from "lucide-react";
import { memo, useState, type CSSProperties } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Avatar } from "@/components/brand/Avatar";
import { Button } from "@/components/brand/Button";
import { IconButton } from "@/components/brand/IconButton";
import { Lockup } from "@/components/brand/Lockup";
import { ThemeSegmented } from "@/components/theme/ThemeSegmented";
import { useAuth } from "@/contexts/AuthContext";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { BottomSheet } from "./BottomSheet";
import type { FrameViewer } from "./frameTypes";
import { RoutedHeaderSearch } from "./HeaderSearch";
import { SITE_NAV } from "./siteNav";
import { HEADER_HEIGHT } from "./chromeSize";

export interface MobileHeaderViewProps {
  viewer: FrameViewer | null;
  onSearchOpen: () => void;
  onAccountOpen: () => void;
  onSignIn: () => void;
}

function AvatarButton({ viewer, onClick, size = 34 }: { viewer: FrameViewer; onClick: () => void; size?: number }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-label="Account"
      onClick={onClick}
      {...handlers}
      style={{
        /* The 44px touch target, hung outside the drawn avatar so the row lays
           out as the board's: (44 − 28) / 2 = 8 each side since UI-P55 (5 around
           the 34 before). */
        width: 44,
        height: 44,
        margin: `${-(44 - (size === 34 ? 28 : size)) / 2}px`,
        padding: 0,
        border: 0,
        background: "transparent",
        borderRadius: "50%",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...ring(state.focusVisible),
      }}
    >
      <Avatar size={size} userId={viewer.id} name={viewer.name} hue={viewer.hue} src={viewer.avatarUrl} />
    </button>
  );
}

/* UI-P87, refined: on `--frame`, 48 high with no edge and no blur, `0 12px`: the lockup (18 / 14), then the search as a
   ghost 30 icon button and the avatar at 26 (inside its 44px touch target), or Sign in. */
function RefinedMobileHeaderView({ viewer, onSearchOpen, onAccountOpen, onSignIn }: MobileHeaderViewProps) {
  return (
    <header
      data-testid="mobile-header"
      data-ui="mobile-header"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        height: HEADER_HEIGHT,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        boxSizing: "border-box",
        background: t.frame,
      }}
    >
      <Lockup size={14} markSize={18} to={SITE_NAV.home} />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <IconButton icon={Search} glyph="search" boxed={false} label="Search" size={30} onClick={onSearchOpen} />
        {viewer ? (
          <AvatarButton viewer={viewer} onClick={onAccountOpen} size={26} />
        ) : (
          <Button variant="secondary" size={30} onClick={onSignIn} style={{ height: 30 }}>
            Sign in
          </Button>
        )}
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
  fontSize: 14,
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
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, user, profile, signOut } = useAuth();
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

  return (
    <>
      <MobileHeaderView
        viewer={viewer}
        onSearchOpen={() => setSearchOpen(true)}
        onAccountOpen={() => setAccountOpen(true)}
        onSignIn={() => navigate(`/login?redirect=${encodeURIComponent(pathname + window.location.search)}`)}
      />

      <BottomSheet open={searchOpen} onOpenChange={setSearchOpen} title="Search">
        <RoutedHeaderSearch variant="sheet" autoFocus onDone={() => setSearchOpen(false)} />
      </BottomSheet>

      <BottomSheet open={accountOpen} onOpenChange={setAccountOpen} title="Account">
        <Link to={profileHref} style={row} onClick={() => setAccountOpen(false)}>Profile</Link>
        <Link to={SITE_NAV.library} style={row} onClick={() => setAccountOpen(false)}>Library</Link>
        <Link to={SITE_NAV.drafts} style={row} onClick={() => setAccountOpen(false)}>Drafts</Link>
        <div style={{ padding: "4px 0" }}>
          <ThemeSegmented size={36} fontSize={11} />
        </div>
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
      </BottomSheet>
    </>
  );
}

/* UI-P40: memoised, and it takes no props, so a page's data changing (which
   re-renders the frame around it) never re-renders the chrome. It updates on
   its own hooks only. */
export const MobileHeader = memo(MobileHeaderContainer);

export default MobileHeader;
