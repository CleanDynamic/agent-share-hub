/* CA-16 P7: the build page's Classification section: three lines, one module of label and value rows (UX-03 follow-up P17), and the Regulated area
   notice. Nothing at all for a build that has no classification (P9): old builds read exactly as before. */

import { Fragment, type CSSProperties, type ReactNode } from "react";

import { Row } from "@/components/brand/Row";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { SectionHead } from "@/components/vision/SectionHead";
import { hasClassification, regulatedArea, shownValues } from "@/lib/classify/facets";
import { REGULATED_NOTICE, labelFor } from "@/lib/classify/lines";
import { FACET_LABEL, type Facet } from "@/lib/classify/taxonomy";
import { isCustomEntry, type Classification, type Entry, type Provenance } from "@/lib/classify/types";
import { useInRouterContext } from "react-router-dom";
import { galleryHref, cleanFacetKeys } from "@/lib/build/galleryParams";
import { PageLink } from "@/lib/routing/PageLink";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, textStep } from "@/lib/theme/type";

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

/** Facets a maker sets themselves: on their own build, when they are empty the section says Not stated, rather than leaving a gap. */
/** Where the maker fills in what they left empty. */
export const OPEN_CLASSIFICATION = "Open Classification";

const MAKER_SET: readonly Facet[] = ["field", "task", "setting", "data", "age"];

/** What a derived value says to anyone who asks: in its tooltip and its accessible name. */
export const DERIVED_NOTE = "Derived from the build";

/** One value: its words, or a link to Builds filtered by it (SV-25). A derived value carries where it came from; a stated one carries nothing extra. */
function Value({ value }: { value: Shown }) {
  const inner = <ValueLabel value={value} />;
  return value.provenance === "derived" ? (
    <span role="group" title={DERIVED_NOTE} aria-label={`${value.label}. ${DERIVED_NOTE}`}>
      {inner}
    </span>
  ) : (
    <span>{inner}</span>
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
 * UX-03 follow-up P17: Classification as one module of label and value rows. The head says how many facts it holds. The
 * rows sit in two columns filled down then across (one column on a phone); each column's last row has no hairline. The
 * maker, on their own build, also sees the empty maker-set facets as `Not stated`, after the facets that have values.
 */
export function ClassificationSection({ classification, maker }: { classification: Classification | null | undefined; /** The build is the viewer's own: the empty maker-set facets say Not stated, with the way to the Classification window. */ maker?: { editHref: string } }): ReactNode {
  const own = Boolean(maker);
  const phone = useIsPhone();
  if (!classification || !hasClassification(classification)) return null;
  const all = classificationRows(classification).flat();
  const withValues = all.filter((entry) => entry.values.length > 0);
  const notStated = own ? all.filter((entry) => entry.values.length === 0 && MAKER_SET.includes(entry.facet)) : [];
  const rows = [...withValues.map((entry) => ({ ...entry, empty: false })), ...notStated.map((entry) => ({ ...entry, empty: true }))];
  const perColumn = phone ? rows.length : Math.ceil(rows.length / 2);
  return (
    <section aria-label="Classification" data-testid="build-classification" style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      <SectionHead headingLevel={2} title="Classification" meta={`${withValues.length} ${withValues.length === 1 ? "fact" : "facts"} about this build`} />
      <div
        style={{
          ...moduleBox,
          padding: "4px 16px",
          display: "grid",
          gridAutoFlow: "column",
          gridTemplateRows: `repeat(${Math.max(perColumn, 1)}, auto)`,
          gridTemplateColumns: phone ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))",
          columnGap: 32,
        }}
      >
        {rows.map((entry, index) => (
          <Row
            key={entry.key}
            inModule
            label={<span data-facet={entry.facet}>{FACET_LABEL[entry.facet]}</span>}
            value={
              entry.empty ? (
                <span style={{ color: t.label, fontWeight: 400 }}>Not stated</span>
              ) : (
                <span style={entry.facet === "stack" ? { fontFamily: DM_MONO } : undefined}>
                  {entry.values.map((value, at) => (
                    <Fragment key={`${value.label}-${at}`}>
                      {at > 0 ? ", " : null}
                      <Value value={value} />
                    </Fragment>
                  ))}
                </span>
              )
            }
            style={(index + 1) % perColumn === 0 || index === rows.length - 1 ? { borderBottom: 0 } : undefined}
          />
        ))}
      </div>
      {maker && notStated.length > 0 ? (
        <PageLink to={maker.editHref} data-testid="classification-open" style={{ alignSelf: "flex-start", fontFamily: FIGTREE, fontSize: textStep.meta, color: t.text2, textDecoration: "underline", textUnderlineOffset: 3, textDecorationColor: t.line }}>
          {OPEN_CLASSIFICATION}
        </PageLink>
      ) : null}
      {regulatedArea(classification) ? (
        <p role="note" data-testid="regulated-notice" style={{ margin: 0, fontFamily: FIGTREE, fontSize: textStep.meta, lineHeight: 1.5, color: t.text2 }}>
          {REGULATED_NOTICE}
        </p>
      ) : null}
    </section>
  );
}

const moduleBox: CSSProperties = { background: t.module, border: `1px solid ${t.moduleBorder}`, borderRadius: 8, boxShadow: t.moduleShadow, boxSizing: "border-box", minWidth: 0 };
