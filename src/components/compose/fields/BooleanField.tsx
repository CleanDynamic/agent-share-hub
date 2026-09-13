// type: "boolean" — a toggle.
//
// The label sits beside the switch rather than above it, which is the one place
// a widget departs from the stacked shell: a lone switch under a heading reads
// as a section, not a setting. FieldShell takes `inlineLabel` for exactly this.

import { FieldShell } from "../SchemaForm";
import { CONTROL_BORDER, TEAL_TRACK, type FieldWidgetProps } from "./index";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";

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
          /* `--r-control`, which is the token for a switch track. At 20px tall
             a 12px radius still reads as a capsule — see switchTrackStyle's note
             on why the token wins over the render anyway. */
          borderRadius: r.control,
          border: `1px solid ${checked ? TEAL_TRACK : CONTROL_BORDER}`,
          background: checked ? TEAL_TRACK : t.recess,
          cursor: "pointer",
          transition: "background 160ms cubic-bezier(.2,.6,.35,1)",
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
            /* A thumb is a circle, which is what `--r-full` is for. */
            borderRadius: r.full,
            /* --on-action is the measured ink on a filled control. "#08080C" was
               the old void: invisible on the track in the light room. */
            background: checked ? t.onAction : t.text2,
            transition: "left 160ms cubic-bezier(.2,.6,.35,1)",
          }}
        />
      </button>
    </FieldShell>
  );
}
