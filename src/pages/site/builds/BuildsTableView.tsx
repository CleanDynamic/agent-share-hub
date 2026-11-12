/* SV-11: the Builds Table, pure: typed props, no fetching, no router hooks but `Link`. The board is
   `design/reference/vision/dusk/builds-table.html`. It leads, on the surface, with no box: the lens tabs with Sort and
   Columns on the right, the active filters under them, then the table.

   Each part is its own component, defined at module level. THE COLUMNS ARE DATA: `columns` says which of the board's
   twelve are drawn, in order, so the live page draws the ones whose data exists (SV-11 Part 3) and the dev page all.

   REAL CONTROLS. A sortable head is a button, and its cell says `aria-sort`; the Runs 12 weeks bars are hidden from
   screen readers and their group carries the numbers in words; the table scrolls inside its column (min width 1000) in a
   region a keyboard can reach. Rows past the first screen are skipped until near (`content-visibility`). No motion: rows
   change at once. */

import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { LampBar } from "@/components/brand/LampDot";
import { ModelMark } from "@/components/brand/ModelMark";
import { Checkbox } from "@/components/brand/Checkbox";
import { useIsPhone } from "@/components/shell/useMinWidth";
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
import { RANGE_FILTERS } from "@/lib/build/galleryRanges";
import { STALE_AFTER_DAYS } from "@/lib/build/signals";
import { TextTabs, type TextTab } from "@/components/vision/TextTabs";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";

import { useColumnDrag, type ColumnDragHandlers } from "./columnDrag";
import { BuildsControl, BuildsTextButton, FiltersButton, TABLE_ROW, UpdatingStatus, ellipsis, hitArea, text } from "./BuildsFrame";

/* ── props ── */

/* BF-12: the ids live in `src/lib/build/buildsColumns.ts`, where the address can read them too. */
import { ALL_COLUMNS, COLUMN_ORDER, EXTRA_COLUMNS, type BoardColumnId, type ColumnId, type ExtraColumnId } from "@/lib/build/buildsColumns";
export { ALL_COLUMNS, COLUMN_ORDER, EXTRA_COLUMNS, type BoardColumnId, type ColumnId, type ExtraColumnId };

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
  works: "Works on model",
  likes: RANGE_FILTERS.likes.name,
  patterns: "Patterns",
  published: "Published",
};
const HEAD = COLUMN_NAME;

const RIGHT: ReadonlySet<ColumnId> = new Set(["steps", "sessions", "reproductions", "rebuilds", "likes"]);

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
  /** BF-12 (B3): the raw times of Last confirmed and Published, so they sort as times. */
  confirmedAt?: string | null;
  publishedAt?: string | null;
  /** BF-10: the Likes number, and the lists Works on model and Patterns are joined from, for the footer's calculations. */
  likes?: number;
  lists?: Readonly<Partial<Record<"works" | "patterns", readonly string[]>>>;
}

export interface TableChip {
  key: string;
  name: string;
  value: string;
}

export interface TableFooterView {
  count: string;
  /** BF-13 (C6): one value under each column that has one: the most common Field and Tools, "Median 11" under Steps, "Total 214"
      under Reproductions. */
  byColumn?: Readonly<Partial<Record<ColumnId, string>>>;
  /** The dev page's button, with no menu. */
  onCalculate?: () => void;
  /** SV-24 P2: the calculations added, each worked out from the loaded page, each drawn under its own column. */
  calculations?: readonly TableCalculation[];
  /** SV-24 P2: Add a calculation as a menu of the columns it can be made on. */
  calculate?: { options: readonly CalculationOption[]; onToggle: (column: ColumnId, kind: CalcKind) => void };
}

export interface TableCalculation {
  key: string;
  /** BF-13: the column it is drawn under. */
  column: ColumnId;
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
  /** BF-10 (C9): `group` heads the options under it; options of a group come together. */
  options: readonly { id: ColumnId; name: string; group?: string; on: boolean; locked?: boolean; fromFilter?: boolean; movable?: boolean }[];
  onToggle: (id: ColumnId) => void;
  /** BF-13 (C6): the keyboard way to reorder: a movable column one place left or right. */
  onMove?: (id: ColumnId, direction: "left" | "right") => void;
  /** Back to the default twelve; drawn only while the columns are not. */
  onReset?: () => void;
}

