/* CA-16 and CA-16b: the Gallery's classification filters, drawn as the "Gallery with filters" board draws them.

   FIVE GROUPS in this order: Field, Task, What was built, Tools and stack, then More filters. The first four start open,
   More filters starts closed and, closed, names the groups it holds ("Setting · Role of AI · Techniques · ..."); open, each
   becomes a group of its own. Groups are split by `--hairline` rules and padded 10 0; the first has no rule and no top
   padding. A group's head is its name at 13/500 and a 14 chevron in `--label` that turns over when open.

   OPTIONS are rows padded 5 0, 13 `--text2`: the brand Checkbox at 14 (a 1px dashed edge when empty), the value, then its
   count at the right in the data face 11 `--label`. A value with no builds is hidden (a chosen one stays, so it can be turned
   off). Each group shows its top 6 and then a text link, 12.5 `--text2`, underlined: "Show all fields", "Show all tasks",
   "Show all", and for Tools and stack "Search tools", which opens its search box. Field, Task and Setting values that have
   children show a small chevron that opens them in place.

   Choosing values is an OR within a facet and an AND across facets; this only says which keys are chosen and the page
   writes the address. The two quick filters are `QuickFilters`, which the Gallery's heading row carries. */

import { useId, useMemo, useState, type CSSProperties } from "react";

import { Checkbox } from "@/components/brand/Checkbox";
import { Glyph } from "@/components/brand/Glyph";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";
import { FACET_LABEL, STACK_VALUES, TAXONOMY, type Facet, type TaxonomyValue } from "@/lib/classify/taxonomy";

export const TOP_VALUES = 6;

export const QUICK_CHIPS: readonly { key: string; label: string }[] = [
  { key: "skill:no-coding", label: "No coding" },
  { key: "cost:free-plans-are-enough", label: "Free plans are enough" },
];

const DASH_EDGE = t.segOnBorder;
const SEG_ON_BORDER = t.segOnBorder;

/** The facets of the first four groups, and what the "Show all" link says. */
const MAIN: readonly { facet: Facet; tree?: boolean; search?: boolean; more: string }[] = [
  { facet: "field", tree: true, more: "Show all fields" },
  { facet: "task", tree: true, more: "Show all tasks" },
  { facet: "built", more: "Show all" },
  { facet: "stack", search: true, more: "Search tools" },
];

const MORE: readonly { facet: Facet; tree?: boolean }[] = [
  { facet: "setting", tree: true },
  { facet: "role" },
  { facet: "technique" },
  { facet: "modality" },
  { facet: "method" },
  { facet: "autonomy" },
  { facet: "data" },
  { facet: "skill" },
  { facet: "cost" },
  { facet: "age" },
];

/** What closed More filters says it holds. */
export const MORE_FILTERS_LINE = MORE.map((group) => FACET_LABEL[group.facet]).join(" · ");

export type FacetCounts = Readonly<Record<string, number>>;

export const keyOf = (facet: Facet, id: string): string => `${facet}:${id}`;
export const countOf = (counts: FacetCounts, facet: Facet, id: string): number => counts[keyOf(facet, id)] ?? 0;

const childrenOf = (facet: Facet, id: string): TaxonomyValue[] => TAXONOMY[facet].filter((value) => value.parent === id);
const rootsOf = (facet: Facet): TaxonomyValue[] => TAXONOMY[facet].filter((value) => value.parent === null);

/** Whether a value, or anything under it, is chosen. */
function holdsSelection(facet: Facet, id: string, selected: ReadonlySet<string>): boolean {
  return selected.has(keyOf(facet, id)) || childrenOf(facet, id).some((child) => holdsSelection(facet, child.id, selected));
}

