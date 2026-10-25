/* SV-02 — an active filter: `key value ×` (series README, Visual grammar 6).

   The prompt calls this `FilterChip`; that name is the toggle in `components/brand/FilterChip.tsx`, which other pages
   use, so this one is `ActiveFilterChip`. The control recipe at height 26, radius 6, 12px: the key in `--label`, the
   value in `--text`, and an 18px remove button named "Remove filter <key>". On a phone the remove button's hit area
   reaches 44px by padding with a matching negative margin. */

import { Glyph } from "@/components/brand/Glyph";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { ring } from "@/lib/theme/controls";
import { TOUCH_MIN } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { CONTROL } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export interface ActiveFilterChipProps {
  /** The filter's name: "Model". */
  name: string;
  /** What it is set to: "Sonnet 5.5". */
  value: string;
  onRemove: () => void;
}

export function ActiveFilterChip({ name, value, onRemove }: ActiveFilterChipProps) {
  const phone = useIsPhone();
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <span
      data-ui="active-filter-chip"
      style={{
        ...CONTROL,
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 26,
        padding: "0 4px 0 8px",
        borderRadius: r.control,
        fontFamily: FIGTREE,
        fontSize: 12,
        fontWeight: 400,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: t.label }}>{name}</span>
      <span style={{ color: t.text, fontWeight: 500 }}>{value}</span>
      <button
        type="button"
        aria-label={`Remove filter ${name}`}
        onClick={onRemove}
        {...handlers}
        style={{
          boxSizing: "content-box",
          width: 18,
          height: 18,
          padding: phone ? (TOUCH_MIN - 18) / 2 : 0,
          margin: phone ? (18 - TOUCH_MIN) / 2 : 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: 0,
          borderRadius: r.chip,
          background: "transparent",
          color: state.hovered ? t.text : t.label,
          cursor: "pointer",
          ...ring(state.focusVisible),
        }}
      >
        <Glyph name="x" size={12} />
      </button>
    </span>
  );
}

export default ActiveFilterChip;
