/* CA-16: the small pieces every surface that shows a classification shares: the two card lines, the Regulated area tag
   and the provenance dot. The Gallery card, the Classification Card's preview and the build page all draw these, so the
   words and the look cannot drift apart. Tokens only; mono is Geist Mono. */

import type { CSSProperties } from "react";

import { REGULATED_TAG, type CardLines } from "@/lib/classify/lines";
import type { Provenance } from "@/lib/classify/types";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

/** The two lines under a build's title. Line one is in the data face at 11.5/17 `--text`; line two at 12 `--text2`, 3 below. Nothing at all for a build with no classification. */
export function ClassificationLines({ lines, gap = 3 }: { lines: CardLines; gap?: number }) {
  if (lines.line1.length === 0 && lines.line2.length === 0) return null;
  return (
    <div data-card-part="classification" style={{ display: "flex", flexDirection: "column", gap, minWidth: 0 }}>
      {lines.line1.length > 0 ? (
        <p data-card-part="classification-1" style={{ margin: 0, fontFamily: DM_MONO, fontSize: 11.5, lineHeight: "17px", color: t.text, overflowWrap: "anywhere" }}>
          {lines.line1.join(" \u00B7 ")}
        </p>
      ) : null}
      {lines.line2.length > 0 ? (
        <p data-card-part="classification-2" style={{ margin: 0, fontFamily: FIGTREE, fontSize: 12, lineHeight: "17px", color: t.text2, overflowWrap: "anywhere" }}>
          {lines.line2.join(" \u00B7 ")}
        </p>
      ) : null}
    </div>
  );
}

/** A small neutral tag beside a title when the build works in a regulated area: never amber. */
export function RegulatedTag() {
  return (
    <span
      data-card-part="regulated-tag"
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 18,
        padding: "0 6px",
        boxSizing: "border-box",
        borderRadius: 4,
        background: t.control,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: `var(--seg-on-border, ${t.controlBorder})`,
        fontFamily: FIGTREE,
        fontSize: 11,
        fontWeight: 400,
        lineHeight: "normal",
        color: t.text,
        whiteSpace: "nowrap",
        verticalAlign: "middle",
      }}
    >
      {REGULATED_TAG}
    </span>
  );
}

export const PROVENANCE_WORDS: Record<"maker" | "reader", Record<Provenance, string>> = {
  maker: { derived: "Derived", stated: "Stated by you", none: "Not stated" },
  reader: { derived: "Derived", stated: "Stated by the maker", none: "Not stated" },
};

/** Where a value came from: a hollow ring (derived), a filled dot (stated), a dashed ring (not stated). The word is always there too. */
export function ProvenanceDot({ kind, viewer = "reader", showWord = false }: { kind: Provenance; viewer?: "maker" | "reader"; showWord?: boolean }) {
  const word = PROVENANCE_WORDS[viewer][kind];
  const dot: CSSProperties = {
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: 4,
    boxSizing: "border-box",
    flexShrink: 0,
    ...(kind === "stated" ? { background: t.text, border: `1px solid ${t.text}` } : kind === "derived" ? { background: "transparent", borderWidth: 1, borderStyle: "solid", borderColor: t.text2 } : { background: "transparent", borderWidth: 1, borderStyle: "dashed", borderColor: t.label }),
  };
  return (
    <span title={word} data-provenance={kind} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span role="img" aria-label={word} style={dot} />
      {showWord ? <span style={{ fontFamily: FIGTREE, fontSize: 11.5, color: t.text2 }}>{word}</span> : null}
    </span>
  );
}
