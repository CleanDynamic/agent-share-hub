/* Synth 13 Part B: the sign-in dialog's frame. One card at every width: 420 wide (the width less 32 on a phone), centred,
   the Overlay fill, radius 16, 16px 20px 20px padding, 14 between its parts, the Overlay edge and shadow.

   Top row: the pills Sign in and Sign up (other views: "Back to sign in" as a ghost button), and a 32 round Close at the
   right. Then the beaver at 104 wide, centred, and a visually hidden h2 that names the view (the dialog's title). Then the
   view.

   Behind it there is no dim scrim: the overlay is clear, and the host draws the dot water over it (`SignInWaterLayer`).

   The frame is Radix's dialog, the site's one primitive: focus trap, Escape, scroll lock, `role="dialog"` and
   `aria-modal`, and the title wired up as the label. PURE: the view, the row-1 control and the handlers come in as props. */

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { IconButton } from "@/components/brand/IconButton";
import { Segmented } from "@/components/brand/Segmented";
import { FrameLink } from "@/components/shell/FrameLink";
import { useRoom } from "@/components/brand/useRoom";
import { BeaverLogo } from "@/components/shell/BeaverLogo";
import { DIALOG_LOGO_WIDTH } from "@/components/shell/chromeSize";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { prefersReducedMotion } from "@/lib/theme/motion";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { DIALOG } from "./authSizes";
import {
  DIALOG_FADE_EASING,
  DIALOG_FADE_MS,
  DIALOG_MOVE_EASING,
  DIALOG_MOVE_FROM,
  DIALOG_MOVE_MS,
  SCRIM_EASING,
  SCRIM_IN_MS,
  SCRIM_OUT_MS,
} from "./signinMotion";
import { SITE_NAME } from "@/lib/site";

/** The visually hidden h2 that names each view. */
export const VIEW_TITLE: Record<string, string> = {
  login: "Sign in",
  signup: "Sign up",
  verify: "Verify your email",
  reset: "Reset password",
};

/** Row 1 for Sign in and Join free: the switch. Choosing the other side pushes its view's address, one step deeper. */
export function AccountSwitch({
  value,
  onChange,
}: {
  value: "login" | "signup";
  onChange: (view: "login" | "signup") => void;
}) {
  const phone = useIsPhone();
  return (
    <Segmented
      label="Sign in or join"
      size={phone ? 38 : 32}
      fontSize={13}
      value={value}
      onChange={onChange}
      items={[
        { value: "login", label: "Sign in" },
        { value: "signup", label: "Sign up" },
      ]}
    />
  );
}

/** Row 1 for every other view: "Back to sign in", a ghost button. */
export function BackToSignIn({ to, state }: { to: string; state?: unknown }) {
  return (
    <FrameLink
      to={to}
      state={state}
      data-testid="signin-back"
      data-ui="button"
      data-variant="ghost"
      style={{
        height: DIALOG.control,
        display: "inline-flex",
        alignItems: "center",
        padding: "0 14px",
        margin: "0 -14px",
        borderRadius: 16,
        fontFamily: FIGTREE,
        fontSize: 13,
        fontWeight: 600,
        color: t.text2,
        textDecoration: "none",
      }}
    >
      Back to sign in
    </FrameLink>
  );
}

export interface SignInDialogFrameProps {
  /** False while the dialog is closing: it stays mounted for the scrim's fade-out, fading itself at once (G11). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Row 1's left side: the Sign in · Join free switch, or "Back to sign in". */
  rowStart: ReactNode;
  /** Which view is showing, for tests and for the motion of a view arriving. */
  view: string;
  children: ReactNode;
}

/** What focus lands on in a view that has just arrived: its first field or control, or the view itself. */
const FOCUSABLE =
  'input:not([type="checkbox"]):not([disabled]), button:not([disabled]), a[href]';

