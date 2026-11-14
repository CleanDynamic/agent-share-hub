/* The sign-in dialog's frame (Reference A): one window over whatever page the person is on.

   840 by 540, centred, radius 16, `--window` with the control-edge border and the overlay shadow. On the left a 360
   column: the beaver picture 360 by 300 flush to the top, then 24 in, the lockup, 16, the tagline (the dialog's title),
   and "openbuilds.ai" pinned to the bottom. On the right a 480 column padded 24, so every control is 432 wide: row 1
   (the switch or "Back to sign in" on the left, Close on the right), 16, then the view.

   The frame is Radix's dialog, the site's one primitive: focus trap, Escape, scroll lock, `role="dialog"` and
   `aria-modal`, and the title wired up as the label. Below 840 wide the picture column is dropped and the form column
   stands alone; a phone gets the full-screen layout (`phone`), which its own module draws.

   PURE: the view, the row-1 control and the handlers come in as props. */

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { IconButton } from "@/components/brand/IconButton";
import { Segmented } from "@/components/brand/Segmented";
import { FrameLink } from "@/components/shell/FrameLink";
import { Lockup } from "@/components/brand/Lockup";
import { Mark } from "@/components/brand/Mark";
import { Panel } from "@/components/brand/Panel";
import { VisuallyHidden } from "@/components/brand/VisuallyHidden";
import { useRoom } from "@/components/brand/useRoom";
import { useIsPhone, useMinWidth } from "@/components/shell/useMinWidth";
import { prefersReducedMotion } from "@/lib/theme/motion";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { DIALOG } from "./authSizes";
import { SIGNIN_COLOURS } from "./signinColours";
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

export const TAGLINE = "Publish, reproduce and fork AI-assisted workflows.";

const PICTURE = {
  dusk: "/brand/beaver-dark.png",
  noon: "/brand/beaver-light.png",
} as const;

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
      /* A phone keeps today's 38 / 13 switch. */
      size={phone ? 38 : 28}
      fontSize={phone ? 13 : undefined}
      value={value}
      onChange={onChange}
      items={[
        { value: "login", label: "Sign in" },
        { value: "signup", label: "Join free" },
      ]}
    />
  );
}

