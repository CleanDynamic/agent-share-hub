// data — dataset, retrieval_config, data_schema and test_set.
//
// One renderer, four types, and again no switch on node.type. The shape comes
// off the schema: counts and short scalars lead as a stat row, the required
// prose follows, and sample lists become tables capped at five rows with an
// explicit "sample of N" so nobody mistakes three visible records for the
// whole dataset.

import {
  Caption,
  DetailGrid,
  MiniTable,
  MonoBlock,
  Prose,
  Section,
  Stack,
  StatRow,
} from "./shared";
import {
  fieldsOf,
  formatDate,
  formatNumber,
  isPresent,
  num,
  payloadOf,
  rowsOf,
  type PayloadRecord,
  type Stat,
} from "./payload";
import { CATEGORY_COLOUR, TEXT_MUTED } from "../tokens";
import type { GetCopyText, NodeProps } from "./types";
import type { FieldDef } from "@/lib/build";

const DATA = CATEGORY_COLOUR.data;

/** Beyond four, a stat row stops being a headline and becomes a table. */
const MAX_STATS = 4;

/** A sample is a sample. Five rows, whatever the creator pasted in. */
export const SAMPLE_LIMIT = 5;

/**
 * Which scalar carries the "how big is this" number for a list field.
 *
 * Read off the schema rather than hardcoded per type: a count field is a
 * number field whose key ends in _count, which is how the dialect names them
 * (record_count, case_count) and how a later type will name its own.
 */
function countFor(record: PayloadRecord, fields: FieldDef[]): number | undefined {
  const field = fields.find((candidate) => candidate.type === "number" && /_count$/.test(candidate.key));
  return field ? num(record, field.key) : undefined;
}

function scalarText(record: PayloadRecord, field: FieldDef): string | undefined {
  const raw = record[field.key];
  if (!isPresent(raw)) return undefined;
  if (field.type === "number" && typeof raw === "number") return formatNumber(raw);
  if (field.type === "boolean") return raw ? "Yes" : "No";
  if (field.format === "timestamp") return formatDate(String(raw));
  return String(raw);
}

export function DataRenderer({ node, nodeType }: NodeProps) {
  const record = payloadOf(node);
  const fields = fieldsOf(nodeType);
  const total = countFor(record, fields);

  const stats: Stat[] = [];
  const grid: Stat[] = [];
  const prose: Array<{ field: FieldDef; value: string }> = [];
  const code: Array<{ field: FieldDef; value: string }> = [];
  const lists: FieldDef[] = [];

  for (const field of fields) {
    if (field.type === "list") {
      if (rowsOf(record, field.key).length > 0) lists.push(field);
      continue;
    }
    const value = scalarText(record, field);
    if (value === undefined) continue;

    if (field.type === "text") {
      // A schema definition or a filter expression is code, not prose.
      const looksStructured = /^[[{]/.test(value.trim()) || /\n/.test(value.trim());
      (looksStructured ? code : prose).push({ field, value });
      continue;
    }

    // The headline: the counts, and the one-word scalars that qualify them.
    const headline =
      field.type === "number" || field.key === "format" || field.key === "strategy";
    if (headline && stats.length < MAX_STATS && value.length <= 40) {
      stats.push({ label: field.label, value });
    } else {
      grid.push({ label: field.label, value });
    }
  }

  return (
    <Stack>
      <StatRow stats={stats} accent={DATA} />

      {prose.map(({ field, value }) => (
        <Prose key={field.key}>{value}</Prose>
      ))}

      {code.map(({ field, value }) => (
        <Section key={field.key} label={field.label}>
          <MonoBlock text={value} accent={DATA} />
        </Section>
      ))}

      {lists.map((field) => {
        const rows = rowsOf(record, field.key);
        const shown = rows.slice(0, SAMPLE_LIMIT);
        const members: FieldDef[] =
          field.of && field.of.length > 0
            ? field.of
            : [{ key: "value", label: field.label, type: "string" }];
        const of = total ?? rows.length;

        return (
          <Section key={field.key} label={field.label}>
            <MiniTable
              columns={members.map((member) => member.label)}
              rows={shown.map((row) =>
                members.map((member) =>
                  isPresent(row[member.key]) ? (
                    <span style={{ fontFamily: member.type === "text" ? "'Courier New', monospace" : undefined, fontSize: 12.5 }}>
                      {String(row[member.key])}
                    </span>
                  ) : (
                    <span style={{ color: TEXT_MUTED }}>—</span>
                  )
                )
              )}
            />
            <Caption>{`Sample of ${formatNumber(of)} — showing ${shown.length}`}</Caption>
          </Section>
        );
      })}

      <DetailGrid items={grid} />
    </Stack>
  );
}

/**
 * A data node is copied to be reused: a schema definition goes whole, and a
 * configuration goes as `key: value` lines.
 */
export const getCopyText: GetCopyText = (node, nodeType) => {
  const record = payloadOf(node);
  const fields = fieldsOf(nodeType);

  const definition = fields.find((field) => field.required && field.type === "text");
  if (definition) {
    const value = record[definition.key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }

  const lines = fields
    .filter((field) => field.type !== "list")
    .map((field) => {
      const value = scalarText(record, field);
      return value === undefined ? null : `${field.key}: ${value}`;
    })
    .filter((line): line is string => line !== null);

  return lines.length > 0 ? lines.join("\n") : null;
};
