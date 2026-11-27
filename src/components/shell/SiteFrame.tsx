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
// THE SYNTH FRAME (Synth 03). The root is the Page shade and a flex column. The header (88 tall, 48 on a phone) sits on it
// with no line and no fill. Under it a centred container, `max-width: 1280`, `0 8px 8px`, holds the page as PANELS: Panel
// fill, radius 12, no border, no shadow, 8 apart. A page with one column gets one panel from `<main>`; a page with several
// calls `useColumnPanels(true)`, `<main>` steps back to a plain column and the page draws a panel per column. Wider
// windows keep the 1280 and show Page on both sides. The older note below is kept for the slots, which have not moved.
//
// THE REFINED FRAME (UI-P87). Under the refined look the root is `--frame` and a flex column. The header sits on it
// (sticky, 48, the frame behind it so the page scrolls under the frame and not through it), and one SURFACE wraps
// everything below: `calc(100% - 16px)` wide, max 1428, `0 auto 8px`, `--surface`, a 1px `--surface-border`, radius 10,
// `--surface-shadow`. `<main>` inside it has `39px 55px 48px` and a 24px column gap, the page's PageHeader first
// (the composer keeps the breadcrumb slot first); the footer is inside the container, pushed to its foot. On a phone the container keeps its 8px inset
// and radius 10 under the 48px header, and the dock is fixed below it. The slots, their order and `#main` are the
// same in both looks.
//
// `bare` (sign in, join, reset, verify) is the backdrop and the page and nothing
// else. The backdrop is the root's first child, `position: absolute` inside a
// `position: relative` root (see PageBackdrop) — never `fixed` — and it is the
// entrance's own tone (`signin`, UI-P36).

import { useCallback, useState, type CSSProperties, type ReactNode } from "react";

import { FrameColumnsContext } from "./frameChrome";

import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { useWindowSize } from "@/pages/site/compose/DetailsAside";
import { ORIGIN, frameOf, innerWidthOf } from "@/pages/site/compose/detailsLayout";
import { Breadcrumb } from "./Breadcrumb";
import { CRUMB_BAND, FRAME_MAX_WIDTH, PANEL_GUTTER, PANEL_PAD, PANEL_RADIUS, PHONE_PAGE_BOTTOM, PHONE_PAGE_TOP, PHONE_TOPBAR } from "./chromeSize";
import { Dock } from "./Dock";
import { FocusRescue } from "./FocusRescue";
import { MobileHeader } from "./MobileHeader";
import { PageProgress } from "./PageProgress";
import { ConnectorDialogProvider } from "@/components/connect/ConnectorDialog";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { type PageFit } from "./siteFrameFit";
import { CrumbTitleProvider } from "./useBreadcrumb";
import { useHeaderHeight } from "./useHeaderCompact";
import { useIsPhone, useShortWindow } from "./useMinWidth";
import { useBarsHidden } from "./phoneBars";
import { move, PHONE_STANDARD } from "@/lib/theme/motion";

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
  padding: "0 12px",
  borderRadius: 12,
  background: t.window,
  color: t.text,
  border: `1px solid ${t.windowBorder}`,
  fontFamily: FIGTREE,
  fontSize: 13,
  fontWeight: 500,
  textDecoration: "none",
};

/** The page container: centred, 1280 at most, 8 from the window edge and 8 below. It has no fill; the panels are the surface. */
const CONTAINER: CSSProperties = {
  width: "100%",
  maxWidth: FRAME_MAX_WIDTH,
  margin: "0 auto",
  padding: `0 ${PANEL_GUTTER}px ${PANEL_GUTTER}px`,
  flexGrow: 1,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
};

/** The phone's page: the fixed bar and dock are out of flow, so the page pads for them, once, from chromeSize (29b). */
const PHONE_CONTAINER: CSSProperties = { ...CONTAINER, padding: `${PHONE_PAGE_TOP} ${PANEL_GUTTER}px ${PHONE_PAGE_BOTTOM}` };

/** The composer (`wide`) lays itself out from the window's width, so its container is not capped. */
const WIDE_CONTAINER: CSSProperties = { ...CONTAINER, maxWidth: "none" };

/** The one panel a single-column page sits in: Panel fill, radius 12, no border, no shadow. `clip` rather than `hidden`, so a
    sticky row inside the panel still sticks. */
const PANEL: CSSProperties = {
  background: t.surface,
  borderRadius: PANEL_RADIUS,
  overflow: "clip",
};

