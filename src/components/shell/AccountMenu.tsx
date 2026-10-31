// SV-26 P2: the header's account menu (Profile, Library, Drafts, Sign out), moved out of `SiteHeader` unchanged so it and
// `@radix-ui/react-dropdown-menu` load apart from the first page. A signed-out reader never loads it; a signed-in one
// loads it at idle, or on hover, focus or press of the account button, whichever comes first (`SiteHeader`'s
// `LazyAccountMenu`).

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useEffect, useRef, type CSSProperties } from "react";

import { PageLink } from "@/lib/routing/PageLink";
import { MENU_ITEM_CLASS } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { AccountButton } from "./AccountButton";
import type { FrameViewer } from "./frameTypes";
import { SITE_NAV } from "./siteNav";

export interface AccountMenuProps {
  viewer: FrameViewer;
  onSignOut: () => void;
  avatarSize?: number;
  /** Open at once: the reader pressed the account button before the menu's code was here. */
  defaultOpen?: boolean;
  /** The account button had focus before the menu's code was here: it keeps it. */
  focusOnMount?: boolean;
}

export function AccountMenu({ viewer, onSignOut, avatarSize = 34, defaultOpen = false, focusOnMount = false }: AccountMenuProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusOnMount && !defaultOpen) trigger.current?.focus();
    // Once, on mount: it hands focus over from the button drawn while the menu loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const profileHref = viewer.handle ? `/profile/${viewer.handle}` : SITE_NAV.profile;
  const item: CSSProperties = {
    display: "flex",
    alignItems: "center",
    height: 30,
    padding: "0 9px",
    borderRadius: 10,
    fontFamily: FIGTREE,
    fontSize: 12,
    fontWeight: 500,
    textDecoration: "none",
    outline: "none",
    cursor: "pointer",
    border: 0,
    background: "transparent",
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
          sideOffset={8}
          style={{
            minWidth: 190,
            padding: 4,
            borderRadius: 14,
            background: t.solid,
            border: `1px solid ${t.glassBorder}`,
            boxShadow: t.shadowFloat,
            color: t.text,
            zIndex: 50,
          }}
        >
          <DropdownMenu.Item asChild className={MENU_ITEM_CLASS}>
            <PageLink to={profileHref} style={item}>Profile</PageLink>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={MENU_ITEM_CLASS}>
            <PageLink to={SITE_NAV.library} style={item}>Library</PageLink>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={MENU_ITEM_CLASS}>
            <PageLink to={SITE_NAV.drafts} style={item}>Drafts</PageLink>
          </DropdownMenu.Item>
          <DropdownMenu.Separator style={{ height: 1, margin: "4px 4px", background: t.line }} />
          <DropdownMenu.Item asChild className={MENU_ITEM_CLASS}>
            <button type="button" onClick={onSignOut} style={item}>Sign out</button>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export default AccountMenu;
