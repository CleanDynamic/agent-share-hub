/* SV-11: Builds' words and shapes, pure: what the list is asked for, and how a row, a filter and the head are put. */

import { BUILDS_TABLE_PAGE_SIZE, GALLERY_SHAPES, type BuildsTableBuild, type CountSpread, type WorksOnModelCount, type BuildsTableOptions, type BuildsTablePage, type GalleryFeedSort, type GalleryLens } from "@/lib/build/gallery";
import { CONFIRMED_WITHIN, DEFAULT_GALLERY_SORT, type ConfirmedState, type ConfirmedWithin, type GalleryParams } from "@/lib/build/galleryParams";
import { RANGE_FILTERS, RANGE_KEYS, rangeWords, type NumberRange, type RangeKey } from "@/lib/build/galleryRanges";
import { PATTERN_LABEL, type Pattern } from "@/lib/build/patterns";
import { STALE_AFTER_DAYS, isStale } from "@/lib/build/signals";
import { shownValues } from "@/lib/classify/facets";
import { labelFor } from "@/lib/classify/lines";
import { FACET_LABEL, TAXONOMY, valueOf, type Facet } from "@/lib/classify/taxonomy";
import { modelById, modelLabel } from "@/lib/models/registry";
import { toolFor } from "@/lib/tools/registry";
import { shortAgo } from "@/pages/site/home/homeModel";

import type { CatalogueGroup, FilterSection, RangeSection, WordOption, WordOrder } from "./BuildsFiltersView";
import { CALC_KINDS, type CalcKind, type Calculation } from "@/lib/build/buildsLayout";

import { ALL_COLUMNS, COLUMN_NAME, type CalculationOption, type ColumnId, type ColumnsMenu, type ExtraColumnId, type TableCalculation, type TableChip, type TableFooterView, type TableRowView, type TableTool } from "./BuildsTableView";

/** What the list is asked for: everything in the address but the view, which changes what is drawn, not what is read. */
export function listParamsOf(params: GalleryParams): BuildsTableOptions {
  return {
    lens: params.lens,
    facets: params.facets ?? [],
    tool: params.tool,
    shapes: params.shapes ?? [],
    pattern: params.pattern,
    openBounties: params.open === true,
    query: params.query ?? undefined,
    ranges: params.ranges,
    confirmedWithin: params.within,
    confirmedState: params.state,
    worksOn: params.model,
    sort: params.sort ?? DEFAULT_GALLERY_SORT,
  };
}

/** The next page's offset, or none when the last page was short. */
export function nextTableOffset(last: BuildsTablePage, pages: readonly BuildsTablePage[]): number | undefined {
  return last.builds.length === BUILDS_TABLE_PAGE_SIZE ? pages.length * BUILDS_TABLE_PAGE_SIZE : undefined;
}

/* ── the live filters ── */

/** Facets whose values are a scale: kept in the taxonomy's order, "Scale order". */
export const SCALE_FACETS: readonly Facet[] = ["autonomy", "age", "skill", "cost"];

/** The facets drawn as filters, in the board's order. Tools and stack is its own filter. */
const PANEL_FACETS: readonly Facet[] = ["field", "task", "setting", "built", "role", "technique", "modality", "method", "autonomy", "data", "oversight", "age", "skill", "cost"];

/** A facet's values in the panel: the top level, or the tools under their groups for Tools and stack. */
function panelValues(facet: Facet) {
  return TAXONOMY[facet].filter((value) => (facet === "stack" ? value.depth === 1 : value.depth === 0));
}

export type PanelOrder = "az" | "count";

/** One facet's checklist: every value with a build or chosen, in the chosen order (scales keep theirs). */
export function facetOptions(facet: Facet, counts: Record<string, number>, chosen: readonly string[], order: PanelOrder): WordOption[] {
  const options = panelValues(facet)
    .map((value) => ({ key: `${facet}:${value.id}`, label: value.label, count: counts[`${facet}:${value.id}`] ?? 0 }))
    .filter((option) => option.count > 0 || chosen.includes(option.key))
    .map((option) => ({ ...option, checked: chosen.includes(option.key) }));
  if (SCALE_FACETS.includes(facet)) return options;
  return order === "count" ? options.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)) : options.sort((a, b) => a.label.localeCompare(b.label));
}

