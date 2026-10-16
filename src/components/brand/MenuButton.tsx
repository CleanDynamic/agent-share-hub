// A menu button (UI-P84, refined look): the control recipe, 28 high, `0 8px 0 12px`. The label sits in `--text2`, the
// chosen value in `--text` at 500, then a `chevd` glyph in `--label`. It only opens a menu: `aria-haspopup`, and
// `aria-expanded` when the caller says it is open. The menu itself is the caller's. An empty `value` draws the label
// alone (the composer's Add, UI-P93).
//
// `tone="inverse"` (PT-05) draws it on a `--inverse` bar: no fill at rest, the value in `--on-inverse`, the label and
// the chevron in `--on-inverse-2`, 30 high; hover is a colour step.

import type { ButtonHTMLAttributes } from "react";

import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { controlPaint } from "@/lib/theme/refinedControl";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { Glyph } from "./Glyph";

export interface MenuButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** "Sort by". */
  label: string;
  /** "Engagement". */
  value: string;
  open?: boolean;
  /** On a light ground (default) or on an `--inverse` bar. */
  tone?: "default" | "inverse";
}

export function MenuButton({
  label,
  value,
  open,
  tone = "default",
  type = "button",
  style,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  ...rest
}: MenuButtonProps) {
  const { state, handlers } = useInteractive<HTMLButtonElement>({
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
    onPointerDown,
    onPointerUp,
    onPointerCancel,
  });
  const inverse = tone === "inverse";
  return (
    <button
      data-ui="menu-button"
      type={type}
      aria-haspopup="menu"
      aria-expanded={open}
      {...rest}
      {...handlers}
      style={{
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 28,
        padding: "0 8px 0 12px",
        borderRadius: r.control,
        ...controlPaint(state),
        fontFamily: FIGTREE,
        fontSize: 12.5,
        fontWeight: 400,
        color: t.text2,
        whiteSpace: "nowrap",
        cursor: "pointer",
        ...(inverse
          ? {
              height: 30,
              padding: "0 6px 0 8px",
              border: 0,
              boxShadow: "none",
              background: open || state.hovered ? tokenAlpha("text2", 0.55) : "transparent",
              color: t.onInverse2,
            }
          : null),
        ...ring(state.focusVisible),
        ...style,
      }}
    >
      {label}
      {value ? <span style={{ color: inverse ? t.onInverse : t.text, fontWeight: 500 }}>{value}</span> : null}
      <Glyph name="chevd" size={16} color={inverse ? t.onInverse2 : t.label} />
    </button>
  );
}

export default MenuButton;
