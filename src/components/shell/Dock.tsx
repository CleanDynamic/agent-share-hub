// The dock (UI-P19): five floating tiles at the bottom of the phone.
//
// `<nav aria-label="Primary">`, fixed, centred, 16px above the bottom edge plus
// the safe-area inset so it clears the home indicator. Glass (`--dock`) — one of
// the two blurred surfaces on a phone, with the header. Tiles are 62×44 links
// (62×54 inside 7px before the UI-P55 density pass; 44 is the table's and the
// touch floor's, and the dock is 5px around them):
// Home, Builds, New (always `--action`), OpenBuilds, Activity. The current tile is
// `--text` with `--on-text` and carries a lamp above it (`--lit`, with
// `--nav-lamp-glow`); amber is light, never text. Activity shows a badge when
// something is unread, and its accessible name says how many.
//
// `DockView` is pure; `Dock` reads the route and the unread count. `placement`
// is `fixed` everywhere except the catalogue, which draws it inside a strip.

import { Bell, Home, Image as ImageIcon, Plus, Target, type LucideIcon } from "lucide-react";
import { memo } from "react";
import { useCurrentPath } from "@/lib/routing/go";

import type { GlyphName } from "@/components/brand/Glyph";
import { Icon as AnyIcon } from "@/components/brand/Icon";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { CONTROL } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { FrameLink } from "./FrameLink";
import { isActivityPath, SITE_NAV, sectionForPath } from "./siteNav";
import { DOCK_PAD, DOCK_TILE_HEIGHT } from "./chromeSize";

export type DockTileName = "home" | "gallery" | "new" | "bounties" | "activity";

const TILES: readonly { name: DockTileName; label: string; href: string; icon: LucideIcon }[] = [
  { name: "home", label: "Home", href: SITE_NAV.home, icon: Home },
  { name: "gallery", label: "Builds", href: SITE_NAV.gallery, icon: ImageIcon },
  { name: "new", label: "New", href: SITE_NAV.create, icon: Plus },
  { name: "bounties", label: "OpenBuilds", href: SITE_NAV.bounties, icon: Target },
  { name: "activity", label: "Activity", href: SITE_NAV.activity, icon: Bell },
];

export interface DockViewProps {
  /** The tile with the lamp, or none. New is never current. */
  current: Exclude<DockTileName, "new"> | null;
  unread: number;
  /** `absolute` only where the dock is drawn inside a strip (the catalogue). */
  placement?: "fixed" | "absolute";
}

/* UI-P87, refined: no glass. A bar the width of the screen on `--surface` with a 1px `--surface-border` top edge, and
   five control-recipe tiles in it, 44 high, radius 6, 6 apart: the glyph at 16 over the label at 10.5/500. The current
   tile is the bell's current state, the `--control-on` fill and `--control-border` edge in `--text`, with the 2px
   `--nav-mark` bar along its foot; never a colour. The unread count is the header's 12px `--lit-mark` badge. */
const TILE_GLYPH: Partial<Record<DockTileName, GlyphName>> = { gallery: "image", new: "plus", activity: "bell" };

function RefinedDockView({ current, unread, placement = "fixed" }: DockViewProps) {
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
        display: "flex",
        gap: 6,
        padding: `${DOCK_PAD}px 8px calc(${DOCK_PAD}px + env(safe-area-inset-bottom))`,
        boxSizing: "border-box",
        background: t.surface,
        borderTop: `1px solid ${t.surfaceBorder}`,
      }}
    >
      {TILES.map(({ name, label, href, icon }) => {
        const isCurrent = name === current;
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
              flex: 1,
              minWidth: 0,
              height: DOCK_TILE_HEIGHT,
              boxSizing: "border-box",
              borderRadius: 6,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              fontFamily: FIGTREE,
              fontSize: 10.5,
              fontWeight: 500,
              ...CONTROL,
              ...(isCurrent ? { background: t.controlOn, color: t.text } : { color: t.text2 }),
            }}
          >
            {isCurrent && (
              <span
                aria-hidden="true"
                data-ui="nav-mark"
                style={{ position: "absolute", left: 10, right: 10, bottom: -1, height: 2, borderRadius: 1, background: t.navMark, boxShadow: t.navLampGlow }}
              />
            )}
            {badged && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: 3,
                  right: 3,
                  minWidth: 12,
                  height: 12,
                  padding: "0 3px",
                  boxSizing: "border-box",
                  borderRadius: 6,
                  background: t.litMark,
                  color: t.onLit,
                  fontFamily: FIGTREE,
                  fontSize: 9,
                  fontWeight: 600,
                  lineHeight: "12px",
                  textAlign: "center",
                }}
              >
                {unread > 9 ? "9+" : unread}
              </span>
            )}
            <AnyIcon lucide={icon} glyph={TILE_GLYPH[name]} size={16} />
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
