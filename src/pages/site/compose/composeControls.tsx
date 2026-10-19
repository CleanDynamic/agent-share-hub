/* UI-P47 / UI-P48 — the composer's small controls, shared by its panels.

   PURE. No state beyond the focus ring each control tracks for itself. The
   field styles and the focus-ring hook they use live in composeFields.ts. */

import type { CSSProperties, MouseEvent, ReactNode } from "react";

import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

const text2Button: CSSProperties = {
  fontFamily: FIGTREE,
  fontSize: 13,
  color: t.text2,
  background: "transparent",
  border: 0,
  padding: 0,
  cursor: "pointer",
};

/**
 * A quiet text control in `--text2`. `target` gives it a 44px touch target on
 * a phone: the padding is the target, the negative margins keep the line where
 * it sits.
 */
export function TextButton({
  onClick,
  underline = false,
  disabled,
  target = false,
  style,
  children,
  ...aria
}: {
  onClick: (event: MouseEvent) => void;
  underline?: boolean;
  disabled?: boolean;
  target?: boolean;
  style?: CSSProperties;
  children: ReactNode;
  "aria-expanded"?: boolean;
  "aria-haspopup"?: "dialog" | "menu";
  "aria-label"?: string;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...aria}
      {...handlers}
      style={{
        ...text2Button,
        textDecoration: underline ? "underline" : "none",
        borderRadius: 6,
        ...(target ? { padding: "12px 4px", margin: "-12px -4px", minHeight: 44, boxSizing: "border-box" } : null),
        ...(disabled ? { cursor: "default", opacity: 0.6 } : null),
        ...ring(state.focusVisible),
        ...style,
      }}
    >
      {children}
    </button>
  );
}


/** A field's label (CA-03, the Components table): Geist 13/500 `--text`, sentence case, 6 above its control. */
export const FIELD_LABEL: CSSProperties = { fontFamily: FIGTREE, fontSize: 13, fontWeight: 500, lineHeight: "normal", color: t.text };

/**
 * A label over its control. With `group`, the control is not one input (a picker, a row of menus): the label names a
 * `role="group"` around it instead of pointing at an input.
 */
export function Field({ id, label, hint, right, group = false, children }: { id: string; label: string; hint?: string; right?: ReactNode; group?: boolean; children: ReactNode }) {
  return (
    <div role={group ? "group" : undefined} aria-labelledby={group ? id : undefined} style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        {group ? (
          <span id={id} style={FIELD_LABEL}>
            {label}
          </span>
        ) : (
          <label htmlFor={id} style={FIELD_LABEL}>
            {label}
          </label>
        )}
        {hint ? <span style={{ fontFamily: FIGTREE, fontSize: 12, color: t.text2 }}>{hint}</span> : null}
        {right ? <span style={{ marginLeft: "auto" }}>{right}</span> : null}
      </div>
      {children}
    </div>
  );
}
