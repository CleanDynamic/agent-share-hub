// A field on a phone (prompt 17): the label above (13/16 Text 2, 6 under it), the box 44 tall, radius 12, Panel fill, a 1px inset
// edge in `--field-edge`. A multi-line box is 88 tall at rest and carries the Expand button at its top right (a 36 round ghost
// with the expand icon at 16, Text 3, "Open in the notepad"), which opens the full-screen notepad. Text boxes carry no
// placeholder words, so `placeholder` is not a prop. Text is 16px so iOS does not zoom.

import { useId, type CSSProperties, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

import { MobileIcon } from "@/components/brand/MobileIcon";
import { ring } from "@/lib/theme/controls";
import { TOUCH_MIN } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export const FIELD_HEIGHT = 44;
export const FIELD_AREA_HEIGHT = 88;

export type PhoneInputProps = { label: string; multiline?: false } & Omit<InputHTMLAttributes<HTMLInputElement>, "placeholder" | "size">;
export type PhoneAreaProps = { label: string; multiline: true; onExpand?: () => void } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "placeholder">;
export type PhoneFieldProps = PhoneInputProps | PhoneAreaProps;

const BOX: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  border: 0,
  borderRadius: 12,
  background: t.surface,
  boxShadow: `inset 0 0 0 1px ${t.fieldEdge}`,
  color: t.text,
  fontFamily: FIGTREE,
  fontSize: 16,
  lineHeight: "22px",
  outline: "none",
};

const focusEdge = (on: boolean): CSSProperties => (on ? { boxShadow: `inset 0 0 0 2px ${t.focusRing}` } : {});

function Frame({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div data-ui="phone-field" style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <label htmlFor={id} style={{ fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.text2 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({ label, multiline: _m, id, ...rest }: PhoneInputProps) {
  const auto = useId();
  const { state, handlers } = useInteractive<HTMLInputElement>();
  const key = id ?? auto;
  return (
    <Frame id={key} label={label}>
      <input {...rest} id={key} {...handlers} style={{ ...BOX, height: FIELD_HEIGHT, padding: "0 12px", ...focusEdge(state.focusVisible) }} />
    </Frame>
  );
}

function Area({ label, multiline: _m, onExpand, id, ...rest }: PhoneAreaProps) {
  const auto = useId();
  const { state, handlers } = useInteractive<HTMLTextAreaElement>();
  const expand = useInteractive<HTMLButtonElement>();
  const key = id ?? auto;
  return (
    <Frame id={key} label={label}>
      <div style={{ position: "relative" }}>
        <textarea
          {...rest}
          id={key}
          {...handlers}
          style={{ ...BOX, display: "block", minHeight: FIELD_AREA_HEIGHT, padding: `11px ${TOUCH_MIN}px 11px 12px`, resize: "none", ...focusEdge(state.focusVisible) }}
        />
        <button
          type="button"
          aria-label="Open in the notepad"
          onClick={onExpand}
          {...expand.handlers}
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            width: TOUCH_MIN,
            height: TOUCH_MIN,
            padding: 0,
            border: 0,
            background: "transparent",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: r.full,
            cursor: "pointer",
            ...ring(expand.state.focusVisible),
          }}
        >
          <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: r.full, display: "inline-flex", alignItems: "center", justifyContent: "center", color: t.label }}>
            <MobileIcon name="expand" size={16} />
          </span>
        </button>
      </div>
    </Frame>
  );
}

export function PhoneField(props: PhoneFieldProps) {
  if (props.multiline) return <Area {...props} />;
  return <Input {...(props as PhoneInputProps)} />;
}

export default PhoneField;
