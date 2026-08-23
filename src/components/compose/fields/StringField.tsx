// type: "string" — a single-line input.
//
// A field carrying a `format` hint (node_id, media_id, url, timestamp) never
// reaches this component: resolveWidget sends it to the picker, the validator,
// the timestamp control or the media placeholder instead. That routing lives in
// the resolver, not here, so this component never learns what a format is — and
// it is still the fallback for a hint this build does not recognise, because a
// stored string is always editable as a string.

import { FieldShell } from "../SchemaForm";
import {
  blurControl,
  compactControlStyle,
  controlStyle,
  focusControl,
  type FieldWidgetProps,
} from "./index";

export function StringField({
  field,
  value,
  onChange,
  id,
  touched,
  onTouch,
  compact,
}: FieldWidgetProps) {
  // A payload written against an older schema can hold anything at this key.
  // Coerce rather than trust it, so a stale number still renders and edits.
  const text = value === null || value === undefined ? "" : String(value);

  return (
    <FieldShell field={field} id={id} touched={touched} isEmpty={text === ""} compact={compact}>
      <input
        id={id}
        type="text"
        value={text}
        placeholder={compact ? field.label : undefined}
        onChange={(event) => {
          onTouch?.();
          // Empty is null, not "": an absent value and a blank one are the same
          // thing to a reader, and null keeps the payload free of empty strings.
          const next = event.target.value;
          onChange(next === "" ? null : next);
        }}
        onFocus={(event) => focusControl(event.currentTarget)}
        onBlur={(event) => blurControl(event.currentTarget)}
        style={compact ? compactControlStyle : controlStyle}
      />
    </FieldShell>
  );
}
