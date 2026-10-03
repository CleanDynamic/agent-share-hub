// The dock (UI-P19): five floating tiles at the bottom of the phone.
//
// `<nav aria-label="Primary">`, fixed, centred, 16px above the bottom edge plus
// the safe-area inset so it clears the home indicator. Glass (`--dock`) — one of
// the two blurred surfaces on a phone, with the header. Tiles are 62×54 links:
// Home, Gallery, New (always `--action`), Bounties, Activity. The current tile is
// `--text` with `--on-text` and carries a lamp above it (`--lit`, with
// `--nav-lamp-glow`); amber is light, never text. Activity shows a badge when
// something is unread, and its accessible name says how many.
//
// `DockView` is pure; `Dock` reads the route and the unread count. `placement`
// is `fixed` everywhere except the catalogue, which draws it inside a strip.

import { Bell, Home, Image as ImageIcon, Plus, Target, type LucideIcon } from "lucide-react";
import { memo, type CSSProperties } from "react";
import { useLocation } from "react-router-dom";

import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { GLASS_BLUR } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { FrameLink } from "./FrameLink";
import { isActivityPath, SITE_NAV, sectionForPath } from "./siteNav";

export type DockTileName = "home" | "gallery" | "new" | "bounties" | "activity";

const TILES: readonly { name: DockTileName; label: string; href: string; icon: LucideIcon }[] = [
  { name: "home", label: "Home", href: SITE_NAV.home, icon: Home },
  { name: "gallery", label: "Gallery", href: SITE_NAV.gallery, icon: ImageIcon },
  { name: "new", label: "New", href: SITE_NAV.create, icon: Plus },
  { name: "bounties", label: "Bounties", href: SITE_NAV.bounties, icon: Target },
  { name: "activity", label: "Activity", href: SITE_NAV.activity, icon: Bell },
];

export interface DockViewProps {
  /** The tile with the lamp, or none. New is never current. */
  current: Exclude<DockTileName, "new"> | null;
  unread: number;
  /** `absolute` only where the dock is drawn inside a strip (the catalogue). */
  placement?: "fixed" | "absolute";
}

export function DockView({ current, unread, placement = "fixed" }: DockViewProps) {
  return (
    <nav
      data-testid="dock"
      data-ui="dock"
      aria-label="Primary"
      style={{
        position: placement,
        left: "50%",
        transform: "translateX(-50%)",
        bottom: "calc(16px + env(safe-area-inset-bottom))",
        zIndex: 30,
        display: "flex",
        gap: 4,
        padding: 7,
        borderRadius: 22,
        background: t.dock,
        border: `1px solid ${t.dockBorder}`,
        boxShadow: t.shadowDock,
        backdropFilter: GLASS_BLUR,
        WebkitBackdropFilter: GLASS_BLUR,
      }}
    >
      {TILES.map(({ name, label, href, icon: Icon }) => {
        const isCurrent = name === current;
        const isNew = name === "new";
        const paint: CSSProperties = isNew
          ? { background: t.action, color: t.onAction }
          : isCurrent
            ? { background: t.text, color: t.onText }
            : { background: "transparent", color: t.text };
        const badged = name === "activity" && unread > 0;
        return (
          <FrameLink
            key={name}
            to={href}
            data-testid={`dock-tile-${name}`}
            aria-current={isCurrent ? "page" : undefined}
            aria-label={badged ? `Activity, ${unread} unread` : label}
            style={{
              position: "relative",
              width: 62,
              height: 54,
              borderRadius: 15,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              fontFamily: FIGTREE,
              fontSize: 10,
              fontWeight: 600,
              ...paint,
            }}
          >
            {isCurrent && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: -11,
                  left: "50%",
                  marginLeft: -10,
                  width: 20,
                  height: 6,
                  borderRadius: "50%",
                  background: t.lit,
                  boxShadow: t.navLampGlow,
                }}
              />
            )}
            {badged && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: 5,
                  right: 9,
                  minWidth: 15,
                  height: 15,
                  borderRadius: 8,
                  background: t.action,
                  color: t.onAction,
                  fontFamily: DM_MONO,
                  fontSize: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxSizing: "border-box",
                  padding: "0 3px",
                }}
              >
                {unread > 9 ? "9+" : unread}
              </span>
            )}
            <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
            <span aria-hidden="true">{label}</span>
          </FrameLink>
        );
      })}
    </nav>
  );
}

/** The container: the current tile from the route, the unread count from the notifications hook. */
function DockContainer() {
  const { pathname } = useLocation();
  const { count } = useUnreadNotifications();
  const section = sectionForPath(pathname);
  const current: DockViewProps["current"] = isActivityPath(pathname)
    ? "activity"
    : section === "home" || section === "gallery" || section === "bounties"
      ? section
      : null;
  return <DockView current={current} unread={count} />;
}

/* UI-P40: memoised, and it takes no props, so a page's data changing (which
   re-renders the frame around it) never re-renders the chrome. It updates on
   its own hooks only. */
export const Dock = memo(DockContainer);

export default Dock;
