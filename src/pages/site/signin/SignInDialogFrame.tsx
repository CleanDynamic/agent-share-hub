/* Synth 13 Part B: the sign-in dialog's frame. One card at every width: 420 wide (the width less 32 on a phone), centred,
   the Overlay fill, radius 16, 16px 20px 20px padding, 14 between its parts, the Overlay edge and shadow.

   Top row: the pills Sign in and Sign up (other views: "Back to sign in" as a ghost button), and a 32 round Close at the
   right. Then the beaver at 104 wide, centred, and a visually hidden h2 that names the view (the dialog's title). Then the
   view.

   Behind it there is no dim scrim: the overlay is clear, and the host draws the dot water over it (`SignInWaterLayer`).

   ON A PHONE (mobile prompt 27 Part B) there is no centred dialog: the whole screen is the dot water (the canvas, `position: absolute;
   inset: 0`), the space above the card is a flex area that centres the beaver (168 wide, `data-clear`, no pointer events), and the
   dialog is a Panel card fixed to the bottom (`data-occlude`, radius 20 on its top corners, the bottom inset in its padding). There is
   no close button there: Back and Escape close it, and a hidden Close is kept for assistive technology.

   The frame is Radix's dialog, the site's one primitive: focus trap, Escape, scroll lock, `role="dialog"` and
   `aria-modal`, and the title wired up as the label. PURE: the view, the row-1 control and the handlers come in as props. */

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { IconButton } from "@/components/brand/IconButton";
import { useKeyboardInset } from "@/components/phone/useKeyboardInset";
import { SignInWaterCanvas } from "@/lib/dots/SignInWaterLayer";
import { Segmented } from "@/components/brand/Segmented";
import { PhoneTabs } from "@/components/phone/PhoneTabs";
import { FrameLink } from "@/components/shell/FrameLink";
import { useRoom } from "@/components/brand/useRoom";
import { BeaverLogo } from "@/components/shell/BeaverLogo";
import { DIALOG_LOGO_WIDTH, PHONE_SIGNIN_LOGO_WIDTH } from "@/components/shell/chromeSize";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { BASE, FAST, PHONE_EASE, PHONE_QUICK, PHONE_STANDARD, prefersReducedMotion, STANDARD } from "@/lib/theme/motion";
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
  /* 29f: on a phone the switch is the tab pattern from 29d (44 tall, a word-wide Text indicator), not small pills. */
  if (phone) {
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <PhoneTabs<"login" | "signup"> centred label="Sign in or join" value={value} onChange={onChange} tabs={[{ value: "login", label: "Sign in" }, { value: "signup", label: "Sign up" }]} />
      </div>
    );
  }
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
  const keyboard = useKeyboardInset();
  const body = useRef<HTMLDivElement>(null);
  /* 29f: while a field is focused (or the keyboard is up) the beaver moves up and fades out, and the card keeps the field, the
     password and Sign in above the keyboard. On blur with the keyboard closed everything returns. */
  const [typing, setTyping] = useState(false);
  const away = phone && (typing || keyboard > 0);
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
  const [cardEl, card] = useState<HTMLDivElement | null>(null);
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
    if (phone) {
      /* A phone: the screen fades in FAST and the card slides up in BASE on STANDARD (reduced motion: a fade only, above). */
      if (open) {
        contentEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FAST, easing: STANDARD });
        cardEl?.animate([{ transform: "translateY(24px)" }, { transform: "none" }], { duration: BASE, easing: STANDARD });
      } else {
        contentEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FAST, easing: STANDARD, fill: "forwards" });
        scrimEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: SCRIM_OUT_MS, easing: SCRIM_EASING, fill: "forwards" });
      }
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
  }, [open, scrimEl, contentEl, cardEl, phone]);

  /* The card rides above the keyboard (the content's bottom padding). Once the keyboard has settled, the card is scrolled so Sign in
     is above it, and the focused field is kept in view if the two cannot both be. The 29e handler leaves fields in dialogs alone. */
  useEffect(() => {
    if (!phone || !typing || keyboard === 0 || !cardEl) return;
    const timer = window.setTimeout(() => {
      const box = cardEl.getBoundingClientRect();
      const primary = cardEl.querySelector<HTMLElement>('button[type="submit"]');
      if (primary) {
        const over = primary.getBoundingClientRect().bottom + 16 - box.bottom;
        if (over > 0) cardEl.scrollTop += over;
      }
      const field = document.activeElement;
      if (field instanceof HTMLElement && cardEl.contains(field)) {
        const under = box.top - field.getBoundingClientRect().top + 8;
        if (under > 0) cardEl.scrollTop -= under;
      }
    }, PHONE_QUICK);
    return () => window.clearTimeout(timer);
  }, [phone, typing, keyboard, cardEl]);

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
          style={
            phone
              ? {
                  position: "fixed",
                  inset: 0,
                  zIndex: 52,
                  boxSizing: "border-box",
                  display: "flex",
                  flexDirection: "column",
                  paddingBottom: keyboard,
                  background: t.frame,
                  outline: "none",
                  fontFamily: FIGTREE,
                  overflow: "hidden",
                }
              : {
                  position: "fixed",
                  left: "50%",
                  top: "50%",
                  translate: "-50% -50%",
                  /* Above the water (51), which is above the overlay (50). */
                  zIndex: 52,
                  boxSizing: "border-box",
                  width: DIALOG.width,
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
                }
          }
        >
          {phone ? (
            <>
              {/* The whole screen is the water; it sits under the beaver and the card. */}
              <SignInWaterCanvas style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
              <div aria-hidden="true" data-testid="signin-beaver" data-away={away ? "" : undefined} style={{ position: "relative", flex: "1 1 0", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", overflow: "hidden" }}>
                <div
                  data-motion="bar"
                  style={{
                    pointerEvents: "none",
                    opacity: away ? 0 : 1,
                    transform: away && !prefersReducedMotion() ? "translateY(-200px)" : "none",
                    transition: prefersReducedMotion() ? `opacity ${PHONE_QUICK}ms ${PHONE_EASE}` : `transform ${PHONE_STANDARD}ms ${PHONE_EASE}, opacity ${PHONE_STANDARD}ms ${PHONE_EASE}`,
                  }}
                >
                  <BeaverLogo theme={room} size={PHONE_SIGNIN_LOGO_WIDTH} clear />
                </div>
              </div>
              <Dialog.Title className="sr-only" style={{ margin: 0 }}>
                {VIEW_TITLE[view] ?? VIEW_TITLE.login}
              </Dialog.Title>
              <div
                ref={card}
                data-occlude=""
                data-testid="signin-phone-card"
                onFocusCapture={(event) => {
                  if (event.target instanceof HTMLInputElement && event.target.type !== "checkbox") setTyping(true);
                }}
                onBlurCapture={(event) => {
                  const next = event.relatedTarget;
                  if (!(next instanceof HTMLInputElement) || next.type === "checkbox") setTyping(false);
                }}
                style={{
                  position: "relative",
                  flexShrink: 0,
                  boxSizing: "border-box",
                  maxHeight: "calc(100% - 24px)",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  padding: away && keyboard > 0 ? "16px" : "16px 16px calc(16px + env(safe-area-inset-bottom))",
                  borderRadius: "20px 20px 0 0",
                  /* 29f: the card is on the Page shade, as `13-sign-in-keyboard.jpg` draws it: Card fields, a Text Google button. */
                  background: t.bg,
                }}
              >
                <div data-testid="signin-row-one" style={{ flexShrink: 0, display: "flex", alignItems: "center", minHeight: 44 }}>
                  {rowStart}
                </div>
                <div ref={body} tabIndex={-1} data-testid="signin-view-body" style={{ outline: "none", display: "flex", flexDirection: "column" }}>
                  <div data-testid="signin-card" data-ui="signin-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {children}
                  </div>
                </div>
              </div>
              <Dialog.Close className="sr-only">Close</Dialog.Close>
            </>
          ) : (
            <>
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
                <BeaverLogo theme={room} size={DIALOG_LOGO_WIDTH} clear />
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
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default SignInDialogFrame;
