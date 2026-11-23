// The site footer (Synth 05): on the Page shade under the panels, with no line above it. The beaver at 48, then the links
// at 13/400 `--text2` 20 apart (About, Privacy, Terms, Community rules, Report a problem, Contact, Connect a tool), and at
// the right "Sign out" (signed in) or "Sign in", underlined, in `--text`. Padding 20px 80px 28px: the beaver and the last
// control sit where the header's do (the 1280 container's edges, 80 from the window at 1440).
//
// Privacy and Terms appear only once their text has been reviewed (`src/content/legal/reviewed.ts`); Community rules,
// Report a problem and Contact appear together once the Terms they repeat are reviewed.

import { memo, type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { PRIVACY_REVIEWED, TERMS_REVIEWED } from "@/content/legal/reviewed";
import { useAuth } from "@/contexts/AuthContext";
import { useResolvedTheme } from "@/contexts/ThemeContext";
import { touchHit } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { deeper, openOver } from "@/pages/site/signin/signinUrl";

import { BeaverLogo } from "./BeaverLogo";
import { FOOTER_LOGO_WIDTH, FRAME_MAX_WIDTH, PANEL_GUTTER } from "./chromeSize";
import { FrameLink } from "./FrameLink";
import { SITE_NAV } from "./siteNav";
import { useIsPhone, useMinWidth } from "./useMinWidth";

export interface SiteFooterViewProps {
  signedIn?: boolean;
  onSignOut?: () => void;
  /** UX-12 P3: a legal link appears only once its text has been reviewed (src/content/legal/reviewed.ts). */
  showPrivacy?: boolean;
  showTerms?: boolean;
  /** TB-02: Community rules, Report a problem and Contact, shown together once the Terms they repeat are reviewed. */
  showFooterPages?: boolean;
  /** Where Sign in goes: the sign-in dialog over the page, and the history state that push carries. */
  signInTo?: string;
  signInState?: unknown;
  /** Sign in as an action, where the container opens the dialog itself. */
  onSignIn?: () => void;
}

const linkStyle: CSSProperties = { fontFamily: FIGTREE, fontSize: 13, fontWeight: 400, color: t.text2 };
const actionStyle: CSSProperties = { ...linkStyle, fontWeight: 400, color: t.text, textDecoration: "underline", textUnderlineOffset: 4, background: "transparent", border: 0, padding: 0, cursor: "pointer" };

export function SiteFooterView({ signedIn = false, onSignOut, onSignIn, showPrivacy = false, showTerms = false, showFooterPages = false, signInTo, signInState }: SiteFooterViewProps) {
  const theme = useResolvedTheme();
  const phone = useIsPhone();
  const edge = useMinWidth(FRAME_MAX_WIDTH + 16);
  const { pathname } = useLocation();
  const links = [
    { label: "About", href: "/about" },
    ...(showPrivacy ? [{ label: "Privacy", href: "/privacy" }] : []),
    ...(showTerms ? [{ label: "Terms", href: "/terms" }] : []),
    ...(showFooterPages ? [{ label: "Community rules", href: "/rules" }, { label: "Report a problem", href: "/report" }, { label: "Contact", href: "/contact" }] : []),
    { label: "Connect a tool", href: "/connect" },
  ];
  const side = edge ? 0 : PANEL_GUTTER;
  return (
    <footer
      data-testid="site-footer"
      data-ui="site-footer"
      style={{
        /* On the Page, inside the container: its 8px side padding is taken back, so the footer's edges are the container's. */
        width: "calc(100% + 16px)",
        margin: `auto -${PANEL_GUTTER}px 0`,
        boxSizing: "border-box",
        padding: `20px ${side}px 28px`,
        display: "flex",
        flexWrap: "wrap",
        alignItems: phone ? "flex-start" : "center",
        flexDirection: phone ? "column" : "row",
        gap: phone ? 12 : 20,
      }}
    >
      <FrameLink to={SITE_NAV.home} aria-label="OpenBuilds.ai home" style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
        <BeaverLogo theme={theme} size={FOOTER_LOGO_WIDTH} />
      </FrameLink>
      <nav aria-label="Footer" style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px", flexGrow: 1 }}>
        {links.map(({ label, href }) => <FrameLink key={href} to={href} aria-current={pathname === href ? "page" : undefined} style={{ ...linkStyle, color: pathname === href ? t.text : t.text2, display: "inline-flex", alignItems: "center", minWidth: phone ? 44 : undefined, textUnderlineOffset: 4, ...touchHit(phone, 44) }} hoverStyle={{ color: t.text, textDecoration: "underline" }}>{label}</FrameLink>)}
      </nav>
      {signedIn ? (
        <button type="button" onClick={onSignOut} style={{ ...actionStyle, ...touchHit(phone, 44) }}>Sign out</button>
      ) : signInTo ? (
        <FrameLink to={signInTo} state={signInState} style={{ ...actionStyle, ...touchHit(phone, 44), display: "inline-flex", alignItems: "center" }}>Sign in</FrameLink>
      ) : (
        <button type="button" onClick={onSignIn} style={{ ...actionStyle, ...touchHit(phone, 44) }}>Sign in</button>
      )}
    </footer>
  );
}

/** The container: signed-in state and sign-out from `useAuth()`. */
function SiteFooterContainer() {
  const { isLoggedIn, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname, state } = useLocation();
  return (
    <SiteFooterView
      signedIn={isLoggedIn}
      onSignOut={async () => {
        await signOut();
        navigate("/");
      }}
      onSignIn={() => navigate(openOver(pathname, window.location.search), { state: deeper(state) })}
      showPrivacy={PRIVACY_REVIEWED}
      showTerms={TERMS_REVIEWED}
      showFooterPages={TERMS_REVIEWED}
    />
  );
}

/* UI-P40: memoised, and it takes no props, so a page's data changing (which
   re-renders the frame around it) never re-renders the chrome. It updates on
   its own hooks only. */
export const SiteFooter = memo(SiteFooterContainer);

export default SiteFooter;
