// The icon button (UI-P07).
//
// A square control that carries one icon and no words, so the words are
// required: `label` becomes the `aria-label`, and there is no way to render the
// button without one. 30, 34 or 38px square as the reference drew it, rendered
// through the density table at 25, 28 or 31 (UI-P54); radius 12, a glass fill
// and a `--line` hairline, the icon in `--text2` at 16px and stroke 1.6.

import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";

import { useInteractive } from "@/lib/theme/interactive";
import { ring } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { controlPaint } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";

import { Icon as AnyIcon } from "./Icon";
import type { GlyphName } from "./Glyph";

/** 26, 28 and 30 are the refined look's; 34 and 38 are the current look's and draw as 30 under the refined one. */
export type IconButtonSize = 26 | 28 | 30 | 34 | 38;

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> {
  icon: LucideIcon;
  /** The accessible name. Required: an icon alone names nothing. */
  label: string;
  size?: IconButtonSize;
  /** The refined look's drawing of `icon` (UI-P84). Absent: the lucide icon at stroke 1.3 with square caps. */
  glyph?: GlyphName;
  /** Refined only: the control recipe (default), or none, for a ghost icon button. */
  boxed?: boolean;
}

export function IconButton({
  icon: Icon,
  label,
  size = 34,
  glyph,
  boxed = true,
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

  const side = size > 30 ? 30 : size;
  return (
    <button
      data-ui="icon-button"
      type={type}
      aria-label={label}
      disabled={disabled}
      {...rest}
      {...handlers}
      style={{
        boxSizing: "border-box",
        width: side,
        height: side,
        borderRadius: r.control,
        ...(boxed
          ? controlPaint(state)
          : { background: "transparent", border: "1px solid transparent" }),
        color: !boxed && state.hovered ? t.text : t.text2,
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
      <AnyIcon lucide={Icon} glyph={glyph} size={16} />
    </button>
  );
}

export default IconButton;
