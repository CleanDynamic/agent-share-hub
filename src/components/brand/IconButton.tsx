// The icon button (UI-P07).
//
// A square control that carries one icon and no words, so the words are
// required: `label` becomes the `aria-label`, and there is no way to render the
// button without one. 30, 34 or 38px square, radius 12, a glass fill and a
// `--line` hairline, the icon in `--text2` at 16px and stroke 1.6.

import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";

import { useInteractive } from "@/lib/theme/interactive";
import { ring } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";

export type IconButtonSize = 30 | 34 | 38;

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> {
  icon: LucideIcon;
  /** The accessible name. Required: an icon alone names nothing. */
  label: string;
  size?: IconButtonSize;
}

export function IconButton({
  icon: Icon,
  label,
  size = 34,
  type = "button",
  disabled,
  style,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  ...rest
}: IconButtonProps) {
  const { state, handlers } = useInteractive<HTMLButtonElement>(
    { onMouseEnter, onMouseLeave, onFocus, onBlur, onPointerDown, onPointerUp, onPointerCancel },
    { disabled },
  );

  return (
    <button
      data-ui="icon-button"
      type={type}
      aria-label={label}
      disabled={disabled}
      {...rest}
      {...handlers}
      style={{
        width: size,
        height: size,
        borderRadius: r.control,
        background: t.glass2,
        border: `1px solid ${state.hovered ? t.text2 : t.line}`,
        color: t.text2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : undefined,
        flexShrink: 0,
        ...ring(state.focusVisible),
        ...style,
      }}
    >
      <Icon size={16} strokeWidth={1.6} aria-hidden="true" style={{ flexShrink: 0 }} />
    </button>
  );
}

export default IconButton;