/** The values to draw: the ones with builds (or chosen), most first, at most `limit` unless all are asked for, chosen ones always. */
export function visibleValues(values: readonly TaxonomyValue[], counts: FacetCounts, selected: ReadonlySet<string>, showAll: boolean, limit = TOP_VALUES): TaxonomyValue[] {
  const ranked = values
    .filter((value) => countOf(counts, value.facet, value.id) > 0 || holdsSelection(value.facet, value.id, selected))
    .sort((a, b) => countOf(counts, b.facet, b.id) - countOf(counts, a.facet, a.id) || a.label.localeCompare(b.label));
  if (showAll || ranked.length <= limit) return ranked;
  const top = ranked.slice(0, limit);
  const kept = ranked.slice(limit).filter((value) => holdsSelection(value.facet, value.id, selected));
  return [...top, ...kept];
}

const link: CSSProperties = { border: 0, background: "transparent", cursor: "pointer", padding: 0, fontFamily: FIGTREE, fontSize: 12.5, color: t.text2, textDecoration: "underline", textUnderlineOffset: 3, textAlign: "left" };

/** A text link under a group: 4 below it, 12.5 `--text2`, underlined. */
function TextLink({ children, onClick, expanded, name, phone }: { children: string; onClick: () => void; expanded?: boolean; name?: string; phone: boolean }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button type="button" aria-expanded={expanded} aria-label={name} onClick={onClick} {...handlers} style={{ ...link, alignSelf: "flex-start", marginTop: 4, minHeight: phone ? 44 : undefined, borderRadius: 4, ...ring(state.focusVisible) }}>
      {children}
    </button>
  );
}

function Option({ value, counts, selected, onToggle, phone, trailing }: { value: TaxonomyValue; counts: FacetCounts; selected: ReadonlySet<string>; onToggle: (key: string) => void; phone: boolean; trailing?: React.ReactNode }) {
  const key = keyOf(value.facet, value.id);
  const on = selected.has(key);
  const [hover, setHover] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <label
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ display: "flex", alignItems: "center", gap: 10, flexGrow: 1, minWidth: 0, padding: phone ? "11px 0" : "5px 0", cursor: "pointer", fontFamily: FIGTREE, fontSize: 13, lineHeight: "normal", color: hover || on ? t.text : t.text2 }}
      >
        <Checkbox
          checked={on}
          label={value.label}
          onChange={() => onToggle(key)}
          style={{ width: 14, height: 14, borderRadius: 4, ...(on ? null : { background: "transparent", boxShadow: "none", borderWidth: 1, borderStyle: "solid", borderColor: DASH_EDGE }) }}
        />
        <span style={{ flexGrow: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value.label}</span>
        <span style={{ fontFamily: DM_MONO, fontSize: 11, color: t.label, fontVariantNumeric: "tabular-nums" }}>{countOf(counts, value.facet, value.id)}</span>
      </label>
      {trailing}
    </div>
  );
}

