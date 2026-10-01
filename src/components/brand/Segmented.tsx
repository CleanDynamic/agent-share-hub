// The segmented control (UI-P07): one choice from a few, always visible.
//
// A track of buttons, and exactly one is current. The current segment is the
// one filled solid — `--text` with `--on-text` on it, weight 600 — so the choice
// is carried by fill and weight, not by colour. Each item is a button with
// `aria-pressed`, and the group is named, because "Following / Everyone" with
// nothing around it is two unrelated buttons to a screen reader.
//
// Sizes are the track's outer height: items are `size − 8` tall inside 4px of
// padding. The type is Figtree at 11, 12 or 13px, and each reference instance
// states its own — 30/11 for panel filters, 32/11 in the footer, 36/12 for the
// gallery lenses, 36/13 on mobile.

import type { ReactNode } from "react";

import { useInteractive } from "@/lib/theme/interactive";
import { ring } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export type SegmentedSize = 30 | 32 | 34 | 36 | 38;
export type SegmentedFontSize = 11 | 12 | 13;

export interface SegmentedItem<V extends string = string> {
  value: V;
  label: ReactNode;
  /** Used as the button's accessible name when `label` is not text. */
  ariaLabel?: string;
}

export interface SegmentedProps<V extends string = string> {
  items: readonly SegmentedItem<V>[];
  value: V;
  onChange: (value: V) => void;
  size?: SegmentedSize;
  fontSize?: SegmentedFontSize;
  /** The group's accessible name. */
  label: string;
}

function Segment({
  current,
  height,
  fontSize,
  ariaLabel,
  onSelect,
  children,
}: {
  current: boolean;
  height: number;
  fontSize: number;
  ariaLabel?: string;
  onSelect: () => void;
  children: ReactNode;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-pressed={current}
      aria-label={ariaLabel}
      onClick={onSelect}
      {...handlers}
      style={{
        height,
        padding: "0 12px",
        border: 0,
        borderRadius: r.chip,
        fontFamily: FIGTREE,
        fontSize,
        cursor: "pointer",
        whiteSpace: "nowrap",
        background: current ? t.text : "transparent",
        color: current ? t.onText : t.text2,
        fontWeight: current ? 600 : 500,
        ...ring(state.focusVisible),
      }}
    >
      {children}
    </button>
  );
}

export function Segmented<V extends string = string>({
  items,
  value,
  onChange,
  size = 34,
  fontSize = 12,
  label,
}: SegmentedProps<V>) {
  return (
    <div
      data-ui="segmented"
      role="group"
      aria-label={label}
      style={{
        display: "inline-flex",
        gap: 2,
        padding: 4,
        borderRadius: r.control,
        background: t.glass2,
        border: `1px solid ${t.line}`,
      }}
    >
      {items.map((item) => (
        <Segment
          key={item.value}
          current={item.value === value}
          height={size - 8}
          fontSize={fontSize}
          ariaLabel={item.ariaLabel}
          onSelect={() => onChange(item.value)}
        >
          {item.label}
        </Segment>
      ))}
    </div>
  );
}

export default Segmented;
