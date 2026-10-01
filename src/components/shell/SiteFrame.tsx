// The site frame (UI-P16): the page's backdrop, its column and the chrome slots.
//
// BUILT BESIDE `FlatShell`, NOT IN IT. `FlatShell` is untouched; a route reaches
// this frame only when the `site_frame` flag is on and the route is listed in
// `siteFrameRoutes.ts` (UI-P20 wires that). This file is the skeleton and the
// chrome that fills it comes from UI-P17 (header), UI-P18 (breadcrumb, footer)
// and UI-P19 (phone header, dock).
//
// TWO COMPONENTS, ONE JOB EACH. `SiteFrameView` is pure — props only, no
// router, no auth — so the dev compare page can render it with the sample
// viewer and the live route renders it with live chrome. `SiteFrame` is the
// container that supplies the live chrome and renders the view.
//
// THE COLUMN. Desktop (≥768): a sticky header slot (64, z-index 20), then
// `<main id="main">` — 1280 wide, centred, `8px 0 46px` from 1328 up and
// `8px 24px 46px` below it — holding the breadcrumb slot and the page, then the
// footer slot. The 46px is the gap between the last panel and the footer on
// every board. Phone (<768): the sticky phone header (58), `<main>` with
// `14px 14px 110px` (110 clears the 68px dock, its 16px lift and some air, plus
// the safe-area inset) and a 12px column gap, and the fixed dock slot.
//
// `bare` (sign in, join, reset, verify) is the backdrop and the page and nothing
// else. The backdrop is the root's first child, `position: absolute` inside a
// `position: relative` root (see PageBackdrop) — never `fixed`.

import type { CSSProperties, ReactNode } from "react";

import { PageBackdrop } from "@/components/brand/PageBackdrop";
import { useIsMobile } from "@/hooks/use-mobile";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { Breadcrumb } from "./Breadcrumb";
import { Dock } from "./Dock";
import { MobileHeader } from "./MobileHeader";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { CrumbTitleProvider } from "./useBreadcrumb";
import { useMinWidth } from "./useMinWidth";

export { boardHeight, BOARD_GRID_HEIGHT, type PageFit } from "./siteFrameFit";

/** The column's width, and the viewport width at which it stops needing side padding (1280 + 2 × 24). */
export const SITE_COLUMN = 1280;
export const SITE_COLUMN_FULL = 1328;

export type SiteFrameVariant = "site" | "bare";

export interface SiteFrameViewProps {
  variant?: SiteFrameVariant;
  /** Force the chrome. The app's 768px breakpoint decides when omitted; the compare page passes it. */
  viewport?: "desktop" | "mobile";
  /** Desktop: the sticky glass header (UI-P17). */
  header?: ReactNode;
  /** Desktop: the breadcrumb, first in `<main>` (UI-P18). */
  breadcrumb?: ReactNode;
  /** Desktop: the footer, after `<main>` (UI-P18). */
  footer?: ReactNode;
  /** Phone: the sticky header (UI-P19). */
  mobileHeader?: ReactNode;
  /** Phone: the fixed dock (UI-P19). */
  dock?: ReactNode;
  /** The page. */
  children?: ReactNode;
}

const SKIP_BASE: CSSProperties = {
  position: "absolute",
  left: 12,
  top: 8,
  zIndex: 40,
  padding: "10px 14px",
  borderRadius: 12,
  background: t.solid,
  color: t.text,
  border: `1px solid ${t.line}`,
  fontFamily: FIGTREE,
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
};

/** "Skip to content": first focusable element, off-screen until focused, targets `#main`. */
function SkipLink() {
  return (
    <a
      href="#main"
      data-testid="skip-link"
      style={{ ...SKIP_BASE, transform: "translateY(-200%)" }}
      onFocus={(event) => {
        event.currentTarget.style.transform = "none";
      }}
      onBlur={(event) => {
        event.currentTarget.style.transform = "translateY(-200%)";
      }}
    >
      Skip to content
    </a>
  );
}

export function SiteFrameView({
  variant = "site",
  viewport,
  header,
  breadcrumb,
  footer,
  mobileHeader,
  dock,
  children,
}: SiteFrameViewProps) {
  const narrow = useIsMobile();
  const wide = useMinWidth(SITE_COLUMN_FULL);
  const phone = (viewport ?? (narrow ? "mobile" : "desktop")) === "mobile";

  const root: CSSProperties = {
    position: "relative",
    minHeight: "100dvh",
    color: t.text,
    fontFamily: FIGTREE,
  };

  if (variant === "bare") {
    return (
      <div data-testid="site-frame" data-variant="bare" style={root}>
        <PageBackdrop viewport={viewport} />
        <SkipLink />
        <main id="main" style={{ position: "relative", zIndex: 1 }}>
          {children}
        </main>
      </div>
    );
  }

  if (phone) {
    return (
      <div data-testid="site-frame" data-variant="site" data-viewport="mobile" style={root}>
        <PageBackdrop viewport="mobile" />
        <SkipLink />
        <div
          data-slot="mobile-header"
          style={{ position: "sticky", top: 0, zIndex: 20, minHeight: 58 }}
        >
          {mobileHeader}
        </div>
        <main
          id="main"
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: "14px 14px calc(110px + env(safe-area-inset-bottom))",
            boxSizing: "border-box",
          }}
        >
          {children}
        </main>
        <div data-slot="dock">{dock}</div>
      </div>
    );
  }

  return (
    <div data-testid="site-frame" data-variant="site" data-viewport="desktop" style={root}>
      <PageBackdrop viewport="desktop" />
      <SkipLink />
      <div data-slot="header" style={{ position: "sticky", top: 0, zIndex: 20, minHeight: 64 }}>
        {header}
      </div>
      <main
        id="main"
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: SITE_COLUMN,
          margin: "0 auto",
          padding: wide ? "8px 0 46px" : "8px 24px 46px",
          boxSizing: "border-box",
        }}
      >
        <div data-slot="breadcrumb" style={{ minHeight: 40 }}>
          {breadcrumb}
        </div>
        {children}
      </main>
      <div data-slot="footer" style={{ position: "relative", zIndex: 1, minHeight: 88 }}>
        {footer}
      </div>
    </div>
  );
}

export interface SiteFrameProps {
  variant?: SiteFrameVariant;
  children?: ReactNode;
}

/** The container: live chrome around the page. UI-P17 to UI-P19 fill the slots. */
export function SiteFrame({ variant = "site", children }: SiteFrameProps) {
  return (
    <CrumbTitleProvider>
      <SiteFrameView
        variant={variant}
        header={<SiteHeader />}
        breadcrumb={<Breadcrumb />}
        footer={<SiteFooter />}
        mobileHeader={<MobileHeader />}
        dock={<Dock />}
      >
        {children}
      </SiteFrameView>
    </CrumbTitleProvider>
  );
}

export default SiteFrame;
