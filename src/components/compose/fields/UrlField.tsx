// format: "url" — a single-line input that insists on a scheme.
//
// The validation runs on blur, never per keystroke: a url is invalid for most
// of the time it is being typed, and a field that turns orange on the "h" of
// https is a field that shouts at someone doing nothing wrong.
//
// An invalid value is still stored. The message says what is missing; it does
// not eat what the creator typed, because a half-written url they can come back
// to is worth more than an empty box that was briefly correct.

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { ORANGE, TEXT_MUTED } from "@/components/build/tokens";
import { FieldShell } from "../SchemaForm";
import {
  blurControl,
  compactControlStyle,
  controlStyle,
  focusControl,
  type FieldWidgetProps,
} from "./index";

/**
 * A scheme and, for the web schemes, a host.
 *
 * `new URL` is the parser rather than a regex: it is the same one the browser
 * uses to resolve the href, so anything it accepts will actually navigate.
 * "example.com" has no scheme and throws; "https://example.com" parses.
 */
export function isValidUrl(text: string): boolean {
  if (text.trim() === "") return false;
  try {
    const url = new URL(text.trim());
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.hostname !== "";
    }
    return url.protocol !== "";
  } catch {
    return false;
  }
}

/** Only the web schemes get an anchor. A mailto: affordance is a mail client. */
function isOpenable(text: string): boolean {
  try {
    const url = new URL(text.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function UrlField({
  field,
  value,
  onChange,
  id,
  touched,
  onTouch,
  compact,
}: FieldWidgetProps) {
  const text = value === null || value === undefined ? "" : String(value);
  /** Set on blur, cleared on the next keystroke. Never set while typing. */
  const [invalid, setInvalid] = useState(false);

  const openable = isOpenable(text);

  return (
    <FieldShell field={field} id={id} touched={touched} isEmpty={text === ""} compact={compact}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          id={id}
          type="text"
          inputMode="url"
          value={text}
          placeholder={compact ? field.label : "https://"}
          aria-invalid={invalid || undefined}
          onChange={(event) => {
            onTouch?.();
            setInvalid(false);
            const next = event.target.value;
            onChange(next === "" ? null : next);
          }}
          onFocus={(event) => focusControl(event.currentTarget)}
          onBlur={(event) => {
            blurControl(event.currentTarget);
            const current = event.currentTarget.value;
            setInvalid(current.trim() !== "" && !isValidUrl(current));
          }}
          style={{
            ...(compact ? compactControlStyle : controlStyle),
            flex: 1,
            minWidth: 0,
            borderColor: invalid ? ORANGE : undefined,
          }}
        />

        {openable && (
          <a
            href={text.trim()}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${field.label} in a new tab`}
            title={text.trim()}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              flexShrink: 0,
              borderRadius: 6,
              color: TEXT_MUTED,
            }}
          >
            <ExternalLink size={13} aria-hidden />
          </a>
        )}
      </div>

      {invalid && (
        <p
          style={{
            fontSize: 11,
            fontWeight: 300,
            lineHeight: 1.5,
            margin: 0,
            color: ORANGE,
          }}
        >
          Needs a scheme — https://example.com, not example.com
        </p>
      )}
    </FieldShell>
  );
}
