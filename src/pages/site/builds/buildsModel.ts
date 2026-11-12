/* SV-11: Builds' words and shapes, pure: what the list is asked for, and how a row, a filter and the head are put. */

import { BUILDS_TABLE_PAGE_SIZE, GALLERY_SHAPES, hasFilters, type LensCountFilters, type BuildsTableBuild, type CountSpread, type WorksOnModelCount, type BuildsTableOptions, type BuildsTablePage, type GalleryFeedSort, type GalleryLens } from "@/lib/build/gallery";
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

import { FILTER_GROUPS, type FilterGroup, type FilterSection, type RangeSection, type WordOption, type WordOrder } from "./BuildsFiltersView";
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
    stillOpen: params.open === true,
    query: params.query ?? undefined,
    ranges: params.ranges,
    confirmedWithin: params.within,
    confirmedState: params.state,
    worksOn: params.model,
    sort: params.sort ?? DEFAULT_GALLERY_SORT,
    /* BF-12: the direction is the database sort's only while no browser key (other than the sort's own column, which a second
       key sets) is set: a browser sort never asks again. */
    ascending: params.dir === "asc" && (!params.by || params.by === SORT_COLUMN[params.sort ?? DEFAULT_GALLERY_SORT]),
  };
}

/** BF-08 (C1): what the lens counts are asked with: the list's filters, without the lens and the sort. */
export function lensCountParams(params: GalleryParams): LensCountFilters {
  const { lens: _lens, sort: _sort, ascending: _ascending, ...filters } = listParamsOf(params);
  return filters;
}

export { hasFilters };

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

/** A checklist's values in the chosen order: most builds first (then by name), or by name. */
function inOrder(options: WordOption[], order: PanelOrder): WordOption[] {
  return order === "count" ? options.sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.label.localeCompare(b.label)) : options.sort((a, b) => a.label.localeCompare(b.label));
}

/** One facet's checklist: every value with a build or chosen, in the chosen order (scales keep theirs). */
export function facetOptions(facet: Facet, counts: Record<string, number>, chosen: readonly string[], order: PanelOrder): WordOption[] {
  const options = panelValues(facet)
    .map((value) => ({ key: `${facet}:${value.id}`, label: value.label, count: counts[`${facet}:${value.id}`] ?? 0 }))
    .filter((option) => option.count > 0 || chosen.includes(option.key))
    .map((option) => ({ ...option, checked: chosen.includes(option.key) }));
  if (SCALE_FACETS.includes(facet)) return options;
  return inOrder(options, order);
}

const keysOf = (facets: readonly string[], facet: Facet) => facets.filter((key) => key.startsWith(`${facet}:`));

