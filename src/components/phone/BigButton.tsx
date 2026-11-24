// The big button (prompt 17): 48 tall, radius 24, 15/600, Raised fill with Text. `main` is Mint with On-mint; `full` makes it the
// row's width. The main action on a phone screen and in sheets. `danger` is the destructive fill, for the action sheet.

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export const BIG_BUTTON_HEIGHT = 48;

export interface BigButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children: ReactNode;
  main?: boolean;
  /** The destructive fill: Danger with the Page shade for its text. */
  danger?: boolean;
  full?: boolean;
}

export function BigButton({ children, main = false, danger = false, full = false, type = "button", style, disabled, ...rest }: BigButtonProps) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const paint = danger ? { background: t.dangerText, color: t.bg } : main ? { background: t.brandAccent, color: t.onBrandAccent } : { background: t.control, color: t.text };
  return (
    <button
      type={type}
      data-ui="big-button"
      data-variant={danger ? "danger" : main ? "main" : "raised"}
      disabled={disabled}
      {...rest}
      {...handlers}
      style={{
        boxSizing: "border-box",
        height: BIG_BUTTON_HEIGHT,
        minWidth: 48,
        padding: "0 24px",
        display: full ? "flex" : "inline-flex",
        width: full ? "100%" : undefined,
        alignItems: "center",
        justifyContent: "center",
        border: 0,
        borderRadius: 24,
        fontFamily: FIGTREE,
        fontSize: 15,
        fontWeight: 600,
        lineHeight: "20px",
        whiteSpace: "nowrap",
        cursor: disabled ? "not-allowed" : "pointer",
        ...paint,
        opacity: disabled ? 0.48 : 1,
        ...ring(!disabled && state.focusVisible),
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export default BigButton;
