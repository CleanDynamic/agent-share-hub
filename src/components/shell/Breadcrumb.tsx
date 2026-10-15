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

export function BreadcrumbView({ trail }: { trail: readonly Crumb[] }) {
  const text: CSSProperties = { fontFamily: FIGTREE, fontSize: 12.5 };
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
                  style={{ width: 120, height: 12, borderRadius: 4, background: t.recess, display: "inline-block" }}
                />
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  style={{
                    ...text,
                    fontWeight: last ? currentWeight : 400,
                    color: last ? t.text : t.text2,
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
                style={{ width: 120, height: 12, borderRadius: 4, background: t.recess, display: "inline-block" }}
              />
            ) : (
              <FrameLink to={crumb.href} style={{ ...text, color: t.text2 }}>
                {crumb.label}
              </FrameLink>
            )}
            {!last && (
              <span aria-hidden="true" style={{ fontFamily: FIGTREE, fontSize: 12.5, color: t.label }}>
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

export default Breadcrumb;
