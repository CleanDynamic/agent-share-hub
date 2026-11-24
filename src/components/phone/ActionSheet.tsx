// An action sheet (prompt 17): a content-height sheet for confirmations. Padding 8 16 plus the inset, the title 17/22 600, the
// explanation 15 Text 2, then full-width 48 tall buttons 8 apart: the action first (Mint, or Danger for a destructive one),
// Cancel last as a Raised button. An alert dialog, so Cancel has focus when it opens and Escape or a tap on the scrim cancels.

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import type { ReactNode } from "react";

import { useWindowFocus } from "@/lib/focus/windowFocus";
import { PHONE_MARGIN, PHONE_SHEET_RADIUS } from "@/components/shell/chromeSize";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { BigButton } from "./BigButton";

export interface ActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  explanation?: ReactNode;
  action: { label: string; onSelect: () => void; danger?: boolean };
  /** Defaults to "Cancel". */
  cancelLabel?: string;
  /** Prompt 24: more the sheet shows under the explanation (the public rows of "Publish <title>?"). */
  children?: ReactNode;
  "data-testid"?: string;
  actionTestId?: string;
  cancelTestId?: string;
}

export function ActionSheet({ open, onOpenChange, title, explanation, action, cancelLabel = "Cancel", children, actionTestId, cancelTestId, ...rest }: ActionSheetProps) {
  /* Closed, focus goes back to what opened the sheet (Cancel still takes it as it opens). */
  const focus = useWindowFocus(open);
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay data-motion="scrim" style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 50 }} />
        <AlertDialog.Content
          data-testid={rest["data-testid"] ?? "action-sheet"}
          data-motion="sheet"
          onCloseAutoFocus={focus.onCloseAutoFocus}
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 51,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: `8px ${PHONE_MARGIN}px calc(8px + env(safe-area-inset-bottom))`,
            borderRadius: `${PHONE_SHEET_RADIUS}px ${PHONE_SHEET_RADIUS}px 0 0`,
            background: t.module,
            color: t.text,
            fontFamily: FIGTREE,
          }}
        >
          <div aria-hidden="true" style={{ alignSelf: "center", width: 36, height: 4, margin: "4px 0 0", borderRadius: 2, background: t.fieldEdge }} />
          <AlertDialog.Title style={{ margin: "8px 0 0", fontSize: 17, fontWeight: 600, lineHeight: "22px", color: t.text }}>{title}</AlertDialog.Title>
          {explanation ? (
            <AlertDialog.Description style={{ margin: "0 0 8px", fontSize: 15, lineHeight: "20px", color: t.text2 }}>{explanation}</AlertDialog.Description>
          ) : (
            <AlertDialog.Description style={{ display: "none" }}>{title}</AlertDialog.Description>
          )}
          {children}
          <AlertDialog.Action asChild>
            <BigButton full main={!action.danger} danger={action.danger} data-testid={actionTestId} onClick={action.onSelect}>
              {action.label}
            </BigButton>
          </AlertDialog.Action>
          <AlertDialog.Cancel asChild>
            <BigButton full data-testid={cancelTestId}>{cancelLabel}</BigButton>
          </AlertDialog.Cancel>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export default ActionSheet;