const keysOf = (facets: readonly string[], facet: Facet) => facets.filter((key) => key.startsWith(`${facet}:`));

/** What a closed filter says it holds: "Any", the one value, or "n chosen". */
function heldValue(facet: Facet, facets: readonly string[]): string {
  const keys = keysOf(facets, facet);
  if (keys.length === 0) return "Any";
  if (keys.length > 1) return `${keys.length} chosen`;
  return valueOf(facet, keys[0].slice(facet.length + 1))?.label ?? "Any";
}

export interface PanelState {
  facets: readonly string[];
  shapes: readonly string[];
  pattern?: Pattern;
  open: boolean;
  counts: Record<string, number> | null;
  patterns: readonly { value: Pattern; count: number }[] | null;
  /** The filters opened on this visit, beyond those opened by default and by holding a value. */
  opened: ReadonlySet<string>;
  orders: Readonly<Record<string, PanelOrder>>;
  /** SV-23: the number filters, drawn once their spread has answered (the stored counts are live). */
  ranges?: Partial<Record<RangeKey, NumberRange>>;
  spread?: CountSpread | null;
  /** SV-23 P2: the proof filters in the address, and the models with a worked run (null: the count is not live, so no Works on model). */
  within?: ConfirmedWithin;
  confirmState?: ConfirmedState;
  model?: string;
  worksOn?: readonly WorksOnModelCount[] | null;
}

const WITHIN_WORDS = (days: number) => `Within ${days} days`;
const STATE_WORDS: Record<ConfirmedState, { option: string; chip: string }> = {
  confirmed: { option: `Confirmed in the last ${STALE_AFTER_DAYS} days`, chip: "Confirmed" },
  stale: { option: `Stale, not confirmed in ${STALE_AFTER_DAYS} days`, chip: "Stale" },
};

/* ── the number filters (SV-23) ── */

const HISTOGRAM_BARS = 12;

/** Bars from 0 to 1 over the filter's values 0 to its cap, and whether each bar holds any value in the chosen range. */
export function histogramOf(counts: ReadonlyMap<number, number> | undefined, cap: number, range: NumberRange | undefined): RangeSection["histogram"] {
  // The cap + 1 values 0 to cap, shared out evenly: value v is in bar floor(v * 12 / (cap + 1)), so the cap is in the last.
  const barOf = (value: number) => Math.min(HISTOGRAM_BARS - 1, Math.floor((Math.min(value, cap) * HISTOGRAM_BARS) / (cap + 1)));
  const totals = Array.from({ length: HISTOGRAM_BARS }, () => 0);
  for (const [value, builds] of counts ?? []) totals[barOf(value)] += builds;
  const most = Math.max(1, ...totals);
  const first = barOf(range?.min ?? 0);
  const last = barOf(range?.max ?? cap);
  return totals.map((total, at) => ({ height: total / most, inRange: at >= first && at <= last }));
}

/** One number filter: the histogram, the slider's two ends and the range in words. */
function rangeSection(key: RangeKey, spread: CountSpread, range: NumberRange | undefined): RangeSection {
  const { cap, name } = RANGE_FILTERS[key];
  return {
    kind: "range",
    id: key,
    name,
    valueText: range ? rangeWords(range) : "Any",
    histogram: histogramOf(spread[key], cap, range),
    min: 0,
    max: cap,
    value: [range?.min ?? 0, range?.max ?? cap],
    describe: (value, end) => (end === "min" ? (value === 0 ? "any" : `${value} or more`) : value >= cap ? "no limit" : `up to ${value}`),
    endLabels: ["0", `${cap}+`],
  };
}

/** The address with a number filter set from the slider's two ends; the ends of the scale are no limit. */
export function withRange(params: GalleryParams, key: RangeKey, value: readonly [number, number]): GalleryParams {
  const { cap } = RANGE_FILTERS[key];
  const range: NumberRange = { ...(value[0] > 0 ? { min: value[0] } : {}), ...(value[1] < cap ? { max: value[1] } : {}) };
  const ranges = { ...params.ranges };
  if (range.min === undefined && range.max === undefined) delete ranges[key];
  else ranges[key] = range;
  return { ...params, ranges: Object.keys(ranges).length > 0 ? ranges : undefined };
}

