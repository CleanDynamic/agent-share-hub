/* UI-P31 — what changed: the rebuild's diff against its source, as the record
   computes it.

   The rows are serialiseChangeSet()'s lines, line for line (rebuildModel's
   changeGroups), each split into a name and a value: `+` in
   `--cat-configuration` for an addition, `~` in `--lit-ink` for a change,
   `−` in `--cat-breakage` for a removal, each with its kind in words for a
   screen reader. The list is computed, not edited, and the panel says so.

   Desktop: a grid `18px 130px minmax(0, 1fr)`, 30 tall, DM Mono 12, under DM
   Mono 10 group headers. Phone: `16px 118px minmax(0, 1fr)`, at least 36 tall.

   PURE. */

import type { CSSProperties, ReactNode } from "react";

import { EmptyState } from "@/components/brand/EmptyState";
import { ErrorState, type PanelFailure } from "@/components/brand/ErrorState";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { Panel, PanelHead } from "@/components/brand/Panel";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { changesEyebrow, type ChangeGroupView, type ChangeRowKind } from "./rebuildModel";
import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";

const SYMBOL: Record<ChangeRowKind, { glyph: string; colour: string }> = {
  added: { glyph: "+", colour: t.catConfiguration },
  changed: { glyph: "~", colour: t.litInk },
  removed: { glyph: "−", colour: t.catBreakage },
};

export function ChangeList({ groups, phone = false }: { groups: readonly ChangeGroupView[]; phone?: boolean }) {
  return (
    <div data-testid="change-list">
      {groups.map((group) => (
        <div key={group.key}>
          <h3
            style={{
              margin: 0,
              fontFamily: DM_MONO,
              fontSize: 10,
              fontWeight: 400,
              letterSpacing: ".09em",
              textTransform: "uppercase",
              lineHeight: "normal",
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
                  gridTemplateColumns: phone ? "16px 118px minmax(0, 1fr)" : "18px 130px minmax(0, 1fr)",
                  gap: 8,
                  alignItems: "center",
                  ...(phone ? { minHeight: 36 } : { height: 30 }),
                  borderBottom: `1px solid ${t.hairline}`,
                  fontFamily: DM_MONO,
                  fontSize: 12,
                  lineHeight: "normal",
                }}
              >
                <span style={{ color: SYMBOL[row.kind].colour }}>
                  <span aria-hidden="true">{SYMBOL[row.kind].glyph}</span>
                  <span style={VISUALLY_HIDDEN}>{row.kind}</span>
                </span>
                <span style={{ color: t.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</span>
                <span
                  title={row.value}
                  style={{
                    color: t.text2,
                    minWidth: 0,
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
}

export function ChangesPanel({ groups, phone = false, fill = false, placeholder, about, loading = false, failure }: ChangesPanelProps) {
  return (
    <Panel padding={phone ? "14px 16px" : "16px 18px"} style={fill ? { height: "100%", overflowY: "auto" } : undefined}>
      <div data-testid="changes-panel">
        <PanelHead
          headingLevel={2}
          title="What changed"
          subtitle={phone ? "Computed from the source — not editable" : "Computed from the source — you cannot edit this list"}
          right={!phone && groups ? <Eyebrow>{changesEyebrow(groups)}</Eyebrow> : undefined}
        />
        {about}
        {failure ? (
          <ErrorState panel="What changed" onRetry={failure.onRetry} error={failure.error} style={{ marginTop: 12 }} data-testid="changes-error" />
        ) : loading ? (
          <LoadingRegion what="what changed" data-testid="changes-loading" style={{ marginTop: 12 }}>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} height={phone ? 40 : 30} radius={0} style={{ marginBottom: 1 }} />
            ))}
          </LoadingRegion>
        ) : groups && groups.length > 0 ? (
          <ChangeList groups={groups} phone={phone} />
        ) : placeholder ? (
          <div style={{ marginTop: 12, fontFamily: FIGTREE, fontSize: 13, lineHeight: 1.5, color: t.text2 }}>{placeholder}</div>
        ) : groups ? (
          <EmptyState line="Nothing has changed yet." data-testid="changes-empty" />
        ) : null}
      </div>
    </Panel>
  );
}

export default ChangesPanel;
