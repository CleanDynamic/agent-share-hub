/* SV-11: the Builds Table, pure: typed props, no fetching, no router hooks but `Link`. The board is
   `design/reference/vision/dusk/builds-table.html`. It leads, on the surface, with no box: the lens tabs with Sort and
   Columns on the right, the active filters under them, then the table.

   Each part is its own component, defined at module level. THE COLUMNS ARE DATA: `columns` says which of the board's
   twelve are drawn, in order, so the live page draws the ones whose data exists (SV-11 Part 3) and the dev page all.

   REAL CONTROLS. A sortable head is a button, and its cell says `aria-sort`; the table scrolls inside its column (min width
   1000) in a region a keyboard can reach. Synth 08: rows sit 2px apart with no lines and take the Card fill on hover;
   numbers are right-aligned Geist Mono; the columns about reproductions and runs, and Tools, are not drawn. Rows past the first screen are skipped until near (`content-visibility`). No motion: rows
   change at once. */

import { VisuallyHidden } from "@/components/brand/VisuallyHidden";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";

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
import { ALL_COLUMN_IDS } from "@/lib/build/buildsColumns";
import { RANGE_FILTERS } from "@/lib/build/galleryRanges";
import { TextTabs, type TextTab } from "@/components/vision/TextTabs";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { hoverFill } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";
import { ChevronDown } from "lucide-react";

import { PhoneActiveFilters } from "./BuildsPhone";
import { PhoneTable, rowFacts, type PhoneCardView, type PhoneNumber, type PhoneView } from "./BuildsTablePhone";
import { useColumnDrag, type HeadDrag } from "./columnDrag";
import { BuildsControl, BuildsTextButton, FiltersButton, TABLE_ROW, UpdatingStatus, ellipsis, hitArea, text } from "./BuildsFrame";

/* ── props ── */

/** The board's twelve columns. */
export type BoardColumnId = "build" | "built" | "field" | "tools" | "steps" | "sessions" | "reproductions" | "confirmed" | "runs" | "rebuilds" | "open" | "cost";

/** SV-24 P2: the twelve more the Columns chooser offers, 24 in all: Shape and the classification facets that are not already a column.
    BF-10: and four more, 28: Works on model, Likes, Patterns (each a filter with no column till now) and Published (Newest's). */
export type ExtraColumnId = "shape" | "task" | "setting" | "role" | "technique" | "modality" | "method" | "autonomy" | "data" | "oversight" | "age" | "skill" | "works" | "likes" | "patterns" | "published";

export type ColumnId = BoardColumnId | ExtraColumnId;

export const COLUMN_ORDER: readonly ColumnId[] = ["build", "built", "field", "tools", "steps", "sessions", "reproductions", "confirmed", "runs", "rebuilds", "open", "cost"];

/** The default columns, in order. Synth 08: Tools, Reproductions, Confirmed and Runs are no longer drawn or offered. */
export const DEFAULT_COLUMNS: readonly ColumnId[] = ["build", "built", "field", "steps", "sessions", "rebuilds", "open", "cost"];

export const EXTRA_COLUMNS: readonly ExtraColumnId[] = ["shape", "task", "setting", "role", "technique", "modality", "method", "autonomy", "data", "oversight", "age", "skill", "works", "likes", "patterns", "published"];

/** Every column, the extras after the board's twelve (so the footer's groups stay together). BF-12: the list itself is in
    `src/lib/build/buildsColumns.ts`, where the address reads it. */
export const ALL_COLUMNS = ALL_COLUMN_IDS as readonly ColumnId[];

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

