/* SV-11: the Builds Table, pure: typed props, no fetching, no router hooks but `Link`. The board is
   `design/reference/vision/dusk/builds-table.html`. It leads, on the surface, with no box: the lens tabs with Sort and
   Columns on the right, the active filters under them, then the table.

   Each part is its own component, defined at module level. THE COLUMNS ARE DATA: `columns` says which of the board's
   twelve are drawn, in order, so the live page draws the ones whose data exists (SV-11 Part 3) and the dev page all.

   REAL CONTROLS. A sortable head is a button, and its cell says `aria-sort`; the Runs 12 weeks bars are hidden from
   screen readers and their group carries the numbers in words; the table scrolls inside its column (min width 1000) in a
   region a keyboard can reach. Rows past the first screen are skipped until near (`content-visibility`). No motion: rows
   change at once. */

import { cloneElement, type ReactElement, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { LampBar } from "@/components/brand/LampDot";
import { ModelMark } from "@/components/brand/ModelMark";
import { Checkbox } from "@/components/brand/Checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ActiveFilterChip } from "@/components/vision/ActiveFilterChip";
import { Empty } from "@/components/vision/Empty";
import type { CalcKind } from "@/lib/build/buildsLayout";
import { STALE_AFTER_DAYS } from "@/lib/build/signals";
import { TextTabs, type TextTab } from "@/components/vision/TextTabs";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";

import { BuildsControl, BuildsTextButton, FiltersButton, TABLE_ROW, UpdatingStatus, ellipsis, hitArea, text } from "./BuildsFrame";

/* ── props ── */

/** The board's twelve columns. */
export type BoardColumnId = "build" | "built" | "field" | "tools" | "steps" | "sessions" | "reproductions" | "confirmed" | "runs" | "rebuilds" | "open" | "cost";

/** SV-24 P2: the twelve more the Columns chooser offers, 24 in all: Shape and the classification facets that are not already a column. */
export type ExtraColumnId = "shape" | "task" | "setting" | "role" | "technique" | "modality" | "method" | "autonomy" | "data" | "oversight" | "age" | "skill";

export type ColumnId = BoardColumnId | ExtraColumnId;

export const COLUMN_ORDER: readonly ColumnId[] = ["build", "built", "field", "tools", "steps", "sessions", "reproductions", "confirmed", "runs", "rebuilds", "open", "cost"];

export const EXTRA_COLUMNS: readonly ExtraColumnId[] = ["shape", "task", "setting", "role", "technique", "modality", "method", "autonomy", "data", "oversight", "age", "skill"];

/** Every column, the extras after the board's twelve (so the footer's groups stay together). */
export const ALL_COLUMNS: readonly ColumnId[] = [...COLUMN_ORDER, ...EXTRA_COLUMNS];

export const COLUMN_NAME: Record<ColumnId, string> = {
  build: "Build",
  built: "What was built",
  field: "Field",
  tools: "Tools",
  steps: "Steps",
  sessions: "Sessions",
  reproductions: "Reproductions",
  confirmed: "Confirmed",
  runs: "Runs, 12 weeks",
  rebuilds: "Rebuilds",
  open: "Open",
  cost: "Cost to run",
  shape: "Shape",
  task: "Task",
  setting: "Setting",
  role: "Role",
  technique: "Technique",
  modality: "Modality",
  method: "Method",
  autonomy: "Autonomy",
  data: "Data",
  oversight: "Oversight",
  age: "Age",
  skill: "Skill",
};
const HEAD = COLUMN_NAME;

const RIGHT: ReadonlySet<ColumnId> = new Set(["steps", "sessions", "reproductions", "rebuilds"]);

export interface TableTool {
  id: string;
  name: string;
}

export interface TableRowView {
  id: string;
  href: string;
  title: string;
  maker: string;
  built: string;
  field: string;
  tools: readonly TableTool[];
  steps: number | null;
  sessions: number | null;
  reproductions: number;
  /** The lamp is lit: confirmed within the window; dim when it has gone stale. */
  lit: boolean;
  confirmed: string;
  /** Twelve weekly counts, oldest first. */
  runs: readonly number[];
  rebuilds: number;
  open: string;
  cost: string;
  /** SV-24 P2: the extra columns' values; absent where the dev page draws only the board's twelve. */
  extra?: Readonly<Partial<Record<ExtraColumnId, string>>>;
}

export interface SortOption {
  value: string;
  label: string;
}

export interface TableChip {
  key: string;
  name: string;
  value: string;
}

export interface TableFooterView {
  count: string;
  /** "Most common · Sales, Claude Code". */
  mostCommon?: string;
  /** "Median 11 steps". */
  median?: string;
  /** "Total 214". */
  total?: string;
  /** The dev page's button, with no menu. */
  onCalculate?: () => void;
  /** SV-24 P2: the calculations added, each worked out from the loaded page. */
  calculations?: readonly TableCalculation[];
  /** SV-24 P2: Add a calculation as a menu of the columns it can be made on. */
  calculate?: { options: readonly CalculationOption[]; onToggle: (column: ColumnId, kind: CalcKind) => void };
}

export interface TableCalculation {
  key: string;
  /** "Sum, Steps 214". */
  text: string;
  onRemove: () => void;
}

export interface CalculationOption {
  column: ColumnId;
  name: string;
  kinds: readonly { kind: CalcKind; label: string; on: boolean }[];
}

export interface ColumnsMenu {
  options: readonly { id: ColumnId; name: string; on: boolean; locked?: boolean }[];
  onToggle: (id: ColumnId) => void;
  /** Back to the default twelve; drawn only while the columns are not. */
  onReset?: () => void;
}

export interface BuildsTableViewProps {
  lenses: readonly TextTab[];
  lens: string;
  onLens: (lens: string) => void;
  sort: { value: string; options: readonly SortOption[]; onChange: (value: string) => void };
  /** "12 of 24": drawn only where the chooser is live. */
  columnsLabel?: string;
  /** SV-24 P2: the Columns chooser. Absent: the label is all there is. */
  columnsMenu?: ColumnsMenu;
  chips: readonly TableChip[];
  onRemoveChip: (key: string) => void;
  onClearAll: () => void;
  columns: readonly ColumnId[];
  rows: readonly TableRowView[];
  /** The column each head sorts by, and the arrow on the sorted one. */
  sortColumn: { id: ColumnId; ascending: boolean } | null;
  /** Column heads that sort: id to the sort value they choose. */
  sortableBy: Partial<Record<ColumnId, string>>;
  footer: TableFooterView;
  /** More rows exist than are shown. */
  onMore?: () => void;
  loadingMore?: boolean;
  /** One line shown instead of the table when the filters match nothing. */
  empty?: ReactNode;
  /** BF-02 (C2): the rows are the last address's, kept until the new page lands. */
  updating?: boolean;
  /** BF-06 (A1): how many filters hold a value, for the Filters button, and the press that opens the dialog. */
  activeCount: number;
  onOpenFilters: () => void;
  /** BF-09 (A8): the open saved set's name, on the Filters button. */
  setName?: string;
}

/* ── the lens row ── */

function SortMenu({ sort }: { sort: BuildsTableViewProps["sort"] }) {
  const current = sort.options.find((option) => option.value === sort.value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <BuildsControl aria-label={`Sort: ${current?.label ?? ""}`}>
          <span style={{ color: t.label }}>Sort</span> {current?.label}
        </BuildsControl>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6}>
        <DropdownMenuRadioGroup value={sort.value} onValueChange={sort.onChange}>
          {sort.options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The Columns chooser: a checklist of every column in a popover. Build is always on. */
function ColumnsChooser({ label, menu }: { label: string; menu: ColumnsMenu }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <BuildsControl aria-label={`Columns: ${label}`}>
          <span style={{ color: t.label }}>Columns</span> {label}
        </BuildsControl>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} style={{ width: 320, maxWidth: "calc(100vw - 28px)", padding: 16 }}>
        <div role="group" aria-label="Columns" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: 16 }}>
          {menu.options.map((option) => (
            <label key={option.id} style={{ display: "grid", gridTemplateColumns: "16px 1fr", columnGap: 10, alignItems: "center", minHeight: 32, cursor: option.locked ? "default" : "pointer", ...text(12.5, 400, option.on ? t.text : t.text2) }}>
              <Checkbox checked={option.on} disabled={option.locked} onChange={() => menu.onToggle(option.id)} />
              <span>{option.name}</span>
            </label>
          ))}
        </div>
        {menu.onReset ? (
          <div style={{ marginTop: 12 }}>
            <BuildsTextButton onClick={menu.onReset}>Back to the default columns</BuildsTextButton>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function LensRow({ lenses, lens, onLens, sort, columnsLabel, columnsMenu, updating, activeCount, onOpenFilters, setName }: Pick<BuildsTableViewProps, "lenses" | "lens" | "onLens" | "sort" | "columnsLabel" | "columnsMenu" | "updating" | "activeCount" | "onOpenFilters" | "setName">) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12, borderBottom: `1px solid ${t.hairline}` }}>
      <TextTabs tabs={lenses} value={lens} onChange={onLens} label="Lens" rule={false} />
      <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
        <UpdatingStatus updating={updating} />
        <FiltersButton activeCount={activeCount} setName={setName} onClick={onOpenFilters} />
        <SortMenu sort={sort} />
        {columnsLabel && columnsMenu ? (
          <ColumnsChooser label={columnsLabel} menu={columnsMenu} />
        ) : columnsLabel ? (
          <BuildsControl>
            <span style={{ color: t.label }}>Columns</span> {columnsLabel}
          </BuildsControl>
        ) : null}
      </div>
    </div>
  );
}

