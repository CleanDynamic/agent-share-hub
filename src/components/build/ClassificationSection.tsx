/* CA-16 P7: the build page's Classification section: three lines, a provenance dot on every value, and the Regulated area
   notice. Nothing at all for a build that has no classification (P9): old builds read exactly as before. */

import type { CSSProperties, ReactNode } from "react";

import { ProvenanceDot } from "@/components/classify/ClassificationBits";
import { hasClassification, regulatedArea, shownValues } from "@/lib/classify/facets";
import { REGULATED_NOTICE, labelFor } from "@/lib/classify/lines";
import { FACET_LABEL, type Facet } from "@/lib/classify/taxonomy";
import { isCustomEntry, type Classification, type Entry, type Provenance } from "@/lib/classify/types";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

interface Shown {
  label: string;
  provenance: Provenance;
}

const declared = (facet: Facet, entries: readonly Entry[]): Shown[] => entries.map((entry) => ({ label: isCustomEntry(entry) ? entry.custom : labelFor(facet, entry.id), provenance: "stated" }));

const read = (c: Classification, facet: Facet): Shown[] => {
  const shown = shownValues(c, facet);
  return shown.values.map((id) => ({ label: labelFor(facet, id), provenance: shown.provenance }));
};

/** The three lines of the section, each a list of facets with their values. */
export function classificationRows(c: Classification): { key: string; facet: Facet; values: Shown[] }[][] {
  const decl = (facet: "field" | "task" | "setting" | "data" | "stack"): Shown[] => declared(facet, c.declared[facet]);
  const age: Shown[] = c.declared.age ? [{ label: labelFor("age", c.declared.age), provenance: "stated" }] : [];
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

/** Facets a maker sets themselves: when they are empty the section says Not stated, rather than leaving a gap. */
const MAKER_SET: readonly Facet[] = ["field", "task", "setting", "data", "age"];

const lineStyle: CSSProperties = { display: "flex", flexWrap: "wrap", columnGap: 20, rowGap: 6, margin: 0, padding: 0, listStyle: "none" };

function Facet_({ facet, values }: { facet: Facet; values: Shown[] }) {
  const empty = values.length === 0;
  if (empty && !MAKER_SET.includes(facet)) return null;
  return (
    <li data-facet={facet} style={{ display: "inline-flex", alignItems: "baseline", flexWrap: "wrap", gap: "2px 8px", minWidth: 0, fontFamily: FIGTREE, fontSize: 12.5, lineHeight: 1.5 }}>
      <span style={{ color: t.label }}>{FACET_LABEL[facet]}</span>
      {empty ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: t.label }}>
          <ProvenanceDot kind="none" />
          Not stated
        </span>
      ) : (
        values.map((value, index) => (
          <span key={`${value.label}-${index}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: t.text, fontFamily: facet === "stack" ? DM_MONO : undefined }}>
            <ProvenanceDot kind={value.provenance} />
            {value.label}
          </span>
        ))
      )}
    </li>
  );
}

export function ClassificationSection({ classification }: { classification: Classification | null | undefined }): ReactNode {
  if (!classification || !hasClassification(classification)) return null;
  const rows = classificationRows(classification);
  return (
    <section aria-label="Classification" data-testid="build-classification" style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <h2 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13.5, fontWeight: 500, color: t.text }}>Classification</h2>
      {rows.map((line, index) => (
        <ul key={index} style={lineStyle}>
          {line.map((entry) => (
            <Facet_ key={entry.key} facet={entry.facet} values={entry.values} />
          ))}
        </ul>
      ))}
      {regulatedArea(classification) ? (
        <p role="note" data-testid="regulated-notice" style={{ margin: 0, fontFamily: FIGTREE, fontSize: 12.5, lineHeight: 1.5, color: t.text2 }}>
          {REGULATED_NOTICE}
        </p>
      ) : null}
    </section>
  );
}
