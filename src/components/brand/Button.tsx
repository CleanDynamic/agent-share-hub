// The button (UI-P07).
//
// THREE VARIANTS, ONE PER JOB. `primary` is the one action in a page body
// (`--action` fill, `--on-action` label), `secondary` is every other action on a
// glass fill with a `--line` hairline, `ghost` is the quiet one — `--text2` on
// nothing. Only one primary per page body: the header's New build is chrome and
// does not count, which is a rule for the page rather than something a button
// can enforce, so it is stated here and not checked.
//
// SIZE AND TYPE ARE TWO NUMBERS BECAUSE THE REFERENCE STATES BOTH. A button is
// `size` px tall at `fontSize` px, and the design uses eleven pairs of them —
// 28/11, 30/12, 32/12, 34/12, 36/13, 38/13, 42/14, 44/13, 46/15, 48/14, 48/15 —
// so neither is derived from the other. The default is 36/13. Padding is 0 14px
// at every size, the radius is the control step (12), the gap is 7, and the icon
// is 15px at stroke 1.8.
//
// This is the new button. The shadcn `ui/button.tsx` and every call site of it
// are untouched: they move when their page is rebuilt.

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { useInteractive } from "@/lib/theme/interactive";
import { ring } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = 28 | 30 | 32 | 34 | 36 | 38 | 42 | 44 | 46 | 48;
export type ButtonFontSize = 11 | 12 | 13 | 14 | 15;

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: ButtonVariant;
  /** Height in px. */
  size?: ButtonSize;
  /** Label size in px. */
  fontSize?: ButtonFontSize;
  /** A lucide icon, drawn before the label at 15px and stroke 1.8. */
  icon?: LucideIcon;
  /** `display: flex; width: 100%` — the mobile 48px buttons. */
  fullWidth?: boolean;
  children: ReactNode;
}

const PAINT: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: t.action,
    color: t.onAction,
    border: `1px solid ${t.action}`,
    fontWeight: 600,
  },
  secondary: {
    background: t.glass2,
    color: t.text,
    border: `1px solid ${t.line}`,
    fontWeight: 500,
  },
  ghost: {
    background: "transparent",
    color: t.text2,
    border: "1px solid transparent",
    fontWeight: 500,
  },
};

export function Button({
  variant = "primary",
  size = 36,
  fontSize = 13,
  icon: Icon,
  fullWidth = false,
  type = "button",
  disabled,
  style,
  children,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  ...rest
}: ButtonProps) {
  const { state, handlers } = useInteractive<HTMLButtonElement>(
    { onMouseEnter, onMouseLeave, onFocus, onBlur, onPointerDown, onPointerUp, onPointerCancel },
    { disabled },
  );

  /* Hover is a step on the fill, never an opacity change: a primary button is
     solid, and letting the page show through it is the opposite of the job. */
  const hover: CSSProperties = state.hovered
    ? variant === "primary"
      ? { filter: "brightness(1.08)" }
      : variant === "ghost"
        ? { background: t.glass2, color: t.text }
        : { borderColor: t.text2 }
    : {};

  return (
    <button
      data-ui="button"
      data-variant={variant}
      type={type}
      disabled={disabled}
      {...rest}
      {...handlers}
      style={{
        height: size,
        padding: "0 14px",
        borderRadius: r.control,
        ...PAINT[variant],
        fontFamily: FIGTREE,
        fontSize,
        display: fullWidth ? "flex" : "inline-flex",
        width: fullWidth ? "100%" : undefined,
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : undefined,
        whiteSpace: "nowrap",
        flexShrink: 0,
        ...hover,
        ...ring(state.focusVisible),
        ...style,
      }}
    >
      {Icon ? <Icon size={15} strokeWidth={1.8} aria-hidden="true" style={{ flexShrink: 0 }} /> : null}
      {children}
    </button>
  );
}

export default Button;