/* ── the active filters ── */

/** BF-04 (X3): the one chip row, drawn by the Table, Maps and Classification alike. */
export function ActiveFilters({ chips, onRemove, onClearAll }: { chips: readonly TableChip[]; onRemove: (key: string) => void; onClearAll: () => void }) {
  if (chips.length === 0) return null;
  return (
    <div role="group" aria-label="Active filters" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 16 }}>
      {chips.map((chip) => (
        <ActiveFilterChip key={chip.key} name={chip.name} value={chip.value} onRemove={() => onRemove(chip.key)} />
      ))}
      <span style={{ height: 26, display: "inline-flex", alignItems: "center", padding: "0 8px" }}>
        <BuildsTextButton onClick={onClearAll}>Clear all</BuildsTextButton>
      </span>
    </div>
  );
}

/* ── cells ── */

/** BF-01 P4 (C10): the lamp, named. Lit: confirmed within the window; dim: gone stale. Drawn only where there is a reproduction. */
export function RowLamp({ lit }: { lit: boolean }) {
  const name = lit ? `Confirmed in the last ${STALE_AFTER_DAYS} days` : `Stale: not confirmed in ${STALE_AFTER_DAYS} days`;
  return (
    <span role="img" aria-label={name} title={name} style={{ display: "inline-flex" }}>
      <LampBar dim={!lit} />
    </span>
  );
}