/** "Skip to content": first focusable element, off-screen until focused, targets `#main`. 36 tall, and 44 on a phone. */
function SkipLink({ phone }: { phone: boolean }) {
  return (
    <a
      href="#main"
      data-testid="skip-link"
      style={{ ...SKIP_BASE, minHeight: phone ? 44 : 32, transform: "translateY(-200%)" }}
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
  skipLink,
  chrome = true,
}: SiteFrameViewProps) {
  const narrow = useIsPhone();
  const short = useShortWindow();
  const win = useWindowSize();
  const phone = (viewport ?? (narrow ? "mobile" : "desktop")) === "mobile";
  const barHeight = useHeaderHeight(phone);
  // Prompt 20: on a phone a feed page slides the top bar up on scroll; only the safe-area inset stays on the Page shade.
  const barsHidden = useBarsHidden() && phone;
  /* SV-04: set once when the frame mounts, so the page audit can tell a header kept across a page change from one drawn again. */
  const [frameId] = useState(() => Math.random().toString(36).slice(2, 10));
  /* A page drawn as several panels (`useColumnPanels`): `<main>` is then a plain column and draws no panel of its own. */
  /* Synth 11: the pages that asked for column panels and are still mounted, counted, so a loading copy taken away after
     the page arrived (PageArrival's fade) does not take the page's panels with it. */
  const [claims, setClaims] = useState(0);
  const setColumns = useCallback((on: boolean) => setClaims((count) => Math.max(0, count + (on ? 1 : -1))), []);
  const columns = claims > 0;

  const root: CSSProperties = {
    position: "relative",
    minHeight: "100dvh",
    color: t.text,
    fontFamily: FIGTREE,
  };

  if (variant === "bare") {
    return (
      <div data-testid="site-frame" data-variant="bare" style={root}>
        <FocusRescue />
        <SkipLink phone={phone} />
        <main id="main" tabIndex={-1} style={{ position: "relative", zIndex: 1, outline: "none" }}>
          {children}
        </main>
      </div>
    );
  }

  if (!chrome) {
    // The same elements at the same places as below, so the page under `<main>` keeps its state.
    return (
      <div data-testid="site-frame" data-variant="none" style={CONTENTS}>
        <FocusRescue />
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
      {/* G17: after a removal, focus goes to the next item, the previous, or the list's heading; never the body. */}
      <FocusRescue />
      {skipLink ?? <SkipLink phone={phone} />}
      <div
        data-slot={phone ? "mobile-header" : "header"}
        data-frame-id={frameId}
        /* G22: pinned unless the window is short (zoomed), where it would cover the page. */
        style={{
          position: short ? "relative" : phone ? "fixed" : "sticky",
          top: 0,
          ...(phone && !short ? { left: 0, right: 0 } : null),
          zIndex: 20,
          minHeight: phone ? undefined : barHeight,
          background: t.frame,
          ...(phone ? { transform: barsHidden ? `translateY(-${PHONE_TOPBAR}px)` : "translateY(0)", transition: move(PHONE_STANDARD) } : null),
        }}
      >
        {phone ? mobileHeader : header}
        {progress}
      </div>
      <div data-ui="surface" data-wide={wide && !phone ? "true" : undefined} data-columns={columns ? "true" : undefined} style={phone ? (short ? CONTAINER : PHONE_CONTAINER) : wide ? WIDE_CONTAINER : CONTAINER}>
        <main
          id="main"
          data-phone-main={phone ? "" : undefined}
          /* G4: the skip link's target. A programmatic focus target, never a Tab stop, and it draws no outline. */
          tabIndex={-1}
          style={{
            outline: "none",
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            gap: columns ? PANEL_GUTTER : phone ? 16 : 24,
            padding: columns ? 0 : phone ? `${PANEL_PAD}px` : wide ? "0 0 48px" : `${PANEL_PAD + CRUMB_BAND}px ${PANEL_PAD}px 48px`,
            boxSizing: "border-box",
            minWidth: 0,
            ...(columns ? null : PANEL),
          }}
        >
          {/* Only the composer keeps the frame's breadcrumb; a page with a parent draws it in its PageHeader. */}
          {phone || !wide ? null : <div data-slot="breadcrumb" style={{ padding: `24px 0 0 ${frameOf(innerWidthOf(win.width)).boxLeft - ORIGIN}px` }}>{breadcrumb}</div>}
          <FrameColumnsContext.Provider value={setColumns}>{children}</FrameColumnsContext.Provider>
        </main>
        {phone ? null : <div data-slot="footer" style={{ marginTop: "auto", display: "flex", flexDirection: "column" }}>{footer}</div>}
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
  /** SV-04 P4: see `SiteFrameViewProps.chrome`. */
  chrome?: boolean;
}

/** The container: live chrome around the page. UI-P17 to UI-P19 fill the slots. */
export function SiteFrame({ variant = "site", children, wide, skipLink, chrome }: SiteFrameProps) {
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