function Node({ value, counts, selected, onToggle, phone, depth }: { value: TaxonomyValue; counts: FacetCounts; selected: ReadonlySet<string>; onToggle: (key: string) => void; phone: boolean; depth: number }) {
  const children = visibleValues(childrenOf(value.facet, value.id), counts, selected, true);
  const [open, setOpen] = useState(() => children.length > 0 && holdsSelection(value.facet, value.id, selected) && !selected.has(keyOf(value.facet, value.id)));
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <Option
        value={value}
        counts={counts}
        selected={selected}
        onToggle={onToggle}
        phone={phone}
        trailing={
          children.length > 0 ? (
            <button
              type="button"
              aria-expanded={open}
              aria-label={`${open ? "Hide" : "Show"} what is under ${value.label}`}
              onClick={() => setOpen((v) => !v)}
              {...handlers}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: phone ? 44 : 20, height: phone ? 44 : 20, flexShrink: 0, border: 0, background: "transparent", cursor: "pointer", borderRadius: 4, color: t.label, ...ring(state.focusVisible) }}
            >
              <Glyph name={open ? "up" : "chevd"} size={14} />
            </button>
          ) : null
        }
      />
      {open && children.length > 0 ? (
        <div role="group" aria-label={`Under ${value.label}`} style={{ display: "flex", flexDirection: "column", marginLeft: Math.min(depth + 1, 3) * 12 }}>
          {children.map((child) => (
            <Node key={child.id} value={child} counts={counts} selected={selected} onToggle={onToggle} phone={phone} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A group: its head (name and chevron) and, when open, its options. */
function Group({ facet, first, defaultOpen = true, more, tree, search, counts, selected, onToggle, phone }: { facet: Facet; first: boolean; defaultOpen?: boolean; more?: string; tree?: boolean; search?: boolean; counts: FacetCounts; selected: ReadonlySet<string>; onToggle: (key: string) => void; phone: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [all, setAll] = useState(false);
  const [searching, setSearching] = useState(false);
  const [needle, setNeedle] = useState("");
  const searchId = useId();
  const head = useInteractive<HTMLButtonElement>();
  const name = FACET_LABEL[facet];

  const pool = useMemo(() => {
    if (tree) return rootsOf(facet);
    if (facet === "stack") return STACK_VALUES.filter((value) => value.parent !== null);
    return [...TAXONOMY[facet]];
  }, [facet, tree]);

  const typed = needle.trim().toLowerCase();
  const matching = typed ? pool.filter((value) => [value.label, ...value.synonyms].some((word) => word.toLowerCase().includes(typed))) : pool;
  const everything = visibleValues(matching, counts, selected, true);
  const shown = typed ? everything : visibleValues(matching, counts, selected, all);
  const hidden = everything.length - shown.length;
  if (everything.length === 0 && !search) return null;

  return (
    <section aria-label={name} data-facet-group={facet} style={{ display: "flex", flexDirection: "column", minWidth: 0, padding: first ? "0 0 10px" : "10px 0", borderTop: first ? undefined : `1px solid ${t.hairline}` }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        {...head.handlers}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", minHeight: phone ? 44 : undefined, padding: "4px 0", border: 0, background: "transparent", cursor: "pointer", borderRadius: 4, fontFamily: FIGTREE, fontSize: 13, fontWeight: 500, color: t.text, ...ring(head.state.focusVisible) }}
      >
        <span>{name}</span>
        <span aria-hidden="true" style={{ display: "inline-flex", color: t.label }}>
          <Glyph name={open ? "up" : "chevd"} size={14} />
        </span>
      </button>
      {open ? (
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          {search && searching ? (
            <div style={{ padding: "4px 0 6px" }}>
              <label htmlFor={searchId} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                Search Tools and stack
              </label>
              <input
                id={searchId}
                type="search"
                role="searchbox"
                autoFocus
                value={needle}
                placeholder="Search Tools and stack"
                onChange={(event) => setNeedle(event.target.value)}
                style={{ width: "100%", boxSizing: "border-box", height: phone ? 44 : 30, padding: "0 10px", borderRadius: 6, background: t.well, border: `1px solid ${t.wellBorder}`, boxShadow: t.wellShadow, fontFamily: FIGTREE, fontSize: phone ? 16 : 13, color: t.text }}
              />
            </div>
          ) : null}
          {shown.map((value) => (tree ? <Node key={value.id} value={value} counts={counts} selected={selected} onToggle={onToggle} phone={phone} depth={0} /> : <Option key={value.id} value={value} counts={counts} selected={selected} onToggle={onToggle} phone={phone} />))}
          {search && typed && shown.length === 0 ? <p style={{ margin: "4px 0 0", fontFamily: FIGTREE, fontSize: 12, color: t.text2 }}>Nothing in Tools and stack matches that yet.</p> : null}
          {search && !searching ? (
            <TextLink phone={phone} onClick={() => setSearching(true)}>
              {more ?? "Search tools"}
            </TextLink>
          ) : null}
          {!search && !typed && (all || hidden > 0) ? (
            <TextLink phone={phone} expanded={all} name={all ? `Show fewer ${name}` : `${more ?? "Show all"} ${name}`} onClick={() => setAll((v) => !v)}>
              {all ? "Show fewer" : (more ?? "Show all")}
            </TextLink>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export interface ClassificationFiltersProps {
  counts: FacetCounts;
  selected: readonly string[];
  onToggle: (key: string) => void;
  phone: boolean;
}

/** The two quick filters: 30 tall, padding 0 12, radius 8, transparent, a 1px `--window-border`, 12.5 `--text2`. A chosen one is `--control-on` with a `--seg-on-border` edge and `--text`. */
export function QuickFilters({ selected, onToggle, phone = false }: { selected: readonly string[]; onToggle: (key: string) => void; phone?: boolean }) {
  return (
    <div role="group" aria-label="Quick filters" data-testid="quick-chips" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {QUICK_CHIPS.map((chip) => (
        <QuickFilter key={chip.key} label={chip.label} on={selected.includes(chip.key)} onClick={() => onToggle(chip.key)} phone={phone} />
      ))}
    </div>
  );
}

function QuickFilter({ label, on, onClick, phone }: { label: string; on: boolean; onClick: () => void; phone: boolean }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      {...handlers}
      style={{
        height: phone ? 44 : 30,
        padding: "0 12px",
        boxSizing: "border-box",
        borderRadius: 8,
        cursor: "pointer",
        fontFamily: FIGTREE,
        fontSize: 12.5,
        lineHeight: "normal",
        background: on ? t.controlOn : state.hovered ? t.tile : "transparent",
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: on ? SEG_ON_BORDER : t.windowBorder,
        color: on || state.hovered ? t.text : t.text2,
        ...ring(state.focusVisible),
      }}
    >
      {label}
    </button>
  );
}

/** Every key that is chosen, for the active-filter chips: its facet's name and the value's label. */
export function describeKey(key: string): string {
  const at = key.indexOf(":");
  const facet = key.slice(0, at) as Facet;
  const id = key.slice(at + 1);
  const value = TAXONOMY[facet]?.find((candidate) => candidate.id === id);
  return `${FACET_LABEL[facet] ?? facet}: ${value?.label ?? id}`;
}

export function ClassificationFilters({ counts, selected, onToggle, phone }: ClassificationFiltersProps) {
  const chosen = useMemo(() => new Set(selected), [selected]);
  const moreHasSelectionAtStart = MORE.some((group) => selected.some((key) => key.startsWith(`${group.facet}:`)));
  const [more, setMore] = useState(moreHasSelectionAtStart);
  const moreId = useId();
  const { state, handlers } = useInteractive<HTMLButtonElement>();

  return (
    <div data-testid="classification-filters" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      {MAIN.map((group, index) => (
        <Group key={group.facet} facet={group.facet} first={index === 0} more={group.more} tree={group.tree} search={group.search} counts={counts} selected={chosen} onToggle={onToggle} phone={phone} />
      ))}
      <section aria-label="More filters" style={{ display: "flex", flexDirection: "column", padding: "10px 0", borderTop: `1px solid ${t.hairline}` }}>
        <button
          type="button"
          aria-expanded={more}
          aria-controls={moreId}
          onClick={() => setMore((v) => !v)}
          {...handlers}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", minHeight: phone ? 44 : undefined, padding: "4px 0", border: 0, background: "transparent", cursor: "pointer", borderRadius: 4, fontFamily: FIGTREE, fontSize: 13, fontWeight: 500, color: t.text, ...ring(state.focusVisible) }}
        >
          <span>More filters</span>
          <span aria-hidden="true" style={{ display: "inline-flex", color: t.label }}>
            <Glyph name={more ? "up" : "chevd"} size={14} />
          </span>
        </button>
        {more ? (
          <div id={moreId} style={{ display: "flex", flexDirection: "column" }}>
            {MORE.map((group, index) => (
              <Group key={group.facet} facet={group.facet} first={index === 0} tree={group.tree} counts={counts} selected={chosen} onToggle={onToggle} phone={phone} />
            ))}
          </div>
        ) : (
          <p data-testid="more-filters-line" style={{ margin: "2px 0 0", fontFamily: FIGTREE, fontSize: 12.5, lineHeight: "20px", color: t.label }}>
            {MORE_FILTERS_LINE}
          </p>
        )}
      </section>
    </div>
  );
}
