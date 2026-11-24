// The dock (prompt 19): the phone's bottom bar, five equal slots on Page. Home, Builds, New, OpenBuilds, Activity.
//
// `<nav aria-label="Primary">`, fixed to the bottom edge, full width, no glass, no blur, no lamp, no glow. The current slot is
// the filled icon with its label in Text; New is a Mint pill that opens the New sheet; Activity's unread state is a Mint
// square at the icon and its accessible name says the count. Hidden where a pinned footer replaces it (`dockHiddenFor`), and
// under 480 tall it scrolls with the page (`SHORT_WINDOW`).
//
// `DockView` is pure; `Dock` reads the route and the unread count. `placement` is `fixed` everywhere except the catalogue.

import { useShortWindow } from "./useMinWidth";
import { memo, useState, type CSSProperties } from "react";
import { useLocation } from "react-router-dom";
import { useCurrentPath } from "@/lib/routing/go";

import { MobileIcon } from "@/components/brand/MobileIcon";
import type { MobileIconName } from "@/components/brand/mobileIcons";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { FrameLink } from "./FrameLink";
import { isActivityPath, SITE_NAV, sectionForPath } from "./siteNav";
import { PHONE_DOCK } from "./chromeSize";
import { NewSheet } from "./NewSheet";
import { dockHiddenFor } from "./phoneTopBar";

export type DockTileName = "home" | "gallery" | "new" | "openbuilds" | "activity";

const TILES: readonly { name: DockTileName; label: string; href: string; icon: MobileIconName }[] = [
  { name: "home", label: "Home", href: SITE_NAV.home, icon: "home" },
  { name: "gallery", label: "Builds", href: SITE_NAV.gallery, icon: "builds" },
  { name: "new", label: "New", href: SITE_NAV.create, icon: "new" },
  { name: "openbuilds", label: "OpenBuilds", href: SITE_NAV.openbuilds, icon: "ob" },
  { name: "activity", label: "Activity", href: SITE_NAV.activity, icon: "bell" },
];

export interface DockViewProps {
  /** The current slot, or none. New is never current. */
  current: Exclude<DockTileName, "new"> | null;
  unread: number;
  /** `absolute` only where the dock is drawn inside a strip (the catalogue). */
  placement?: "fixed" | "absolute" | "static";
  /** New opens the New sheet. */
  onNew?: () => void;
}

/* Prompt 19: the dock on the phone. Fixed to the bottom edge, full width, on Page: no glass, no blur, no lamp, no glow, no
   line. 56 tall plus the safe-area inset, a grid of five equal slots. Each slot is the icon at 24 over its label (13/16 500),
   3 apart, in Text 3; the current slot is the filled icon with its label 600 in Text. New is a 44 by 32 Mint pill with the plus
   at 20 in On-mint, and it opens the New sheet. Activity's unread state is a 9px Mint square with a 2px Page ring at the icon's
   top right; the accessible name says the count. */
const filled = (icon: MobileIconName, current: boolean): MobileIconName => (current && icon !== "new" ? (`${icon}f` as MobileIconName) : icon);

const SLOT: CSSProperties = {
  position: "relative",
  minWidth: 0,
  height: PHONE_DOCK,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 3,
  border: 0,
  background: "transparent",
  padding: 0,
  fontFamily: FIGTREE,
  fontSize: 13,
  lineHeight: "16px",
  textDecoration: "none",
  cursor: "pointer",
};

function NewSlot({ onNew }: { onNew?: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button type="button" data-testid="dock-tile-new" aria-haspopup="dialog" aria-label="New" onClick={onNew} {...handlers} style={{ ...SLOT, color: t.label, fontWeight: 500, ...ring(state.focusVisible) }}>
      <span aria-hidden="true" style={{ width: 44, height: 32, borderRadius: 16, background: t.brandAccent, color: t.onBrandAccent, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <MobileIcon name="new" size={20} />
      </span>
      <span aria-hidden="true">New</span>
    </button>
  );
}

function RefinedDockView({ current, unread, placement = "fixed", onNew }: DockViewProps) {
  return (
    <nav
      data-testid="dock"
      data-ui="dock"
      aria-label="Primary"
      style={{
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
      }}
    >
      {TILES.map(({ name, label, href, icon }) => {
        if (name === "new") return <NewSlot key={name} onNew={onNew} />;
        const isCurrent = name === current;
        const badged = name === "activity" && unread > 0;
        return (
          <FrameLink
            key={name}
            to={href}
            data-testid={`dock-tile-${name}`}
            aria-current={isCurrent ? "page" : undefined}
            aria-label={badged ? `Activity, ${unread} unread` : label}
            style={{ ...SLOT, fontWeight: isCurrent ? 600 : 500, color: isCurrent ? t.text : t.label }}
          >
            <span style={{ position: "relative", display: "inline-flex" }}>
              <MobileIcon name={filled(icon, isCurrent)} size={24} />
              {badged && (
                <span
                  aria-hidden="true"
                  data-testid="dock-unread"
                  style={{ position: "absolute", top: -1, right: -3, width: 9, height: 9, borderRadius: 3, background: t.brandAccent, boxShadow: `0 0 0 2px ${t.bg}` }}
                />
              )}
            </span>
            <span aria-hidden="true">{label}</span>
          </FrameLink>
        );
      })}
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
    : section === "home" || section === "gallery" || section === "openbuilds"
      ? section
      : null;
  // G22: in a short window the dock follows the page instead of covering its foot.
  const short = useShortWindow();
  const { search } = useLocation();
  const [newOpen, setNewOpen] = useState(false);
  // Prompt 19: a pinned footer or a full-screen task (the editor, a sheet's reply bar, sign in) replaces the dock.
  if (dockHiddenFor(pathname, search)) return null;
  return (
    <>
      <DockView current={current} unread={count} placement={short ? "static" : "fixed"} onNew={() => setNewOpen(true)} />
      <NewSheet open={newOpen} onOpenChange={setNewOpen} />
    </>
  );
}

/* UI-P40: memoised, and it takes no props, so a page's data changing (which
   re-renders the frame around it) never re-renders the chrome. It updates on
   its own hooks only. */
export const Dock = memo(DockContainer);

export default Dock;
