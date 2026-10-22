/* CA-15 P3: one choice from a handful, as a grid of plain buttons: the Result's output type, the Tool's connection method.

   Three columns. A button is the control recipe; the chosen one is the selected recipe, never a colour. Each is a real
   button with `aria-pressed`, the group is named, and a phone's buttons are 44 high. With `allowClear` a second press on
   the chosen button takes the choice off (the Tool's connection method is optional). */

import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { CONTROL, SELECTED, controlPaint } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";

import { text } from "./refinedStyles";

export interface ChoiceItem<V extends string> {
  value: V;
  label: string;
  disabled?: boolean;
}

function Choice({ label, chosen, disabled, phone, onPick }: { label: string; chosen: boolean; disabled?: boolean; phone: boolean; onPick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>({}, { disabled });
  return (
    <button
      type="button"
      aria-pressed={chosen}
      disabled={disabled}
      onClick={onPick}
      {...handlers}
      style={{
        ...(chosen ? SELECTED : disabled ? CONTROL : controlPaint(state)),
        ...text(13, chosen ? 500 : 400, t.text),
        minHeight: phone ? 44 : 32,
        padding: "4px 8px",
        boxSizing: "border-box",
        borderRadius: 6,
        textAlign: "center",
        cursor: disabled ? "default" : "pointer",
        ...(disabled ? { filter: t.dimFilter } : null),
        ...ring(state.focusVisible),
      }}
    >
      {label}
    </button>
  );
}

export interface ChoiceGridProps<V extends string> {
  /** The group's accessible name. */
  label: string;
  items: readonly ChoiceItem<V>[];
  value: V | null;
  onChange: (value: V | null) => void;
  phone: boolean;
  columns?: number;
  /** A second press on the chosen one takes the choice off. */
  allowClear?: boolean;
  /** A `Field` around it already names the group: draw no group of its own. */
  bare?: boolean;
}

export function ChoiceGrid<V extends string>({ label, items, value, onChange, phone, columns = 3, allowClear = false, bare = false }: ChoiceGridProps<V>) {
  return (
    <div role={bare ? undefined : "group"} aria-label={bare ? undefined : label} data-testid="choice-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 6 }}>
      {items.map((item) => (
        <Choice key={item.value} label={item.label} chosen={item.value === value} disabled={item.disabled} phone={phone} onPick={() => onChange(allowClear && item.value === value ? null : item.value)} />
      ))}
    </div>
  );
}

export default ChoiceGrid;