export function SignInDialogFrame({
  open,
  onOpenChange,
  rowStart,
  view,
  children,
}: SignInDialogFrameProps) {
  const room = useRoom();
  const phone = useIsPhone();
  const body = useRef<HTMLDivElement>(null);
  /* G5: focus goes back to the control that opened the dialog. The dialog has no Radix Trigger (the address opens it), so
     the element that had focus when it mounted is kept here and focused on close, however it closes. */
  const [opener] = useState(() =>
    typeof document === "undefined"
      ? null
      : (document.activeElement as HTMLElement | null),
  );
  const returnFocus = (event: Event) => {
    event.preventDefault();
    if (opener && opener !== document.body && opener.isConnected)
      opener.focus();
  };
  const shown = useRef(view);

  /* G10: after a view change focus is inside the new view, never left on a control that has gone (or on row 1). The first
     view's focus is Radix's to place. */
  useEffect(() => {
    if (shown.current === view) return;
    shown.current = view;
    const target =
      body.current?.querySelector<HTMLElement>(FOCUSABLE) ?? body.current;
    target?.focus();
  }, [view]);

  /* G11: the scrim fades in over 300ms and out over 900ms; the dialog enters with opacity over 320ms ease-out and
     translateY(12px) scale(0.98) to none over 440ms on the prototype's curve, with no delay, and on close starts fading
     at once. Played on the elements through the Web Animations API; under reduced motion nothing animates. */
  /* Callback refs held in state: Radix mounts its portal a layout pass after the dialog, so the elements arrive later. */
  const [scrimEl, scrim] = useState<HTMLDivElement | null>(null);
  const [contentEl, content] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (!scrimEl || !contentEl) return;
    const animates = typeof contentEl.animate === "function";
    if (animates) for (const el of [scrimEl, contentEl]) el.getAnimations().forEach((animation) => animation.cancel());
    contentEl.style.pointerEvents = open ? "" : "none";
    if (!open && opener && opener !== document.body && opener.isConnected) opener.focus();
    if (prefersReducedMotion() || !animates) {
      scrimEl.style.opacity = open ? "" : "0";
      contentEl.style.opacity = open ? "" : "0";
      return;
    }
    if (open) {
      scrimEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: SCRIM_IN_MS, easing: SCRIM_EASING });
      contentEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DIALOG_FADE_MS, easing: DIALOG_FADE_EASING });
      contentEl.animate([{ transform: DIALOG_MOVE_FROM }, { transform: "none" }], { duration: DIALOG_MOVE_MS, easing: DIALOG_MOVE_EASING });
    } else {
      scrimEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: SCRIM_OUT_MS, easing: SCRIM_EASING, fill: "forwards" });
      contentEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DIALOG_FADE_MS, easing: DIALOG_FADE_EASING, fill: "forwards" });
    }
    // The opener is the one recorded when the dialog mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scrimEl, contentEl]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal forceMount>
        {/* No dim scrim: the overlay is clear, and the water layer (z 51) is drawn over it. */}
        <Dialog.Overlay
          ref={scrim}
          forceMount
          data-testid="signin-scrim"
          onClick={() => onOpenChange(false)}
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "transparent" }}
        />
        <Dialog.Content
          ref={content}
          forceMount
          data-testid="signin-dialog"
          data-view={view}
          data-viewport={phone ? "mobile" : "desktop"}
          aria-describedby={undefined}
          onCloseAutoFocus={returnFocus}
          onPointerDownOutside={(event) => event.preventDefault()}
          /* Radix hides the rest of the page from assistive technology; the attribute says so to the dialog's own role too (G14). */
          aria-modal="true"
          style={{
            position: "fixed",
            left: "50%",
            top: "50%",
            translate: "-50% -50%",
            /* Above the water (51), which is above the overlay (50). */
            zIndex: 52,
            boxSizing: "border-box",
            width: phone ? "calc(100vw - 32px)" : DIALOG.width,
            maxHeight: "calc(100dvh - 32px)",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            padding: "16px 20px 20px",
            borderRadius: DIALOG.radius,
            background: t.window,
            boxShadow: `0 0 0 1px ${t.windowBorder}, ${t.windowShadow}`,
            outline: "none",
            fontFamily: FIGTREE,
          }}
        >
          <div
            data-testid="signin-row-one"
            style={{ height: DIALOG.control, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            {rowStart}
            <Dialog.Close asChild>
              <IconButton icon={X} label="Close" size={32} />
            </Dialog.Close>
          </div>
          <div aria-hidden="true" style={{ display: "flex", justifyContent: "center", flexShrink: 0 }}>
            <BeaverLogo theme={room} size={DIALOG_LOGO_WIDTH} />
          </div>
          <Dialog.Title className="sr-only" style={{ margin: 0 }}>
            {VIEW_TITLE[view] ?? VIEW_TITLE.login}
          </Dialog.Title>
          <div
            ref={body}
            tabIndex={-1}
            data-testid="signin-view-body"
            style={{ outline: "none", display: "flex", flexDirection: "column" }}
          >
            <div data-testid="signin-card" data-ui="signin-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {children}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default SignInDialogFrame;
