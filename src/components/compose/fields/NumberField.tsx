// type: "number" — a numeric input where empty means null, not zero.
//
// The distinction matters: a temperature of 0 is a real setting a creator may
// have used, and a temperature nobody recorded is not the same claim. Storing
// an untouched field as 0 would publish a parameter that was never set.
//
// The typed text is held locally while the field has focus so that partial
// input — "-", "0.", "1e" — survives being typed. Only a value that parses is
// written to the payload.

import { useEffect, useState } from "react";
import { FieldShell } from "../SchemaForm";
import {
  blurControl,
  compactControlStyle,
  controlStyle,
  focusControl,
  type FieldWidgetProps,
} from "./index";

function toDraft(value: FieldWidgetProps["value"]): string {
  if (value === null || value === undefined || value === "") return "";
  return typeof value === "number" ? String(value) : String(value);
}

export function NumberField({
  field,
  value,
  onChange,
  id,
  touched,
  onTouch,
  compact,
}: FieldWidgetProps) {
  const [draft, setDraft] = useState(() => toDraft(value));
  const [editing, setEditing] = useState(false);

  // A value that changed underneath us — a reload, or another writer — should
  // show, but not while the creator is mid-keystroke in this very field.
  useEffect(() => {
    if (!editing) setDraft(toDraft(value));
  }, [editing, value]);

  return (
    <FieldShell field={field} id={id} touched={touched} isEmpty={draft === ""} compact={compact}>
      <input
        id={id}
        // inputMode rather than type="number": the spinner steals scroll events
        // inside a scrolling panel, and its own empty-string coercion hides the
        // difference between an unset field and a zero.
        type="text"
        inputMode="decimal"
        value={draft}
        placeholder={compact ? field.label : undefined}
        onChange={(event) => {
          onTouch?.();
          const next = event.target.value;
          setDraft(next);
          if (next.trim() === "") {
            onChange(null);
            return;
          }
          const parsed = Number(next);
          // "1e" and "-" are on the way to a number. Keep them on screen and
          // leave the stored value alone until they resolve.
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
        onFocus={(event) => {
          setEditing(true);
          focusControl(event.currentTarget);
        }}
        onBlur={(event) => {
          setEditing(false);
          blurControl(event.currentTarget);
          // Leaving "1e" behind would show text the payload does not hold.
          setDraft(toDraft(value));
        }}
        style={compact ? compactControlStyle : controlStyle}
      />
    </FieldShell>
  );
}