const th = (right: boolean, last: boolean): React.CSSProperties => ({ ...text(12, 400, t.label), padding: last ? "0 0 10px" : "0 12px 10px 0", borderBottom: `1px solid ${t.hairline}`, textAlign: right ? "right" : "left", verticalAlign: "bottom", whiteSpace: "nowrap" });
const td = (right: boolean, last: boolean): React.CSSProperties => ({ padding: last ? 0 : "0 12px 0 0", height: TABLE_ROW, textAlign: right ? "right" : "left", whiteSpace: "nowrap" });

function ColumnHead({ id, last, sorted, sortValue, onSort }: { id: ColumnId; last: boolean; sorted: { ascending: boolean } | null; sortValue?: string; onSort: (value: string) => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const right = RIGHT.has(id);
  const ariaSort = sorted ? (sorted.ascending ? "ascending" : "descending") : sortValue ? "none" : undefined;
  return (
    <th scope="col" aria-sort={ariaSort} style={{ ...th(right, last), color: sorted ? t.text : t.label }}>
      {sortValue ? (
        <button
          type="button"
          onClick={() => onSort(sortValue)}
          {...handlers}
          style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: 0, ...hitArea(2), font: "inherit", color: state.hovered ? t.text : "inherit", cursor: "pointer", borderRadius: r.chip, ...ring(state.focusVisible) }}
        >
          {HEAD[id]}
          {sorted ? <span aria-hidden="true">{sorted.ascending ? "↑" : "↓"}</span> : null}
        </button>
      ) : (
        HEAD[id]
      )}
    </th>
  );
}

