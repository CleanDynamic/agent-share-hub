// format: "media_id" — the placeholder the upload replaces.
//
// Media arrives in NS-P12, on top of the table and bucket NS-P11 adds. This
// widget exists before either of them so that the resolver never has to change
// again: NS-P12 rewrites the body of this one file into a real upload control,
// and resolveWidget, SchemaForm and the Inspector are not touched at all.
//
// It is deliberately inert. A screenshot node whose media_id was seeded by hand
// still shows the id it holds, so nothing looks lost while the upload is
// missing, but there is no control here that could write one.

import { ImageOff } from "lucide-react";
import { HAIRLINE, TEXT_MUTED, TEXT_SECONDARY } from "@/components/build/tokens";
import { FieldShell } from "../SchemaForm";
import { type FieldWidgetProps } from "./index";

export function MediaRefField({ field, value, id, touched, compact }: FieldWidgetProps) {
  const stored = value === null || value === undefined ? "" : String(value);

  return (
    <FieldShell field={field} id={id} touched={touched} isEmpty={stored === ""} compact={compact}>
      <div
        id={id}
        aria-disabled="true"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: compact ? "5px 8px" : "7px 10px",
          borderRadius: 8,
          background: "rgba(255,255,255,0.02)",
          border: `1px dashed ${HAIRLINE}`,
          color: TEXT_MUTED,
          fontSize: compact ? 11 : 12,
          fontWeight: 300,
          lineHeight: 1.5,
        }}
      >
        <ImageOff size={13} aria-hidden style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          media upload arrives in NS-P12
          {stored !== "" && (
            <>
              {" — "}
              <span
                style={{
                  fontFamily:
                    "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
                  color: TEXT_SECONDARY,
                  wordBreak: "break-all",
                }}
              >
                {stored}
              </span>
            </>
          )}
        </span>
      </div>
    </FieldShell>
  );
}