/** Row 1 for every other view: a text link, 24 high, 12px, underlined, centred in the 32 row. */
export function BackToSignIn({ to, state }: { to: string; state?: unknown }) {
  const room = useRoom();
  return (
    <FrameLink
      to={to}
      state={state}
      data-testid="signin-back"
      style={{
        height: DIALOG.row,
        display: "inline-flex",
        alignItems: "center",
        fontFamily: FIGTREE,
        fontSize: 12,
        fontWeight: 500,
        color: SIGNIN_COLOURS[room].link,
        textDecoration: "underline",
        textUnderlineOffset: 4,
        textDecorationThickness: 1,
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

function PictureColumn() {
  const room = useRoom();
  return (
    <div
      data-testid="signin-picture-column"
      style={{
        width: DIALOG.left,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: SIGNIN_COLOURS[room].column,
      }}
    >
      <img
        src={PICTURE[room]}
        alt=""
        width={DIALOG.left}
        height={DIALOG.picture}
        style={{
          display: "block",
          width: DIALOG.left,
          height: DIALOG.picture,
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
      <div
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          padding: DIALOG.pad,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Lockup size={14} markSize={18} />
        <Dialog.Title
          data-testid="signin-tagline"
          style={{
            margin: "16px 0 0",
            fontFamily: FIGTREE,
            fontSize: 22,
            fontWeight: 500,
            lineHeight: "28px",
            color: t.text,
          }}
        >
          {TAGLINE}
        </Dialog.Title>
        <span
          style={{
            marginTop: "auto",
            fontFamily: DM_MONO,
            fontSize: 11,
            lineHeight: "16px",
            color: t.text2,
          }}
        >
          openbuilds.ai
        </span>
      </div>
    </div>
  );
}

/** What focus lands on in a view that has just arrived: its first field or control, or the view itself. */
const FOCUSABLE =
  'input:not([type="checkbox"]):not([disabled]), button:not([disabled]), a[href]';

/* ── a phone: today's sign-in layout, full screen ── */

const PHONE_TAGLINE = ["Every AI build,", "hung with", "its proof."] as const;

/** Today's phone tagline, as one heading: the dialog's title on a phone. */
function PhoneTagline() {
  return (
    <Dialog.Title
      data-ui="tagline"
      style={{
        margin: 0,
        display: "flex",
        flexDirection: "column",
        fontFamily: FIGTREE,
        fontSize: 32,
        fontWeight: 500,
        letterSpacing: "-0.04em",
        lineHeight: 1.04,
        color: t.text,
      }}
    >
      <VisuallyHidden>{PHONE_TAGLINE.join(" ")}</VisuallyHidden>
      <span aria-hidden="true">{PHONE_TAGLINE[0]}</span>
      <span
        aria-hidden="true"
        style={{
          paddingLeft: 48,
          display: "inline-flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {PHONE_TAGLINE[1]}
        <Mark size={Math.round(32 * 0.68)} />
      </span>
      <span aria-hidden="true" style={{ paddingLeft: 24 }}>
        {PHONE_TAGLINE[2]}
      </span>
    </Dialog.Title>
  );
}

/** The phone dialog: the whole screen, the page's ground, today's lockup and tagline, then the form in its panel with the
    switch (or the way back) at the top of it. No halftone and no code style here: nothing surrounds it. */
function PhoneFrame({
  rowStart,
  view,
  children,
  onCloseAutoFocus,
  contentRef,
}: Omit<SignInDialogFrameProps, "open" | "onOpenChange"> & {
  onCloseAutoFocus: (event: Event) => void;
  contentRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <Dialog.Content
      ref={contentRef}
      forceMount
      data-testid="signin-dialog"
      data-view={view}
      data-viewport="mobile"
      aria-describedby={undefined}
      aria-modal="true"
      onCloseAutoFocus={onCloseAutoFocus}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        overflowY: "auto",
        overflowX: "hidden",
        background: t.frame,
        outline: "none",
      }}
    >
      <div
        style={{
          boxSizing: "border-box",
          minHeight: "100dvh",
          padding: "16px 10px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 13,
              padding: "7px 0 4px",
            }}
          >
            <Lockup size={34} />
            <PhoneTagline />
          </div>
          <Dialog.Close asChild>
            <IconButton icon={X} label="Close" size={32} />
          </Dialog.Close>
        </div>
        <Panel surface="glass" padding="16px">
          <div
            data-testid="signin-card"
            data-ui="signin-card"
            style={{ display: "flex", flexDirection: "column", gap: 7 }}
          >
            {rowStart}
            {children}
          </div>
        </Panel>
      </div>
    </Dialog.Content>
  );
}

export function SignInDialogFrame({
  open,
  onOpenChange,
  rowStart,
  view,
  children,
}: SignInDialogFrameProps) {
  const room = useRoom();
  const phone = useIsPhone();
  const twoColumns = useMinWidth(DIALOG.twoColumnsFrom);
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
        <Dialog.Overlay
          ref={scrim}
          forceMount
          data-testid="signin-scrim"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: SIGNIN_COLOURS[room].scrim,
          }}
        />
        {phone ? (
          <PhoneFrame
            rowStart={rowStart}
            view={view}
            onCloseAutoFocus={returnFocus}
            contentRef={content}
          >
            {children}
          </PhoneFrame>
        ) : (
          <Dialog.Content
            ref={content}
            forceMount
            data-testid="signin-dialog"
            data-view={view}
            aria-describedby={undefined}
            onCloseAutoFocus={returnFocus}
            /* Radix hides the rest of the page from assistive technology; the attribute says so to the dialog's own role too (G14). */
            aria-modal="true"
            style={{
              position: "fixed",
              inset: 0,
              margin: "auto",
              zIndex: 50,
              boxSizing: "border-box",
              width: twoColumns ? DIALOG.width : DIALOG.right,
              maxWidth: "100vw",
              height: DIALOG.height,
              display: "flex",
              overflow: "hidden",
              borderRadius: DIALOG.radius,
              background: t.window,
              boxShadow: t.windowShadow,
              outline: "none",
            }}
          >
            {twoColumns ? (
              <PictureColumn />
            ) : (
              <Dialog.Title
                style={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  overflow: "hidden",
                  clipPath: "inset(50%)",
                  margin: 0,
                }}
              >
                {TAGLINE}
              </Dialog.Title>
            )}
            <div
              data-testid="signin-form-column"
              style={{
                width: DIALOG.right,
                flexShrink: 0,
                boxSizing: "border-box",
                padding: DIALOG.pad,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                data-testid="signin-row-one"
                style={{
                  height: DIALOG.control,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                {rowStart}
                <Dialog.Close asChild>
                  <IconButton icon={X} label="Close" size={32} />
                </Dialog.Close>
              </div>
              <div
                ref={body}
                tabIndex={-1}
                data-testid="signin-view-body"
                style={{
                  outline: "none",
                  flex: "1 1 auto",
                  minHeight: 0,
                  marginTop: 16,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {children}
              </div>
            </div>
            {/* The control-edge border, drawn over the columns rather than inside the box, so the columns stay 360 and 480 and
              the picture stays flush to the dialog's edge. */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: DIALOG.radius,
                border: `1px solid ${t.windowBorder}`,
                pointerEvents: "none",
              }}
            />
          </Dialog.Content>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default SignInDialogFrame;