/** A tool's mark: the real logo from the registry in the board's 16px tile. BF-01 P5 (C11): a keyboard can reach it, and
    it names its tool to a screen reader and, on hover, in its title. No shared tooltip is used on a site page. */
function ToolMark({ tool }: { tool: TableTool }) {
  const { state, handlers } = useInteractive<HTMLSpanElement>();
  return (
    // BF-05 (G3): the focusable span is a 24 by 24 hit area with a -4 margin, so the row keeps its footprint; the 16px tile inside is what is drawn and what the focus ring circles.
    <span role="img" aria-label={tool.name} title={tool.name} tabIndex={0} {...handlers} style={{ boxSizing: "content-box", width: 16, height: 16, padding: 4, margin: -4, display: "inline-grid", placeItems: "center" }}>
      <span style={{ position: "relative", width: 16, height: 16, borderRadius: r.chip, background: t.tile, display: "inline-grid", placeItems: "center", ...ring(state.focusVisible) }}>
        <ModelMark tool={tool.id} size={14} />
      </span>
    </span>
  );
}

function ToolMarks({ tools }: { tools: readonly TableTool[] }) {
  return (
    <span style={{ display: "inline-flex", gap: 4, verticalAlign: "middle" }}>
      {tools.map((tool) => (
        <ToolMark key={tool.id} tool={tool} />
      ))}
    </span>
  );
}

function RunBars({ runs }: { runs: readonly number[] }) {
  if (runs.every((value) => value === 0)) return <Empty />;
  const max = Math.max(1, ...runs);
  const summary = `Runs per week over 12 weeks, oldest first: ${runs.join(", ")}`;
  return (
    <span role="img" aria-label={summary} style={{ display: "inline-flex", alignItems: "flex-end", gap: 2, height: 16, verticalAlign: "middle" }}>
      {runs.map((value, index) => (
        <span key={index} aria-hidden="true" style={{ width: 3, height: Math.max(2, Math.round((value / max) * 16)), borderRadius: 1, background: value === 0 ? t.line : t.evidence }} />
      ))}
    </span>
  );
}

function BuildCell({ row }: { row: TableRowView }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <span style={{ display: "block", minWidth: 200 }}>
      <Link to={row.href} {...handlers} style={{ display: "block", maxWidth: 220, ...ellipsis, ...hitArea(2), ...text(13, 500, state.hovered ? t.text2 : t.text), textDecoration: "none", borderRadius: r.chip, ...ring(state.focusVisible) }}>
        {row.title}
      </Link>
      <span style={text(12, 400, t.label)}>@{row.maker}</span>
    </span>
  );
}

function cellOf(id: ColumnId, row: TableRowView): ReactNode {
  switch (id) {
    case "build":
      return <BuildCell row={row} />;
    case "built":
      return row.built || <Empty />;
    case "field":
      return row.field || <Empty />;
    case "tools":
      return row.tools.length > 0 ? <ToolMarks tools={row.tools} /> : <Empty />;
    case "steps":
      return row.steps ?? <Empty />;
    case "sessions":
      return row.sessions ?? <Empty />;
    case "reproductions":
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {row.reproductions}
          {row.reproductions > 0 ? <RowLamp lit={row.lit} /> : null}
        </span>
      );
    case "confirmed":
      return row.confirmed || <Empty />;
    case "runs":
      return <RunBars runs={row.runs} />;
    case "rebuilds":
      return row.rebuilds;
    case "open":
      return row.open || <Empty />;
    case "cost":
      return row.cost || <Empty />;
    default:
      return row.extra?.[id] || <Empty />;
  }
}