const RIGHT: ReadonlySet<ColumnId> = new Set(["steps", "sessions", "rebuilds", "likes"]);

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
  /** Kept as data (sorting and calculations read it); no column draws it any more. */
  tools: readonly TableTool[];
  steps: number | null;
  sessions: number | null;
  /** Kept as data; no column draws these three since Synth 08. */
  reproductions: number;
  lit: boolean;
  confirmed: string;
  runs: readonly number[];
  rebuilds: number;
  open: string;
  cost: string;
  /** SV-24 P2: the extra columns' values; absent where the dev page draws only the board's twelve. */
  extra?: Readonly<Partial<Record<ExtraColumnId, string>>>;
  /** BF-12: what a row is sorted on where its cell is words: the raw times and the open topics' number. Absent on the dev page. */
  confirmedAt?: string | null;
  publishedAt?: string | null;
  openCount?: number;
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
  /** BF-13: a value under its own column: the most common Field and Tool, "Median 11" under Steps, "Total 214" under Reproductions. */
  byColumn?: Readonly<Partial<Record<ColumnId, string>>>;
  /** The dev page's button, with no menu. */
  onCalculate?: () => void;
  /** SV-24 P2: the calculations added, each worked out from the loaded page. */
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
  options: readonly { id: ColumnId; name: string; group?: string; on: boolean; locked?: boolean; move?: { left: boolean; right: boolean } }[];
  onToggle: (id: ColumnId) => void;
  /** Prompt 21: each column's own group (Identity, Classification, Proof, Structure, OpenBuilds), for the phone's Columns sheet,
      where the shown columns are not set apart (they cannot be moved there). Absent: the options' own groups. */
  groups?: Readonly<Partial<Record<ColumnId, string>>>;
  /** BF-13 (C6): a shown column one place left or right; the keyboard's way to what a head's drag does. */
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
  /** 29f: the page's views with their addresses; a phone lists the others in the bar's More sheet. */
  views?: readonly PhoneView[];
  rows: readonly TableRowView[];
  /** The column each head sorts by, and the arrow on the sorted one. */
  sortColumn: { id: ColumnId; ascending: boolean } | null;
  /** BF-12 (B5): the second key, for ties: its head shows its arrow and "2". */
  sortColumn2?: { id: ColumnId; ascending: boolean } | null;
  /** BF-12 (B3): the heads that sort, those whose answer is true for the whole list. */
  sortable: ReadonlySet<ColumnId>;
  /** A head pressed; `second` with Shift, for a second key. `fresh` from the phone's Sort menu: the column's first step. */
  onSortColumn: (id: ColumnId, second: boolean, fresh?: boolean) => void;
  /** BF-13 (C6): the heads that can be dragged to a new place (the reader's own columns, not Build), and where one was dropped:
      its index among the drawn heads. */
  draggable?: ReadonlySet<ColumnId>;
  onDropColumn?: (id: ColumnId, index: number) => void;
  /** BF-11 (B2): the columns a filter in the address holds a value for; their heads are marked. */
  filtered?: ReadonlySet<ColumnId>;
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

/** BF-12 (B4): on a phone, where heads are small and scroll away, the one sort control is this menu: the drawn columns that can
    be sorted, by their names, the sorted one checked. Choosing one sorts by it descending. On a wider screen the heads are it. */
