/* CA-16 P6 — the Gallery's classification filters.

   IN THIS ORDER: Field (Areas and Domains with counts, each opening to its children), Task (groups, each opening to its
   tasks), What was built, Tools and stack (with its own search box). Then one closed group, More filters, holding Setting,
   Role of AI, Techniques, Modality, Build method, Autonomy, Data handled, Skill needed, Cost to run and Age suitability.
   Every value shows its count; a value with no builds is hidden (a chosen one stays, so it can be turned off); a group
   shows its top 6 and then "Show all". Two quick chips sit above: No coding, and Free plans are enough.

   Choosing values is an OR within a facet and an AND across facets; this component only says which keys are chosen and
   the page writes the address. It draws the refined `FilterChip` and the well, and nothing of its own colour. */

import { useId, useMemo, useState } from "react";

import { FilterChip } from "@/components/brand/FilterChip";
import { Glyph } from "@/components/brand/Glyph";
import { SearchField } from "@/components/brand/SearchField";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { FACET_LABEL, TAXONOMY, STACK_VALUES, type Facet, type TaxonomyValue } from "@/lib/classify/taxonomy";

export const TOP_VALUES = 6;

export const QUICK_CHIPS: readonly { key: string; label: string }[] = [
  { key: "skill:no-coding", label: "No coding" },
  { key: "cost:free-plans-are-enough", label: "Free plans are enough" },
];

const MAIN: readonly { facet: Facet; tree?: boolean; search?: boolean }[] = [
  { facet: "field", tree: true },
  { facet: "task", tree: true },
  { facet: "built" },
  { facet: "stack", search: true },
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

function ShowAll({ open, hidden, onToggle, name, phone }: { open: boolean; hidden: number; onToggle: () => void; name: string; phone: boolean }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  if (!open && hidden <= 0) return null;
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={`${open ? "Show fewer" : "Show all"} ${name}`}
      onClick={onToggle}
      {...handlers}
      style={{ alignSelf: "flex-start", border: 0, background: "transparent", cursor: "pointer", minHeight: phone ? 44 : 28, padding: "0 4px", borderRadius: 6, fontFamily: "inherit", fontSize: 12, color: t.text2, textDecoration: "underline", textUnderlineOffset: 3, ...ring(state.focusVisible) }}
    >
      {open ? "Show fewer" : "Show all"}
    </button>
  );
}

function ValueChip({ value, counts, selected, onToggle }: { value: TaxonomyValue; counts: FacetCounts; selected: ReadonlySet<string>; onToggle: (key: string) => void }) {
  const key = keyOf(value.facet, value.id);
  return <FilterChip label={value.label} count={countOf(counts, value.facet, value.id)} on={selected.has(key)} onClick={() => onToggle(key)} />;
}

