// The filter chip (UI-P07): the mobile sideways rows of "All · Proven · …".
//
// 36px tall, radius 10 (the media step), Figtree 13/500. Off is a glass fill with
// a hairline; on is the inverse — `--text` fill, `--on-text` label — so a chosen
// filter is carried by fill and not by colour. An optional count rides inside,
// in DM Mono 10px at 70%. It is a toggle, so it is a button with `aria-pressed`; as a tab (`tab`) it is
// `role="tab"` inside a `ScrollRow tablist`.

import type { ButtonHTMLAttributes } from "react";

import { useInteractive } from "@/lib/theme/interactive";
import { ring } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

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
        height: 36,
        padding: "0 12px",
        borderRadius: r.media,
        background: on ? t.text : t.glass2,
        color: on ? t.onText : t.text,
        border: `1px solid ${on ? t.text : t.line}`,
        fontFamily: FIGTREE,
        fontSize: 13,
        fontWeight: 500,
        display: "inline-flex",
        gap: 7,
        alignItems: "center",
        cursor: "pointer",
        whiteSpace: "nowrap",
        ...ring(state.focusVisible),
        ...style,
      }}
    >
      {label}
      {count !== undefined ? (
        <span style={{ fontFamily: DM_MONO, fontSize: 10, opacity: 0.7 }}>{count}</span>
      ) : null}
    </button>
  );
}

export default FilterChip;
