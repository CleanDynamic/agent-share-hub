// Prompt 24: a page pushed inside a sheet on a phone. It covers the sheet's own area (59 below the top, to the bottom edge, radius
// 16 at the top, on Card), enters from the right in BASE (the `data-motion="push"` rule; a fade under reduced motion) and has a
// back chevron where the sheet had its close button. A dialog of its own, so focus stays inside, Escape or Back goes back to
// the sheet under it, and focus returns to the field that opened it. Used by the pickers (a full-screen searchable list) and by
// Colours (a reference group).

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

import { MobileIcon } from "@/components/brand/MobileIcon";
import { PHONE_MARGIN, PHONE_SHEET_RADIUS } from "@/components/shell/chromeSize";
import { ring } from "@/lib/theme/controls";
import { TOUCH_MIN } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { useWindowFocus } from "@/lib/focus/windowFocus";
import { LAYER } from "@/pages/site/compose/layers";

import { SHEET_TOP_GAP } from "./BottomSheet";
import { useKeyboardInset } from "./useKeyboardInset";

export const PUSH_COPY = { back: "Back" } as const;

export interface PhonePushPanelProps {
  open: boolean;
  /** Back, Escape: return to the sheet underneath. */
  onClose: () => void;
  title: string;
  /** Where focus lands as it opens (the search field); the browser's first stop otherwise. */
  onOpenAutoFocus?: (event: Event) => void;
  /** A pinned footer (Save), on Surface above the keyboard. */
  footer?: ReactNode;
  "data-testid"?: string;
  /** The content pins its own footer to the bottom edge: no padding under it. */
  flush?: boolean;
  children: ReactNode;
}

export function PhonePushPanel({ open, onClose, title, onOpenAutoFocus, footer, flush = false, children, ...rest }: PhonePushPanelProps) {
  const focus = useWindowFocus(open);
  const keyboard = useKeyboardInset();
  const back = useInteractive<HTMLButtonElement>();
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay data-motion="scrim" style={{ position: "fixed", inset: 0, background: "transparent", zIndex: LAYER.floating - 1 }} />
        <Dialog.Content
          data-testid={rest["data-testid"] ?? "push-panel"}
          data-motion="push"
          aria-describedby={undefined}
          onOpenAutoFocus={onOpenAutoFocus ?? focus.onOpenAutoFocus}
          onCloseAutoFocus={focus.onCloseAutoFocus}
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            top: SHEET_TOP_GAP,
            bottom: keyboard,
            zIndex: LAYER.floating,
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            borderRadius: `${PHONE_SHEET_RADIUS}px ${PHONE_SHEET_RADIUS}px 0 0`,
            background: t.module,
            color: t.text,
            fontFamily: FIGTREE,
            paddingTop: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: `4px ${PHONE_MARGIN}px 8px 4px`, flexShrink: 0 }}>
            <button
              type="button"
              aria-label={PUSH_COPY.back}
              data-testid="push-back"
              onClick={onClose}
              {...back.handlers}
              style={{ width: TOUCH_MIN, height: TOUCH_MIN, flexShrink: 0, padding: 0, border: 0, borderRadius: r.full, background: "transparent", color: t.text, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", ...ring(back.state.focusVisible) }}
            >
              <MobileIcon name="back" size={24} />
            </button>
            <Dialog.Title style={{ margin: 0, minWidth: 0, fontSize: 17, fontWeight: 600, lineHeight: "22px", color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</Dialog.Title>
          </div>
          <div data-push-body="" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: `0 ${PHONE_MARGIN}px ${flush ? 0 : footer ? 12 : 16}px`, ...(footer || keyboard || flush ? null : { paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }), ...(flush ? { display: "flex", flexDirection: "column" } : null) }}>
            {children}
          </div>
          {footer ? (
            <div data-testid="push-footer" style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: `12px ${PHONE_MARGIN}px ${keyboard ? "12px" : "calc(12px + env(safe-area-inset-bottom))"}`, background: t.surface }}>
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default PhonePushPanel;
