/* CA-15 P3: one choice from a handful, as a grid of plain buttons: the Result's output type, the Tool's connection method.

   CA-15b: drawn as the recipes' option grid: three equal columns (two on a phone), each option 32 tall, left-aligned, one
   line with an ellipsis and its full name as the tooltip; the chosen one is the selected recipe, never a colour. Each is a
   real button with `aria-pressed`, the group is named. With `allowClear` a second press on the chosen button takes the
   choice off (the Tool's connection method is optional). */

import { OptionGrid } from "./modalRecipes";

export interface ChoiceItem<V extends string> {
  value: V;
  label: string;
  disabled?: boolean;
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
    <OptionGrid<V>
      label={label}
      items={items}
      chosen={value === null ? [] : [value]}
      onPick={(picked) => onChange(allowClear && picked === value ? null : picked)}
      phone={phone}
      columns={columns}
      bare={bare}
    />
  );
}

export default ChoiceGrid;
