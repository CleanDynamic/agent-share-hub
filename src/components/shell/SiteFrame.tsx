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
// THE REFINED FRAME (UI-P87). Under the refined look the root is `--frame` and a flex column. The header sits on it
// (sticky, 48, the frame behind it so the page scrolls under the frame and not through it), and one SURFACE wraps
// everything below: `calc(100% - 12px)` wide, max 1428, `0 auto 6px`, `--surface`, a 1px `--surface-border`, radius 10,
// `--surface-shadow`. `<main>` inside it has `24px clamp(16px, 4.6vw, 64px) 48px` and a 24px column gap, the
// breadcrumb first; the footer is inside the surface, pushed to its foot. On a phone the surface keeps its 6px inset
// and radius 10 under the 48px header, and the dock is fixed below it. The slots, their order and `#main` are the
// same in both looks.
//
// `bare` (sign in, join, reset, verify) is the backdrop and the page and nothing
// else. The backdrop is the root's first child, `position: absolute` inside a
// `position: relative` root (see PageBackdrop) — never `fixed` — and it is the
// entrance's own tone (`signin`, UI-P36).

import { useState, type CSSProperties, type ReactNode } from "react";

import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { useWindowSize } from "@/pages/site/compose/DetailsAside";
import { ORIGIN, frameOf, innerWidthOf } from "@/pages/site/compose/detailsLayout";
import { Breadcrumb } from "./Breadcrumb";
import { HEADER_HEIGHT } from "./chromeSize";
import { Dock } from "./Dock";
import { MobileHeader } from "./MobileHeader";
import { PageProgress } from "./PageProgress";
import { ConnectorDialogProvider } from "@/components/connect/ConnectorDialog";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { type PageFit } from "./siteFrameFit";
import { CrumbTitleProvider } from "./useBreadcrumb";
import { useIsPhone } from "./useMinWidth";

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
  /** SV-04: the progress line, along the foot of the header slot while a page change waits. */
  progress?: ReactNode;
  /** The page. */
  children?: ReactNode;
  /** `board` on the dev compare page: the footer is placed where the board draws it (UI-P55). */
  fit?: PageFit;
  /** CA-18 P4: no 1428 cap, no side padding on `<main>`: the page insets itself by 34. For the composer only. */
  wide?: boolean;
  /** CA-26 P1: replaces "Skip to content" as the first stop (the composer's "Skip to build"). */
  skipLink?: ReactNode;
  /** SV-08: the vision boards' page area (series README, Visual grammar 1): no breadcrumb, and `<main>` padded
      `40px clamp(16px, 5vw, 76px) 0` so the page starts where the board's does. Desktop only; the phone keeps its own.
      SV-10 `"home"`: Home's board pads its surface `24px clamp(16px, 2.2vw, 32px) 0`. */
  board?: boolean | "home";
  /** SV-04 P4: false for a page that draws its own chrome (the legacy workspace). The slots go and every box steps back
      (`display: contents`), but the page stays at the same place in the tree, so it is not mounted again. */
  chrome?: boolean;
}

const CONTENTS: CSSProperties = { display: "contents" };

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

/** The refined look's one surface (UI-P87). */
const SURFACE: CSSProperties = {
  width: "calc(100% - 12px)",
  maxWidth: 1428,
  margin: "0 auto 6px",
  flexGrow: 1,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  background: t.surface,
  border: `1px solid ${t.surfaceBorder}`,
  borderRadius: 10,
  boxShadow: t.surfaceShadow,
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
  progress,
  children,
  wide = false,
  board = false,
  skipLink,
  chrome = true,
}: SiteFrameViewProps) {
  const narrow = useIsPhone();
  const win = useWindowSize();
  const phone = (viewport ?? (narrow ? "mobile" : "desktop")) === "mobile";
  /* SV-04: set once when the frame mounts, so the page audit can tell a header kept across a page change from one drawn again. */
  const [frameId] = useState(() => Math.random().toString(36).slice(2, 10));

  const root: CSSProperties = {
    position: "relative",
    minHeight: "100dvh",
    color: t.text,
    fontFamily: FIGTREE,
  };

  if (variant === "bare") {
    return (
      <div data-testid="site-frame" data-variant="bare" style={root}>
        <SkipLink phone={phone} />
        <main id="main" style={{ position: "relative", zIndex: 1 }}>
          {children}
        </main>
      </div>
    );
  }

  if (!chrome) {
    // The same elements at the same places as below, so the page under `<main>` keeps its state.
    return (
      <div data-testid="site-frame" data-variant="none" style={CONTENTS}>
        {null}
        {null}
        <div style={CONTENTS}>
          <main id="main" style={CONTENTS}>
            {null}
            {children}
          </main>
          {null}
        </div>
        {null}
      </div>
    );
  }

  const refinedRoot: CSSProperties = { ...root, display: "flex", flexDirection: "column", background: t.frame };
  return (
    <div data-testid="site-frame" data-variant="site" data-viewport={phone ? "mobile" : "desktop"} style={refinedRoot}>
      {skipLink ?? <SkipLink phone={phone} />}
      <div
        data-slot={phone ? "mobile-header" : "header"}
        data-frame-id={frameId}
        style={{ position: "sticky", top: 0, zIndex: 20, minHeight: HEADER_HEIGHT, background: t.frame }}
      >
        {phone ? mobileHeader : header}
        {progress}
      </div>
      <div data-ui="surface" data-wide={wide && !phone ? "true" : undefined} style={wide && !phone ? { ...SURFACE, maxWidth: "none" } : SURFACE}>
        <main
          id="main"
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            gap: phone ? 16 : 24,
            padding: phone
              ? "16px 16px calc(80px + env(safe-area-inset-bottom))"
              : wide
                ? "0 0 48px"
                : board === "home"
                  ? "24px clamp(16px, 2.2vw, 32px) 0"
                  : board
                  ? "40px clamp(16px, 5vw, 76px) 0"
                  : "24px clamp(16px, 4.6vw, 64px) 48px",
            boxSizing: "border-box",
            minWidth: 0,
          }}
        >
          {phone || board ? null : <div data-slot="breadcrumb" style={wide ? { padding: `24px 0 0 ${frameOf(innerWidthOf(win.width)).boxLeft - ORIGIN}px` } : undefined}>{breadcrumb}</div>}
          {children}
        </main>
        {phone ? null : (
          <div data-slot="footer" style={{ marginTop: "auto", display: "flex", flexDirection: "column" }}>
            {footer}
          </div>
        )}
      </div>
      {phone ? <div data-slot="dock">{dock}</div> : null}
    </div>
  );
}

export interface SiteFrameProps {
  variant?: SiteFrameVariant;
  children?: ReactNode;
  /** CA-18 P4: see `SiteFrameViewProps.wide`. */
  wide?: boolean;
  /** CA-26 P1: see `SiteFrameViewProps.skipLink`. */
  skipLink?: ReactNode;
  /** SV-08: see `SiteFrameViewProps.board`. */
  board?: boolean | "home";
  /** SV-04 P4: see `SiteFrameViewProps.chrome`. */
  chrome?: boolean;
}

/** The container: live chrome around the page. UI-P17 to UI-P19 fill the slots. */
export function SiteFrame({ variant = "site", children, wide, board, skipLink, chrome }: SiteFrameProps) {
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
        progress={<PageProgress />}
        wide={wide}
        board={board}
        skipLink={skipLink}
        chrome={chrome}
      >
        {children}
      </SiteFrameView>
      </ConnectorDialogProvider>
    </CrumbTitleProvider>
  );
}

export default SiteFrame;
