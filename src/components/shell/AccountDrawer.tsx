// The account drawer (prompt 19), from the avatar on a phone: a 300 wide panel from the left on Panel (`--surface`), full height,
// padded by the top inset plus 12 and the bottom inset. A dialog, so focus is trapped, Escape closes, and focus goes back to the
// avatar that opened it. A tap on the scrim or a swipe left closes it. Inside, top to bottom: the 48 avatar, "Signed in as",
// the handle, rows 52 tall at 17/500 (Your profile, Your library, Drafts, Messages, Settings, then API docs, which the account
// menu on a desktop also holds), space, "Dark theme" with a 44 by 26 switch, and "Sign out" in Danger. No icons beside the rows.

import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { useLocation } from "react-router-dom";

import { Avatar } from "@/components/brand/Avatar";
import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";
import { useWindowFocus } from "@/lib/focus/windowFocus";
import { PageLink } from "@/lib/routing/PageLink";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { PHONE_EASE, PHONE_QUICK, feedback, prefersReducedMotion } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { PHONE_MARGIN } from "./chromeSize";
import type { FrameViewer } from "./frameTypes";
import { SITE_NAV } from "./siteNav";

export const DRAWER_WIDTH = 300;
/** A swipe to the left of more than this many px closes the drawer. */
export const DRAWER_SWIPE_PX = 60;

export interface AccountDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewer: FrameViewer;
  /** The dark theme is on. */
  dark: boolean;
  onToggleDark: () => void;
  onSignOut: () => void;
}

const ROW: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  minHeight: 52,
  padding: `0 ${PHONE_MARGIN}px`,
  display: "flex",
  alignItems: "center",
  border: 0,
  background: "transparent",
  color: t.text,
  fontFamily: FIGTREE,
  fontSize: 17,
  fontWeight: 500,
  lineHeight: "22px",
  textAlign: "left",
  textDecoration: "none",
  cursor: "pointer",
};

function LinkRow({ to, current, children, onGo }: { to: string; current?: boolean; children: string; onGo: () => void }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <PageLink to={to} aria-current={current ? "page" : undefined} onClick={onGo} {...handlers} style={{ ...ROW, ...ring(state.focusVisible) }}>
      {children}
    </PageLink>
  );
}

function Switch({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      {...handlers}
      style={{
        position: "relative",
        flexShrink: 0,
        width: 44,
        height: 44,
        padding: 0,
        border: 0,
        background: "transparent",
        cursor: "pointer",
        ...ring(state.focusVisible),
        borderRadius: r.full,
      }}
    >
      <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 9, width: 44, height: 26, borderRadius: 13, background: on ? t.brandAccent : t.control, transition: feedback("background-color") }}>
        <span data-motion="bar" style={{ position: "absolute", top: 3, left: 3, width: 20, height: 20, borderRadius: 10, background: on ? t.onBrandAccent : t.text, transform: on ? "translateX(18px)" : "none", transition: prefersReducedMotion() ? "none" : `transform ${PHONE_QUICK}ms ${PHONE_EASE}` }} />
      </span>
    </button>
  );
}

export function AccountDrawer({ open, onOpenChange, viewer, dark, onToggleDark, onSignOut }: AccountDrawerProps) {
  const focus = useWindowFocus(open);
  const { pathname } = useLocation();
  const start = useRef<{ x: number; y: number } | null>(null);
  const out = useInteractive<HTMLButtonElement>();
  const [drag, setDrag] = useState(0);

  const profileHref = viewer.handle ? `/profile/${viewer.handle}` : SITE_NAV.profile;
  const close = () => onOpenChange(false);

  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest?.('[role="switch"]')) return;
    start.current = { x: event.clientX, y: event.clientY };
  };
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const dx = event.clientX - start.current.x;
    const dy = Math.abs(event.clientY - start.current.y);
    // A mostly vertical move is the list scrolling, not a swipe.
    setDrag(dx < 0 && Math.abs(dx) > dy ? dx : 0);
  };
  const onUp = () => {
    const dx = drag;
    start.current = null;
    setDrag(0);
    if (dx < -DRAWER_SWIPE_PX) close();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay data-motion="scrim" style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 40 }} />
        <Dialog.Content
          data-testid="account-drawer"
          data-motion="drawer"
          data-fill="panel"
          aria-describedby={undefined}
          onOpenAutoFocus={focus.onOpenAutoFocus}
          onCloseAutoFocus={focus.onCloseAutoFocus}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{
            position: "fixed",
            top: 0,
            bottom: 0,
            left: 0,
            zIndex: 41,
            width: DRAWER_WIDTH,
            maxWidth: "100%",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            padding: "calc(env(safe-area-inset-top) + 12px) 0 env(safe-area-inset-bottom)",
            background: t.surface,
            color: t.text,
            fontFamily: FIGTREE,
            overflowY: "auto",
            overscrollBehavior: "contain",
            touchAction: "pan-y",
            transform: drag ? `translateX(${drag}px)` : undefined,
          }}
        >
          <Dialog.Title style={VISUALLY_HIDDEN}>Account</Dialog.Title>
          <div style={{ padding: `0 ${PHONE_MARGIN}px 12px`, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ marginBottom: 10, display: "inline-flex" }}>
              <Avatar userId={viewer.id} name={viewer.name} src={viewer.avatarUrl ?? undefined} alt="" size={48} phone />
            </span>
            <span style={{ fontSize: 13, lineHeight: "16px", color: t.label }}>Signed in as</span>
            <span style={{ fontSize: 15, fontWeight: 600, lineHeight: "20px", color: t.text, overflowWrap: "anywhere" }}>@{viewer.handle}</span>
          </div>
          <LinkRow to={profileHref} current={pathname === profileHref || pathname === SITE_NAV.profile} onGo={close}>Your profile</LinkRow>
          <LinkRow to={SITE_NAV.library} current={pathname === SITE_NAV.library} onGo={close}>Your library</LinkRow>
          <LinkRow to={SITE_NAV.drafts} current={pathname === SITE_NAV.drafts} onGo={close}>Drafts</LinkRow>
          <LinkRow to="/messages" current={pathname === "/messages"} onGo={close}>Messages</LinkRow>
          <LinkRow to={SITE_NAV.settings} current={pathname.startsWith(SITE_NAV.settings)} onGo={close}>Settings</LinkRow>
          <LinkRow to="/api-docs" current={pathname === "/api-docs"} onGo={close}>API docs</LinkRow>
          <LinkRow to="/connect" current={pathname === "/connect"} onGo={close}>Connect a tool</LinkRow>
          <LinkRow to="/about" current={pathname === "/about"} onGo={close}>About</LinkRow>
          <div style={{ flex: 1 }} />
          <div style={{ ...ROW, cursor: "default", justifyContent: "space-between", paddingRight: 8 }}>
            <span>Dark theme</span>
            <Switch on={dark} label="Dark theme" onToggle={onToggleDark} />
          </div>
          <button
            type="button"
            onClick={() => {
              close();
              onSignOut();
            }}
            {...out.handlers}
            data-tone="danger"
            style={{ ...ROW, color: t.dangerText, ...ring(out.state.focusVisible) }}
          >
            Sign out
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default AccountDrawer;
