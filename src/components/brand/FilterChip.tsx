// The filter chip (UI-P07): the mobile sideways rows of "All · Proven · …".
//
// 30px tall (36 before the UI-P54 density pass), radius 10 (the media step),
// Figtree 12/500 (13), 0 9px of padding and a gap of 5. Off is a glass fill with
// a hairline; on is the inverse — `--text` fill, `--on-text` label — so a chosen
// filter is carried by fill and not by colour. An optional count rides inside,
// in DM Mono 10px at 70%. It is a toggle, so it is a button with `aria-pressed`; as a tab (`tab`) it is
// `role="tab"` inside a `ScrollRow tablist`.

import type { ButtonHTMLAttributes, CSSProperties } from "react";

import { useInteractive } from "@/lib/theme/interactive";
import { ring } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { controlPaint, SELECTED } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export interface FilterChipProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-pressed"> {
  label: string;
  /** Whether this filter is on. */
  on?: boolean;
  count?: number | string;
  /** The chip is a tab (UI-P38): `role="tab"` with `aria-selected` in place of `aria-pressed`, and only the chosen one in the tab order. */
  tab?: { id: string; controls: string };
}

export function FilterChip({
  label,
  on = false,
  count,
  tab,
  type = "button",
  style,
  onFocus,
  onBlur,
  ...rest
}: FilterChipProps) {
  const { state, handlers } = useInteractive<HTMLButtonElement>({ onFocus, onBlur });

  /* UI-P84: the control recipe at 36 high and radius 6; on is the selected recipe, not an inversion. */
  const paint: CSSProperties = {
    boxSizing: "border-box",
    height: 36,
    padding: "0 12px",
    borderRadius: r.control,
    ...(on ? SELECTED : controlPaint(state)),
    color: t.text,
    gap: 6,
  };

  return (
    <button
      data-ui="filter-chip"
      type={type}
      {...(tab
        ? { role: "tab", id: tab.id, "aria-controls": tab.controls, "aria-selected": on, tabIndex: on ? 0 : -1 }
        : { "aria-pressed": on })}
      {...rest}
      {...handlers}
      style={{
        flexShrink: 0,
        ...paint,
        fontFamily: FIGTREE,
        fontSize: 12,
        fontWeight: 500,
        display: "inline-flex",
        alignItems: "center",
        cursor: "pointer",
        whiteSpace: "nowrap",
        ...ring(state.focusVisible),
        ...style,
      }}
    >
      {label}
      {count !== undefined ? (
        <span
          style={
            { fontSize: 11.5, fontWeight: 400, color: t.label, fontVariantNumeric: "tabular-nums" }
          }
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

export default FilterChip;
