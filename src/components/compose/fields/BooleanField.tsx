// type: "boolean" — a toggle.
//
// The label sits beside the switch rather than above it, which is the one place
// a widget departs from the stacked shell: a lone switch under a heading reads
// as a section, not a setting. FieldShell takes `inlineLabel` for exactly this.

import { FieldShell } from "../SchemaForm";
import { CONTROL_BORDER, TEAL_TRACK, type FieldWidgetProps } from "./index";
import { TEXT_MUTED } from "@/components/build/tokens";

const TRACK_WIDTH = 34;
const TRACK_HEIGHT = 20;
const KNOB = 14;

export function BooleanField({
  field,
  value,
  onChange,
  id,
  touched,
  onTouch,
  compact,
}: FieldWidgetProps) {
  // Anything truthy that is not a boolean came from an older schema. Read it as
  // a boolean rather than refusing to render.
  const checked = value === true || value === "true" || value === 1;

  return (
    <FieldShell field={field} id={id} touched={touched} isEmpty={false} compact={compact} inlineLabel>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={field.label}
        onClick={() => {
          onTouch?.();
          onChange(!checked);
        }}
        style={{
          position: "relative",
          flexShrink: 0,
          width: TRACK_WIDTH,
          height: TRACK_HEIGHT,
          padding: 0,
          borderRadius: TRACK_HEIGHT,
          border: `1px solid ${checked ? TEAL_TRACK : CONTROL_BORDER}`,
          background: checked ? TEAL_TRACK : "rgba(255,255,255,0.04)",
          cursor: "pointer",
          transition: "background 140ms ease, border-color 140ms ease",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: checked ? TRACK_WIDTH - KNOB - 4 : 2,
            width: KNOB,
            height: KNOB,
            marginTop: -(KNOB / 2),
            borderRadius: "50%",
            background: checked ? "#08080C" : TEXT_MUTED,
            transition: "left 140ms ease, background 140ms ease",
          }}
        />
      </button>
    </FieldShell>
  );
}