export interface BuildsTableViewProps {
  lenses: readonly TextTab[];
  lens: string;
  onLens: (lens: string) => void;
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
  /** BF-12 (B5): the second key, which breaks the first's ties; its head says "other" and draws its arrow with a 2. */
  sortColumn2?: { id: ColumnId; ascending: boolean } | null;
  /** BF-12 (B3): the heads that sort: every drawn column once the whole list is loaded, else the database's six. */
  sortable: ReadonlySet<ColumnId>;
  /** A press on a sortable head; `second` is Shift (BF-12 P4). `fresh`: the phone's Sort menu, which starts the column's cycle
      over (descending) rather than taking its next step. */
  onSortColumn: (id: ColumnId, second: boolean, fresh?: boolean) => void;
  /** BF-11 (B2): the columns whose filter holds a value; their heads are marked. Absent: none. */
  filtered?: ReadonlySet<ColumnId>;
  footer: TableFooterView;
  /** More rows exist than are shown. */
  onMore?: () => void;
  loadingMore?: boolean;
  /** One line shown instead of the table when the filters match nothing. */
  empty?: ReactNode;
  /** BF-13 (C6): the reader's own columns but Build, whose heads can be dragged to a new place, and the drop: the column and its
      place among them (counted without it). Absent: no head drags. */
  movable?: ReadonlySet<ColumnId>;
  onDropColumn?: (id: ColumnId, index: number) => void;
  /** BF-02 (C2): the rows are the last address's, kept until the new page lands. */
  updating?: boolean;
  /** BF-06 (A1): how many filters hold a value, for the Filters button, and the press that opens the dialog. */
  activeCount: number;
  onOpenFilters: () => void;
  /** BF-09 (A8): the open saved set's name, on the Filters button. */
  setName?: string;
}

/* ── the lens row ── */

/** BF-12 (B4): on a phone, where a head is hard to reach, the one other way to sort: the drawn columns that can sort, by their
    column names, in column order. Choosing one sorts it descending; the heads say the same. */
