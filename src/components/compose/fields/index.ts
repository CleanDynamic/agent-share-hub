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
// A second, smaller map sits beside it: the four `format` hints a string field
// may carry. A format never changes what is stored — a node reference, a url
// and a timestamp are all strings on the row — so it is resolved here as a
// choice of control, and the four widgets it names are the only widgets in this
// directory that know anything beyond their own field.
//
// The shared widget contract lives here too, so the six widgets agree on their
// props and their control styling without a seventh file to hold it. ListField
// imports `resolveWidget` back out of this module to render its sub-fields:
// that cycle is read at render time, never at module evaluation time, so the
// binding is always resolved by the time it is used.

import type { ComponentType, CSSProperties } from "react";
import type { Json } from "@/integrations/supabase/types";
import type { FieldDef, FieldFormat, FieldType } from "@/lib/build";
import { fieldStyle } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, body, label as labelType } from "@/lib/theme/type";

import { StringField } from "./StringField";
import { TextField } from "./TextField";
import { NumberField } from "./NumberField";
import { BooleanField } from "./BooleanField";
import { EnumField } from "./EnumField";
import { ListField } from "./ListField";
import { NodeRefField } from "./NodeRefField";
import { MediaRefField } from "./MediaRefField";
import { UrlField } from "./UrlField";
import { TimestampField } from "./TimestampField";

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

/* ── The control, on BG-P07's field treatment ──────────────────────────────────
   EVERY WIDGET IN THIS DIRECTORY IS REPAINTED BY THESE FIVE CONSTANTS, which is
   why they are here and not in ten files. They were white-alpha values struck
   for one dark room — a 2.5%-white ground, a 6%-white border, a teal focus edge
   — so on Exhibition the fields were nearly invisible against the panel and the
   ink was black on black.

   `fieldStyle()` is the kit's own answer (src/lib/theme/controls.ts): `--recess`
   for the ground, because a field is a surface the page is cut INTO and that is
   what separates it from a button standing on the page; `--line` at rest and
   `--action` once focused; `--r-control`; and the shared focus ring. Taking it
   here means the composer's fields and every other input in the application are
   one control rather than two that resemble each other.
   ─────────────────────────────────────────────────────────────────────────── */

/** The resting field, kept as a name because ten widgets spread it. */
export const CONTROL_BACKGROUND = t.recess;
export const CONTROL_BORDER = t.line;
/** Focus. `--action` is the accent a focused field brightens toward. */
export const CONTROL_FOCUS = t.action;
/**
 * The "on" surface of a toggle.
 *
 * KEEPS ITS NAME AND CHANGES ITS VALUE, like everything else in the BG-P21
 * repointing: `TEAL_TRACK` is `--action`, which is burnt orange on Exhibition
 * and salmon on Dusk. Read the name as the job — "a toggle that is on" — rather
 * than as the colour it was. BG-P07's switch uses `--action` for exactly this.
 */
export const TEAL_TRACK = t.action;

export const controlStyle: CSSProperties = {
  ...fieldStyle(),
  width: "100%",
  boxSizing: "border-box",
  fontFamily: FIGTREE,
  fontSize: 13,
  /* 400, not 300. Below 18px the theme never emits Figtree under weight 400,
     and this is the role that sets most of the prose in the inspector. */
  fontWeight: 400,
  lineHeight: 1.6,
  padding: "7px 10px",
  outline: "none",
};

export const compactControlStyle: CSSProperties = {
  ...controlStyle,
  fontSize: 12,
  padding: "5px 8px",
  /* A list row's sub-field is still a control, so still `--r-control`. The 6px
     it used was a seventh step in a six-step scale. */
  borderRadius: r.control,
};

/** Applied on focus and removed on blur, because an inline style has no :focus. */
export function focusControl(element: HTMLElement) {
  element.style.borderColor = CONTROL_FOCUS;
}

export function blurControl(element: HTMLElement) {
  element.style.borderColor = CONTROL_BORDER;
}

/** A field's label: Figtree 13/500, which is the theme's `label` role exactly. */
export const fieldLabelStyle: CSSProperties = {
  ...labelType,
  color: t.text,
  display: "flex",
  alignItems: "baseline",
  gap: 6,
};

/** The hint under a label. `--text2`, so it reads as guidance, not as a value. */
export const helpStyle: CSSProperties = {
  ...body,
  fontSize: 11,
  fontWeight: 400,
  lineHeight: 1.5,
  color: t.text2,
  margin: 0,
};

export const hairlineStyle = t.line;
export const secondaryTextColour = t.text2;

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
 * format string -> widget. Four hints, and the dialect allows no others.
 *
 * Typed as a total map over FieldFormat for the same reason as FIELD_WIDGETS: a
 * fifth hint added to the migration fails to compile here until the control it
 * names exists.
 */
export const FORMAT_WIDGETS: Record<FieldFormat, FieldWidget> = {
  node_id: NodeRefField,
  media_id: MediaRefField,
  url: UrlField,
  timestamp: TimestampField,
};

/**
 * The widget for one field definition.
 *
 * A `format` is only meaningful on a string field, so it is only consulted for
 * one: a list or a number carrying a stray format hint is a schema mistake, and
 * rendering it as a picker would hide that rather than showing the field as the
 * type it declares.
 *
 * An unknown type — or an unknown format — is a schema this build of the app
 * predates. Both fall back to StringField rather than rendering nothing, so the
 * value stays visible and editable instead of silently disappearing from the
 * form.
 */
export function resolveWidget(field: FieldDef): FieldWidget {
  if (field.type === "string" && field.format) {
    return FORMAT_WIDGETS[field.format] ?? StringField;
  }
  return FIELD_WIDGETS[field.type] ?? StringField;
}

export { StringField, TextField, NumberField, BooleanField, EnumField, ListField };
export { NodeRefField, NodeRefProvider } from "./NodeRefField";
export { MediaRefField } from "./MediaRefField";
export { UrlField, isValidUrl } from "./UrlField";
export { TimestampField, isoToLocalInput, localInputToIso } from "./TimestampField";
