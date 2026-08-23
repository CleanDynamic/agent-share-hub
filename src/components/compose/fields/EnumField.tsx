// type: "enum" — a select over the field's `options`.
//
// The options come from the schema and nowhere else. A payload holding a value
// that is no longer in the list keeps it as an extra choice rather than
// silently resetting to the placeholder, because dropping it would rewrite a
// creator's record to fix a registry change they did not make.

import { FieldShell } from "../SchemaForm";
import {
  blurControl,
  compactControlStyle,
  controlStyle,
  focusControl,
  type FieldWidgetProps,
} from "./index";
import { TEXT_SECONDARY, VOID } from "@/components/build/tokens";

/** Not selected. Distinct from any real option, which is why it is empty. */
const UNSET = "";

export function EnumField({
  field,
  value,
  onChange,
  id,
  touched,
  onTouch,
  compact,
}: FieldWidgetProps) {
  const current = value === null || value === undefined ? UNSET : String(value);
  const options = field.options ?? [];
  const isStale = current !== UNSET && !options.includes(current);

  return (
    <FieldShell field={field} id={id} touched={touched} isEmpty={current === UNSET} compact={compact}>
      <select
        id={id}
        value={current}
        onChange={(event) => {
          onTouch?.();
          const next = event.target.value;
          onChange(next === UNSET ? null : next);
        }}
        onFocus={(event) => focusControl(event.currentTarget)}
        onBlur={(event) => blurControl(event.currentTarget)}
        style={{
          ...(compact ? compactControlStyle : controlStyle),
          appearance: "none",
          cursor: "pointer",
        }}
      >
        {/* The native menu paints on the OS surface, so each option carries the
            panel's own colours rather than inheriting the select's. */}
        <option value={UNSET} style={{ background: VOID, color: TEXT_SECONDARY }}>
          {compact ? field.label : "Not set"}
        </option>
        {isStale && (
          <option value={current} style={{ background: VOID }}>
            {current} (not in schema)
          </option>
        )}
        {options.map((option) => (
          <option key={option} value={option} style={{ background: VOID }}>
            {option}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
