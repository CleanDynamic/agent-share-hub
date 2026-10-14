// A checkbox (UI-P84, refined look): 16 square, radius 4. Off is the well; on is `--action` with a `check` glyph in
// `--on-action`. A real `<input type="checkbox">` sits over the box with no opacity change to its box (it is the
// control, drawn transparent), so the label, the keyboard and the form all behave natively. Name it with `label`, or
// wrap it in a `<label>`.

import type { InputHTMLAttributes } from "react";

import { r } from "@/lib/theme/radius";
import { WELL } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";

import { Glyph } from "./Glyph";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  checked: boolean;
  /** The accessible name, when no `<label>` wraps it. */
  label?: string;
}

export function Checkbox({ checked, label, disabled, style, ...rest }: CheckboxProps) {
  return (
    <span
      data-ui="checkbox"
      data-checked={checked}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        width: 16,
        height: 16,
        flexShrink: 0,
        borderRadius: r.chip,
        ...(checked
          ? { background: t.action, border: `1px solid ${t.action}`, color: t.onAction }
          : WELL),
        opacity: disabled ? 0.5 : undefined,
        ...style,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        {...rest}
        style={{
          position: "absolute",
          inset: -14,
          margin: 0,
          width: "auto",
          height: "auto",
          opacity: 0,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      />
      {checked ? <Glyph name="check" size={12} color="currentColor" /> : null}
    </span>
  );
}

export default Checkbox;
