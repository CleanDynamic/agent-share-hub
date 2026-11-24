// The pill row on a phone (prompt 17): 32 tall pills, 8 apart, padding 12 16 around the row, scrolling sideways when they
// overflow. The chosen pill keeps the Inverse fill: one Mint element per region stays the New button or the round post button.
// Each pill is a toggle (`aria-pressed`), or a tab when `tabs` is given.

import { FilterChip } from "@/components/brand/FilterChip";
import { PHONE_MARGIN } from "@/components/shell/chromeSize";
import { PHONE_PILL } from "@/components/shell/chromeSize";

export interface PhonePill<V extends string = string> {
  value: V;
  label: string;
  count?: number | string;
}

export interface PhonePillsProps<V extends string = string> {
  pills: readonly PhonePill<V>[];
  /** The chosen pill. */
  value: V | null;
  onChange: (value: V) => void;
  /** The row's accessible name. */
  label: string;
}

export function PhonePills<V extends string = string>({ pills, value, onChange, label }: PhonePillsProps<V>) {
  return (
    <div
      data-ui="phone-pills"
      className="bg-scroll-row"
      role="group"
      aria-label={label}
      style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", padding: `12px ${PHONE_MARGIN}px` }}
    >
      {pills.map((pill) => (
        <FilterChip
          key={pill.value}
          label={pill.label}
          count={pill.count}
          on={pill.value === value}
          onClick={() => onChange(pill.value)}
          style={{ height: PHONE_PILL, minHeight: PHONE_PILL, padding: "0 12px", borderRadius: PHONE_PILL / 2 }}
        />
      ))}
    </div>
  );
}

export default PhonePills;
