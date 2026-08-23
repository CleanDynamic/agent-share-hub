// evidence — result, comparison_table, eval_run, screenshot, recording.
//
// Evidence is the half of a build that can be checked, so these cards carry
// the teal accent and lead with the figure rather than the prose. Method and
// sample size are printed rather than implied: a comparison with no n is an
// opinion, and the card should look like one.

import { HAIRLINE, TEAL, TEXT_MUTED, TEXT_SECONDARY, bodyText, hexToRgba, labelText } from "../tokens";
import { MEDIA_WIDTH, MediaFigure } from "../MediaFigure";
import {
  Caption,
  Chip,
  ChipRow,
  Field,
  KeyValueGrid,
  NodeRef,
  Prose,
  type GetCopyText,
  type NodeProps,
  type Rec,
  Rest,
  Stack,
  StatRow,
  TableScroll,
  cellStyle,
  fieldsOf,
  firstRequiredTextField,
  formatDate,
  formatDuration,
  formatNumber,
  headCellStyle,
  isPresent,
  labelFor,
  num,
  payloadOf,
  rows,
  str,
} from "./shared";

/**
 * The width a figure inside a node card asks for, never original size.
 *
 * A screenshot and a recording are the same field on the same card, so the
 * slot has one width and MediaFigure decides what element fills it from the
 * media row's kind.
 */
const FIGURE_WIDTH = MEDIA_WIDTH.tree;

// --- the generic evidence card -----------------------------------------------

/** Figures worth leading with, in the order they should read. */
const STAT_KEYS = ["value", "score", "passed", "total", "duration"];

/** renderer key: "evidence" — result, eval_run, screenshot, recording. */
export function EvidenceRenderer(props: NodeProps) {
  const payload = payloadOf(props.node);
  const fields = fieldsOf(props.nodeType).filter((field) => isPresent(payload[field.key]));

  const summary = str(payload, "summary");
  const metric = str(payload, "metric");
  const mediaRef = str(payload, "media_id");
  const caption = str(payload, "caption");

  // passed/total read as one figure, not two.
  const passed = num(payload, "passed");
  const total = num(payload, "total");

  const stats: { label: string; value: string }[] = [];
  if (str(payload, "value")) {
    stats.push({ label: metric ?? labelFor(props.nodeType, "value"), value: str(payload, "value") as string });
  }
  if (typeof passed === "number" && typeof total === "number") {
    stats.push({ label: "Passed", value: `${formatNumber(passed)}/${formatNumber(total)}` });
  } else if (typeof passed === "number") {
    stats.push({ label: labelFor(props.nodeType, "passed"), value: formatNumber(passed) });
  }
  if (typeof num(payload, "score") === "number") {
    const score = num(payload, "score") as number;
    stats.push({
      label: labelFor(props.nodeType, "score"),
      value: score <= 1 ? `${(score * 100).toFixed(1)}%` : formatNumber(score),
    });
  }
  if (typeof num(payload, "duration") === "number") {
    stats.push({
      label: labelFor(props.nodeType, "duration"),
      value: formatDuration(num(payload, "duration") as number),
    });
  }

  const referenceFields = fields.filter((field) => field.format === "node_id");

  const gridFields = fields.filter(
    (field) =>
      field.type !== "list" &&
      field.type !== "text" &&
      field.format !== "node_id" &&
      field.format !== "media_id" &&
      !STAT_KEYS.includes(field.key) &&
      !["metric", "caption"].includes(field.key)
  );

  const handled = [
    "summary",
    "metric",
    "media_id",
    "caption",
    ...STAT_KEYS,
    ...referenceFields.map((field) => field.key),
    ...gridFields.map((field) => field.key),
  ];

  return (
    <div data-visual-slot="renderer-evidence" style={{ minWidth: 0 }}>
      <Stack gap={12}>
        <StatRow stats={stats} colour={TEAL} />

        {summary ? <Prose>{summary}</Prose> : null}

        {mediaRef ? (
          <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <MediaFigure
              reference={mediaRef}
              resolveMedia={props.resolveMedia}
              alt={caption ?? props.node.title ?? "Evidence"}
              width={FIGURE_WIDTH}
            />
            {caption ? (
              <figcaption>
                <Caption>{caption}</Caption>
              </figcaption>
            ) : null}
          </figure>
        ) : caption ? (
          <Caption>{caption}</Caption>
        ) : null}

        {referenceFields.length > 0 ? (
          <ChipRow>
            {referenceFields.map((field) => (
              <NodeRef
                key={field.key}
                id={str(payload, field.key)}
                resolveNode={props.resolveNode}
              />
            ))}
          </ChipRow>
        ) : null}

        <KeyValueGrid
          pairs={gridFields.map((field) => ({
            label: field.label,
            value:
              field.format === "timestamp"
                ? formatDate(str(payload, field.key))
                : str(payload, field.key),
          }))}
        />

        <Rest node={props.node} nodeType={props.nodeType} handled={handled} />
      </Stack>
    </div>
  );
}