/** Field and Autonomy are open by default, as the board draws them; a filter holding a value is open. */
const OPEN_BY_DEFAULT = new Set(["field", "autonomy"]);

/**
 * The live panel: the classification filters once their counts have answered, Tools and stack, Shape, Patterns once the
 * column is live, and Open requests. The board's number filters, Works on model and Last confirmed are SV-23's.
 */
export function panelSections(state: PanelState): FilterSection[] {
  const isOpen = (id: string, holds: boolean) => holds || OPEN_BY_DEFAULT.has(id) || state.opened.has(id);
  const sections: FilterSection[] = [];
  if (state.counts) {
    const counts = state.counts;
    for (const facet of [...PANEL_FACETS.slice(0, 9), "stack" as Facet, ...PANEL_FACETS.slice(9)]) {
      const chosen = keysOf(state.facets, facet);
      const name = FACET_LABEL[facet];
      if (!isOpen(facet, chosen.length > 0)) {
        sections.push({ kind: "closed", id: facet, name, value: heldValue(facet, state.facets) });
        continue;
      }
      if (facet === "autonomy") {
        sections.push({
          kind: "scale",
          id: facet,
          name,
          segments: panelValues(facet).map((value) => ({ key: `${facet}:${value.id}`, label: value.label, on: chosen.includes(`${facet}:${value.id}`) })),
          endLabels: [panelValues(facet)[0].label, panelValues(facet).at(-1)!.label],
        });
        continue;
      }
      const order: WordOrder = SCALE_FACETS.includes(facet) ? "scale" : (state.orders[facet] ?? "az");
      sections.push({ kind: "word", id: facet, name, order, options: facetOptions(facet, counts, state.facets, order === "scale" ? "az" : order) });
    }
  }
  const rangeSections = (keys: readonly RangeKey[]) => {
    if (!state.spread) return;
    for (const key of keys) {
      const range = state.ranges?.[key];
      if (isOpen(key, range !== undefined)) sections.push(rangeSection(key, state.spread, range));
      else sections.push({ kind: "closed", id: key, name: RANGE_FILTERS[key].name, value: "Any" });
    }
  };
  /* SV-23 P2, the proof: Reproductions, Works on model, Last confirmed, Confirmed or stale, Rebuilds, Likes. */
  rangeSections(["reproductions"]);
  if (state.worksOn) {
    const chosen = state.model ? modelById(state.model) : null;
    if (isOpen("model", chosen !== null)) {
      const options = state.worksOn.map((entry) => ({ key: entry.model.id, label: entry.model.name, count: entry.builds, checked: entry.model.id === state.model }));
      if (chosen && !options.some((option) => option.checked)) options.push({ key: chosen.id, label: chosen.name, count: 0, checked: true });
      sections.push({ kind: "word", id: "model", name: "Works on model", order: "count", options });
    } else sections.push({ kind: "closed", id: "model", name: "Works on model", value: "Any" });
  }
  sections.push(
    isOpen("within", state.within !== undefined)
      ? { kind: "word", id: "within", name: "Last confirmed", order: "scale", options: CONFIRMED_WITHIN.map((days) => ({ key: `within:${days}`, label: WITHIN_WORDS(days), checked: state.within === days })) }
      : { kind: "closed", id: "within", name: "Last confirmed", value: "Any" },
  );
  sections.push(
    isOpen("state", state.confirmState !== undefined)
      ? { kind: "word", id: "state", name: "Confirmed or stale", order: "scale", options: (["confirmed", "stale"] as const).map((entry) => ({ key: `state:${entry}`, label: STATE_WORDS[entry].option, checked: state.confirmState === entry })) }
      : { kind: "closed", id: "state", name: "Confirmed or stale", value: state.confirmState ? STATE_WORDS[state.confirmState].chip : "Any" },
  );
  rangeSections(["rebuilds", "likes"]);
  const shapeOpen = isOpen("shape", state.shapes.length > 0);
  sections.push(
    shapeOpen
      ? { kind: "word", id: "shape", name: "Shape", order: "az", options: GALLERY_SHAPES.map((shape) => ({ key: shape, label: shapeWord(shape), count: 0, checked: state.shapes.includes(shape) })) }
      : { kind: "closed", id: "shape", name: "Shape", value: state.shapes.length === 1 ? shapeWord(state.shapes[0]) : state.shapes.length > 1 ? `${state.shapes.length} chosen` : "Any" },
  );
  rangeSections(["steps", "sessions"]);
  if (state.patterns) {
    const patternOpen = isOpen("pattern", state.pattern !== undefined);
    sections.push(
      patternOpen
        ? { kind: "word", id: "pattern", name: "Patterns", order: "count", options: state.patterns.map((entry) => ({ key: entry.value, label: PATTERN_LABEL[entry.value], count: entry.count, checked: state.pattern === entry.value })) }
        : { kind: "closed", id: "pattern", name: "Patterns", value: state.pattern ? PATTERN_LABEL[state.pattern] : "Any" },
    );
  }
  sections.push(
    isOpen("open", state.open)
      ? { kind: "word", id: "open", name: "Open requests", order: "az", options: [{ key: "open", label: "Has an open request", count: 0, checked: state.open }] }
      : { kind: "closed", id: "open", name: "Open requests", value: state.open ? "Has one" : "Any" },
  );
  return sections;
}

