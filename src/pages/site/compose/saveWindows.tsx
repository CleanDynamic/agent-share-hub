/* CA-23: the two windows that talk about saving, built from `modalRecipes.tsx`: the frame, the title (15/500), the footer on
   `--window-foot` with a 1px `--hairline` rule above it, and the recipe buttons. A sheet on a phone.

   `RecipeWindow` is only the frame; "Changes still saving" is `LeaveWindow` (420) and the clash of Part 4 is in
   `ClashWindow.tsx` (560). Escape and a click outside cancel, as in the other small windows: for the leave window that is Stay. */

import { useWindowFocus } from "@/lib/focus/windowFocus";
import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

import { BottomSheet } from "@/components/shell/BottomSheet";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { t } from "@/lib/theme/tokens";

import { LABEL, NOTE, RecipeButton, TITLE, footerStyle, frameStyle } from "./modalRecipes";

export const LEAVE_COPY = {
  title: "Changes still saving",
  body: (count: number): string => (count === 1 ? "1 change hasn't saved. Leaving may lose it." : `${count} changes haven't saved. Leaving may lose them.`),
  leave: "Leave",
  stay: "Stay",
} as const;

/** The footer: `--window-foot`, and a 1px `--hairline` rule on top. */
const FOOT = { borderTop: `1px solid ${t.hairline}` } as const;

export interface RecipeWindowProps {
  open: boolean;
  /** Escape and a click outside. */
  onClose: () => void;
  title: string;
  /** The grey line under the title. */
  note?: ReactNode;
  /** The buttons, at the right of the footer, in order. */
  buttons: ReactNode;
  testId: string;
  width: number;
  children?: ReactNode;
  /** The note's size: 13 for a body line, 12.5 where the title has a panel under it. */
  small?: boolean;
}

/** The window opens with the primary button focused, not the first: neither question here is one to answer by accident. */
const focusPrimary = (event: Event) => {
  event.preventDefault();
  (event.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>('[data-variant="primary"]')?.focus();
};

export function RecipeWindow({ open, onClose, title, note, buttons, testId, width, children, small = false }: RecipeWindowProps) {
  const phone = useIsPhone();
  const focus = useWindowFocus(open, undefined, focusPrimary);
  const noteStyle = small ? { ...NOTE, color: t.text2, margin: 0 } : { ...LABEL, margin: 0 };
  if (phone) {
    return (
      <BottomSheet open={open} onOpenChange={(next) => !next && onClose()} title={title}>
        <div data-testid={testId} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {note ? <p style={noteStyle}>{note}</p> : null}
          {children}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 8 }}>{buttons}</div>
        </div>
      </BottomSheet>
    );
  }
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 70 }} />
        <Dialog.Content role="alertdialog" aria-describedby={undefined} onOpenAutoFocus={focus.onOpenAutoFocus} onCloseAutoFocus={focus.onCloseAutoFocus} data-testid={testId} style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 71, ...frameStyle(width) }}>
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", minHeight: 0 }}>
            <Dialog.Title style={TITLE}>{title}</Dialog.Title>
            {note ? <p style={noteStyle}>{note}</p> : null}
            {children}
          </div>
          <div style={{ ...footerStyle(false), ...FOOT }}>
            <span style={{ flexGrow: 1 }} />
            {buttons}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** "Changes still saving": Leave (secondary), then Stay (primary). Stay is also what Escape does. */
export function LeaveWindow({ open, count, onStay, onLeave }: { open: boolean; count: number; onStay: () => void; onLeave: () => void }) {
  const phone = useIsPhone();
  return (
    <RecipeWindow
      open={open}
      onClose={onStay}
      title={LEAVE_COPY.title}
      note={LEAVE_COPY.body(count)}
      testId="leave-window"
      width={420}
      buttons={
        <>
          <RecipeButton small={!phone} phone={phone} data-testid="leave-leave" onClick={onLeave}>
            {LEAVE_COPY.leave}
          </RecipeButton>
          <RecipeButton variant="primary" small={!phone} phone={phone} data-testid="leave-stay" onClick={onStay}>
            {LEAVE_COPY.stay}
          </RecipeButton>
        </>
      }
    />
  );
}