function SortMenu({ columns, sortable, sortColumn, onSortColumn }: Pick<BuildsTableViewProps, "columns" | "sortable" | "sortColumn" | "onSortColumn">) {
  const options = columns.filter((id) => sortable.has(id));
  const current = sortColumn ? COLUMN_NAME[sortColumn.id] : "";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <BuildsControl aria-label={current ? `Sort: ${current}` : "Sort"}>
          Sort
          <ChevronDown size={14} aria-hidden="true" />
        </BuildsControl>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6}>
        <DropdownMenuRadioGroup value={sortColumn?.id ?? ""} onValueChange={(id) => onSortColumn(id as ColumnId, false, true)}>
          {options.map((id) => (
            <DropdownMenuRadioItem key={id} value={id}>
              {COLUMN_NAME[id]}
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
          Columns
          <ChevronDown size={14} aria-hidden="true" />
        </BuildsControl>
      </PopoverTrigger>
      <PopoverContent side={phone ? "bottom" : "left"} align={phone ? "end" : "start"} sideOffset={6} collisionPadding={14} style={{ width: 240, maxWidth: "calc(100vw - 28px)", maxHeight: "min(560px, calc(100dvh - 120px), var(--radix-popover-content-available-height))", overflowY: "auto", padding: 16 }}>
        <div role="group" aria-label="Columns">
          {groups.map((group, at) => (
            <div key={group.name ?? at} role={group.name ? "group" : undefined} aria-label={group.name}>
              {group.name ? <div style={{ ...text(12, 400, t.label), margin: `${at === 0 ? 0 : 12}px 0 4px` }}>{group.name}</div> : null}
              {group.options.map((option) => (
                <div key={option.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <label style={{ flex: 1, display: "grid", gridTemplateColumns: "16px 1fr", columnGap: 10, alignItems: "center", minHeight: 32, cursor: option.locked ? "default" : "pointer", ...text(12, 400, option.on ? t.text : t.text2) }}>
                    <Checkbox checked={option.on} disabled={option.locked} onChange={() => menu.onToggle(option.id)} />
                    <span>{option.name}</span>
                  </label>
                  {option.move && menu.onMove ? (
                    <span style={{ display: "inline-flex", gap: 16, paddingInline: 8 }}>
                      <BuildsTextButton aria-label={`Move ${option.name} left`} disabled={!option.move.left} onClick={() => menu.onMove?.(option.id, "left")}>
                        ‹
                      </BuildsTextButton>
                      <BuildsTextButton aria-label={`Move ${option.name} right`} disabled={!option.move.right} onClick={() => menu.onMove?.(option.id, "right")}>
                        ›
                      </BuildsTextButton>
                    </span>
                  ) : null}
                </div>
              ))}
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
  /* Synth 08: the lenses at the left, Filters, Sort and Columns at the right as small secondary buttons. From 761 to 1100 the
     controls wrap under the lenses; below 761 the lenses scroll sideways inside their own row. */
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0 12px" }}>
      {/* The box keeps 4px round the tabs for their focus ring, given back in margin, so nothing moves. */}
      <div style={{ padding: 4, margin: -4, maxWidth: "calc(100% + 8px)", boxSizing: "border-box", minWidth: 0, overflowX: "auto", scrollbarWidth: "none" }}>
        <TextTabs tabs={lenses} value={lens} onChange={onLens} label="Lens" rule={false} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingBlock: 4 }}>
        <UpdatingStatus updating={updating} />
        <FiltersButton activeCount={activeCount} setName={setName} onClick={onOpenFilters} />
        <SortMenu columns={columns} sortable={sortable} sortColumn={sortColumn} onSortColumn={onSortColumn} />
        {columnsLabel && columnsMenu ? (
          <ColumnsChooser label={columnsLabel} menu={columnsMenu} />
        ) : columnsLabel ? (
          <BuildsControl aria-label={`Columns: ${columnsLabel}`}>
            Columns
            <ChevronDown size={14} aria-hidden="true" />
          </BuildsControl>
        ) : null}
      </div>
    </div>
  );
}

/* ── the active filters ── */

/** BF-04 (X3): the one chip row, drawn by the Table, Maps and Classification alike. */
export function ActiveFilters({ chips, onRemove, onClearAll }: { chips: readonly TableChip[]; onRemove: (key: string) => void; onClearAll: () => void }) {
  const phone = useIsPhone();
  if (chips.length === 0) return null;
  if (phone) return <PhoneActiveFilters chips={chips} onRemove={onRemove} onClearAll={onClearAll} />;
  return (
    <div role="group" aria-label="Active filters" data-focus-list="" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 16 }}>
      {chips.map((chip) => (
        <ActiveFilterChip key={chip.key} name={chip.name} value={chip.value} onRemove={() => onRemove(chip.key)} />
      ))}
      <span style={{ height: 26, display: "inline-flex", alignItems: "center", padding: "0 8px" }}>
        <BuildsTextButton size={13} underline color={t.text2} onClick={onClearAll}>
          Clear all
        </BuildsTextButton>
      </span>
    </div>
  );
}

/* ── cells ── */

/** BF-13 (C5b): the Build column stays in view while the table scrolls sideways, on the surface it sits on. */
const PINNED: CSSProperties = { position: "sticky", left: 0, zIndex: 1 };

/** The pinned column's right edge, drawn only while the table is scrolled, so the cells passing under it are cut by a line. */
function PinnedEdge({ scrolled }: { scrolled: boolean }) {
  return scrolled ? <span aria-hidden="true" style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 1, background: t.hairline }} /> : null;
}

