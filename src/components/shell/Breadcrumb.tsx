// The parent link (Synth 05): there is no breadcrumb. Where a page has a parent, one 13px `--label` underlined link to it sits
// above the h1 ("OpenBuilds" above a space's name, the build's name above Lineage and Compare, the space above a topic).
// A page that sits straight under Home has no parent and draws nothing.
//
// It keeps the `<nav aria-label="Breadcrumb">` and its test ids, and the route's trail (`breadcrumbTrail.ts`) is unchanged:
// the parent is the trail's second-to-last crumb, from a trail of three or more. While a parent's name is loading it is a
// 120x16 `--recess` bar, so nothing moves when the name arrives.
//
// `BreadcrumbView` is pure (a trail in, a nav out); `Breadcrumb` reads the route.

import { memo, type CSSProperties } from "react";

import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import type { Crumb } from "./breadcrumbTrail";
import { FrameLink } from "./FrameLink";
import { useBreadcrumb } from "./useBreadcrumb";
import { CRUMB_BAND, PANEL_PAD } from "./chromeSize";
import { useIsPhone } from "./useMinWidth";

/* WCAG 2.5.8: an ancestor link's target is 24 high. The line it stands on is 19, so the extra 5 is taken back by a
   margin and the breadcrumb keeps its height. */
const LINK_HIT: CSSProperties = { display: "inline-flex", alignItems: "center", minHeight: 24, margin: "-3px 0" };

/** G12: a crumb's box is 16 high whether it holds its words or, while they load, a 12-high bar: nothing moves when they arrive. */
const CRUMB_LINE = 16;
const LOADING_CRUMB: CSSProperties = {
  width: 120,
  height: CRUMB_LINE,
  boxSizing: "border-box",
  borderTop: "2px solid transparent",
  borderBottom: "2px solid transparent",
  backgroundClip: "padding-box",
  borderRadius: 4,
  backgroundColor: t.recess,
  display: "inline-block",
};

export function BreadcrumbView({ trail }: { trail: readonly Crumb[] }) {
  const parent = trail.length >= 3 ? trail[trail.length - 2] : null;
  if (!parent || !parent.href) return null;
  return (
    <nav
      data-testid="breadcrumb"
      data-ui="breadcrumb"
      aria-label="Breadcrumb"
      style={{ display: "flex", alignItems: "center", minWidth: 0 }}
    >
      {parent.label === null ? (
        <span role="status" aria-label="Loading" style={LOADING_CRUMB} />
      ) : (
        <FrameLink
          to={parent.href}
          style={{ fontFamily: FIGTREE, fontSize: 13, fontWeight: 400, color: t.label, textDecoration: "underline", textUnderlineOffset: 3, maxWidth: 480, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...LINK_HIT }}
          hoverStyle={{ color: t.text }}
        >
          {parent.label}
        </FrameLink>
      )}
    </nav>
  );
}

function BreadcrumbContainer() {
  return <BreadcrumbView trail={useBreadcrumb()} />;
}

/* UI-P40: memoised, and it takes no props, so a page's data changing (which
   re-renders the frame around it) never re-renders the chrome. It updates on
   its own hooks only. */
export const Breadcrumb = memo(BreadcrumbContainer);

/** Page shell: the breadcrumb in the 24 above the content's top, out of flow, as PageHeader's slot draws it, for a page whose
    PageHeader is drawn by its view while the page itself has other states (loading, a notice, a failure) that need the trail
    too: the build reader, the rebuild, the lineage. Desktop only, as the frame's was. `<main>` is its positioned box: its top
    padding is PANEL_PAD + CRUMB_BAND and its side padding PANEL_PAD. */
export function PageBreadcrumb() {
  return useIsPhone() ? null : (
    <div data-slot="breadcrumb" style={{ position: "absolute", top: PANEL_PAD, left: PANEL_PAD, right: PANEL_PAD, height: CRUMB_BAND, display: "flex", alignItems: "center", minWidth: 0 }}>
      <Breadcrumb />
    </div>
  );
}

export default Breadcrumb;
