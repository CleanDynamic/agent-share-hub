// The site footer (UI-P18): lockup, five links, the theme control, the credit.
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

import { memo, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useConnectorDialog } from "@/components/connect/ConnectorDialog";
import { Lockup } from "@/components/brand/Lockup";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeSegmented } from "@/components/theme/ThemeSegmented";
import { useLook } from "@/lib/theme/look";
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

const link: CSSProperties = { fontFamily: FIGTREE, fontSize: 12, color: t.text2 };

/* UI-P87, refined: inside the surface, under a 1px `--hairline`, `12px <gutter>`, wrapping with `12px 24px` between
   items: the lockup (15 / 13), the links at 12.5 `--text2` `8px 20px` apart, a spacer, the Theme segmented control at
   26, and "© buildgallery" at 12 `--label`. The items, their order and their names are the current footer's. */
const refinedLink: CSSProperties = { fontFamily: FIGTREE, fontSize: 12.5, fontWeight: 400, color: t.text2 };
const refinedButtonLink: CSSProperties = { ...refinedLink, padding: 0, border: 0, background: "transparent", cursor: "pointer" };

function RefinedSiteFooterView({ signedIn, onSignOut, onConnect, themeControl }: SiteFooterViewProps) {
  return (
    <footer
      data-testid="site-footer"
      data-ui="site-footer"
      data-look="refined"
      style={{
        marginTop: "auto",
        borderTop: `1px solid ${t.hairline}`,
        padding: "12px clamp(16px, 4.6vw, 64px)",
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
        <FrameLink to="/bounties/solvers" style={refinedLink} hoverStyle={{ color: t.text }}>Solvers</FrameLink>
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
      {themeControl ?? <ThemeSegmented size={26} fontSize={12} />}
      <span style={{ fontFamily: FIGTREE, fontSize: 12, fontWeight: 400, color: t.label }}>© buildgallery</span>
    </footer>
  );
}

export function SiteFooterView(props: SiteFooterViewProps) {
  const refined = useLook() === "refined";
  return refined ? <RefinedSiteFooterView {...props} /> : <CurrentSiteFooterView {...props} />;
}

function CurrentSiteFooterView({ signedIn, onSignOut, onConnect, themeControl }: SiteFooterViewProps) {
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
          gap: narrow ? "9px 14px" : 20,
          padding: wide ? 0 : narrow ? "9px 24px" : "0 24px",
          boxSizing: "border-box",
        }}
      >
        <Lockup size={16} to={SITE_NAV.home} />
        <nav aria-label="Footer" style={{ display: "flex", flexWrap: narrow ? "wrap" : undefined, gap: narrow ? "6px 12px" : 16 }}>
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