/* Heads are 13 Text 3, no line under them; a cell has 12 either side so a hovered row's Card fill has room round its words. */
const th = (right: boolean, _last: boolean): React.CSSProperties => ({ ...text(13, 400, t.label), padding: "0 12px 8px", textAlign: right ? "right" : "left", verticalAlign: "bottom", whiteSpace: "nowrap" });
const td = (right: boolean, position: number, count: number): React.CSSProperties => ({
  padding: "0 12px",
  height: TABLE_ROW,
  textAlign: right ? "right" : "left",
  whiteSpace: "nowrap",
  borderRadius: position === 0 ? "8px 0 0 8px" : position === count - 1 ? "0 8px 8px 0" : 0,
});

/** A number: Geist Mono 15, right-aligned by its column. Zero or none is "0" in Text 3. */
function Count({ value }: { value: number | null | undefined }) {
  return value ? <span style={{ fontFamily: DM_MONO, fontSize: 15, color: t.text }}>{value}</span> : <span style={{ fontFamily: DM_MONO, fontSize: 15, color: t.label }}>0</span>;
}

/** A word cell with nothing in it: the shared empty mark. */
const Blank = Empty;

/** BF-11 (B2): a filtered head is in `--text` at 500 over a 1px `--selected-edge` line, and says so to a screen reader. No icon,
    and pressing it still only sorts: the way to the filter is the Filters button and the chip. The head and its button are named
    "Autonomy, filtered" by `aria-label`, not by a hidden piece after the name: that gets a space before its comma in some engines,
    and would join the head's text. */
const FILTERED_MARK: React.CSSProperties = { fontWeight: 500, borderBottom: `1px solid ${t.selectedEdge}` };

function ColumnHead({ id, last, sorted, sorted2, sortable, onSort, filtered, drag, scrolled }: { id: ColumnId; last: boolean; sorted: { ascending: boolean } | null; sorted2: { ascending: boolean } | null; sortable: boolean; onSort: (second: boolean) => void; filtered: boolean; drag?: HeadDrag; scrolled: boolean }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const right = RIGHT.has(id);
  /* G18: aria-sort is on the sorted head only. The second key shows its arrow and a 2, and its button says so in words. */
  const ariaSort = sorted ? (sorted.ascending ? "ascending" : "descending") : undefined;
  const arrow = sorted ?? sorted2;
  const secondNote = sorted2 && !sorted ? `, then by this, ${sorted2.ascending ? "ascending" : "descending"}` : "";
  const label = filtered ? `${HEAD[id]}, filtered${secondNote}` : undefined;
  return (
    <th
      scope="col"
      data-column={id}
      aria-sort={ariaSort}
      aria-label={label}
      {...drag}
      style={{ ...th(right, last), color: sorted || filtered ? t.text : t.label, ...(drag ? { userSelect: "none", touchAction: "none", cursor: "grab" } : null), ...(id === "build" ? { ...PINNED, background: t.surface } : null) }}
    >
      {id === "build" ? <PinnedEdge scrolled={scrolled} /> : null}
      {sortable ? (
        <button
          type="button"
          onClick={(event) => onSort(event.shiftKey)}
          /* Shift with Enter or Space is the second key from the keyboard, whatever the browser puts on the click it makes. */
          onKeyDown={(event) => {
            if (event.shiftKey && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              onSort(true);
            }
          }}
          aria-label={label}
          {...handlers}
          style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: 0, ...hitArea(2), font: "inherit", color: state.hovered ? t.text : "inherit", cursor: "pointer", borderRadius: r.chip, ...ring(state.focusVisible), ...(filtered ? FILTERED_MARK : null) }}
        >
          {HEAD[id]}
          {arrow ? (
            <span aria-hidden="true">
              <ChevronDown size={13} style={{ verticalAlign: "-2px", color: t.label, transform: arrow.ascending ? "rotate(180deg)" : undefined }} />
              {sorted2 && !sorted ? "2" : null}
            </span>
          ) : null}
          {secondNote ? <VisuallyHidden>{secondNote}</VisuallyHidden> : null}
        </button>
      ) : filtered ? (
        <span style={FILTERED_MARK}>{HEAD[id]}</span>
      ) : (
        HEAD[id]
      )}
    </th>
  );
}

