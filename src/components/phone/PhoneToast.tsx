// A toast on a phone (prompt 17): Text fill with Page text 15/500, 48 tall, radius 12, 16 from the sides and 16 above the dock or
// the sticky footer; an action at the right as a ghost button. Five seconds, then it goes; one at a time. The paint lives
// here so the real toaster (`ui/sonner.tsx`, on a phone) and the catalogue draw the same toast.

import type { CSSProperties, ReactNode } from "react";

import { PHONE_DOCK, PHONE_MARGIN } from "@/components/shell/chromeSize";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export const PHONE_TOAST_MS = 5000;
export const PHONE_TOAST_HEIGHT = 48;

export const phoneToastStyle: CSSProperties = {
  background: t.text,
  color: t.toastText,
  border: 0,
  borderRadius: 12,
  minHeight: PHONE_TOAST_HEIGHT,
  padding: "0 8px 0 16px",
  fontFamily: FIGTREE,
  fontSize: 15,
  fontWeight: 500,
  lineHeight: "20px",
  boxShadow: "none",
};

/** The action: a ghost button, in the ink that reads on the Text fill in both themes. */
export const phoneToastActionStyle: CSSProperties = {
  background: "transparent",
  color: t.toastAction,
  height: 44,
  padding: "0 12px",
  borderRadius: 22,
  fontSize: 15,
  fontWeight: 600,
};

/** Where sonner puts a toast on a phone: 16 from the sides, 16 above the dock plus the safe-area inset. */
export const PHONE_TOAST_OFFSET = {
  left: PHONE_MARGIN,
  right: PHONE_MARGIN,
  bottom: `calc(${PHONE_DOCK}px + env(safe-area-inset-bottom) + ${PHONE_MARGIN}px)`,
} as const;

export interface PhoneToastProps {
  children: ReactNode;
  action?: { label: string; onClick: () => void };
}

/** The drawn toast, for the catalogue and for tests. */
export function PhoneToast({ children, action }: PhoneToastProps) {
  return (
    <div role="status" data-ui="phone-toast" style={{ ...phoneToastStyle, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
      {action ? (
        <button type="button" onClick={action.onClick} style={{ ...phoneToastActionStyle, border: 0, cursor: "pointer" }}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

export default PhoneToast;
