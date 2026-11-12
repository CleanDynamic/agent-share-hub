// The site footer (UI-P18): lockup, five links, the credit. UX-03 P10: no theme control; the header's is the one.
//
// `<footer>` full width, 88px, a 1px `--header-border` top edge on `--header`
// with NO blur (the header is the one blurred surface). The inner row is the
// 1280 column. The last link is "Sign in" when signed out and "Sign out" — a
// button in the same style — when signed in; the reference draws the signed-out
// item, so that difference is expected in the compare.
//
// DENSER SINCE UI-P55: the row is 20 apart and the links 16 apart in 12px type;
// the 88px height is over the table's band and stays. The lockup and the theme
// control take the drawn 16 and 32/11 and render them through the table. The
// side gutters below 1328 keep the column's edges, as the header's do.

import { memo, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";

import { useConnectorDialog } from "@/components/connect/ConnectorDialog";
import { Lockup } from "@/components/brand/Lockup";
import { useAuth } from "@/contexts/AuthContext";
import { PRIVACY_REVIEWED, TERMS_REVIEWED } from "@/content/legal/reviewed";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { FrameLink } from "./FrameLink";
import { SITE_NAV } from "./siteNav";
import { SITE_NAME } from "@/lib/site";

export interface SiteFooterViewProps {
  signedIn: boolean;
  onSignOut: () => void;
  /** "Connect a tool": opens the connector guide. */
  onConnect: () => void;
  /** UX-12 P3: a legal link appears only once its text has been reviewed (src/content/legal/reviewed.ts). */
  showPrivacy?: boolean;
  showTerms?: boolean;
}

/* UI-P87, refined: inside the surface, under a 1px `--hairline`, `12px <gutter>`, wrapping with `12px 24px` between
   items: the lockup (15 / 13), the links at 12.5 `--text2` `8px 20px` apart, a spacer, and "© buildgallery" at 12
   `--label`. The items, their order and their names are the current footer's; UX-03 P10 took out the Theme control. */
const refinedLink: CSSProperties = { fontFamily: FIGTREE, fontSize: 12.5, fontWeight: 400, color: t.text2 };
const refinedButtonLink: CSSProperties = { ...refinedLink, padding: 0, border: 0, background: "transparent", cursor: "pointer" };

function RefinedSiteFooterView({ signedIn, onSignOut, onConnect, showPrivacy = false, showTerms = false }: SiteFooterViewProps) {
  return (
    <footer
      data-testid="site-footer"
      data-ui="site-footer"
      style={{
        marginTop: "auto",
        borderTop: `1px solid ${t.hairline}`,
        /* The page's 56 content edge, less the surface's 1px border. */
        padding: "12px 55px",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "12px 24px",
      }}
    >
      <Lockup size={13} markSize={15} to={SITE_NAV.home} />
      <nav aria-label="Footer" style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px" }}>
        <FrameLink to="/about" style={refinedLink} hoverStyle={{ color: t.text }}>About</FrameLink>
        <FrameLink to="/api-docs" style={refinedLink} hoverStyle={{ color: t.text }}>API docs</FrameLink>
        {showPrivacy ? <FrameLink to="/privacy" style={refinedLink} hoverStyle={{ color: t.text }}>Privacy</FrameLink> : null}
        {showTerms ? <FrameLink to="/terms" style={refinedLink} hoverStyle={{ color: t.text }}>Terms</FrameLink> : null}
        <button type="button" onClick={onConnect} style={refinedButtonLink}>
          Connect a tool
        </button>
        {signedIn ? (
          <button type="button" onClick={onSignOut} style={refinedButtonLink}>
            Sign out
          </button>
        ) : (
          <FrameLink to="/login" style={refinedLink} hoverStyle={{ color: t.text }}>Sign in</FrameLink>
        )}
      </nav>
      <span style={{ flexGrow: 1 }} />
      <span style={{ fontFamily: FIGTREE, fontSize: 12, fontWeight: 400, color: t.label }}>© {SITE_NAME}</span>
    </footer>
  );
}

export function SiteFooterView(props: SiteFooterViewProps) {
  return <RefinedSiteFooterView {...props} />;
}

/** The container: signed-in state and sign-out from `useAuth()`. */
function SiteFooterContainer() {
  const { isLoggedIn, signOut } = useAuth();
  const navigate = useNavigate();
  const connector = useConnectorDialog();
  return (
    <SiteFooterView
      signedIn={isLoggedIn}
      onConnect={connector.open}
      showPrivacy={PRIVACY_REVIEWED}
      showTerms={TERMS_REVIEWED}
      onSignOut={async () => {
        await signOut();
        navigate("/");
      }}
    />
  );
}

/* UI-P40: memoised, and it takes no props, so a page's data changing (which
   re-renders the frame around it) never re-renders the chrome. It updates on
   its own hooks only. */
export const SiteFooter = memo(SiteFooterContainer);

export default SiteFooter;