// --- comparison_table --------------------------------------------------------

const COLUMNS_KEY = "columns";
const ROWS_KEY = "rows";

interface Column {
  key: string;
  label: string;
  type?: string;
}

function readColumns(payload: Rec): Column[] {
  return rows(payload, COLUMNS_KEY)
    .map((column, index) => {
      const key = typeof column.key === "string" && column.key ? column.key : `col_${index}`;
      const label =
        typeof column.label === "string" && column.label ? column.label : key;
      return { key, label, type: typeof column.type === "string" ? column.type : undefined };
    })
    .filter((column) => Boolean(column.label));
}

/**
 * One row's cells, in column order.
 *
 * The schema declares `cells` as a single text field holding "one value per
 * column, in column order", but a row written with the column keys directly is
 * the shape a compose step is most likely to produce. Both are accepted, in
 * that order of preference, and a `cells` string is parsed as JSON first and
 * split on the most structured delimiter it contains second. Nothing here
 * throws on a malformed row — it renders short and the missing cells read as
 * empty.
 */
function readCells(row: Rec, columns: Column[]): string[] {
  const direct = columns.map((column) => row[column.key]);
  if (direct.some((value) => isPresent(value))) {
    return direct.map((value) => (isPresent(value) ? String(value) : ""));
  }

  const cells = row.cells;
  if (Array.isArray(cells)) return cells.map((cell) => (isPresent(cell) ? String(cell) : ""));

  if (typeof cells === "string") {
    const trimmed = cells.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((cell) => (isPresent(cell) ? String(cell) : ""));
        }
      } catch {
        // Fall through to the delimiter split.
      }
    }
    if (trimmed.includes("\t")) return trimmed.split("\t").map((cell) => cell.trim());
    if (trimmed.includes("|")) return trimmed.split("|").map((cell) => cell.trim());
    return trimmed.split(",").map((cell) => cell.trim());
  }

  return [];
}

/** The winner names a row. Match its first cell, then any cell, case-blind. */
function isWinner(cells: string[], winner: string | undefined): boolean {
  if (!winner) return false;
  const target = winner.trim().toLowerCase();
  if (!target) return false;
  if (cells.length > 0 && cells[0].trim().toLowerCase() === target) return true;
  return cells.some((cell) => cell.trim().toLowerCase() === target);
}

/** renderer key: "comparison_table" */
export function ComparisonTableRenderer(props: NodeProps) {
  const payload = payloadOf(props.node);
  const columns = readColumns(payload);
  const tableRows = rows(payload, ROWS_KEY).map((row) => readCells(row, columns));

  const winner = str(payload, "winner");
  const method = str(payload, "method");
  const sampleSize = num(payload, "n");

  const footnote = [
    method,
    typeof sampleSize === "number" ? `n = ${formatNumber(sampleSize)}` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  const handled = [COLUMNS_KEY, ROWS_KEY, "winner", "method", "n"];

  return (
    <div data-visual-slot="renderer-comparison-table" style={{ minWidth: 0 }}>
      <Stack gap={10}>
        {columns.length > 0 && tableRows.length > 0 ? (
          <TableScroll>
            <thead>
              <tr>
                {columns.map((column, index) => (
                  <th
                    key={column.key}
                    style={{
                      ...headCellStyle,
                      // The winner's left border needs room on the first column.
                      paddingLeft: index === 0 ? 12 : 0,
                    }}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((cells, rowIndex) => {
                const won = isWinner(cells, winner);
                return (
                  <tr
                    key={rowIndex}
                    style={won ? { background: hexToRgba(TEAL, 0.07) } : undefined}
                  >
                    {columns.map((column, columnIndex) => (
                      <td
                        key={column.key}
                        style={{
                          ...cellStyle,
                          paddingLeft: columnIndex === 0 ? 12 : 0,
                          color: won ? TEAL : bodyText.color,
                          fontWeight: won ? 500 : bodyText.fontWeight,
                          ...(columnIndex === 0
                            ? {
                                borderLeft: `3px solid ${won ? TEAL : "transparent"}`,
                              }
                            : {}),
                        }}
                      >
                        {cells[columnIndex] || <span style={{ color: TEXT_MUTED }}>—</span>}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </TableScroll>
        ) : (
          <Caption>This comparison has no rows yet.</Caption>
        )}

        {winner ? (
          <ChipRow>
            <Chip colour={TEAL} tinted>
              {`Winner: ${winner}`}
            </Chip>
          </ChipRow>
        ) : null}

        {footnote ? (
          <Caption style={{ paddingTop: 2, borderTop: `1px solid ${HAIRLINE}` }}>
            {footnote}
          </Caption>
        ) : null}

        <Rest node={props.node} nodeType={props.nodeType} handled={handled} />
      </Stack>
    </div>
  );
}

export const getCopyText: GetCopyText = (node, nodeType) => firstRequiredTextField(node, nodeType);

export default EvidenceRenderer;