function BuildCell({ row }: { row: TableRowView }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <span style={{ display: "block", minWidth: 200 }}>
      <Link to={row.href} {...handlers} style={{ display: "block", maxWidth: 240, ...ellipsis, ...hitArea(2), ...text(15, 600, state.hovered ? t.text2 : t.text), textDecoration: "none", borderRadius: r.chip, ...ring(state.focusVisible) }}>
        {row.title}
      </Link>
      <span style={text(13, 400, t.label)}>@{row.maker}</span>
    </span>
  );
}

function cellOf(id: ColumnId, row: TableRowView): ReactNode {
  switch (id) {
    case "build":
      return <BuildCell row={row} />;
    case "built":
      return row.built || <Blank />;
    case "field":
      return row.field || <Blank />;
    case "steps":
      return <Count value={row.steps} />;
    case "sessions":
      return <Count value={row.sessions} />;
    case "rebuilds":
      return <Count value={row.rebuilds} />;
    case "open":
      return row.open || <Blank />;
    case "cost":
      return row.cost || <span style={{ color: t.label }}>Not measured</span>;
    default:
      return row.extra?.[id] || <Blank />;
  }
}

const QUIET: ReadonlySet<ColumnId> = new Set(["built", "field", "open", "cost", ...EXTRA_COLUMNS]);

/** Rows past the first screen are skipped until they come near. */
const FIRST_SCREEN_ROWS = 14;

function Row({ row, columns, index, scrolled }: { row: TableRowView; columns: readonly ColumnId[]; index: number; scrolled: boolean }) {
  const { state, handlers } = useInteractive<HTMLTableRowElement>();
  const fill = state.hovered ? t.module : "transparent";
  return (
    <tr {...handlers} style={index >= FIRST_SCREEN_ROWS ? { contentVisibility: "auto", containIntrinsicSize: `auto ${TABLE_ROW}px` } : undefined}>
      {columns.map((id, position) => (
        <td key={id} style={{ ...td(RIGHT.has(id), position, columns.length), background: id === "build" && !state.hovered ? t.surface : fill, color: QUIET.has(id) ? t.text2 : t.text, ...(id === "build" ? PINNED : null) }}>
          {id === "build" ? <PinnedEdge scrolled={scrolled} /> : null}
          {cellOf(id, row)}
        </td>
      ))}
    </tr>
  );
}

/* ── the footer ── */

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

/** A footer value: "Median 11" is the word in Text 3 and the number in Geist Mono 13 Text 2; a word value stays as it is. */
function MedianValue({ text: value, numeric }: { text: string; numeric: boolean }) {
  const at = value.lastIndexOf(" ");
  const number = numeric && at > 0 ? value.slice(at + 1) : null;
  return (
    <span style={{ display: "block", width: 0, minWidth: "100%" }}>
      {number === null ? (
        value
      ) : (
        <>
          {value.slice(0, at)} <span style={{ fontFamily: DM_MONO, fontSize: 13, color: t.text2 }}>{number}</span>
        </>
      )}
    </span>
  );
}

/** BF-13 (C6): one cell per column, in the drawn order, so a value moves with its column. The Build cell holds the count and, under
    it, Add a calculation; every other cell its own value and the calculations added on it, each with its Remove button. */
