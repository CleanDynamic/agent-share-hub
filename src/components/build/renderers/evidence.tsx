// evidence — result, eval_run, screenshot, recording, and comparison_table.
//
// Evidence is the part of a build a reader is entitled to be sceptical about,
// so it is the part that carries an accent: a teal rule down the left of every
// evidence card, and the method printed under any claim that has one.

import type { ReactNode } from "react";
import {
  Caption,
  DetailGrid,
  MiniTable,
  Prose,
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
  str,
  type PayloadRecord,
  type Stat,
} from "./payload";
import { MEDIA_QUALITY, MEDIA_WIDTH, mediaUrl } from "./media";
import { HAIRLINE, TEAL, TEXT_MUTED, hexToRgba, labelText } from "../tokens";
import type { GetCopyText, NodeProps } from "./types";
import type { FieldDef } from "@/lib/build";

/** The teal rule. Every evidence renderer sits inside one. */
function EvidenceFrame({ children }: { children: ReactNode }) {
  return (
    <div
      data-evidence-accent="teal"
      style={{
        borderLeft: `2px solid ${hexToRgba(TEAL, 0.55)}`,
        paddingLeft: 12,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

function Media({ record, caption }: { record: PayloadRecord; caption?: string }) {
  const ref = str(record, "media_id");
  const src = mediaUrl(ref, { width: MEDIA_WIDTH.full, quality: MEDIA_QUALITY });

  // A reference that names no stored file says so rather than emitting a
  // broken <img>. Silence would read as "there is no evidence".
  if (!src) {
    return ref ? (
      <Caption>Media reference recorded, but no stored file resolves from it</Caption>
    ) : null;
  }

  return (
    <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
      <img
        src={src}
        alt={caption ?? "Evidence"}
        loading="lazy"
        width={MEDIA_WIDTH.full}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          borderRadius: 8,
          border: `1px solid ${HAIRLINE}`,
        }}
      />
      {caption ? (
        <figcaption style={{ ...labelText, fontSize: 11, color: TEXT_MUTED }}>
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function EvidenceRenderer({ node, nodeType }: NodeProps) {
  const record = payloadOf(node);
  const fields = fieldsOf(nodeType);

  // passed/total is one fact, not two, and reads as one.
  const passed = num(record, "passed");
  const total = num(record, "total");
  const scored = passed !== undefined && total !== undefined;

  const stats: Stat[] = [];
  const grid: Stat[] = [];
  const prose: Array<{ field: FieldDef; value: string }> = [];

  if (scored) {
    stats.push({ label: "Passing", value: `${formatNumber(passed)}/${formatNumber(total)}` });
  }

  const metric = str(record, "metric");
  const value = str(record, "value");
  if (metric && value) stats.push({ label: metric, value });

  for (const field of fields) {
    if (["media_id", "caption", "metric", "value"].includes(field.key)) continue;
    if (scored && (field.key === "passed" || field.key === "total")) continue;
    const raw = record[field.key];
    if (!isPresent(raw)) continue;

    if (field.type === "text") {
      prose.push({ field, value: String(raw) });
      continue;
    }
    if (field.type === "number" && typeof raw === "number") {
      if (stats.length < 3) {
        stats.push({ label: field.label, value: formatNumber(raw) });
      } else {
        grid.push({ label: field.label, value: formatNumber(raw) });
      }
      continue;
    }
    grid.push({
      label: field.label,
      value: field.format === "timestamp" ? formatDate(String(raw)) ?? String(raw) : String(raw),
    });
  }

  return (
    <EvidenceFrame>
      <StatRow stats={stats} accent={TEAL} />
      {prose.map(({ field, value: text }) => (
        <Prose key={field.key}>{text}</Prose>
      ))}
      <Media record={record} caption={str(record, "caption")} />
      <DetailGrid items={grid} />
    </EvidenceFrame>
  );
}

// --- comparison_table --------------------------------------------------------

/**
 * A row's cells arrive as one text value "in column order", per the schema's
 * own help text. Creators write that three ways in practice, so all three are
 * accepted and nothing is dropped: a real array, a JSON array in a string, or
 * a delimited string.
 */
export function parseCells(value: unknown, columnCount: number): string[] {
  if (Array.isArray(value)) return value.map((cell) => String(cell ?? "").trim());

  const text = typeof value === "string" ? value.trim() : "";
  if (text.length === 0) return [];

  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map((cell) => String(cell ?? "").trim());
    } catch {
      // Not JSON after all. Fall through to the delimiters.
    }
  }

  for (const delimiter of ["|", "\t"]) {
    if (text.includes(delimiter)) {
      return text.split(delimiter).map((cell) => cell.trim());
    }
  }

  // A comma only splits when the split actually fills the declared columns —
  // otherwise a single prose cell containing a comma would be torn in half.
  const commaParts = text.split(",").map((cell) => cell.trim());
  if (columnCount > 1 && commaParts.length === columnCount) return commaParts;

  return [text];
}

export function ComparisonTableRenderer({ node }: NodeProps) {
  const record = payloadOf(node);

  const columns = rowsOf(record, "columns").map((column, index) => ({
    key: typeof column.key === "string" ? column.key : `col_${index}`,
    label:
      typeof column.label === "string" && column.label.trim().length > 0
        ? column.label
        : typeof column.key === "string"
          ? column.key
          : `Column ${index + 1}`,
  }));

  const rows = rowsOf(record, "rows").map((row) =>
    // A row may carry `cells` per the schema, or already be keyed by column.
    isPresent(row.cells)
      ? parseCells(row.cells, columns.length)
      : columns.map((column) => (isPresent(row[column.key]) ? String(row[column.key]) : ""))
  );

  const winner = str(record, "winner");
  const winnerIndex = winner
    ? rows.findIndex((cells) =>
        cells.some((cell) => cell.toLowerCase() === winner.trim().toLowerCase())
      )
    : -1;

  const method = str(record, "method");
  const n = num(record, "n");
  const footnote = [
    method ? `Method: ${method}` : undefined,
    n !== undefined ? `n = ${formatNumber(n)}` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  if (columns.length === 0 || rows.length === 0) {
    return (
      <EvidenceFrame>
        <Prose dim>This comparison has no columns or no rows recorded yet.</Prose>
      </EvidenceFrame>
    );
  }

  return (
    <EvidenceFrame>
      <MiniTable
        columns={columns.map((column) => column.label)}
        rows={rows.map((cells) =>
          columns.map((_, index) =>
            cells[index] && cells[index].length > 0 ? (
              <span>{cells[index]}</span>
            ) : (
              <span style={{ color: TEXT_MUTED }}>—</span>
            )
          )
        )}
        accent={TEAL}
        markedRow={winnerIndex >= 0 ? winnerIndex : undefined}
      />
      {winner ? <Caption>{`Winner: ${winner}`}</Caption> : null}
      {footnote ? <Caption>{footnote}</Caption> : null}
    </EvidenceFrame>
  );
}

/** Evidence is read, not run. Only the written claim is worth a clipboard. */
export const getCopyText: GetCopyText = (node, nodeType) => {
  const record = payloadOf(node);
  const summary = fieldsOf(nodeType).find((field) => field.required && field.type === "text");
  return summary ? str(record, summary.key) ?? null : null;
};
