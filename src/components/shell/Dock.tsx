// The dock (29d): the phone's bottom bar, five equal slots on Page, icons only. Home, Builds, Import, OpenBuilds, Activity.
//
// `<nav aria-label="Primary">`, fixed to the bottom edge, full width, no glass, no blur, no lamp, no glow, with one structural
// line along its top. The current slot is the filled icon in Text; the rest are Text 3. Each slot is a link whose `aria-label`
// names it and that says `aria-current="page"` when current. There is no New slot: the round create button is the one way to
// create (`CreateButton`, drawn beside the dock on Home, Builds, OpenBuilds and Activity). Activity's unread state is a Mint
// count pill at the icon's top right. Hidden where a pinned footer replaces it (`dockHiddenFor`), and under 480 tall it
// scrolls with the page (`SHORT_WINDOW`).
//
// `DockView` is pure; `Dock` reads the route and the unread count. `placement` is `fixed` everywhere except the catalogue.

import { useShortWindow } from "./useMinWidth";
import { memo, useState, type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCurrentPath, useGo } from "@/lib/routing/go";

import { MobileIcon } from "@/components/brand/MobileIcon";
import type { MobileIconName } from "@/components/brand/mobileIcons";
import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";
import { CreateButton } from "@/components/phone/CreateButton";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

import { FrameLink } from "./FrameLink";
import { isActivityPath, isImportPath, SITE_NAV, sectionForPath, showsCreateButton } from "./siteNav";
import { PHONE_DOCK } from "./chromeSize";
import { NewSheet } from "./NewSheet";
import { dockAwayFor, dockHiddenFor } from "./phoneTopBar";
import { phoneSlide, phoneSlideOpacity } from "@/lib/theme/motion";

export type DockTileName = "home" | "gallery" | "import" | "openbuilds" | "activity";

const TILES: readonly { name: DockTileName; label: string; href: string; icon: MobileIconName }[] = [
  { name: "home", label: "Home", href: SITE_NAV.home, icon: "home" },
  { name: "gallery", label: "Builds", href: SITE_NAV.gallery, icon: "builds" },
  { name: "import", label: "Import", href: SITE_NAV.import, icon: "import" },
  { name: "openbuilds", label: "OpenBuilds", href: SITE_NAV.openbuilds, icon: "ob" },
  { name: "activity", label: "Activity", href: SITE_NAV.activity, icon: "bell" },
];

export interface DockViewProps {
  /** The current slot, or none. */
  current: DockTileName | null;
  unread: number;
  /** `absolute` only where the dock is drawn inside a strip (the catalogue). */
  placement?: "fixed" | "absolute" | "static";
  /** Prompt 21: slid down out of sight (a topic's reply bar stands where it was). */
  away?: boolean;
}

/* 29d: the dock on the phone. 49 tall plus the safe-area inset, a grid of five equal slots, no labels. Each icon is 26, centred
   in its slot 12 from the top, Text 3; the current one is the filled icon in Text. Activity's unread state is a 16 tall Mint
   pill (min width 16, padding 0 4, radius 8) with the count in 11/16 700 Page colour at top -4, left 44 of the slot; over 99
   it reads "99+". The accessible name stays "Activity" and the count is its description. */
const ICON = 26;
const ICON_TOP = 12;
const BADGE_MAX = 99;

const filled = (icon: MobileIconName, current: boolean): MobileIconName => (current && icon !== "import" ? (`${icon}f` as MobileIconName) : icon);

const SLOT: CSSProperties = {
  position: "relative",
  minWidth: 0,
  height: PHONE_DOCK,
  boxSizing: "border-box",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  paddingTop: ICON_TOP,
  textDecoration: "none",
  cursor: "pointer",
};

function Slot({ name, label, href, icon, current, unread }: { name: DockTileName; label: string; href: string; icon: MobileIconName; current: boolean; unread: number }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  const badged = name === "activity" && unread > 0;
  const countId = "dock-unread-count";
  return (
    <FrameLink
      to={href}
      data-testid={`dock-tile-${name}`}
      aria-current={current ? "page" : undefined}
      aria-label={label}
      aria-describedby={badged ? countId : undefined}
      {...handlers}
      style={{ ...SLOT, color: current ? t.text : t.label, ...ring(state.focusVisible) }}
    >
      <MobileIcon name={filled(icon, current)} size={ICON} />
      {badged && (
        <>
          <span
            aria-hidden="true"
            data-testid="dock-unread"
            style={{
              position: "absolute",
              top: -4,
              left: 44,
              boxSizing: "border-box",
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 8,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: t.brandAccent,
              color: t.bg,
              fontFamily: DM_MONO,
              fontSize: 11,
              fontWeight: 700,
              lineHeight: "16px",
            }}
          >
            {unread > BADGE_MAX ? "99+" : unread}
          </span>
          <span id={countId} style={VISUALLY_HIDDEN}>{`${unread} unread`}</span>
        </>
      )}
    </FrameLink>
  );
}

function RefinedDockView({ current, unread, placement = "fixed", away = false }: DockViewProps) {
  return (
    <nav
      data-testid="dock"
      data-ui="dock"
      data-motion="bar"
      aria-label="Primary"
      aria-hidden={away || undefined}
      ref={(node) => { node?.toggleAttribute("inert", away); }}
      style={{
        transform: away ? "translateY(100%)" : "translateY(0)",
        transition: phoneSlide(),
        opacity: phoneSlideOpacity(away),
        position: placement,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        paddingBottom: "env(safe-area-inset-bottom)",
        boxSizing: "border-box",
        background: t.bg,
        boxShadow: `inset 0 1px 0 ${t.control}`,
      }}
    >
      {TILES.map((tile) => (
        <Slot key={tile.name} {...tile} current={tile.name === current} unread={unread} />
      ))}
    </nav>
  );
}

export function DockView(props: DockViewProps) {
  return <RefinedDockView {...props} />;
}

/** The container: the current tile from the route, the unread count from the notifications hook. */
function DockContainer() {
  // SV-04: the tile of the page a change is on its way to is current at once (go.ts).
  const pathname = useCurrentPath();
  const { count } = useUnreadNotifications();
  const section = sectionForPath(pathname);
  const current: DockViewProps["current"] = isActivityPath(pathname)
    ? "activity"
    : isImportPath(pathname)
      ? "import"
      : section === "home" || section === "gallery" || section === "openbuilds"
        ? section
        : null;
  // G22: in a short window the dock follows the page instead of covering its foot.
  const short = useShortWindow();
  const { search } = useLocation();
  const [newOpen, setNewOpen] = useState(false);
  const navigate = useNavigate();
  const go = useGo() ?? navigate;
  // Prompt 19: a pinned footer or a full-screen task (the editor, a sheet's reply bar, sign in) replaces the dock.
  if (dockHiddenFor(pathname, search)) return null;
  return (
    <>
      <DockView current={current} unread={count} placement={short ? "static" : "fixed"} away={dockAwayFor(pathname)} />
      {showsCreateButton(pathname) ? <CreateButton expanded={newOpen} onTap={() => setNewOpen(true)} onHold={() => go(SITE_NAV.create)} /> : null}
      <NewSheet open={newOpen} onOpenChange={setNewOpen} />
    </>
  );
}

/* UI-P40: memoised, and it takes no props, so a page's data changing (which
   re-renders the frame around it) never re-renders the chrome. It updates on
   its own hooks only. */
export const Dock = memo(DockContainer);

export default Dock;
