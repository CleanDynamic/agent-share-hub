/* CA-16 P7: the build page's Classification section: a provenance dot on every value, and the Regulated area notice. Nothing
   at all for a build that has no classification (P9): old builds read exactly as before. UX-03 P4: two groups by provenance,
   each facet a label over its values in a grid, where it was three lines of text. */

import type { CSSProperties, ReactNode } from "react";

import { PROVENANCE_WORDS, ProvenanceDot } from "@/components/classify/ClassificationBits";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { hasClassification, regulatedArea, shownValues } from "@/lib/classify/facets";
import { REGULATED_NOTICE, labelFor } from "@/lib/classify/lines";
import { FACET_LABEL, type Facet } from "@/lib/classify/taxonomy";
import { isCustomEntry, type Classification, type Entry, type Provenance } from "@/lib/classify/types";
import { useInRouterContext } from "react-router-dom";
import { galleryHref, cleanFacetKeys } from "@/lib/build/galleryParams";
import { PageLink } from "@/lib/routing/PageLink";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

interface Shown {
  label: string;
  provenance: Provenance;
  /** `<facet>:<id>`, the Builds filter for this value. Absent for a value the maker typed. */
  key?: string;
}

const declared = (facet: Facet, entries: readonly Entry[]): Shown[] => entries.map((entry) => ({ label: isCustomEntry(entry) ? entry.custom : labelFor(facet, entry.id), provenance: "stated", ...(isCustomEntry(entry) ? null : { key: `${facet}:${entry.id}` }) }));

const read = (c: Classification, facet: Facet): Shown[] => {
  const shown = shownValues(c, facet);
  return shown.values.map((id) => ({ label: labelFor(facet, id), provenance: shown.provenance, key: `${facet}:${id}` }));
};

/** The three lines of the section, each a list of facets with their values. */
export function classificationRows(c: Classification): { key: string; facet: Facet; values: Shown[] }[][] {
  const decl = (facet: "field" | "task" | "setting" | "data" | "stack"): Shown[] => declared(facet, c.declared[facet]);
  const age: Shown[] = c.declared.age ? [{ label: labelFor("age", c.declared.age), provenance: "stated", key: `age:${c.declared.age}` }] : [];
  const stack = [...read(c, "stack"), ...decl("stack").filter((value) => !read(c, "stack").some((have) => have.label.toLowerCase() === value.label.toLowerCase()))];
  return [
    [
      { key: "field", facet: "field", values: decl("field") },
      { key: "task", facet: "task", values: decl("task") },
      { key: "setting", facet: "setting", values: decl("setting") },
    ],
    [
      { key: "built", facet: "built", values: read(c, "built") },
      { key: "role", facet: "role", values: read(c, "role") },
      { key: "technique", facet: "technique", values: read(c, "technique") },
      { key: "modality", facet: "modality", values: read(c, "modality") },
      { key: "method", facet: "method", values: read(c, "method") },
      { key: "autonomy", facet: "autonomy", values: read(c, "autonomy") },
      { key: "stack", facet: "stack", values: stack },
    ],
    [
      { key: "data", facet: "data", values: decl("data") },
      { key: "age", facet: "age", values: age },
      { key: "oversight", facet: "oversight", values: read(c, "oversight") },
      { key: "skill", facet: "skill", values: read(c, "skill") },
      { key: "cost", facet: "cost", values: read(c, "cost") },
    ],
  ];
}

/** Facets a maker sets themselves. UX-03 P4: when one is empty the maker, on their own build, sees Not stated; a reader never does. */
const MAKER_SET: readonly Facet[] = ["field", "task", "setting", "data", "age"];

/** UX-03 P4: the two groups, by where a value came from, the maker's first. */
type GroupKind = "stated" | "derived";
const GROUP_TITLE: Record<GroupKind, string> = { stated: PROVENANCE_WORDS.reader.stated, derived: "Derived from the build" };
/** Where the maker fills in what they left empty. */
export const OPEN_CLASSIFICATION = "Open Classification";

/** One group's facets, in the section's order, each with only the values of that provenance. The maker's group keeps an empty facet they set. */
function groupFacets(c: Classification, kind: GroupKind, withEmpty: boolean): { facet: Facet; values: Shown[] }[] {
  return classificationRows(c)
    .flat()
    .flatMap((entry) => {
      const values = entry.values.filter((value) => value.provenance === kind);
      if (values.length > 0) return [{ facet: entry.facet, values }];
      // Not stated: a facet the maker sets that holds nothing at all, in the maker's own view.
      return withEmpty && kind === "stated" && MAKER_SET.includes(entry.facet) && entry.values.length === 0 ? [{ facet: entry.facet, values }] : [];
    });
}

const facetStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 4, minWidth: 0, margin: 0 };

function Facet_({ facet, values }: { facet: Facet; values: Shown[] }) {
  const empty = values.length === 0;
  return (
    <div data-facet={facet} style={facetStyle}>
      <span style={{ fontFamily: FIGTREE, fontSize: 12, lineHeight: 1.4, color: t.label }}>{FACET_LABEL[facet]}</span>
      <span style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", minWidth: 0, fontFamily: FIGTREE, fontSize: 12.5, lineHeight: 1.5 }}>
        {empty ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: t.label }}>
            <ProvenanceDot kind="none" />
            Not stated
          </span>
        ) : (
          values.map((value, index) => (
            <span key={`${value.label}-${index}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: t.text, minWidth: 0, overflowWrap: "anywhere", fontFamily: facet === "stack" ? DM_MONO : undefined }}>
              <ProvenanceDot kind={value.provenance} />
              <ValueLabel value={value} />
            </span>
          ))
        )}
      </span>
    </div>
  );
}

function Group({ kind, facets, phone, editHref }: { kind: GroupKind; facets: { facet: Facet; values: Shown[] }[]; phone: boolean; editHref?: string }) {
  const title = GROUP_TITLE[kind];
  return (
    <div role="group" aria-label={title} data-testid={`classification-${kind}`} style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <h3 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 12.5, fontWeight: 500, lineHeight: 1.4, color: t.text2 }}>{title}</h3>
      <div data-testid="classification-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${phone ? 2 : 4}, minmax(0, 1fr))`, gap: "12px 24px" }}>
        {facets.map((entry) => (
          <Facet_ key={entry.facet} facet={entry.facet} values={entry.values} />
        ))}
      </div>
      {editHref ? (
        <PageLink to={editHref} data-testid="classification-open" style={{ alignSelf: "flex-start", fontFamily: FIGTREE, fontSize: 12.5, color: t.text2, textDecoration: "underline", textUnderlineOffset: 3, textDecorationColor: t.line }}>
          {OPEN_CLASSIFICATION}
        </PageLink>
      ) : null}
    </div>
  );
}

/** SV-25: a value is a link to Builds filtered by it, when the Builds filter knows it. */
function ValueLabel({ value }: { value: Shown }) {
  const inRouter = useInRouterContext();
  const known = inRouter && value.key && cleanFacetKeys([value.key]).length > 0;
  if (!known) return <>{value.label}</>;
  return (
    <PageLink to={galleryHref({ facets: [value.key as string] })} data-testid="classification-link" style={{ color: "inherit", textDecoration: "none" }}>
      {value.label}
    </PageLink>
  );
}

/**
 * UX-03 P4: two groups, by provenance: Stated by the maker, then Derived from the build. A group with no values is not drawn,
 * and a reader never sees Not stated. `maker`: the build is the viewer's own, so the empty facets they set say Not stated, with
 * the way to the Classification window.
 */
export function ClassificationSection({ classification, maker }: { classification: Classification | null | undefined; maker?: { editHref: string } }): ReactNode {
  const phone = useIsPhone();
  if (!classification || !hasClassification(classification)) return null;
  const stated = groupFacets(classification, "stated", Boolean(maker));
  const derived = groupFacets(classification, "derived", false);
  const missing = Boolean(maker) && stated.some((entry) => entry.values.length === 0);
  return (
    <section aria-label="Classification" data-testid="build-classification" style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
      <h2 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13.5, fontWeight: 500, color: t.text }}>Classification</h2>
      {stated.length > 0 ? <Group kind="stated" facets={stated} phone={phone} editHref={missing ? maker?.editHref : undefined} /> : null}
      {derived.length > 0 ? <Group kind="derived" facets={derived} phone={phone} /> : null}
      {regulatedArea(classification) ? (
        <p role="note" data-testid="regulated-notice" style={{ margin: 0, fontFamily: FIGTREE, fontSize: 12.5, lineHeight: 1.5, color: t.text2 }}>
          {REGULATED_NOTICE}
        </p>
      ) : null}
    </section>
  );
}
