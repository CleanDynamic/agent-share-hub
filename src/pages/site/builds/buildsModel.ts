/* SV-11: Builds' words and shapes, pure: what the list is asked for, and how a row, a filter and the head are put. */

import type { FigurePart } from "@/components/vision/PageFigure";
import { BUILDS_TABLE_PAGE_SIZE, GALLERY_SHAPES, type BuildsTableBuild, type BuildsTableOptions, type BuildsTablePage, type GalleryFeedSort, type GalleryLens, type GalleryStats } from "@/lib/build/gallery";
import { DEFAULT_GALLERY_SORT, type GalleryParams } from "@/lib/build/galleryParams";
import { PATTERN_LABEL, type Pattern } from "@/lib/build/patterns";
import { STALE_AFTER_DAYS, isStale } from "@/lib/build/signals";
import { shownValues } from "@/lib/classify/facets";
import { labelFor } from "@/lib/classify/lines";
import { FACET_LABEL, TAXONOMY, valueOf, type Facet } from "@/lib/classify/taxonomy";
import { modelLabel } from "@/lib/models/registry";
import { toolFor } from "@/lib/tools/registry";
import { shortAgo } from "@/pages/site/home/homeModel";

import type { CatalogueGroup, FilterSection, WordOption, WordOrder } from "./BuildsFiltersView";
import type { ColumnId, TableChip, TableFooterView, TableRowView, TableTool } from "./BuildsTableView";

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
  const shapeOpen = isOpen("shape", state.shapes.length > 0);
  sections.push(
    shapeOpen
      ? { kind: "word", id: "shape", name: "Shape", order: "az", options: GALLERY_SHAPES.map((shape) => ({ key: shape, label: shapeWord(shape), count: 0, checked: state.shapes.includes(shape) })) }
      : { kind: "closed", id: "shape", name: "Shape", value: state.shapes.length === 1 ? shapeWord(state.shapes[0]) : state.shapes.length > 1 ? `${state.shapes.length} chosen` : "Any" },
  );
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
export function liveCatalogue(classified: boolean, patterns: boolean): CatalogueGroup[] {
  const groups: CatalogueGroup[] = [];
  if (classified) {
    const names = [...PANEL_FACETS.slice(0, 9), "stack" as Facet, ...PANEL_FACETS.slice(9)].map((facet) => FACET_LABEL[facet]);
    groups.push({ name: "Classification", count: names.length, items: names.join(", ") });
  }
  const structure = ["Shape", ...(patterns ? ["Patterns"] : [])];
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
  return params;
}

/** The address with a panel value toggled. */
export function toggled(params: GalleryParams, sectionId: string, key: string): GalleryParams {
  const flip = (list: readonly string[]) => (list.includes(key) ? list.filter((entry) => entry !== key) : [...list, key]);
  if (sectionId === "shape") return { ...params, shapes: flip(params.shapes ?? []) };
  if (sectionId === "pattern") return { ...params, pattern: params.pattern === key ? undefined : (key as Pattern) };
  if (sectionId === "open") return { ...params, open: params.open ? undefined : true };
  return { ...params, facets: flip(params.facets ?? []) };
}

/** How many values the filters hold, for "n active". */
export const activeCount = (params: GalleryParams): number => activeChips(params).filter((chip) => chip.key !== "q").length;

/* ── the rows ── */

/** A build as a row of the Table. */
export function tableRow(build: BuildsTableBuild, now: number): TableRowView {
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
    steps: null,
    sessions: null,
    reproductions: build.reproductionCount,
    lit: build.reproductionCount > 0 && !isStale({ last_confirmed_at: build.lastConfirmedAt, published_at: build.publishedAt }, now),
    confirmed: ago ? `${ago === "now" ? "just now" : `${ago} ago`}${model ? ` on ${model}` : ""}` : "",
    runs: [],
    rebuilds: build.rebuildCount,
    open: build.open.count === 0 ? "" : `${build.open.count} open${build.open.reward ? ` · £${build.open.reward}` : ""}`,
    cost: first("cost"),
  };
}

/** The live columns: the board's, less those whose data does not exist yet (Steps, Sessions, Runs: SV-23). */
export const LIVE_COLUMNS: readonly ColumnId[] = ["build", "built", "field", "tools", "reproductions", "confirmed", "rebuilds", "open", "cost"];

/** The most common value among the rows, or null. */
function mostCommon(values: readonly string[]): string | null {
  const counts = new Map<string, number>();
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: string | null = null;
  for (const [value, count] of counts) if (best === null || count > (counts.get(best) ?? 0)) best = value;
  return best;
}

/** The footer: the count, the most common Field and Tools on the page, and the reproductions on the page. */
export function tableFooter(total: number | null, rows: readonly TableRowView[]): TableFooterView {
  const common = [mostCommon(rows.map((row) => row.field)), mostCommon(rows.flatMap((row) => row.tools.map((tool) => tool.name)))].filter(Boolean);
  const count = total ?? rows.length;
  return {
    count: `${count} ${count === 1 ? "build" : "builds"}`,
    mostCommon: common.length > 0 ? `Most common · ${common.join(", ")}` : undefined,
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

/** "Of 120 published · 214 reproductions this week · 78% confirmed in the last 120 days". */
export function statParts(stats: GalleryStats): FigurePart[] {
  const runs = stats.reproducedThisWeek;
  return [
    { text: `Of ${stats.inGallery} published` },
    { text: `${runs} ${runs === 1 ? "reproduction" : "reproductions"}`, tone: "evidence" },
    { text: "this week" },
    { text: `${stats.freshPct}% confirmed in the last ${STALE_AFTER_DAYS} days` },
  ];
}