function TreeNode({ value, counts, selected, onToggle, depth, phone }: { value: TaxonomyValue; counts: FacetCounts; selected: ReadonlySet<string>; onToggle: (key: string) => void; depth: number; phone: boolean }) {
  const [open, setOpen] = useState(() => holdsSelection(value.facet, value.id, selected) && !selected.has(keyOf(value.facet, value.id)));
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const children = visibleValues(childrenOf(value.facet, value.id), counts, selected, true);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
        <ValueChip value={value} counts={counts} selected={selected} onToggle={onToggle} />
        {children.length > 0 ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${open ? "Hide" : "Show"} what is under ${value.label}`}
            onClick={() => setOpen((v) => !v)}
            {...handlers}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: phone ? 44 : 28, minHeight: phone ? 44 : 28, border: 0, background: "transparent", cursor: "pointer", borderRadius: 6, color: t.label, ...ring(state.focusVisible) }}
          >
            <Glyph name={open ? "chevd" : "chev"} size={16} />
          </button>
        ) : null}
      </div>
      {open && children.length > 0 ? (
        <div role="group" aria-label={`Under ${value.label}`} style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: Math.min(depth + 1, 3) * 12, paddingLeft: 8, borderLeft: `1px solid ${t.hairlineModule}` }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {children
              .filter((child) => childrenOf(child.facet, child.id).length === 0)
              .map((child) => (
                <ValueChip key={child.id} value={child} counts={counts} selected={selected} onToggle={onToggle} />
              ))}
          </div>
          {children
            .filter((child) => childrenOf(child.facet, child.id).length > 0)
            .map((child) => (
              <TreeNode key={child.id} value={child} counts={counts} selected={selected} onToggle={onToggle} depth={depth + 1} phone={phone} />
            ))}
        </div>
      ) : null}
    </div>
  );
}

function FacetGroup({ facet, tree, search, counts, selected, onToggle, phone }: { facet: Facet; tree?: boolean; search?: boolean; counts: FacetCounts; selected: ReadonlySet<string>; onToggle: (key: string) => void; phone: boolean }) {
  const [all, setAll] = useState(false);
  const [needle, setNeedle] = useState("");
  const searchId = useId();
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
  if (everything.length === 0 && !search) return null;

  return (
    <section aria-label={name} data-facet-group={facet} style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <h3 style={{ margin: 0, fontFamily: "inherit", fontSize: 12.5, fontWeight: 500, color: t.text }}>{name}</h3>
      {search ? (
        <div>
          <label htmlFor={searchId} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            Search Tools and stack
          </label>
          <SearchField id={searchId} label="Search Tools and stack" placeholder="Search Tools and stack" width={240} value={needle} onChange={(event) => setNeedle(event.target.value)} />
        </div>
      ) : null}
      {tree ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {shown.map((value) => (
              <TreeNode key={value.id} value={value} counts={counts} selected={selected} onToggle={onToggle} depth={0} phone={phone} />
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {shown.map((value) => (
            <ValueChip key={value.id} value={value} counts={counts} selected={selected} onToggle={onToggle} />
          ))}
        </div>
      )}
      {search && typed && shown.length === 0 ? <p style={{ margin: 0, fontFamily: "inherit", fontSize: 12, color: t.text2 }}>Nothing in Tools and stack matches that yet.</p> : null}
      {typed ? null : <ShowAll open={all} hidden={everything.length - shown.length} onToggle={() => setAll((v) => !v)} name={name} phone={phone} />}
    </section>
  );
}

export interface ClassificationFiltersProps {
  counts: FacetCounts;
  selected: readonly string[];
  onToggle: (key: string) => void;
  phone: boolean;
}

/** Every key that is chosen, for the active-filter chips: its facet's name and the value's label. */
export function describeKey(key: string): string {
  const at = key.indexOf(":");
  const facet = key.slice(0, at) as Facet;
  const id = key.slice(at + 1);
  const value = TAXONOMY[facet]?.find((candidate) => candidate.id === id);
  return `${FACET_LABEL[facet] ?? facet}: ${value?.label ?? id}`;
}

/** The two quick chips above the grid: No coding, and Free plans are enough. Each is just a facet key, so it also shows in the active filters. */
export function QuickChips({ selected, onToggle }: { selected: readonly string[]; onToggle: (key: string) => void }) {
  return (
    <div role="group" aria-label="Quick filters" data-testid="quick-chips" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {QUICK_CHIPS.map((chip) => (
        <FilterChip key={chip.key} label={chip.label} on={selected.includes(chip.key)} onClick={() => onToggle(chip.key)} />
      ))}
    </div>
  );
}

export function ClassificationFilters({ counts, selected, onToggle, phone }: ClassificationFiltersProps) {
  const moreHasSelectionAtStart = MORE.some((group) => selected.some((key) => key.startsWith(`${group.facet}:`)));
  const [more, setMore] = useState(moreHasSelectionAtStart);
  const chosen = useMemo(() => new Set(selected), [selected]);
  const moreId = useId();
  const { state, handlers } = useInteractive<HTMLButtonElement>();

  return (
    <div data-testid="classification-filters" style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      {MAIN.map((group) => (
        <FacetGroup key={group.facet} facet={group.facet} tree={group.tree} search={group.search} counts={counts} selected={chosen} onToggle={onToggle} phone={phone} />
      ))}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button
          type="button"
          aria-expanded={more}
          aria-controls={moreId}
          onClick={() => setMore((v) => !v)}
          {...handlers}
          style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, minHeight: phone ? 44 : 32, padding: "0 4px", border: 0, background: "transparent", cursor: "pointer", borderRadius: 6, fontFamily: "inherit", fontSize: 13, fontWeight: 500, color: t.text, ...ring(state.focusVisible) }}
        >
          <Glyph name={more ? "chevd" : "chev"} size={16} color={t.label} />
          More filters
        </button>
        {more ? (
          <div id={moreId} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {MORE.map((group) => (
              <FacetGroup key={group.facet} facet={group.facet} tree={group.tree} counts={counts} selected={chosen} onToggle={onToggle} phone={phone} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

