// The site footer (UI-P18): lockup, five links, the theme control, the credit.
//
// `<footer>` full width, 88px, a 1px `--header-border` top edge on `--header`
// with NO blur (the header is the one blurred surface). The inner row is the
// 1280 column. The last link is "Sign in" when signed out and "Sign out" — a
// button in the same style — when signed in; the reference draws the signed-out
// item, so that difference is expected in the compare.

import { memo, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useConnectorDialog } from "@/components/connect/ConnectorDialog";
import { Lockup } from "@/components/brand/Lockup";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeSegmented } from "@/components/theme/ThemeSegmented";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { FrameLink } from "./FrameLink";
import { SITE_NAV } from "./siteNav";
import { useMinWidth } from "./useMinWidth";

export interface SiteFooterViewProps {
  signedIn: boolean;
  onSignOut: () => void;
  /** "Connect a tool": opens the connector guide. */
  onConnect: () => void;
  /** Defaults to the live `ThemeSegmented` (32, 11px). The compare page passes a static one. */
  themeControl?: ReactNode;
}

const link: CSSProperties = { fontFamily: FIGTREE, fontSize: 13, color: t.text2 };

export function SiteFooterView({ signedIn, onSignOut, onConnect, themeControl }: SiteFooterViewProps) {
  const wide = useMinWidth(1328);
  /* Below 1100 the row cannot hold lockup, five links, the theme control and the
     credit on one line, so it wraps and the footer grows past its 88px. */
  const narrow = !useMinWidth(1100);
  return (
    <footer
      data-testid="site-footer"
      data-ui="site-footer"
      style={{ height: narrow ? undefined : 88, minHeight: 88, borderTop: `1px solid ${t.headerBorder}`, background: t.header, boxSizing: "border-box", overflow: "hidden" }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1280,
          margin: "0 auto",
          height: narrow ? undefined : 88,
          minHeight: 88,
          display: "flex",
          flexWrap: narrow ? "wrap" : undefined,
          alignItems: "center",
          gap: narrow ? "12px 20px" : 28,
          padding: wide ? 0 : narrow ? "12px 24px" : "0 24px",
          boxSizing: "border-box",
        }}
      >
        <Lockup size={16} to={SITE_NAV.home} />
        <nav aria-label="Footer" style={{ display: "flex", flexWrap: narrow ? "wrap" : undefined, gap: narrow ? "8px 16px" : 22 }}>
          <FrameLink to="/about" style={link}>About</FrameLink>
          <FrameLink to="/api-docs" style={link}>API docs</FrameLink>
          <FrameLink to="/bounties/solvers" style={link}>Solvers</FrameLink>
          <button
            type="button"
            onClick={onConnect}
            style={{ ...link, padding: 0, border: 0, background: "transparent", cursor: "pointer" }}
          >
            Connect a tool
          </button>
          {signedIn ? (
            <button
              type="button"
              onClick={onSignOut}
              style={{ ...link, padding: 0, border: 0, background: "transparent", cursor: "pointer" }}
            >
              Sign out
            </button>
          ) : (
            <FrameLink to="/login" style={link}>Sign in</FrameLink>
          )}
        </nav>
        <span style={{ flexGrow: 1 }} />
        {themeControl ?? <ThemeSegmented size={32} fontSize={11} />}
        <span style={{ fontFamily: DM_MONO, fontSize: 11, color: t.label }}>© buildgallery</span>
      </div>
    </footer>
  );
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
