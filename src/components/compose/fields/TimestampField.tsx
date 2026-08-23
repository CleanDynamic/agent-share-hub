// format: "timestamp" — a datetime-local control that stores ISO 8601 UTC.
//
// The creator picks a moment in their own timezone and the payload keeps the
// instant, normalised to UTC with a Z on the end. Two people reading the same
// build from two continents are then reading the same moment, and a build
// exported and re-imported anywhere says what it said.
//
// datetime-local speaks "YYYY-MM-DDTHH:mm" in local time and nothing else, so
// both directions of that conversion happen here.

import { TEXT_MUTED } from "@/components/build/tokens";
import { FieldShell } from "../SchemaForm";
import {
  blurControl,
  compactControlStyle,
  controlStyle,
  focusControl,
  type FieldWidgetProps,
} from "./index";

const pad = (part: number) => String(part).padStart(2, "0");

/** Stored ISO -> the local wall-clock string the input wants. "" if unreadable. */
export function isoToLocalInput(iso: string): string {
  if (iso.trim() === "") return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return (
    `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}` +
    `T${pad(at.getHours())}:${pad(at.getMinutes())}`
  );
}

/** The input's local string -> ISO 8601 UTC. Null if the field was cleared. */
export function localInputToIso(local: string): string | null {
  if (local.trim() === "") return null;
  // No trailing Z: the string is a wall clock in the creator's zone, and that
  // is exactly how the Date constructor reads it.
  const at = new Date(local);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

export function TimestampField({
  field,
  value,
  onChange,
  id,
  touched,
  onTouch,
  compact,
}: FieldWidgetProps) {
  const stored = value === null || value === undefined ? "" : String(value);
  const local = isoToLocalInput(stored);
  /** Stored, but not a date this build can read — a hand-edited payload. */
  const unreadable = stored !== "" && local === "";

  return (
    <FieldShell field={field} id={id} touched={touched} isEmpty={stored === ""} compact={compact}>
      <input
        id={id}
        type="datetime-local"
        value={local}
        aria-label={compact ? field.label : undefined}
        onChange={(event) => {
          onTouch?.();
          onChange(localInputToIso(event.target.value));
        }}
        onFocus={(event) => focusControl(event.currentTarget)}
        onBlur={(event) => blurControl(event.currentTarget)}
        style={{
          ...(compact ? compactControlStyle : controlStyle),
          // Safari and Chrome paint the picker glyph black on a dark control.
          colorScheme: "dark",
        }}
      />

      {!compact && (unreadable || stored !== "") && (
        <p
          style={{
            fontSize: 11,
            fontWeight: 300,
            lineHeight: 1.5,
            margin: 0,
            fontFamily:
              "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
            color: TEXT_MUTED,
          }}
        >
          {unreadable ? `Stored, but not a readable date: ${stored}` : stored}
        </p>
      )}
    </FieldShell>
  );
}