/** What a filter says it holds: "Any", the one value, or "n chosen". */
export function heldValue(facet: Facet, facets: readonly string[]): string {
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
  /** BF-07 (A7): one order for every checklist that is not a scale. */
  order: PanelOrder;
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
function rangeSection(key: RangeKey, spread: CountSpread, range: NumberRange | undefined, group: FilterGroup): RangeSection {
  const { cap, name } = RANGE_FILTERS[key];
  return {
    kind: "range",
    id: key,
    name,
    group,
    valueText: range ? rangeWords(range) : "Any",
    histogram: histogramOf(spread[key], cap, range),
    counted: [...(spread[key]?.values() ?? [])].reduce((sum, builds) => sum + builds, 0),
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

/**
 * The live panel, every filter drawn in its group: the classification filters once their counts have answered, the proof (the
 * number filters once their spread has answered, Works on model once its counts have), Shape, Steps and Sessions, Patterns once
 * the column is live, and Still open.
 */
export function panelSections(state: PanelState): FilterSection[] {
  const sections: FilterSection[] = [];
  if (state.counts) {
    const counts = state.counts;
    for (const facet of [...PANEL_FACETS.slice(0, 9), "stack" as Facet, ...PANEL_FACETS.slice(9)]) {
      const name = FACET_LABEL[facet];
      if (facet === "autonomy") {
        const chosen = keysOf(state.facets, facet);
        sections.push({
          kind: "scale",
          id: facet,
          name,
          group: "Classification",
          segments: panelValues(facet).map((value) => ({ key: `${facet}:${value.id}`, label: value.label, on: chosen.includes(`${facet}:${value.id}`) })),
        });
        continue;
      }
      const order: WordOrder = SCALE_FACETS.includes(facet) ? "scale" : state.order;
      sections.push({ kind: "word", id: facet, name, group: "Classification", order, value: heldValue(facet, state.facets), options: facetOptions(facet, counts, state.facets, order === "scale" ? "az" : order) });
    }
  }
  const rangeSections = (keys: readonly RangeKey[], group: FilterGroup) => {
    if (!state.spread) return;
    for (const key of keys) sections.push(rangeSection(key, state.spread, state.ranges?.[key], group));
  };
  /* SV-23 P2, the proof: Reproductions, Works on model, Last confirmed, Confirmed or stale, Rebuilds, Likes. */
  rangeSections(["reproductions"], "Proof");
  if (state.worksOn) {
    const chosen = state.model ? modelById(state.model) : null;
    const options = state.worksOn.map((entry) => ({ key: entry.model.id, label: entry.model.name, count: entry.builds, checked: entry.model.id === state.model }));
    if (chosen && !options.some((option) => option.checked)) options.push({ key: chosen.id, label: chosen.name, count: 0, checked: true });
    sections.push({ kind: "word", id: "model", name: "Works on model", group: "Proof", order: state.order, value: chosen?.name ?? "Any", options: inOrder(options, state.order) });
  }
  sections.push({ kind: "word", id: "within", name: "Last confirmed", group: "Proof", order: "scale", value: state.within !== undefined ? WITHIN_WORDS(state.within) : "Any", options: CONFIRMED_WITHIN.map((days) => ({ key: `within:${days}`, label: WITHIN_WORDS(days), checked: state.within === days })) });
  sections.push({ kind: "word", id: "state", name: "Confirmed or stale", group: "Proof", order: "scale", value: state.confirmState ? STATE_WORDS[state.confirmState].chip : "Any", options: (["confirmed", "stale"] as const).map((entry) => ({ key: `state:${entry}`, label: STATE_WORDS[entry].option, checked: state.confirmState === entry })) });
  rangeSections(["rebuilds", "likes"], "Proof");
  const shapeValue = state.shapes.length === 1 ? shapeWord(state.shapes[0]) : state.shapes.length > 1 ? `${state.shapes.length} chosen` : "Any";
  sections.push({ kind: "word", id: "shape", name: "Shape", group: "Structure", order: state.order, value: shapeValue, options: inOrder(GALLERY_SHAPES.map((shape) => ({ key: shape, label: shapeWord(shape), count: 0, checked: state.shapes.includes(shape) })), state.order) });
  rangeSections(["steps", "sessions"], "Structure");
  if (state.patterns) {
    const options = state.patterns.map((entry) => ({ key: entry.value, label: PATTERN_LABEL[entry.value], count: entry.count, checked: state.pattern === entry.value }));
    sections.push({ kind: "word", id: "pattern", name: "Patterns", group: "Structure", order: state.order, value: state.pattern ? PATTERN_LABEL[state.pattern] : "Any", options: inOrder(options, state.order) });
  }
  sections.push({ kind: "word", id: "open", name: "Still open", group: "OpenBuilds", order: "az", value: state.open ? "Has one" : "Any", options: [{ key: "open", label: "Has a still-open topic", count: 0, checked: state.open }] });
  /* BF-07 (A4, A5): within each group a checklist with nothing to choose follows the rest. Nothing else reorders, and nothing a
     reader does moves a filter: holding a value is not a place. */
  const empty = (section: FilterSection) => (section.kind === "word" && section.options.length === 0 ? 1 : 0);
  return sections.sort((a, b) => FILTER_GROUPS.indexOf(a.group) - FILTER_GROUPS.indexOf(b.group) || empty(a) - empty(b));
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
  if (params.open) chips.push({ key: "open", name: "Still open", value: "Has one" });
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

/** BF-02 (X2): what Clear all leaves: the lens, the view and the sort. Every filter, the query and the open set go. */
export function clearedFilters(params: GalleryParams): GalleryParams {
  return { lens: params.lens, madeFor: [], madeWith: [], query: null, view: params.view, sort: params.sort, dir: params.dir, by: params.by, by2: params.by2, dir2: params.dir2 };
}

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
  /* BF-10: the four columns the filters had without one. */
  const works = [...new Set((build.workedModels ?? []).map(modelLabel).filter(Boolean))];
  const patterns = (build.patterns ?? []).map((pattern) => PATTERN_LABEL[pattern as Pattern] ?? pattern);
  const published = build.publishedAt ? agoWords(shortAgo(build.publishedAt, now)) : "";
  const extraOf = (id: ExtraColumnId): string => {
    if (id === "shape") return shapeWord(build.shape);
    if (id === "works") return works.length === 0 ? "" : `${works.slice(0, 2).join(", ")}${works.length > 2 ? ` + ${works.length - 2}` : ""}`;
    if (id === "likes") return String(build.likeCount ?? 0);
    if (id === "patterns") return patterns.join(", ");
    if (id === "published") return published;
    return first(id);
  };
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
    confirmed: ago ? `${agoWords(ago)}${model ? ` on ${model}` : ""}` : "",
    runs: build.runs ?? [],
    rebuilds: build.rebuildCount,
    open: build.open.count === 0 ? "" : `${build.open.count} open`,
    cost: first("cost"),
    ...(extras.length > 0 ? { extra: Object.fromEntries(extras.map((id) => [id, extraOf(id)])) } : null),
    likes: build.likeCount ?? 0,
    lists: { works, patterns },
    confirmedAt: build.lastConfirmedAt,
    publishedAt: build.publishedAt,
  };
}

/** "2d ago", "just now": a short age as the Table writes it. */
const agoWords = (ago: string): string => (ago === "now" ? "just now" : ago ? `${ago} ago` : "");

/** The live columns: the board's, less Steps and Sessions, which wait for the stored counts. */
export const LIVE_COLUMNS: readonly ColumnId[] = ["build", "built", "field", "tools", "reproductions", "confirmed", "runs", "rebuilds", "open", "cost"];

/** SV-23 P1: Steps and Sessions join once the list carries the stored counts. */
export function columnsFor(countsLive: boolean): readonly ColumnId[] {
  return countsLive ? ["build", "built", "field", "tools", "steps", "sessions", "reproductions", "confirmed", "runs", "rebuilds", "open", "cost"] : LIVE_COLUMNS;
}

/* ── the columns the reader chose (SV-24 P2) ── */

/** The columns the chooser offers: all 28, less Steps, Sessions and Works on model until the list carries the stored counts. */
export function availableColumns(countsLive: boolean): ColumnId[] {
  return ALL_COLUMNS.filter((id) => countsLive || (id !== "steps" && id !== "sessions" && id !== "works"));
}

/** The columns the reader chose: the default twelve, or the ones the reader kept in the reader's order (BF-13), Build first
    whatever was saved, and never one that is not live. */
export function chosenColumns(saved: readonly string[] | null, countsLive: boolean): ColumnId[] {
  if (saved === null) return [...columnsFor(countsLive)];
  const offered = new Set<string>(availableColumns(countsLive));
  return ["build", ...[...new Set(saved)].filter((id): id is ColumnId => id !== "build" && offered.has(id))];
}

/** BF-13 (C6): a column moved one place left or right among the reader's columns. Build never moves, and nothing moves before it. */
export function movedColumn(chosen: readonly ColumnId[], id: ColumnId, direction: "left" | "right"): ColumnId[] {
  const at = chosen.indexOf(id);
  const to = direction === "left" ? at - 1 : at + 1;
  if (id === "build" || at < 1 || to < 1 || to >= chosen.length) return [...chosen];
  const next = [...chosen];
  [next[at], next[to]] = [next[to], next[at]];
  return next;
}

/** BF-13 (C6): a column dropped at an index among the reader's columns (counted without it), never before Build. */
export function placedColumn(chosen: readonly ColumnId[], id: ColumnId, index: number): ColumnId[] {
  if (id === "build" || !chosen.includes(id)) return [...chosen];
  const rest = chosen.filter((entry) => entry !== id);
  const at = Math.max(1, Math.min(index, rest.length));
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}

/* ── BF-11 (B1): a filter that holds a value draws its column, worked out from the address on every render, never stored ── */

/** The column each filter's value is shown in. */
export const FILTER_COLUMN: Record<string, ColumnId> = {
  ...Object.fromEntries(PANEL_FACETS.map((facet) => [facet, facet as ColumnId])),
  stack: "tools",
  reproductions: "reproductions",
  rebuilds: "rebuilds",
  likes: "likes",
  steps: "steps",
  sessions: "sessions",
  model: "works",
  within: "confirmed",
  state: "confirmed",
  shape: "shape",
  pattern: "patterns",
  open: "open",
};

/** One id per filter that holds a value, from the parameters `activeChips` reads, the search left out. */
export function activeFilterIds(params: GalleryParams): string[] {
  const ids: string[] = (params.facets ?? []).map((key) => key.slice(0, key.indexOf(":")));
  if (params.tool) ids.push("stack");
  if ((params.shapes ?? []).length > 0) ids.push("shape");
  if (params.pattern) ids.push("pattern");
  if (params.open) ids.push("open");
  if (params.model) ids.push("model");
  if (params.within !== undefined) ids.push("within");
  if (params.state) ids.push("state");
  for (const key of RANGE_KEYS) if (params.ranges?.[key]) ids.push(key);
  return [...new Set(ids)];
}

/** The columns of the filters that hold a value. */
export function filteredColumns(params: GalleryParams): ColumnId[] {
  return [...new Set(activeFilterIds(params).flatMap((id) => (FILTER_COLUMN[id] ? [FILTER_COLUMN[id]] : [])))];
}

/** The columns drawn: the reader's own, then, with the setting on, each filtered column that is available and not already
    there, in the table's own order (and the sorted column, BF-12). */
export function drawnColumns(chosen: readonly ColumnId[], filtered: readonly ColumnId[], on: boolean, countsLive: boolean, sorted: readonly ColumnId[] = []): ColumnId[] {
  /* BF-12: the column the database sorts by is drawn by the same rule (Published with Newest), whatever the setting. */
  const added = new Set([...(on ? filtered : []), ...sorted].filter((id) => !chosen.includes(id)));
  return [...chosen, ...availableColumns(countsLive).filter((id) => added.has(id))];
}

/** "12 of 24". */
export const columnsLabel = (chosen: readonly ColumnId[], countsLive: boolean): string => `${chosen.length} of ${availableColumns(countsLive).length}`;

/** BF-10 (C9): the chooser's groups, the dialog's four after Identity, each in the order it lists its columns. */
export type ColumnGroup = "Identity" | "Classification" | "Proof" | "Structure" | "OpenBuilds";
const COLUMN_GROUPS: readonly (readonly [ColumnGroup, readonly ColumnId[]])[] = [
  ["Identity", ["build", "published"]],
  ["Classification", ["built", "field", "tools", "cost", "task", "setting", "role", "technique", "modality", "method", "autonomy", "data", "oversight", "age", "skill"]],
  ["Proof", ["reproductions", "works", "confirmed", "runs", "rebuilds", "likes"]],
  ["Structure", ["shape", "steps", "sessions", "patterns"]],
  ["OpenBuilds", ["open"]],
];
export const COLUMN_GROUP = Object.fromEntries(COLUMN_GROUPS.flatMap(([group, ids]) => ids.map((id) => [id, group]))) as Record<ColumnId, ColumnGroup>;

/** The chooser's checklist: the reader's columns first, in their order, under "Shown, in order" (BF-13, each but Build with its
    Move buttons), then the rest by group. BF-11 (B1): a column drawn only because a filter holds a value is on and locked, and
    says so. */
export const SHOWN_GROUP = "Shown, in order";
export function columnsMenu(chosen: readonly ColumnId[], countsLive: boolean, onToggle: (id: ColumnId) => void, onReset?: () => void, fromFilters: readonly ColumnId[] = [], onMove?: (id: ColumnId, direction: "left" | "right") => void): ColumnsMenu {
  const offered = new Set(availableColumns(countsLive));
  const shown = chosen.filter((id) => offered.has(id)).map((id) => ({ id, name: COLUMN_NAME[id], group: SHOWN_GROUP, on: true, ...(id === "build" ? { locked: true } : { movable: true }) }));
  const rest = COLUMN_GROUPS.flatMap(([group, ids]) =>
    ids
      .filter((id) => offered.has(id) && !chosen.includes(id))
      .map((id) => {
        const fromFilter = fromFilters.includes(id);
        return { id, name: COLUMN_NAME[id], group, on: fromFilter, ...(fromFilter ? { locked: true, fromFilter } : null) };
      }),
  );
  const options = [...shown, ...rest];
  return { options, onToggle, onReset, onMove };
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
  likes: (row) => row.likes ?? null,
};

const WORDS: Partial<Record<ColumnId, (row: TableRowView) => string[]>> = {
  built: (row) => [row.built],
  field: (row) => [row.field],
  tools: (row) => row.tools.map((tool) => tool.name),
  cost: (row) => [row.cost],
  ...Object.fromEntries((["shape", "task", "setting", "role", "technique", "modality", "method", "autonomy", "data", "oversight", "age", "skill"] as const).map((id) => [id, (row: TableRowView) => [row.extra?.[id] ?? ""]])),
  /* BF-10: a list's own values, not the joined cell. */
  works: (row) => [...(row.lists?.works ?? [])],
  patterns: (row) => [...(row.lists?.patterns ?? [])],
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
      return { key: `${calculation.column}:${calculation.kind}`, column: calculation.column as ColumnId, text: `${text} ${calculate(calculation, rows) ?? "–"}`, onRemove: () => onRemove(calculation) };
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

/** The footer: the count, and one value under each column that has one: the most common Field and Tools on the page, the
    median steps and the reproductions on the page (BF-13: by column, so each moves with its column). */
export function tableFooter(total: number | null, rows: readonly TableRowView[]): TableFooterView {
  const median = medianOf(rows.flatMap((row) => (row.steps === null ? [] : [row.steps])));
  const field = mostCommon(rows.map((row) => row.field));
  const tools = mostCommon(rows.flatMap((row) => row.tools.map((tool) => tool.name)));
  const count = total ?? rows.length;
  return {
    count: `${count} ${count === 1 ? "build" : "builds"}`,
    byColumn: {
      ...(field ? { field } : null),
      ...(tools ? { tools } : null),
      ...(median === null ? null : { steps: `Median ${median}` }),
      reproductions: `Total ${rows.reduce((sum, row) => sum + row.reproductions, 0)}`,
    },
  };
}

/* ── the head and the lenses ── */

export const LENS_LABEL: Record<GalleryLens, string> = { all: "All", proven: "Reproduced", rebuilt: "Rebuilt", unsolved: "Still open" };

/* ── BF-12 (B3, B5): sorting ── */

/** The six orderings the database can do, by the column whose head chooses them. Every other column sorts in the browser,
    and only when every matching build is loaded. */
export const SERVER_SORT: Partial<Record<ColumnId, GalleryFeedSort>> = { reproductions: "reproduced", confirmed: "confirmed", rebuilds: "rebuilt", steps: "steps", sessions: "sessions", published: "newest" };

/** The column each sort draws its arrow on: SERVER_SORT's inverse. */
export const SORT_COLUMN = Object.fromEntries(Object.entries(SERVER_SORT).map(([column, sort]) => [sort, column])) as Partial<Record<GalleryFeedSort, ColumnId>>;

const time = (value: string | null | undefined): number | null => {
  const at = value ? Date.parse(value) : NaN;
  return Number.isNaN(at) ? null : at;
};

/** A scale's place in the taxonomy, from its label; unknown labels are empty. */
const scalePlace = (facet: Facet, label: string | undefined): number | null => {
  const at = label ? TAXONOMY[facet].findIndex((value) => value.label === label) : -1;
  return at < 0 ? null : at;
};

/** One sort key per column: a number, a word, or null for an empty value. */
function sortKey(row: TableRowView, column: ColumnId): number | string | null {
  const word = (value: string | undefined) => (value ? value : null);
  switch (column) {
    case "build":
      return row.title;
    case "steps":
      return row.steps;
    case "sessions":
      return row.sessions;
    case "reproductions":
      return row.reproductions;
    case "rebuilds":
      return row.rebuilds;
    case "likes":
      return row.likes ?? null;
    case "confirmed":
      return time(row.confirmedAt);
    case "published":
      return time(row.publishedAt);
    case "runs":
      return row.runs.reduce((sum, value) => sum + value, 0);
    case "tools":
      return word(row.tools[0]?.name);
    case "open":
      return row.open ? Number.parseInt(row.open, 10) || 0 : null;
    case "cost":
      return scalePlace("cost", row.cost);
    case "autonomy":
    case "age":
    case "skill":
      return scalePlace(column, row.extra?.[column]);
    case "built":
      return word(row.built);
    case "field":
      return word(row.field);
    default:
      return word(row.extra?.[column]);
  }
}

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

/** Two keys compared in a direction, an empty value last whichever way. */
function compareKeys(a: number | string | null, b: number | string | null, ascending: boolean): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  const order = typeof a === "number" && typeof b === "number" ? a - b : collator.compare(String(a), String(b));
  return ascending ? order : -order;
}

/** The rows sorted by a column (and a second to break its ties), each in its own direction. Pure and stable: a new array, equal
    keys in the order they came. */
export function sortRows(rows: readonly TableRowView[], by: ColumnId, ascending: boolean, by2?: ColumnId, ascending2 = false): TableRowView[] {
  return rows
    .map((row, at) => ({ row, at }))
    .sort((a, b) => compareKeys(sortKey(a.row, by), sortKey(b.row, by), ascending) || (by2 ? compareKeys(sortKey(a.row, by2), sortKey(b.row, by2), ascending2) : 0) || a.at - b.at)
    .map((entry) => entry.row);
}

/** The column the database sort draws its arrow on. */
export const serverSortColumn = (params: GalleryParams): ColumnId | undefined => SORT_COLUMN[params.sort ?? DEFAULT_GALLERY_SORT];

/** The first press on a column: a database column sorts there (descending, any browser keys cleared); any other column becomes
    the browser's key over the database's sort. */
export function firstSortStep(params: GalleryParams, column: ColumnId): GalleryParams {
  const server = SERVER_SORT[column];
  if (server) return { ...params, sort: server === DEFAULT_GALLERY_SORT ? undefined : server, dir: undefined, by: undefined, by2: undefined, dir2: undefined };
  return { ...params, by: column, dir: undefined, by2: undefined, dir2: undefined };
}

/** What a press on a head does. A plain press cycles its column: sorted, then ascending, then back (the default sort's column has
    two steps, so it only flips). A column the database cannot sort is offered only with everything loaded. `second` (Shift)
    cycles the second key the same way, only with everything loaded. */
export function nextSort(params: GalleryParams, column: ColumnId, allLoaded: boolean, second = false): GalleryParams {
  const server = SERVER_SORT[column];
  if (second) {
    const first = params.by ?? serverSortColumn(params);
    if (!allLoaded || !first || first === column) return params;
    /* by2 needs a by: a second key over the database's sort names the sort's own column as the first. */
    if (params.by2 !== column) return { ...params, by: first, by2: column, dir2: undefined };
    if (params.dir2 !== "asc") return { ...params, dir2: "asc" };
    return { ...params, by2: undefined, dir2: undefined };
  }
  const cleared = { ...params, by2: undefined, dir2: undefined };
  if (server) {
    const current = (!params.by || params.by === column) && (params.sort ?? DEFAULT_GALLERY_SORT) === server;
    if (!current) return firstSortStep(params, column);
    if (params.dir !== "asc") return { ...cleared, by: undefined, dir: "asc" };
    return server === DEFAULT_GALLERY_SORT ? { ...cleared, by: undefined, dir: undefined } : { ...cleared, by: undefined, sort: undefined, dir: undefined };
  }
  if (!allLoaded) return params;
  if (params.by !== column) return firstSortStep(params, column);
  if (params.dir !== "asc") return { ...cleared, dir: "asc" };
  return { ...cleared, by: undefined, dir: undefined };
}
