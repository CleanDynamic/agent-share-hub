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
import { useLocation } from "react-router-dom";

import { useResolvedTheme } from "@/contexts/ThemeContext";
import { touchHit } from "@/lib/theme/controls";
import { useIsPhone } from "./useMinWidth";
import { BeaverLogo } from "./BeaverLogo";
import { PRIVACY_REVIEWED, TERMS_REVIEWED } from "@/content/legal/reviewed";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { FrameLink } from "./FrameLink";
import { SITE_NAV } from "./siteNav";
import { SITE_NAME } from "@/lib/site";

export interface SiteFooterViewProps {
  signedIn?: boolean;
  onSignOut?: () => void;
  /** "Connect a tool": opens the connector guide. */
  onConnect?: () => void;
  /** UX-12 P3: a legal link appears only once its text has been reviewed (src/content/legal/reviewed.ts). */
  showPrivacy?: boolean;
  showTerms?: boolean;
  /** TB-02: Community rules, Report a problem and Contact, shown together once the Terms they repeat are reviewed. */
  showFooterPages?: boolean;
  /** Where Sign in goes: the sign-in dialog over the page, and the history state that push carries. */
  signInTo?: string;
  signInState?: unknown;
}

/* UI-P87, refined: inside the surface, under a 1px `--hairline`, `12px <gutter>`, wrapping with `12px 24px` between
   items: the lockup (15 / 13), the links at 12.5 `--text2` `8px 20px` apart, a spacer, and "© buildgallery" at 12
   `--label`. The items, their order and their names are the current footer's; UX-03 P10 took out the Theme control. */
const refinedLink: CSSProperties = { fontFamily: FIGTREE, fontSize: 13, fontWeight: 400, color: t.text2 };

function RefinedSiteFooterView({ showPrivacy = false, showTerms = false, showFooterPages = false }: SiteFooterViewProps) {
  const theme = useResolvedTheme();
  const phone = useIsPhone();
  const { pathname } = useLocation();
  const links = [
    { label: "About", href: "/about" }, { label: "API docs", href: "/api-docs" },
    ...(showTerms ? [{ label: "Terms", href: "/terms" }] : []),
    ...(showPrivacy ? [{ label: "Privacy", href: "/privacy" }] : []),
    ...(showFooterPages ? [{ label: "Community rules", href: "/rules" }, { label: "Report a problem", href: "/report" }, { label: "Contact", href: "/contact" }] : []),
  ];
  return (
    <footer
      data-testid="site-footer"
      data-ui="site-footer"
      style={{
        marginTop: "auto",
        width: "100%",
        margin: "auto auto 0",
        boxSizing: "border-box",
        padding: "16px 16px 24px",
        display: "flex",
        flexWrap: "wrap",
        alignItems: phone ? "flex-start" : "center",
        flexDirection: phone ? "column" : "row",
        justifyContent: "space-between",
        gap: "8px 24px",
      }}
    >
      <FrameLink to={SITE_NAV.home} aria-label="OpenBuilds.ai home" style={{ ...refinedLink, display: "flex", alignItems: "center", gap: 8, outlineColor: t.brandAccent, ...touchHit(phone, 44) }}>
        <BeaverLogo theme={theme} size={16} /><span>© {new Date().getFullYear()} {SITE_NAME}</span>
      </FrameLink>
      <nav aria-label="Footer" style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px", justifyContent: phone ? "flex-start" : "flex-end" }}>
        {links.map(({ label, href }) => <FrameLink key={href} to={href} aria-current={pathname === href ? "page" : undefined} style={{ ...refinedLink, color: pathname === href ? t.text : t.text2, display: "inline-flex", alignItems: "center", minWidth: phone ? 44 : undefined, outlineColor: t.brandAccent, textUnderlineOffset: 4, ...touchHit(phone, 44) }} hoverStyle={{ color: t.text, textDecoration: "underline" }}>{label}</FrameLink>)}
      </nav>
    </footer>
  );
}

export function SiteFooterView(props: SiteFooterViewProps) {
  return <RefinedSiteFooterView {...props} />;
}

/** The container: signed-in state and sign-out from `useAuth()`. */
function SiteFooterContainer() {
  return (
    <SiteFooterView
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
