// The field widget registry: one component per field type, and nothing else.
//
// This module is the reason the node type registry exists. A node type is
// rendered by walking its schema and looking each field's `type` up in the map
// below — never by a component that knows what a prompt or a result is. There
// are exactly six entries here because the schema dialect has exactly six field
// types (see the NS-P02 migration header). A seventh field type is a change to
// the dialect, the migration and this map together, not a new component quietly
// added to the side.
//
// The shared widget contract lives here too, so the six widgets agree on their
// props and their control styling without a seventh file to hold it. ListField
// imports `resolveWidget` back out of this module to render its sub-fields:
// that cycle is read at render time, never at module evaluation time, so the
// binding is always resolved by the time it is used.

import type { ComponentType, CSSProperties } from "react";
import type { Json } from "@/integrations/supabase/types";
import type { FieldDef, FieldType } from "@/lib/build";
import {
  FONT_STACK,
  HAIRLINE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  labelText,
} from "@/components/build/tokens";

import { StringField } from "./StringField";
import { TextField } from "./TextField";
import { NumberField } from "./NumberField";
import { BooleanField } from "./BooleanField";
import { EnumField } from "./EnumField";
import { ListField } from "./ListField";

/**
 * What every widget receives.
 *
 * `value` is whatever the payload currently holds at this field's key, which
 * may be anything at all — a payload written before a schema changed is not
 * required to match it. Every widget coerces defensively rather than trusting
 * the type, and none of them throw on a shape they did not expect.
 *
 * `onChange` reports the field's new value only. Merging it into the payload,
 * debouncing and writing are SchemaForm's job, not the widget's.
 */
export interface FieldWidgetProps {
  field: FieldDef;
  value: Json | undefined;
  onChange: (value: Json | null) => void;
  /** Ties the control to its label without colliding across list rows. */
  id: string;
  /** True once the creator has edited this field: gates the required marker. */
  touched?: boolean;
  onTouch?: () => void;
  /** Inline density for the sub-fields inside a ListField row. */
  compact?: boolean;
}

export type FieldWidget = ComponentType<FieldWidgetProps>;

// --- shared control styling --------------------------------------------------

export const CONTROL_BACKGROUND = "rgba(255,255,255,0.025)";
export const CONTROL_BORDER = "rgba(255,255,255,0.06)";
/** Focus ring. Teal rather than orange: orange is the instruction category. */
export const CONTROL_FOCUS = "rgba(46,196,182,0.55)";
/** The "on" surface of a toggle. Teal, for the same reason as the focus ring. */
export const TEAL_TRACK = "rgba(46,196,182,0.75)";

export const controlStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: FONT_STACK,
  fontSize: 13,
  fontWeight: 300,
  lineHeight: 1.6,
  color: TEXT_PRIMARY,
  background: CONTROL_BACKGROUND,
  border: `1px solid ${CONTROL_BORDER}`,
  borderRadius: 8,
  padding: "7px 10px",
  outline: "none",
};

export const compactControlStyle: CSSProperties = {
  ...controlStyle,
  fontSize: 12,
  padding: "5px 8px",
  borderRadius: 6,
};

/** Applied on focus and removed on blur, because an inline style has no :focus. */
export function focusControl(element: HTMLElement) {
  element.style.borderColor = CONTROL_FOCUS;
}

export function blurControl(element: HTMLElement) {
  element.style.borderColor = CONTROL_BORDER;
}

export const fieldLabelStyle: CSSProperties = {
  ...labelText,
  display: "flex",
  alignItems: "baseline",
  gap: 6,
};

export const helpStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 300,
  lineHeight: 1.5,
  color: TEXT_MUTED,
  margin: 0,
};

export const hairlineStyle = HAIRLINE;
export const secondaryTextColour = TEXT_SECONDARY;

// --- the registry ------------------------------------------------------------

/**
 * type string -> widget. The one place a field type becomes a component.
 *
 * Typed as a total map over FieldType, so adding a seventh type to the dialect
 * fails to compile here until a widget for it exists.
 */
export const FIELD_WIDGETS: Record<FieldType, FieldWidget> = {
  string: StringField,
  text: TextField,
  number: NumberField,
  boolean: BooleanField,
  enum: EnumField,
  list: ListField,
};

/**
 * The widget for one field definition.
 *
 * A field carrying a `format` hint still resolves to StringField in NS-P09 —
 * storage is `string` either way, and the node_id picker, url validator and
 * timestamp control arrive in NS-P10. That decision belongs here, in the
 * resolver, rather than inside StringField: NS-P10 changes this function and
 * adds widgets, and touches none of the six that already exist.
 *
 * An unknown type is a schema this build of the app predates. It falls back to
 * StringField rather than rendering nothing, so the value stays visible and
 * editable instead of silently disappearing from the form.
 */
export function resolveWidget(field: FieldDef): FieldWidget {
  return FIELD_WIDGETS[field.type] ?? StringField;
}

export { StringField, TextField, NumberField, BooleanField, EnumField, ListField };