/** The catalogue on the live page: only the filters that work, by group. */
export function liveCatalogue(classified: boolean, patterns: boolean, ranges = false, models = false): CatalogueGroup[] {
  const groups: CatalogueGroup[] = [];
  if (classified) {
    const names = [...PANEL_FACETS.slice(0, 9), "stack" as Facet, ...PANEL_FACETS.slice(9)].map((facet) => FACET_LABEL[facet]);
    groups.push({ name: "Classification", count: names.length, items: names.join(", ") });
  }
  const named = (keys: readonly RangeKey[]) => (ranges ? keys.map((key) => RANGE_FILTERS[key].name) : []);
  const proof = [...named(["reproductions"]), ...(models ? ["Works on model"] : []), "Last confirmed", "Confirmed or stale", ...named(["rebuilds", "likes"])];
  groups.push({ name: "Proof", count: proof.length, items: proof.join(", ") });
  const structure = ["Shape", ...named(["steps", "sessions"]), ...(patterns ? ["Patterns"] : [])];
  groups.push({ name: "Structure", count: structure.length, items: structure.join(", ") });
  groups.push({ name: "OpenBuilds", count: 1, items: "Open requests" });
  return groups;
}

/** "App", "Workflow": a shape as a word. */
export function shapeWord(shape: string): string {
  return shape ? shape.charAt(0).toUpperCase() + shape.slice(1) : "";
}

/* ── the active filters ── */

/** One chip per chosen value: its filter's name and the value. The key is what removing it takes away. */
export function activeChips(params: GalleryParams): TableChip[] {
  const chips: TableChip[] = [];
  for (const key of params.facets ?? []) {
    const at = key.indexOf(":");
    const facet = key.slice(0, at) as Facet;
    chips.push({ key: `f:${key}`, name: facet === "stack" ? "Tools" : FACET_LABEL[facet], value: valueOf(facet, key.slice(at + 1))?.label ?? key });
  }
  if (params.tool) chips.push({ key: "tool", name: "Tools", value: toolFor(params.tool)?.name ?? params.tool });
  for (const shape of params.shapes ?? []) chips.push({ key: `shape:${shape}`, name: "Shape", value: shapeWord(shape) });
  if (params.pattern) chips.push({ key: "pattern", name: "Patterns", value: PATTERN_LABEL[params.pattern] });
  if (params.open) chips.push({ key: "open", name: "Open requests", value: "Has one" });
  const model = params.model ? modelById(params.model) : null;
  if (model) chips.push({ key: "model", name: "Works on", value: model.name });
  if (params.within !== undefined) chips.push({ key: "within", name: "Last confirmed", value: WITHIN_WORDS(params.within) });
  if (params.state) chips.push({ key: "state", name: "Confirmed or stale", value: STATE_WORDS[params.state].chip });
  for (const key of RANGE_KEYS) {
    const range = params.ranges?.[key];
    if (range) chips.push({ key: `range:${key}`, name: RANGE_FILTERS[key].name, value: rangeWords(range) });
  }
  if (params.query) chips.push({ key: "q", name: "Search", value: params.query });
  return chips;
}