const QUIET: ReadonlySet<ColumnId> = new Set(["built", "field", "confirmed", "open", "cost", ...EXTRA_COLUMNS]);

/** Rows past the first screen are skipped until they come near. */
const FIRST_SCREEN_ROWS = 14;

function Row({ row, columns, index }: { row: TableRowView; columns: readonly ColumnId[]; index: number }) {
  return (
    <tr style={{ borderBottom: `1px solid ${t.hairline}`, ...(index >= FIRST_SCREEN_ROWS ? { contentVisibility: "auto", containIntrinsicSize: `auto ${TABLE_ROW}px` } : null) }}>
      {columns.map((id, position) => (
        <td key={id} style={{ ...td(RIGHT.has(id), position === columns.length - 1), color: QUIET.has(id) ? t.text2 : t.text }}>
          {cellOf(id, row)}
        </td>
      ))}
    </tr>
  );
}

/* ── the footer ── */

/** BF-01 P4: what the two lamps mean, the last thing in the footer. */
function LampKey() {
  return (
    <span style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 8, ...text(12, 400, t.label) }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <RowLamp lit />
        <span>{`confirmed in the last ${STALE_AFTER_DAYS} days`}</span>
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <RowLamp lit={false} />
        <span>stale</span>
      </span>
    </span>
  );
}

function span(columns: readonly ColumnId[], from: ColumnId, group: readonly ColumnId[]): number {
  return group.filter((id) => columns.includes(id) && columns.indexOf(id) >= columns.indexOf(from)).length;
}

/** Add a calculation: a menu of the columns one can be made on (sum and median of a count, most common of a word), or the dev page's plain button. */
function AddCalculation({ footer }: { footer: TableFooterView }) {
  if (footer.calculate) {
    const { options, onToggle } = footer.calculate;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <BuildsTextButton size={12} color={t.text2}>
            Add a calculation
          </BuildsTextButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6} style={{ maxHeight: 320, overflowY: "auto" }}>
          {options.flatMap((option) =>
            option.kinds.map((entry) => (
              <DropdownMenuCheckboxItem key={`${option.column}:${entry.kind}`} checked={entry.on} onCheckedChange={() => onToggle(option.column, entry.kind)}>
                {entry.label}, {option.name}
              </DropdownMenuCheckboxItem>
            )),
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  return footer.onCalculate ? (
    <BuildsTextButton size={12} color={t.text2} onClick={footer.onCalculate}>
      Add a calculation
    </BuildsTextButton>
  ) : null;
}

/** The calculations added, each with its way to take it off, and the button that adds one. */
function CalculationCell({ footer }: { footer: TableFooterView }) {
  return (
    <span style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "4px 16px" }}>
      <AddCalculation footer={footer} />
      {(footer.calculations ?? []).map((calculation) => (
        <span key={calculation.key} style={{ display: "inline-flex", alignItems: "baseline", gap: 4, ...text(12, 400, t.label) }}>
          {calculation.text}
          <BuildsTextButton size={12} aria-label={`Remove ${calculation.text}`} onClick={calculation.onRemove}>
            ×
          </BuildsTextButton>
        </span>
      ))}
    </span>
  );
}

