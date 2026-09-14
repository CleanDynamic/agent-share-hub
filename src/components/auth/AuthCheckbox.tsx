import { useState } from "react";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { checkboxStyle } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

interface AuthCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  id: string;
}

/**
 * "Keep me signed in" and "I agree to the Terms".
 *
 * The box is the kit's: `--r-chip`, `--recess` with a `--line` hairline at rest,
 * `--action` with an `--on-action` tick when checked — the same pair
 * `ui/checkbox.tsx` shows. `controls.ts` records the affordance defect this
 * inherits: at 16px square, an 8px radius is a circle, so the box reads like a
 * radio. The fix is a bigger box, which is structural and not this prompt's.
 *
 * THE RING IS NEW, AND IT IS A FIX RATHER THAN A REPAINT. The real control is
 * an `sr-only` input, so a keyboard user tabbing onto it had NO visible mark at
 * all — the checkbox was invisible to focus on a form whose submit button is
 * disabled until it is ticked. The input's focus now rings the box that stands
 * in for it.
 */
export function AuthCheckbox({ checked, onChange, label, id }: AuthCheckboxProps) {
  const [keyboardFocus, setKeyboardFocus] = useState(false);

  return (
    <label
      htmlFor={id}
      className="flex items-center cursor-pointer"
      style={{ gap: "10px" }}
    >
      <div style={{ position: "relative" }}>
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
          onFocus={(event) => {
            let visible = true;
            try {
              visible = event.currentTarget.matches(":focus-visible");
            } catch {
              /* :focus-visible unsupported. Show the ring rather than hide it. */
            }
            if (visible) setKeyboardFocus(true);
          }}
          onBlur={() => setKeyboardFocus(false)}
        />
        <div
          style={{
            ...checkboxStyle({ focusVisible: keyboardFocus }),
            width: "16px",
            height: "16px",
            background: checked ? t.action : t.recess,
            borderColor: checked ? t.action : t.line,
            color: t.onAction,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {checked && <Check size={12} strokeWidth={3} />}
        </div>
      </div>
      <span
        style={{
          fontFamily: FIGTREE,
          fontSize: "12px",
          fontWeight: 400,
          color: t.text2,
        }}
      >
        {label}
      </span>
    </label>
  );
}