function Footer({ columns, footer, scrolled }: { columns: readonly ColumnId[]; footer: TableFooterView; scrolled: boolean }) {
  const line = { display: "block" } as const;
  return (
    <tfoot>
      <tr>
        {columns.map((id, position) => {
          const last = position === columns.length - 1;
          const calculations = (footer.calculations ?? []).filter((calculation) => calculation.column === id);
          return (
            <td key={id} style={{ ...text(13, 400, t.label), padding: last ? "12px 12px 0" : "12px 12px 0", textAlign: RIGHT.has(id) ? "right" : "left", verticalAlign: "top", ...(id === "build" ? { ...PINNED, background: t.surface } : null) }}>
              {id === "build" ? (
                <>
                  <PinnedEdge scrolled={scrolled} />
                  <span style={line}>{footer.count}</span>
                  <AddCalculation footer={footer} />
                </>
              ) : (
                <>
                  {/* The footer's own value never widens its column: it wraps within the width the head and the cells set, and a
                      word longer than that ("Median" under Steps) runs into the cell's own padding. */}
                  {footer.byColumn?.[id] ? <MedianValue text={footer.byColumn[id]!} numeric={RIGHT.has(id)} /> : null}
                  {calculations.map((calculation) => (
                    <span key={calculation.key} style={{ display: "flex", alignItems: "baseline", justifyContent: RIGHT.has(id) ? "flex-end" : "flex-start", gap: 4 }}>
                      {calculation.text}
                      <BuildsTextButton size={12} aria-label={`Remove ${calculation.text}`} onClick={calculation.onRemove}>
                        ×
                      </BuildsTextButton>
                    </span>
                  ))}
                </>
              )}
            </td>
          );
        })}
      </tr>
    </tfoot>
  );
}

/* ── the table on a phone (prompt 21) ── */

/** The columns whose value is a number the cards can show. The first three of these the reader chose, in their order. */
const CARD_NUMBERS: ReadonlySet<ColumnId> = new Set(["steps", "rebuilds", "likes", "cost"]);

const GROUP_ORDER = ["Identity", "Classification", "Proof", "Structure", "OpenBuilds"] as const;

function numbersOf(columns: readonly ColumnId[], row: TableRowView): PhoneNumber[] {
  return columns
    .filter((id) => CARD_NUMBERS.has(id))
    .slice(0, 3)
    .map((id): PhoneNumber => {
      if (id === "cost") return { name: COLUMN_NAME[id], value: row.cost || "Not measured", empty: !row.cost, mono: false };
      const value = id === "steps" ? row.steps : id === "rebuilds" ? row.rebuilds : (row.likes ?? 0);
      return { name: COLUMN_NAME[id], value: String(value || 0), empty: !value, mono: true };
    });
}

function phoneCards(columns: readonly ColumnId[], rows: readonly TableRowView[]): PhoneCardView[] {
  return rows.map((row) => ({ id: row.id, href: row.href, title: row.title, maker: row.maker, facts: [row.built, row.field].filter(Boolean).join(" · "), numbers: numbersOf(columns, row), line: rowFacts(row.sessions, row.steps, row.maker) }));
}

/** The footer's calculation words as a phone says them: "Median 11, Steps", "Most common Food and drink, Field". */
function phoneSummary(columns: readonly ColumnId[], footer: TableFooterView): string[] {
  return columns.flatMap((id) => {
    const value = footer.byColumn?.[id];
    if (!value) return [];
    return [RIGHT.has(id) ? `${value}, ${COLUMN_NAME[id]}` : `Most common ${value}, ${COLUMN_NAME[id]}`];
  });
}

function phoneColumnGroups(menu: ColumnsMenu) {
  const nameOf = (option: ColumnsMenu["options"][number]): string | undefined => menu.groups?.[option.id] ?? option.group;
  const names = menu.groups ? [...GROUP_ORDER] : [...new Set(menu.options.map(nameOf))];
  return names.map((name) => ({
    name,
    rows: menu.options.filter((option) => nameOf(option) === name).map((option) => ({ id: option.id, label: option.name, checked: option.on, disabled: option.locked, dim: option.locked })),
  })).filter((group) => group.rows.length > 0);
}

/* ── the table ── */

