// The fallback payload renderer.
//
// It walks node_types.schema.fields in order and prints label + value, with
// the value formatted by its declared field type. NS-P05 adds typed renderers
// per node type; this one stays as the fallback for every type that does not
// have one yet, so it must never assume anything about a particular type.

import type { CSSProperties, ReactNode } from "react";
import type { FieldDef, NodePayload } from "@/lib/build";
import { chipType } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import {
  body as bodyType,
  data as dataType,
  eyebrow,
  measure,
  tabular,
} from "@/lib/theme/type";

interface GenericPayloadProps {
  payload: NodePayload | null | undefined;
  fields: FieldDef[];
}

/** A value worth printing. Empty strings and empty lists are not. */
function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

/**
 * A link in a payload.
 *
 * BG-P21 — THE LAST RAW HEX UNDER src/components/build/. It was `#2EC4B6`,
 * written out rather than imported, so the one renderer every unregistered
 * type falls through to was the one place the repoint of `tokens.ts` could not
 * reach. `--action` rather than `--evidence`: a URL is somewhere to go, and
 * `--evidence` means "this worked", which a link does not claim. The underline
 * is at rest because colour alone fails WCAG 1.4.1 and hover does not exist on
 * a touch screen.
 */
const linkStyle: CSSProperties = {
  ...dataType,
  color: t.action,
  textDecoration: "underline",
  textUnderlineOffset: "3px",
  wordBreak: "break-all",
};

const proseStyle: CSSProperties = {
  ...bodyType,
  ...measure,
  color: t.text,
  margin: 0,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  fontFamily: "inherit",
};

/** One list field, as a small table keyed by the member field definitions. */
function ListTable({ field, rows }: { field: FieldDef; rows: unknown[] }) {
  // A list whose member fields were not declared still renders: fall back to
  // the keys actually present across the rows.
  const members: FieldDef[] =
    field.of && field.of.length > 0
      ? field.of
      : Array.from(
          new Set(
            rows.flatMap((row) =>
              row && typeof row === "object" && !Array.isArray(row)
                ? Object.keys(row as Record<string, unknown>)
                : []
            )
          )
        ).map((key) => ({ key, label: key, type: "string" as const }));

  // A list of bare scalars ("tags": ["a","b"]) has no member fields at all.
  if (members.length === 0) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {rows.map((row, index) => (
          <span
            key={index}
            style={{
              ...chipType,
              color: t.text2,
              padding: "2px 8px",
              borderRadius: r.chip,
              border: `1px solid ${t.line}`,
            }}
          >
            {String(row)}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          borderCollapse: "collapse",
          width: "100%",
          tableLayout: "auto",
        }}
      >
        <thead>
          <tr>
            {members.map((member) => (
              <th
                key={member.key}
                style={{
                  ...eyebrow,
                  color: t.text2,
                  textAlign: "left",
                  padding: "4px 10px 4px 0",
                  borderBottom: `1px solid ${t.line}`,
                  whiteSpace: "nowrap",
                }}
              >
                {member.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const record =
              row && typeof row === "object" && !Array.isArray(row)
                ? (row as Record<string, unknown>)
                : {};
            return (
              <tr key={index}>
                {members.map((member) => (
                  <td
                    key={member.key}
                    style={{
                      ...dataType,
                      ...tabular,
                      color: t.text,
                      verticalAlign: "top",
                      padding: "6px 10px 6px 0",
                      borderBottom: `1px solid ${t.line}`,
                    }}
                  >
                    {isPresent(record[member.key])
                      ? renderScalar(member, record[member.key])
                      : <span style={{ color: t.text2 }}>—</span>}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Everything except a list — lists nest one level only, by the dialect. */
function renderScalar(field: FieldDef, value: unknown): ReactNode {
  switch (field.type) {
    case "boolean":
      return value ? "Yes" : "No";
    case "number":
      return typeof value === "number" ? value.toLocaleString() : String(value);
    case "enum":
      return (
        <span
          style={{
            ...chipType,
            padding: "1px 8px",
            borderRadius: r.chip,
            border: `1px solid ${t.line}`,
            color: t.text2,
          }}
        >
          {String(value)}
        </span>
      );
    case "text":
      return <p style={proseStyle}>{String(value)}</p>;
    case "string":
    default: {
      const text = String(value);
      if (field.format === "timestamp") return formatTimestamp(text);
      if (field.format === "url" || /^https?:\/\//i.test(text)) {
        return (
          <a
            href={text}
            target="_blank"
            rel="noreferrer noopener"
            style={linkStyle}
          >
            {text}
          </a>
        );
      }
      return <span style={{ wordBreak: "break-word" }}>{text}</span>;
    }
  }
}

export function GenericPayload({ payload, fields }: GenericPayloadProps) {
  const record = (payload ?? {}) as Record<string, unknown>;

  // An unregistered node type has no schema. Printing its raw keys beats
  // printing nothing — a creator's content is never silently dropped.
  const effectiveFields: FieldDef[] =
    fields && fields.length > 0
      ? fields
      : Object.keys(record).map((key) => ({
          key,
          label: key,
          type: Array.isArray(record[key]) ? ("list" as const) : ("string" as const),
        }));

  const present = effectiveFields.filter((field) => isPresent(record[field.key]));
  if (present.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {present.map((field) => {
        const value = record[field.key];
        return (
          <div key={field.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ ...eyebrow, color: t.text2 }}>{field.label}</span>
            {field.type === "list" && Array.isArray(value) ? (
              <ListTable field={field} rows={value} />
            ) : (
              <div style={{ ...bodyType, color: t.text }}>{renderScalar(field, value)}</div>
            )}
            {field.help ? (
              <span style={{ ...dataType, ...measure, color: t.text2 }}>
                {field.help}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default GenericPayload;