function SortMenu({ columns, sortable, sortColumn, onSortColumn }: Pick<BuildsTableViewProps, "columns" | "sortable" | "sortColumn" | "onSortColumn">) {
  const options = columns.filter((id) => sortable.has(id));
  const current = sortColumn ? HEAD[sortColumn.id] : "";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <BuildsControl aria-label={`Sort: ${current}`}>
          <span style={{ color: t.label }}>Sort</span> {current}
        </BuildsControl>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6}>
        <DropdownMenuRadioGroup value={sortColumn?.id ?? ""} onValueChange={(id) => onSortColumn(id as ColumnId, false, true)}>
          {options.map((id) => (
            <DropdownMenuRadioItem key={id} value={id}>
              {HEAD[id]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The Columns chooser: a checklist of every column in a popover, by group. Build is always on. BF-10 (C9): it opens to the left of
    its button, so the column a tick adds is not under it. On a phone there is no room to its left (Radix kept it there, 18px off
    the screen at 412 wide), so it opens under the button. */
function ColumnsChooser({ label, menu }: { label: string; menu: ColumnsMenu }) {
  const phone = useIsPhone();
  const groups: { name: string | undefined; options: ColumnsMenu["options"][number][] }[] = [];
  for (const option of menu.options) {
    const last = groups.at(-1);
    if (last && last.name === option.group) last.options.push(option);
    else groups.push({ name: option.group, options: [option] });
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <BuildsControl aria-label={`Columns: ${label}`}>
          <span style={{ color: t.label }}>Columns</span> {label}
        </BuildsControl>
      </PopoverTrigger>
      <PopoverContent side={phone ? "bottom" : "left"} align={phone ? "end" : "start"} sideOffset={6} collisionPadding={14} style={{ width: 240, maxWidth: "calc(100vw - 28px)", maxHeight: "min(560px, calc(100dvh - 120px), var(--radix-popover-content-available-height))", overflowY: "auto", padding: 16 }}>
        <div role="group" aria-label="Columns">
          {groups.map((group, at) => (
            <div key={group.name ?? at} role={group.name ? "group" : undefined} aria-label={group.name}>
              {group.name ? <div style={{ ...text(12, 400, t.label), margin: `${at === 0 ? 0 : 12}px 0 4px` }}>{group.name}</div> : null}
              {group.options.map((option, place) => {
                const movable = group.options.filter((entry) => entry.movable);
                const row = (
                <label key={option.id} style={{ display: "grid", gridTemplateColumns: "16px 1fr", columnGap: 10, alignItems: "center", minHeight: 32, flex: 1, cursor: option.locked ? "default" : "pointer", ...text(12.5, 400, option.on ? t.text : t.text2) }}>
                  <Checkbox checked={option.on} disabled={option.locked} label={option.fromFilter ? `${option.name}, from a filter` : undefined} onChange={() => menu.onToggle(option.id)} />
                  <span>
                    {option.name}
                    {/* BF-11 (B1): drawn because a filter holds a value; it goes when the filter does. */}
                    {option.fromFilter ? <span style={{ color: t.label }}>, from a filter</span> : null}
                  </span>
                </label>
                );
                if (!option.movable || !menu.onMove) return row;
                const onMove = menu.onMove;
                /* BF-13 (C6): the keyboard way to reorder. A character in a named button is text, not an icon. */
                return (
                  <div key={option.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {row}
                    <BuildsTextButton aria-label={`Move ${option.name} left`} disabled={movable[0] === option} onClick={() => onMove(option.id, "left")}>
                      ‹
                    </BuildsTextButton>
                    <BuildsTextButton aria-label={`Move ${option.name} right`} disabled={movable.at(-1) === option || place === group.options.length - 1} onClick={() => onMove(option.id, "right")}>
                      ›
                    </BuildsTextButton>
                  </div>
                );
              })}
            </div>
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

function LensRow({ lenses, lens, onLens, columns, sortable, sortColumn, onSortColumn, columnsLabel, columnsMenu, updating, activeCount, onOpenFilters, setName }: Pick<BuildsTableViewProps, "lenses" | "lens" | "onLens" | "columns" | "sortable" | "sortColumn" | "onSortColumn" | "columnsLabel" | "columnsMenu" | "updating" | "activeCount" | "onOpenFilters" | "setName">) {
  const phone = useIsPhone();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12, borderBottom: `1px solid ${t.hairline}` }}>
      <TextTabs tabs={lenses} value={lens} onChange={onLens} label="Lens" rule={false} />
      <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
        <UpdatingStatus updating={updating} />
        <FiltersButton activeCount={activeCount} setName={setName} onClick={onOpenFilters} />
        {phone ? <SortMenu columns={columns} sortable={sortable} sortColumn={sortColumn} onSortColumn={onSortColumn} /> : null}
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
/** BF-13 (C5b): the Build column stays in view while the table scrolls sideways, on the surface's colour, with a hairline edge once
    the table has been scrolled. */
const pinned = (id: ColumnId, scrolled: boolean): React.CSSProperties | null =>
  id === "build" ? { position: "sticky", left: 0, zIndex: 1, background: t.surface, ...(scrolled ? { boxShadow: `inset -1px 0 0 ${t.hairline}` } : null) } : null;
const td = (right: boolean, last: boolean): React.CSSProperties => ({ padding: last ? 0 : "0 12px 0 0", height: TABLE_ROW, textAlign: right ? "right" : "left", whiteSpace: "nowrap" });

/** BF-11 (B2): a filtered column's head is in `--text` at 500 over a 1px `--selected-edge` line, and says so to a screen reader.
    No icon, and no new press: pressing the head sorts, as before. The words are the head's (and its button's) `aria-label`, not
    hidden text: hidden text is positioned, so a name built from it reads "Autonomy , filtered". */
function ColumnHead({ id, last, sorted, second = false, sortable, onSort, filtered = false, drag, scrolled = false }: { id: ColumnId; last: boolean; scrolled?: boolean; sorted: { ascending: boolean } | null; second?: boolean; sortable: boolean; onSort: (second: boolean) => void; filtered?: boolean; drag?: ColumnDragHandlers }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  /* BF-12 (B5): Shift with Enter or Space. A browser may fire the keyboard's click without the modifier, so the key press's Shift
     is kept for the click it causes; a pointer press starts clean. */
  const shiftKey = useRef(false);
  const right = RIGHT.has(id);
  const ariaSort = sorted ? (second ? "other" : sorted.ascending ? "ascending" : "descending") : sortable ? "none" : undefined;
  const mark: React.CSSProperties | undefined = filtered ? { fontWeight: 500, borderBottom: `1px solid ${t.selectedEdge}` } : undefined;
  const name = HEAD[id];
  const label = filtered ? `${HEAD[id]}, filtered` : undefined;
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      aria-label={label}
      data-column={id}
      data-movable={drag ? "" : undefined}
      {...drag}
      /* BF-13 (C6): a head that drags selects no text and is not taken for a scroll. */
      style={{ ...th(right, last), ...pinned(id, scrolled), color: sorted || filtered ? t.text : t.label, ...(drag ? { userSelect: "none", WebkitUserSelect: "none", touchAction: "none", cursor: "grab" } : null) }}
    >
      {sortable ? (
        <button
          type="button"
          aria-label={label}
          {...handlers}
          onPointerDown={(event) => {
            shiftKey.current = false;
            handlers.onPointerDown(event);
          }}
          onKeyDown={(event) => (shiftKey.current = event.shiftKey)}
          onClick={(event) => {
            const withShift = event.shiftKey || shiftKey.current;
            shiftKey.current = false;
            onSort(withShift);
          }}
          style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: 0, ...hitArea(2), font: "inherit", color: state.hovered ? t.text : "inherit", cursor: "pointer", borderRadius: r.chip, ...ring(state.focusVisible), ...mark }}
        >
          {name}
          {sorted ? <span aria-hidden="true">{`${sorted.ascending ? "↑" : "↓"}${second ? "2" : ""}`}</span> : null}
        </button>
      ) : mark ? (
        <span style={mark}>{name}</span>
      ) : (
        name
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

function Row({ row, columns, index, scrolled }: { row: TableRowView; columns: readonly ColumnId[]; index: number; scrolled: boolean }) {
  return (
    <tr style={{ borderBottom: `1px solid ${t.hairline}`, ...(index >= FIRST_SCREEN_ROWS ? { contentVisibility: "auto", containIntrinsicSize: `auto ${TABLE_ROW}px` } : null) }}>
      {columns.map((id, position) => (
        <td key={id} style={{ ...td(RIGHT.has(id), position === columns.length - 1), ...pinned(id, scrolled), color: QUIET.has(id) ? t.text2 : t.text }}>
          {cellOf(id, row)}
        </td>
      ))}
    </tr>
  );
}

/* ── the footer ── */

/** BF-01 P4: what the two lamps mean. BF-13: on its own line under the table. */
function LampKey() {
  return (
    <span data-testid="lamp-key" style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 8, ...text(12, 400, t.label) }}>
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

/** One calculation the reader added, with its way to take it off. */
function CalculationLine({ calculation }: { calculation: TableCalculation }) {
  return (
    <span style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
      {calculation.text}
      <BuildsTextButton size={12} aria-label={`Remove ${calculation.text}`} onClick={calculation.onRemove}>
        ×
      </BuildsTextButton>
    </span>
  );
}

/** BF-13 (C6): one cell under each column, in the drawn order, so a value moves with its column: the count and Add a calculation
    under Build; under any other column its own value, then the calculations added on it, each on its own line. */
function Footer({ columns, footer, scrolled }: { columns: readonly ColumnId[]; footer: TableFooterView; scrolled: boolean }) {
  return (
    <tfoot>
      <tr>
        {columns.map((id, position) => {
          const right = RIGHT.has(id);
          const style: React.CSSProperties = { ...text(12, 400, t.label), padding: position === columns.length - 1 ? "12px 0 0" : "12px 12px 0 0", textAlign: right ? "right" : "left", verticalAlign: "top", ...pinned(id, scrolled) };
          const calculations = (footer.calculations ?? []).filter((calculation) => calculation.column === id);
          return (
            <td key={id} style={style}>
              {id === "build" ? (
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                  {footer.count}
                  <AddCalculation footer={footer} />
                </span>
              ) : (
                <>
                  {footer.byColumn?.[id] ? (
                    right ? (
                      /* A number's value ("Median 19.5" under Steps) is wider than its column: it does not widen the table, it
                         sits right-aligned and, when it does not fit, runs on to the right, over the next column's footer. A
                         word's value (the most common tool) wraps instead. */
                      <span style={{ display: "flex", justifyContent: "safe flex-end", width: 0, minWidth: "100%", whiteSpace: "nowrap" }}>{footer.byColumn[id]}</span>
                    ) : (
                      footer.byColumn[id]
                    )
                  ) : null}
                  {calculations.length > 0 ? (
                    <span style={{ display: "flex", flexDirection: "column", alignItems: right ? "flex-end" : "flex-start", gap: 4, marginTop: footer.byColumn?.[id] ? 4 : 0 }}>
                      {calculations.map((calculation) => (
                        <CalculationLine key={calculation.key} calculation={calculation} />
                      ))}
                    </span>
                  ) : null}
                </>
              )}
            </td>
          );
        })}
      </tr>
    </tfoot>
  );
}

/* ── the table ── */

export function BuildsTableView(props: BuildsTableViewProps) {
  const { lenses, lens, onLens, columnsLabel, columnsMenu, chips, onRemoveChip, onClearAll, columns, rows, sortColumn, sortColumn2, sortable, onSortColumn, footer, onMore, loadingMore, empty, updating, activeCount, onOpenFilters, setName, filtered, movable, onDropColumn } = props;
  /* BF-13 (C6): the head row, where a drag reads the heads' places once. */
  const headRow = useRef<HTMLTableRowElement>(null);
  const dragOf = useColumnDrag(headRow, (id, index) => onDropColumn?.(id as ColumnId, index));
  /* BF-13 (C5b): one flag, set only when it flips, from the region's scroll: whether the table is scrolled sideways. */
  const [scrolled, setScrolled] = useState(false);
  return (
    <div data-testid="builds-table">
      <LensRow lenses={lenses} lens={lens} onLens={onLens} columns={columns} sortable={sortable} sortColumn={sortColumn} onSortColumn={onSortColumn} columnsLabel={columnsLabel} columnsMenu={columnsMenu} updating={updating} activeCount={activeCount} onOpenFilters={onOpenFilters} setName={setName} />
      <ActiveFilters chips={chips} onRemove={onRemoveChip} onClearAll={onClearAll} />
      {rows.length === 0 && empty ? (
        <div style={{ marginTop: 20 }}>{empty}</div>
      ) : (
        <div role="region" aria-label="Builds table" aria-busy={updating === true} tabIndex={0} data-scrolled={scrolled ? "true" : undefined} onScroll={(event) => setScrolled(event.currentTarget.scrollLeft > 0)} style={{ marginTop: 20, overflowX: "auto", scrollbarWidth: "thin", scrollbarColor: `${t.label} transparent` }}>
          <table style={{ width: "100%", minWidth: 1000, borderCollapse: "collapse", ...text(13, 400, t.text) }}>
            <thead>
              <tr ref={headRow}>
                {columns.map((id, position) => (
                  <ColumnHead
                    key={id}
                    id={id}
                    last={position === columns.length - 1}
                    sorted={sortColumn?.id === id ? sortColumn : sortColumn2?.id === id ? sortColumn2 : null}
                    second={sortColumn?.id !== id && sortColumn2?.id === id}
                    sortable={sortable.has(id)}
                    onSort={(second) => onSortColumn(id, second)}
                    filtered={filtered?.has(id)}
                    drag={onDropColumn && movable?.has(id) ? dragOf(id) : undefined}
                    scrolled={scrolled}
                  />
                ))}
              </tr>
            </thead>
            <tbody style={updating ? { opacity: 0.5 } : undefined}>
              {rows.map((row, index) => (
                <Row key={row.id} row={row} columns={columns} index={index} scrolled={scrolled} />
              ))}
            </tbody>
            <Footer columns={columns} footer={footer} scrolled={scrolled} />
          </table>
        </div>
      )}
      {/* BF-13: the lamp key, on its own line under the table. */}
      {rows.length === 0 && empty ? null : <LampKey />}
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
