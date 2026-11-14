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
import { useEffect, useRef, type ReactNode } from "react";

import { IconButton } from "@/components/brand/IconButton";
import { Segmented } from "@/components/brand/Segmented";
import { FrameLink } from "@/components/shell/FrameLink";
import { Lockup } from "@/components/brand/Lockup";
import { useRoom } from "@/components/brand/useRoom";
import { useMinWidth } from "@/components/shell/useMinWidth";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { DIALOG } from "./authSizes";
import { SIGNIN_COLOURS } from "./signinColours";

export const TAGLINE = "Publish, reproduce and fork AI-assisted workflows.";

const PICTURE = { dusk: "/brand/beaver-dark.png", noon: "/brand/beaver-light.png" } as const;

/** Row 1 for Sign in and Join free: the switch, two links, so each side is the address of its view (a push). */
export function AccountSwitch({ value, loginTo, signupTo }: { value: "login" | "signup"; loginTo: string; signupTo: string }) {
  return (
    <Segmented
      label="Sign in or join"
      size={28}
      value={value}
      items={[
        { value: "login", label: "Sign in", href: loginTo },
        { value: "signup", label: "Join free", href: signupTo },
      ]}
    />
  );
}

/** Row 1 for every other view: a text link, 24 high, 12px, underlined, centred in the 32 row. */
export function BackToSignIn({ to }: { to: string }) {
  const room = useRoom();
  return (
    <FrameLink
      to={to}
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
      style={{ width: DIALOG.left, flexShrink: 0, display: "flex", flexDirection: "column", background: SIGNIN_COLOURS[room].column }}
    >
      <img
        src={PICTURE[room]}
        alt=""
        width={DIALOG.left}
        height={DIALOG.picture}
        style={{ display: "block", width: DIALOG.left, height: DIALOG.picture, objectFit: "cover", flexShrink: 0 }}
      />
      <div style={{ flex: "1 1 auto", minHeight: 0, padding: DIALOG.pad, display: "flex", flexDirection: "column" }}>
        <Lockup size={14} markSize={18} />
        <Dialog.Title
          data-testid="signin-tagline"
          style={{ margin: "16px 0 0", fontFamily: FIGTREE, fontSize: 22, fontWeight: 500, lineHeight: "28px", color: t.text }}
        >
          {TAGLINE}
        </Dialog.Title>
        <span style={{ marginTop: "auto", fontFamily: DM_MONO, fontSize: 11, lineHeight: "16px", color: t.text2 }}>openbuilds.ai</span>
      </div>
    </div>
  );
}

/** What focus lands on in a view that has just arrived: its first field or control, or the view itself. */
const FOCUSABLE = 'input:not([type="checkbox"]):not([disabled]), button:not([disabled]), a[href]';

export function SignInDialogFrame({ open, onOpenChange, rowStart, view, children }: SignInDialogFrameProps) {
  const room = useRoom();
  const twoColumns = useMinWidth(DIALOG.twoColumnsFrom);
  const body = useRef<HTMLDivElement>(null);
  const shown = useRef(view);

  /* G10: after a view change focus is inside the new view, never left on a control that has gone (or on row 1). The first
     view's focus is Radix's to place. */
  useEffect(() => {
    if (shown.current === view) return;
    shown.current = view;
    const target = body.current?.querySelector<HTMLElement>(FOCUSABLE) ?? body.current;
    target?.focus();
  }, [view]);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay data-testid="signin-scrim" style={{ position: "fixed", inset: 0, zIndex: 50, background: SIGNIN_COLOURS[room].scrim }} />
        <Dialog.Content
          data-testid="signin-dialog"
          data-view={view}
          aria-describedby={undefined}
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
          {twoColumns ? <PictureColumn /> : <Dialog.Title style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)", margin: 0 }}>{TAGLINE}</Dialog.Title>}
          <div
            data-testid="signin-form-column"
            style={{ width: DIALOG.right, flexShrink: 0, boxSizing: "border-box", padding: DIALOG.pad, display: "flex", flexDirection: "column" }}
          >
            <div data-testid="signin-row-one" style={{ height: DIALOG.control, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              {rowStart}
              <Dialog.Close asChild>
                <IconButton icon={X} label="Close" size={32} />
              </Dialog.Close>
            </div>
            <div ref={body} tabIndex={-1} data-testid="signin-view-body" style={{ outline: "none", flex: "1 1 auto", minHeight: 0, marginTop: 16, display: "flex", flexDirection: "column" }}>
              {children}
            </div>
          </div>
          {/* The control-edge border, drawn over the columns rather than inside the box, so the columns stay 360 and 480 and
              the picture stays flush to the dialog's edge. */}
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, borderRadius: DIALOG.radius, border: `1px solid ${t.windowBorder}`, pointerEvents: "none" }} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default SignInDialogFrame;