/** The address without the chip's value. */
export function withoutChip(params: GalleryParams, key: string): GalleryParams {
  if (key.startsWith("f:")) return { ...params, facets: (params.facets ?? []).filter((entry) => entry !== key.slice(2)) };
  if (key.startsWith("shape:")) return { ...params, shapes: (params.shapes ?? []).filter((entry) => entry !== key.slice(6)) };
  if (key === "tool") return { ...params, tool: undefined };
  if (key === "pattern") return { ...params, pattern: undefined };
  if (key === "open") return { ...params, open: undefined };
  if (key === "q") return { ...params, query: null };
  if (key === "model") return { ...params, model: undefined };
  if (key === "within") return { ...params, within: undefined };
  if (key === "state") return { ...params, state: undefined };
  if (key.startsWith("range:")) {
    const { [key.slice(6) as RangeKey]: _removed, ...rest } = params.ranges ?? {};
    return { ...params, ranges: Object.keys(rest).length > 0 ? rest : undefined };
  }
  return params;
}

/** The address with a panel value toggled. */
export function toggled(params: GalleryParams, sectionId: string, key: string): GalleryParams {
  const flip = (list: readonly string[]) => (list.includes(key) ? list.filter((entry) => entry !== key) : [...list, key]);
  if (sectionId === "shape") return { ...params, shapes: flip(params.shapes ?? []) };
  if (sectionId === "pattern") return { ...params, pattern: params.pattern === key ? undefined : (key as Pattern) };
  if (sectionId === "open") return { ...params, open: params.open ? undefined : true };
  // SV-23 P2: Works on model, Last confirmed and Confirmed or stale are each a choice of one: choosing the one held clears it.
  if (sectionId === "model") return { ...params, model: params.model === key ? undefined : key };
  if (sectionId === "within") return { ...params, within: params.within === Number(key.slice(7)) ? undefined : (Number(key.slice(7)) as ConfirmedWithin) };
  if (sectionId === "state") return { ...params, state: params.state === key.slice(6) ? undefined : (key.slice(6) as ConfirmedState) };
  return { ...params, facets: flip(params.facets ?? []) };
}

/** How many values the filters hold, for "n active". */
export const activeCount = (params: GalleryParams): number => activeChips(params).filter((chip) => chip.key !== "q").length;

/** SV-12: the Maps view draws this many builds at a time, and reads their Maps in one request. */
export const MAPS_PAGE = 24;

/* ── the rows ── */

/** A build as a row of the Table. The extra columns' values are worked out only for the columns that are drawn. */
export function tableRow(build: BuildsTableBuild, now: number, extras: readonly ExtraColumnId[] = []): TableRowView {
  const c = build.classifiedAs;
  const first = (facet: Facet) => {
    if (!c) return "";
    if (facet === "field") {
      const entry = c.declared.field[0];
      return entry ? ("custom" in entry ? entry.custom : labelFor("field", entry.id)) : "";
    }
    const id = shownValues(c, facet).values[0];
    return id ? labelFor(facet, id) : "";
  };
  const tools: TableTool[] = [];
  for (const name of build.madeWith) {
    const tool = toolFor(name);
    if (tool && !tools.some((entry) => entry.id === tool.id)) tools.push({ id: tool.id, name: tool.name });
  }
  const ago = build.lastConfirmedAt ? shortAgo(build.lastConfirmedAt, now) : "";
  const model = modelLabel(build.lastConfirmedModel);
  return {
    id: build.id,
    href: `/b2/${build.slug}`,
    title: build.title || "Untitled",
    maker: build.maker?.handle ?? "unknown",
    built: first("built"),
    field: first("field"),
    tools: tools.slice(0, 3),
    steps: build.stepCount ?? null,
    sessions: build.sessionCount ?? null,
    reproductions: build.reproductionCount,
    lit: build.reproductionCount > 0 && !isStale({ last_confirmed_at: build.lastConfirmedAt, published_at: build.publishedAt }, now),
    confirmed: ago ? `${ago === "now" ? "just now" : `${ago} ago`}${model ? ` on ${model}` : ""}` : "",
    runs: build.runs ?? [],
    rebuilds: build.rebuildCount,
    open: build.open.count === 0 ? "" : `${build.open.count} open${build.open.reward ? ` · £${build.open.reward}` : ""}`,
    cost: first("cost"),
    ...(extras.length > 0 ? { extra: Object.fromEntries(extras.map((id) => [id, id === "shape" ? shapeWord(build.shape) : first(id)])) } : null),
  };
}

