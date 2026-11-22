// SV-26 P2: the header's account menu (Profile, Library, Drafts, Settings, Sign out), moved out of `SiteHeader` unchanged so it and
// `@radix-ui/react-dropdown-menu` load apart from the first page. A signed-out reader never loads it; a signed-in one
// loads it at idle, or on hover, focus or press of the account button, whichever comes first (`SiteHeader`'s
// `LazyAccountMenu`).

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { PageLink } from "@/lib/routing/PageLink";
import { MENU_ITEM_CLASS } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { feedback } from "@/lib/theme/motion";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { r } from "@/lib/theme/radius";
import { Button } from "@/components/brand/Button";
import { AccountButton } from "./AccountButton";
import type { FrameViewer } from "./frameTypes";
import { SITE_NAV } from "./siteNav";

export interface AccountMenuProps {
  viewer: FrameViewer;
  onSignOut: () => void;
  avatarSize?: number;
  drafts?: number;
  theme?: "dusk" | "noon";
  onToggleTheme?: () => void;
  /** Open at once: the reader pressed the account button before the menu's code was here. */
  defaultOpen?: boolean;
  /** The account button had focus before the menu's code was here: it keeps it. */
  focusOnMount?: boolean;
}

/* The surface ladder: a hovered item steps its fill four grey levels toward the text (1.9% of --text over the window)
   and draws no ring; the ring is for keyboard focus only. Radix moves focus onto the item under the pointer, which the
   browser then marks :focus-visible, so the pointer's move and leave are kept from Radix and the hover is tracked here. */
const HOVER_FILL = tokenAlpha("text", 0.019);
const keepFromRadix = (event: PointerEvent) => event.preventDefault();

function Entry({ children }: { children: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLElement>();
  return (
    <DropdownMenu.Item
      asChild
      className={MENU_ITEM_CLASS}
      {...handlers}
      onPointerMove={keepFromRadix}
      onPointerLeave={keepFromRadix}
      style={{ background: state.hovered ? HOVER_FILL : "transparent", transition: feedback() }}
    >
      {children}
    </DropdownMenu.Item>
  );
}

export function AccountMenu({ viewer, onSignOut, avatarSize = 24, drafts = 0, theme = "dusk", onToggleTheme, defaultOpen = false, focusOnMount = false }: AccountMenuProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusOnMount && !defaultOpen) trigger.current?.focus();
    // Once, on mount: it hands focus over from the button drawn while the menu loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const profileHref = viewer.handle ? `/profile/${viewer.handle}` : SITE_NAV.profile;
  // UX-10 P11: the reader's own profile link says it is the current page there.
  const { pathname } = useLocation();
  const onOwnProfile = pathname === profileHref || pathname === SITE_NAV.profile;
  const item: CSSProperties = {
    display: "flex",
    alignItems: "center",
    height: 32,
    padding: "0 12px",
    borderRadius: r.chip,
    fontFamily: FIGTREE,
    fontSize: 13,
    fontWeight: 400,
    textDecoration: "none",
    outline: "none",
    cursor: "pointer",
    outlineColor: t.brandAccent,
    border: 0,
    width: "100%",
    textAlign: "left",
  };
  return (
    <DropdownMenu.Root defaultOpen={defaultOpen}>
      <DropdownMenu.Trigger asChild>
        <AccountButton ref={trigger} viewer={viewer} avatarSize={avatarSize} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          style={{
            minWidth: 220,
            padding: 4,
            borderRadius: r.window,
            background: t.window,
            border: `1px solid ${t.windowBorder}`,
            boxShadow: t.windowShadow,
            color: t.text,
            zIndex: 50,
          }}
        >
          <DropdownMenu.Label style={{ padding: "8px 12px", fontFamily: FIGTREE, fontSize: 13, fontWeight: 400, color: t.text2 }}>Signed in as <span style={{ fontWeight: 500, color: t.text }}>@{viewer.handle}</span></DropdownMenu.Label>
          <Entry><PageLink to={profileHref} aria-current={onOwnProfile ? "page" : undefined} style={item}>Your profile</PageLink></Entry>
          <Entry><PageLink to={SITE_NAV.drafts} style={item}>Your drafts{drafts > 0 && <span style={{ marginLeft: "auto", fontFamily: FIGTREE, fontSize: 13, color: t.text2 }}>{drafts}</span>}</PageLink></Entry>
          <Entry><PageLink to={SITE_NAV.library} style={item}>Your library</PageLink></Entry>
          <Entry><PageLink to="/messages" style={item}>Messages</PageLink></Entry>
          <DropdownMenu.Separator style={{ height: 1, margin: "4px 0", background: t.windowBorder }} />
          <DropdownMenu.CheckboxItem checked={theme === "dusk"} onCheckedChange={() => onToggleTheme?.()} style={{ ...item, color: t.text, background: "transparent", outlineColor: t.brandAccent }} onFocus={(event) => { event.currentTarget.style.background = HOVER_FILL; }} onBlur={(event) => { event.currentTarget.style.background = "transparent"; }}>Dark theme<span style={{ marginLeft: "auto", fontFamily: FIGTREE, fontSize: 13, color: t.text2 }}>{theme === "dusk" ? "On" : "Off"}</span></DropdownMenu.CheckboxItem>
          <Entry><PageLink to={SITE_NAV.settings} aria-current={pathname.startsWith(SITE_NAV.settings) ? "page" : undefined} style={item}>Settings</PageLink></Entry>
          <Entry><PageLink to="/api-docs" style={item}>API docs</PageLink></Entry>
          <DropdownMenu.Separator style={{ height: 1, margin: "4px 0", background: t.windowBorder }} />
          <Entry><Button variant="ghost" size={32} onClick={onSignOut} style={item}>Sign out</Button></Entry>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export default AccountMenu;