export function BuildsTableView(props: BuildsTableViewProps) {
  const { lenses, lens, onLens, columnsLabel, columnsMenu, chips, onRemoveChip, onClearAll, columns, rows, sortColumn, sortColumn2, sortable, onSortColumn, draggable, onDropColumn, filtered, footer, onMore, loadingMore, empty, updating, activeCount, onOpenFilters, setName } = props;
  const headRow = useRef<HTMLTableRowElement>(null);
  /* BF-13 (C5b): one passive listener sets one flag, whether the table is scrolled sideways; the region carries it as
     data-scrolled and the pinned column draws its edge from it. Nothing else changes per scroll event. */
  const region = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const shown = !(rows.length === 0 && empty);
  useEffect(() => {
    const el = region.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollLeft > 0);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [shown]);
  const dragOf = useColumnDrag(headRow, onDropColumn ? (id, index) => onDropColumn(id as ColumnId, index) : undefined);
  const phone = useIsPhone();
  if (phone) {
    const calculate = footer.calculate;
    return (
      <PhoneTable
        lenses={lenses}
        lens={lens}
        onLens={onLens}
        updating={updating}
        activeCount={activeCount}
        onOpenFilters={onOpenFilters}
        setName={setName}
        sort={{
          current: sortColumn ? COLUMN_NAME[sortColumn.id] : "",
          choices: columns.filter((id) => sortable.has(id)).map((id) => ({ id, name: COLUMN_NAME[id], on: sortColumn?.id === id })),
          onChoose: (id) => onSortColumn(id as ColumnId, false, true),
        }}
        columns={columnsLabel && columnsMenu ? { label: columnsLabel, groups: phoneColumnGroups(columnsMenu), onToggle: (id) => columnsMenu.onToggle(id as ColumnId), onReset: columnsMenu.onReset } : undefined}
        chips={chips}
        onRemoveChip={onRemoveChip}
        onClearAll={onClearAll}
        cards={phoneCards(columns, rows)}
        summary={phoneSummary(columns, footer)}
        calculations={(footer.calculations ?? []).map((calculation) => ({ key: calculation.key, text: calculation.text, onRemove: calculation.onRemove }))}
        calculate={
          calculate
            ? {
                options: calculate.options.flatMap((option) => option.kinds.map((entry) => ({ key: `${option.column}:${entry.kind}`, label: `${entry.label}, ${option.name}`, on: entry.on }))),
                onToggle: (key) => {
                  const [column, kind] = key.split(":");
                  calculate.onToggle(column as ColumnId, kind as CalcKind);
                },
              }
            : undefined
        }
        onMore={onMore}
        loadingMore={loadingMore}
        empty={empty}
        views={props.views}
      />
    );
  }
  return (
    <div data-testid="builds-table">
      <LensRow lenses={lenses} lens={lens} onLens={onLens} columns={columns} sortable={sortable} sortColumn={sortColumn} onSortColumn={onSortColumn} columnsLabel={columnsLabel} columnsMenu={columnsMenu} updating={updating} activeCount={activeCount} onOpenFilters={onOpenFilters} setName={setName} />
      <ActiveFilters chips={chips} onRemove={onRemoveChip} onClearAll={onClearAll} />
      {rows.length === 0 && empty ? (
        <div style={{ marginTop: 20 }}>{empty}</div>
      ) : (
        <div ref={region} role="region" aria-label="Builds table" data-scrolled={scrolled ? "true" : undefined} aria-busy={updating === true} tabIndex={0} style={{ position: "relative", marginTop: 20, overflowX: "auto", scrollbarWidth: "thin", scrollbarColor: `${t.label} transparent` }}>
          <table style={{ width: "100%", minWidth: 760, borderCollapse: "separate", borderSpacing: "0 2px", ...text(15, 400, t.text) }}>
            <thead>
              <tr ref={headRow}>
                {columns.map((id, position) => (
                  <ColumnHead
                    key={id}
                    id={id}
                    last={position === columns.length - 1}
                    sorted={sortColumn?.id === id ? sortColumn : null}
                    sorted2={sortColumn2?.id === id ? sortColumn2 : null}
                    sortable={sortable.has(id)}
                    onSort={(second) => onSortColumn(id, second)}
                    filtered={filtered?.has(id) === true}
                    drag={draggable?.has(id) ? dragOf?.(id) : undefined}
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
      {onMore ? (
        <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
          <BuildsControl onClick={onMore} disabled={loadingMore}>
            Show more
          </BuildsControl>
        </div>
      ) : null}
    </div>
  );
}