function Footer({ columns, footer }: { columns: readonly ColumnId[]; footer: TableFooterView }) {
  const cells: ReactNode[] = [];
  const small = { ...text(12, 400, t.label), padding: "12px 12px 0 0" };
  const skip = new Set<ColumnId>();
  const hasCalculations = Boolean(footer.onCalculate || footer.calculate);
  columns.forEach((id, position) => {
    if (skip.has(id)) return;
    if (id === "build") {
      cells.push(<td key={id} style={small}>{footer.count}</td>);
    } else if (id === "built") {
      const n = span(columns, "built", ["built", "field", "tools"]);
      (["built", "field", "tools"] as const).forEach((c) => skip.add(c));
      cells.push(<td key={id} colSpan={n} style={small}>{footer.mostCommon ?? ""}</td>);
    } else if (id === "steps") {
      const n = span(columns, "steps", ["steps", "sessions"]);
      (["steps", "sessions"] as const).forEach((c) => skip.add(c));
      cells.push(<td key={id} colSpan={n} style={{ ...small, textAlign: "right" }}>{footer.median ?? ""}</td>);
    } else if (id === "reproductions") {
      cells.push(<td key={id} style={{ ...small, textAlign: "right" }}>{footer.total ?? ""}</td>);
    } else if (id === "confirmed") {
      const rest = columns.length - position;
      columns.slice(position).forEach((c) => skip.add(c));
      cells.push(
        <td key={id} colSpan={rest} style={{ ...small, padding: "12px 0 0" }}>
          {hasCalculations ? <CalculationCell footer={footer} /> : null}
        </td>,
      );
    } else {
      cells.push(<td key={id} style={small} />);
    }
  });
  /* With Confirmed off the button has no cell of its own: it sits in a row under the footer, the width of the table. */
  const apart = hasCalculations && !columns.includes("confirmed");
  /* The key goes last in the footer's final cell: the row under it when the calculations sit apart, else the last cell. */
  if (!apart) {
    const last = cells[cells.length - 1] as ReactElement<{ children?: ReactNode }>;
    cells[cells.length - 1] = cloneElement(last, undefined, last.props.children, <LampKey key="key" />);
  }
  return (
    <tfoot>
      <tr>{cells}</tr>
      {apart ? (
        <tr>
          <td colSpan={columns.length} style={{ padding: "8px 0 0" }}>
            <CalculationCell footer={footer} />
            <LampKey />
          </td>
        </tr>
      ) : null}
    </tfoot>
  );
}

/* ── the table ── */

export function BuildsTableView(props: BuildsTableViewProps) {
  const { lenses, lens, onLens, sort, columnsLabel, columnsMenu, chips, onRemoveChip, onClearAll, columns, rows, sortColumn, sortableBy, footer, onMore, loadingMore, empty, updating, activeCount, onOpenFilters, setName } = props;
  return (
    <div data-testid="builds-table">
      <LensRow lenses={lenses} lens={lens} onLens={onLens} sort={sort} columnsLabel={columnsLabel} columnsMenu={columnsMenu} updating={updating} activeCount={activeCount} onOpenFilters={onOpenFilters} setName={setName} />
      <ActiveFilters chips={chips} onRemove={onRemoveChip} onClearAll={onClearAll} />
      {rows.length === 0 && empty ? (
        <div style={{ marginTop: 20 }}>{empty}</div>
      ) : (
        <div role="region" aria-label="Builds table" aria-busy={updating === true} tabIndex={0} style={{ marginTop: 20, overflowX: "auto", scrollbarWidth: "thin", scrollbarColor: `${t.label} transparent` }}>
          <table style={{ width: "100%", minWidth: 1000, borderCollapse: "collapse", ...text(13, 400, t.text) }}>
            <thead>
              <tr>
                {columns.map((id, position) => (
                  <ColumnHead
                    key={id}
                    id={id}
                    last={position === columns.length - 1}
                    sorted={sortColumn?.id === id ? sortColumn : null}
                    sortValue={sortableBy[id]}
                    onSort={sort.onChange}
                  />
                ))}
              </tr>
            </thead>
            <tbody style={updating ? { opacity: 0.5 } : undefined}>
              {rows.map((row, index) => (
                <Row key={row.id} row={row} columns={columns} index={index} />
              ))}
            </tbody>
            <Footer columns={columns} footer={footer} />
          </table>
        </div>
      )}
      {onMore ? (
        <div style={{ marginTop: 20 }}>
          <BuildsControl onClick={onMore} disabled={loadingMore}>
            Show more
          </BuildsControl>
        </div>
      ) : null}
    </div>
  );
}