/** The live columns: the board's, less Steps and Sessions, which wait for the stored counts. */
export const LIVE_COLUMNS: readonly ColumnId[] = ["build", "built", "field", "tools", "reproductions", "confirmed", "runs", "rebuilds", "open", "cost"];

/** SV-23 P1: Steps and Sessions join once the list carries the stored counts. */
export function columnsFor(countsLive: boolean): readonly ColumnId[] {
  return countsLive ? ["build", "built", "field", "tools", "steps", "sessions", "reproductions", "confirmed", "runs", "rebuilds", "open", "cost"] : LIVE_COLUMNS;
}

/* ── the columns the reader chose (SV-24 P2) ── */

/** The columns the chooser offers: all 24, less Steps and Sessions until the list carries the stored counts. */
export function availableColumns(countsLive: boolean): ColumnId[] {
  return ALL_COLUMNS.filter((id) => countsLive || (id !== "steps" && id !== "sessions"));
}

/** The columns drawn: the default twelve, or the ones the reader kept, always with Build, always in the table's own order. */
export function chosenColumns(saved: readonly string[] | null, countsLive: boolean): ColumnId[] {
  if (saved === null) return [...columnsFor(countsLive)];
  const wanted = new Set(saved);
  return availableColumns(countsLive).filter((id) => id === "build" || wanted.has(id));
}

/** "12 of 24". */
export const columnsLabel = (chosen: readonly ColumnId[], countsLive: boolean): string => `${chosen.length} of ${availableColumns(countsLive).length}`;

/** The chooser's checklist. */
export function columnsMenu(chosen: readonly ColumnId[], countsLive: boolean, onToggle: (id: ColumnId) => void, onReset?: () => void): ColumnsMenu {
  return { options: availableColumns(countsLive).map((id) => ({ id, name: COLUMN_NAME[id], on: chosen.includes(id), ...(id === "build" ? { locked: true } : null) })), onToggle, onReset };
}

/** The chosen columns with one turned on or off. Build stays. */
export function toggledColumns(chosen: readonly ColumnId[], id: ColumnId): string[] {
  if (id === "build") return [...chosen];
  return chosen.includes(id) ? chosen.filter((entry) => entry !== id) : [...chosen, id];
}

/* ── the footer's calculations (SV-24 P2): worked out from the rows on the page, no request ── */

const NUMBERS: Partial<Record<ColumnId, (row: TableRowView) => number | null>> = {
  steps: (row) => row.steps,
  sessions: (row) => row.sessions,
  reproductions: (row) => row.reproductions,
  rebuilds: (row) => row.rebuilds,
};

const WORDS: Partial<Record<ColumnId, (row: TableRowView) => string[]>> = {
  built: (row) => [row.built],
  field: (row) => [row.field],
  tools: (row) => row.tools.map((tool) => tool.name),
  cost: (row) => [row.cost],
  ...Object.fromEntries((["shape", "task", "setting", "role", "technique", "modality", "method", "autonomy", "data", "oversight", "age", "skill"] as const).map((id) => [id, (row: TableRowView) => [row.extra?.[id] ?? ""]])),
};

export const CALC_WORD: Record<CalcKind, string> = { sum: "Sum", median: "Median", common: "Most common" };

/** What can be worked out on a column: a count has a sum and a median, a word its most common value, the rest nothing. */
export function calculationsFor(column: ColumnId): CalcKind[] {
  return NUMBERS[column] ? ["sum", "median"] : WORDS[column] ? ["common"] : [];
}

