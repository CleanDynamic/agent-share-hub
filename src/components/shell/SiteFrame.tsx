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
// THE COLUMN. Desktop (≥768): a sticky header slot (52, z-index 20), then
// `<main id="main">` — 1280 wide, centred, `6px 0 33px` from 1328 up and
// `6px 24px 33px` below it — holding the breadcrumb slot (33) and the page, then
// the footer slot. In `board` fit the 33 under the page is the board's own
// leftover instead (`BOARD_FOOTER_GAP`), so the footer ends where the board's
// does. Phone (<768): the sticky phone header (48), `<main>` with
// `10px 10px 79px` (79 clears the 56px dock, its 16px lift and some air, plus the
// safe-area inset) and a 9px column gap, and the fixed dock slot. Those are the
// UI-P55 density pass's numbers; before it they were 64, 8/46, 40, 58, 14/110
// and 12.
//
// THE GLASS FILTER (UI-P09b). `<GlassFilter />` follows the backdrop in every variant, so the backdrop stays the
// root's first child. It is the one SVG filter `.bg-glass` panels refract through, mounted once per frame and
// before the page, and it is a 0 x 0 hidden SVG that paints nothing.
//
// `bare` (sign in, join, reset, verify) is the backdrop and the page and nothing
// else. The backdrop is the root's first child, `position: absolute` inside a
// `position: relative` root (see PageBackdrop) — never `fixed` — and it is the
// entrance's own tone (`signin`, UI-P36).

import type { CSSProperties, ReactNode } from "react";

import { GlassFilter } from "@/components/brand/GlassFilter";
import { PageBackdrop } from "@/components/brand/PageBackdrop";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { Breadcrumb } from "./Breadcrumb";
import { Dock } from "./Dock";
import { MobileHeader } from "./MobileHeader";
import { ConnectorDialogProvider } from "@/components/connect/ConnectorDialog";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { BOARD_FOOTER_GAP, type PageFit } from "./siteFrameFit";
import { CrumbTitleProvider } from "./useBreadcrumb";
import { useIsPhone, useMinWidth } from "./useMinWidth";

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
  /** `board` on the dev compare page: the footer is placed where the board draws it (UI-P55). */
  fit?: PageFit;
}

const SKIP_BASE: CSSProperties = {
  position: "absolute",
  left: 12,
  top: 8,
  zIndex: 40,
  boxSizing: "border-box",
  display: "inline-flex",
  alignItems: "center",
  padding: "0 10px",
  borderRadius: 12,
  background: t.solid,
  color: t.text,
  border: `1px solid ${t.line}`,
  fontFamily: FIGTREE,
  fontSize: 12,
  fontWeight: 600,
  textDecoration: "none",
};

/** "Skip to content": first focusable element, off-screen until focused, targets `#main`. 36 tall, and 44 on a phone. */
function SkipLink({ phone }: { phone: boolean }) {
  return (
    <a
      href="#main"
      data-testid="skip-link"
      style={{ ...SKIP_BASE, minHeight: phone ? 44 : 36, transform: "translateY(-200%)" }}
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
  fit = "content",
}: SiteFrameViewProps) {
  const narrow = useIsPhone();
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
        <PageBackdrop viewport={phone ? "mobile" : "desktop"} tone="signin" />
        <GlassFilter />
        <SkipLink phone={phone} />
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
        <GlassFilter />
        <SkipLink phone={phone} />
        <div
          data-slot="mobile-header"
          style={{ position: "sticky", top: 0, zIndex: 20, minHeight: 48 }}
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
            gap: 9,
            padding: "10px 10px calc(79px + env(safe-area-inset-bottom))",
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
      <GlassFilter />
      <SkipLink phone={phone} />
      <div data-slot="header" style={{ position: "sticky", top: 0, zIndex: 20, minHeight: 52 }}>
        {header}
      </div>
      <main
        id="main"
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: SITE_COLUMN,
          margin: "0 auto",
          padding: `6px ${wide ? 0 : "24px"} ${fit === "board" ? BOARD_FOOTER_GAP : 33}px`,
          boxSizing: "border-box",
        }}
      >
        <div data-slot="breadcrumb" style={{ minHeight: 33 }}>
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
      <ConnectorDialogProvider>
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
      </ConnectorDialogProvider>
    </CrumbTitleProvider>
  );
}

export default SiteFrame;
