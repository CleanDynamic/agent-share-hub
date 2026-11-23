/* Synth 15 Part F: the admin page's confirmations, on the modal recipe (prompt 06): the window at the confirm width, its
   header (the question, one line under it in Text 2, a close button), an optional body, and the footer with Cancel (ghost)
   and the one filled button that says what it does. The rejection reason is a text box like every other: it gets Expand,
   which opens the text in the notepad. */

import * as Dialog from "@radix-ui/react-dialog";
import { useId, useState, type ReactNode } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { useWindowFocus } from "@/lib/focus/windowFocus";
import { FieldArea, footerStyle, frameStyle, HEADER, HEADER_ICONS, HEADER_TEXT, IconSquare, LABEL, MODAL_PAD, MODAL_WIDTH, RecipeButton, SUBTITLE, TITLE } from "@/pages/site/compose/modalRecipes";
import { t } from "@/lib/theme/tokens";

export interface AdminConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  busy?: boolean;
  testId?: string;
  children?: ReactNode;
}

export function AdminConfirm({ open, onOpenChange, title, description, confirmLabel, onConfirm, busy = false, testId, children }: AdminConfirmProps) {
  const phone = useIsPhone();
  const focus = useWindowFocus(open);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => (!next && busy ? undefined : onOpenChange(next))}>
      <Dialog.Portal>
        <Dialog.Overlay data-motion="scrim" style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 50 }} />
        <Dialog.Content
          data-testid={testId}
          onOpenAutoFocus={focus.onOpenAutoFocus}
          onCloseAutoFocus={focus.onCloseAutoFocus}
          style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 51, ...frameStyle(MODAL_WIDTH.confirm) }}
        >
          <div style={HEADER}>
            <div style={HEADER_TEXT}>
              <Dialog.Title style={TITLE}>{title}</Dialog.Title>
              <Dialog.Description style={SUBTITLE}>{description}</Dialog.Description>
            </div>
            <div style={HEADER_ICONS}>
              <IconSquare glyph="x" label={`Close ${title}`} phone={phone} disabled={busy} onClick={() => onOpenChange(false)} />
            </div>
          </div>
          {children ? <div style={{ padding: `4px ${MODAL_PAD}px 12px`, minWidth: 0 }}>{children}</div> : null}
          <div style={{ ...footerStyle(false), justifyContent: "flex-end" }}>
            <RecipeButton variant="ghost" small phone={phone} disabled={busy} onClick={() => onOpenChange(false)}>
              Cancel
            </RecipeButton>
            <RecipeButton variant="primary" small phone={phone} disabled={busy} onClick={onConfirm}>
              {confirmLabel}
            </RecipeButton>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Reject with an optional reason: the confirmation with one text box, "Rejection reason (optional)". */
export function RejectWithReason({
  open,
  onOpenChange,
  name,
  onReject,
  busy = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What is being rejected: "ChatGPT". */
  name: string;
  onReject: (reason: string) => void;
  busy?: boolean;
}) {
  const phone = useIsPhone();
  const [reason, setReason] = useState("");
  const id = useId();
  return (
    <AdminConfirm
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason("");
        onOpenChange(next);
      }}
      title={`Reject ${name}?`}
      description="It leaves the review list and is not shown in the AI Tools filter."
      confirmLabel="Reject"
      busy={busy}
      testId="reject-dialog"
      onConfirm={() => onReject(reason)}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label htmlFor={id} style={LABEL}>
          Rejection reason (optional)
        </label>
        <FieldArea id={id} phone={phone} rows={3} aria-label="Rejection reason (optional)" value={reason} onChange={(event) => setReason(event.target.value)} />
      </div>
    </AdminConfirm>
  );
}
