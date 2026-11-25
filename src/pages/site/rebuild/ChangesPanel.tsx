/* Synth 14: what changed, the rebuild's diff against its source as the record computes it, as a section with no box of its
   own (the side panel is the box). Groups ("Steps", "Sessions") headed 13/500 Text 3; each row the sign in mono 13 ("+" in
   Mint, "~" in Warn, "−" in Danger, its kind in words for a screen reader), the name 15 and the value 13 Text 2 at the
   right; under the rows "Computed from the source, not editable." 13 Text 3. Model names are plain text, with no marks.

   PURE. */

import { PageEmpty, PageState } from "@/components/pagestate/PageState";
import { readOf } from "@/components/pagestate/pageStateModel";
import type { CSSProperties, ReactNode } from "react";

import type { PanelFailure } from "@/components/pagestate/PageState";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { type ChangeGroupView, type ChangeRowKind } from "./rebuildModel";
import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";

const SYMBOL: Record<ChangeRowKind, { glyph: string; colour: string }> = {
  added: { glyph: "+", colour: t.brandAccent },
  changed: { glyph: "~", colour: t.warn },
  removed: { glyph: "−", colour: t.dangerText },
};

/** The line under the rows (the repo's em dash is a comma now). */
export const COMPUTED_NOTE = "Computed from the source, not editable.";

export function ChangeList({ groups, phone = false }: { groups: readonly ChangeGroupView[]; phone?: boolean }) {
  return (
    <div data-testid="change-list">
      {groups.map((group) => (
        <div key={group.key}>
          <h3
            style={{
              margin: 0,
              fontFamily: FIGTREE,
              fontSize: 13,
              fontWeight: 500,
              lineHeight: "16px",
              color: t.label,
              padding: "12px 0 4px",
            }}
          >
            {group.label}
          </h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {group.rows.map((row) => (
              <li
                key={row.key}
                data-testid="change-row"
                data-change-key={row.key}
                data-change-kind={row.kind}
                style={{
                  display: "grid",
                  gridTemplateColumns: "16px minmax(0, auto) minmax(0, 1fr)",
                  gap: 8,
                  alignItems: "baseline",
                  minHeight: 32,
                  padding: "6px 0",
                  boxSizing: "border-box",
                  fontFamily: FIGTREE,
                }}
              >
                <span style={{ fontFamily: DM_MONO, fontSize: 13, lineHeight: "20px", color: SYMBOL[row.kind].colour }}>
                  <span aria-hidden="true">{SYMBOL[row.kind].glyph}</span>
                  <span style={VISUALLY_HIDDEN}>{row.kind}</span>
                </span>
                <span style={{ fontSize: 15, lineHeight: "20px", color: t.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</span>
                <span
                  title={row.value}
                  style={{
                    fontSize: 13,
                    lineHeight: "20px",
                    color: t.text2,
                    minWidth: 0,
                    textAlign: "right",
                    ...(phone ? {} : { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }),
                  }}
                >
                  {row.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export interface ChangesPanelProps {
  groups: readonly ChangeGroupView[] | null;
  phone?: boolean;
  /** Fill the column (desktop). */
  fill?: boolean;
  /** In place of the list: still reading, nothing chosen yet, or nothing to compare. */
  placeholder?: ReactNode;
  /** A line under the head naming whose changes these are (the lineage page). */
  about?: ReactNode;
  /** The diff is being worked out: bones where the rows go. */
  loading?: boolean;
  /** The diff could not be worked out: said in the panel, with a retry. */
  failure?: PanelFailure;
  /** One quiet control in the section's head (the lineage page's "Open this build"). */
  action?: ReactNode;
  /** Mobile 28 A: the rebuild page on a phone says "Computed from the source" under the credit, so the list leaves it out. */
  note?: boolean;
}

export function ChangesPanel({ groups, phone = false, fill = false, placeholder, about, loading = false, failure, action, note = true }: ChangesPanelProps) {
  return (
    <section aria-labelledby="changes-title" style={fill ? { minHeight: 0, overflowY: "auto" } : undefined}>
      <div data-testid="changes-panel">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <h2 id="changes-title" style={{ margin: 0, fontFamily: FIGTREE, fontSize: 20, fontWeight: 600, lineHeight: "24px", color: t.text }}>
            What changed
          </h2>
          {action}
        </div>
        {about}
        {failure ? (
          <PageState read={readOf("error", undefined, failure.onRetry, failure.error)} thing="this comparison" region="What changed" skeleton={null} style={{ marginTop: 9 }}>
            {() => null}
          </PageState>
        ) : loading ? (
          <LoadingRegion what="what changed" data-testid="changes-loading" style={{ marginTop: 9 }}>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} height={phone ? 33 : 25} radius={4} style={{ marginBottom: 6 }} />
            ))}
          </LoadingRegion>
        ) : groups && groups.length > 0 ? (
          <>
            <ChangeList groups={groups} phone={phone} />
            {note ? <p data-testid="changes-note" style={{ margin: "8px 0 0", fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label }}>
              {COMPUTED_NOTE}
            </p> : null}
          </>
        ) : placeholder ? (
          <div style={{ marginTop: 9, fontFamily: FIGTREE, fontSize: 15, lineHeight: "20px", color: t.text2 }}>{placeholder}</div>
        ) : groups ? (
          <PageEmpty line="Nothing has changed yet." testId="changes-empty" />
        ) : null}
      </div>
    </section>
  );
}

export default ChangesPanel;
