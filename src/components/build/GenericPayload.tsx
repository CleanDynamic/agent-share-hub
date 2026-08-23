// The fallback payload renderer.
//
// It walks node_types.schema.fields in order and prints label + value, with
// the value formatted by its declared field type. NS-P05 adds typed renderers
// per node type; this one stays as the fallback for every type that does not
// have one yet, so it must never assume anything about a particular type.

import type { CSSProperties, ReactNode } from "react";
import type { FieldDef, NodePayload } from "@/lib/build";
import { HAIRLINE, TEXT_MUTED, TEXT_SECONDARY, bodyText, labelText } from "./tokens";

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

const linkStyle: CSSProperties = {
  ...bodyText,
  color: "#2EC4B6",
  textDecoration: "none",
  wordBreak: "break-all",
};

const proseStyle: CSSProperties = {
  ...bodyText,
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
      <div style={{ ...bodyText, display: "flex", flexWrap: "wrap", gap: 6 }}>
        {rows.map((row, index) => (
          <span
            key={index}
            style={{
              padding: "2px 8px",
              borderRadius: 6,
              border: `1px solid ${HAIRLINE}`,
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
                  ...labelText,
                  textAlign: "left",
                  padding: "4px 10px 4px 0",
                  borderBottom: `1px solid ${HAIRLINE}`,
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
                      ...bodyText,
                      verticalAlign: "top",
                      padding: "6px 10px 6px 0",
                      borderBottom: `1px solid ${HAIRLINE}`,
                    }}
                  >
                    {isPresent(record[member.key])
                      ? renderScalar(member, record[member.key])
                      : <span style={{ color: TEXT_MUTED }}>—</span>}
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
            padding: "1px 8px",
            borderRadius: 6,
            border: `1px solid ${HAIRLINE}`,
            color: TEXT_SECONDARY,
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
            <span style={labelText}>{field.label}</span>
            {field.type === "list" && Array.isArray(value) ? (
              <ListTable field={field} rows={value} />
            ) : (
              <div style={bodyText}>{renderScalar(field, value)}</div>
            )}
            {field.help ? (
              <span style={{ ...bodyText, fontSize: 12, color: TEXT_MUTED }}>
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