/** The value of one calculation over the rows, or null when no row has a value for it. */
export function calculate(calculation: Calculation, rows: readonly TableRowView[]): string | null {
  const column = calculation.column as ColumnId;
  if (!calculationsFor(column).includes(calculation.kind)) return null;
  const numbers = NUMBERS[column];
  if (numbers) {
    const values = rows.flatMap((row) => {
      const value = numbers(row);
      return value === null ? [] : [value];
    });
    if (values.length === 0) return null;
    return String(calculation.kind === "sum" ? values.reduce((total, value) => total + value, 0) : medianOf(values));
  }
  return mostCommon(rows.flatMap((row) => WORDS[column]?.(row) ?? []));
}

/** The calculations the reader added that still make sense for the columns drawn, as footer entries. */
export function footerCalculations(calculations: readonly Calculation[], chosen: readonly ColumnId[], rows: readonly TableRowView[], onRemove: (calculation: Calculation) => void): TableCalculation[] {
  return calculations
    .filter((calculation) => chosen.includes(calculation.column as ColumnId) && CALC_KINDS.includes(calculation.kind))
    .map((calculation) => {
      const text = `${CALC_WORD[calculation.kind]}, ${COLUMN_NAME[calculation.column as ColumnId]}`;
      return { key: `${calculation.column}:${calculation.kind}`, text: `${text} ${calculate(calculation, rows) ?? "·"}`, onRemove: () => onRemove(calculation) };
    });
}

/** The menu of Add a calculation: each drawn column that can have one, with the ones already added on. */
export function calculationOptions(calculations: readonly Calculation[], chosen: readonly ColumnId[]): CalculationOption[] {
  return chosen.flatMap((column) => {
    const kinds = calculationsFor(column);
    return kinds.length === 0 ? [] : [{ column, name: COLUMN_NAME[column], kinds: kinds.map((kind) => ({ kind, label: CALC_WORD[kind], on: calculations.some((entry) => entry.column === column && entry.kind === kind) })) }];
  });
}

/** The most common value among the rows, or null. */
function mostCommon(values: readonly string[]): string | null {
  const counts = new Map<string, number>();
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: string | null = null;
  for (const [value, count] of counts) if (best === null || count > (counts.get(best) ?? 0)) best = value;
  return best;
}

/** The middle of the counted steps (the mean of the two in the middle for an even number), or null when no row has a count. */
export function medianOf(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The footer: the count, the most common Field and Tools on the page, the median steps and the reproductions on the page. */
export function tableFooter(total: number | null, rows: readonly TableRowView[]): TableFooterView {
  const median = medianOf(rows.flatMap((row) => (row.steps === null ? [] : [row.steps])));
  const common = [mostCommon(rows.map((row) => row.field)), mostCommon(rows.flatMap((row) => row.tools.map((tool) => tool.name)))].filter(Boolean);
  const count = total ?? rows.length;
  return {
    count: `${count} ${count === 1 ? "build" : "builds"}`,
    mostCommon: common.length > 0 ? `Most common · ${common.join(", ")}` : undefined,
    median: median === null ? undefined : `Median ${median} ${median === 1 ? "step" : "steps"}`,
    total: `Total ${rows.reduce((sum, row) => sum + row.reproductions, 0)}`,
  };
}

/* ── the head and the lenses ── */

export const LENS_LABEL: Record<GalleryLens, string> = { all: "All", proven: "Reproduced", rebuilt: "Rebuilt", unsolved: "Open requests" };

export const SORT_OPTIONS: readonly { value: GalleryFeedSort; label: string }[] = [
  { value: "reproduced", label: "Reproductions" },
  { value: "confirmed", label: "Confirmed" },
  { value: "rebuilt", label: "Rebuilds" },
  { value: "newest", label: "Newest" },
];

/** The column each sort draws its arrow on; Newest has none. */
export const SORT_COLUMN: Partial<Record<GalleryFeedSort, ColumnId>> = { reproduced: "reproductions", confirmed: "confirmed", rebuilt: "rebuilds" };
