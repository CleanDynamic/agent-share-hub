// The breadcrumb (UI-P18): where this page sits, mirroring the URL.
//
// `<nav aria-label="Breadcrumb">`, 33px tall (40 before the UI-P55 density pass),
// 6 apart. Ancestors are links in Figtree 12px `--text2` each followed by a "/"
// in DM Mono 12px `--label` (hidden from assistive tech); the current page is a
// `<span aria-current="page">` at weight 600 in `--text`, one line with an
// ellipsis at 480px. While a title is loading the current crumb is a 120×12
// `--recess` skeleton.
//
// `BreadcrumbView` is pure (a trail in, a nav out); `Breadcrumb` reads the route.
//
// UNDER THE REFINED LOOK (UI-P87): Geist 12.5, 8 apart, no fixed height; ancestors `--text2`, the "/" in Geist
// `--label`, the current page `--text` at 500. The structure and the names are the same.

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
  const text: CSSProperties = { fontFamily: FIGTREE, fontSize: 13 };
  const currentWeight = 500;
  return (
    <nav
      data-testid="breadcrumb"
      data-ui="breadcrumb"
      aria-label="Breadcrumb"
      style={
        { display: "flex", alignItems: "center", gap: 8, minWidth: 0 }
      }
    >
      {trail.map((crumb, index) => {
        const last = index === trail.length - 1;
        return (
          <span key={index} style={{ display: "contents" }}>
            {last || !crumb.href ? (
              crumb.label === null ? (
                <span
                  role="status"
                  aria-label="Loading"
                  aria-current="page"
                  style={LOADING_CRUMB}
                />
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  style={{
                    ...text,
                    fontWeight: last ? currentWeight : 400,
                    color: last ? t.text : t.text2,
                    lineHeight: `${CRUMB_LINE}px`,
                    maxWidth: 480,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {crumb.label}
                </span>
              )
            ) : crumb.label === null ? (
              <span
                role="status"
                aria-label="Loading"
                style={LOADING_CRUMB}
              />
            ) : (
              <FrameLink to={crumb.href} style={{ ...text, color: t.text2, ...LINK_HIT }}>
                {crumb.label}
              </FrameLink>
            )}
            {!last && (
              <span aria-hidden="true" style={{ fontFamily: FIGTREE, fontSize: 13, color: t.label }}>
                /
              </span>
            )}
          </span>
        );
      })}
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
