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

import { Eyebrow } from "@/components/brand/Eyebrow";
import { Panel, PanelHead } from "@/components/brand/Panel";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { changesEyebrow, type ChangeGroupView, type ChangeRowKind } from "./rebuildModel";

const SYMBOL: Record<ChangeRowKind, { glyph: string; colour: string }> = {
  added: { glyph: "+", colour: t.catConfiguration },
  changed: { glyph: "~", colour: t.litInk },
  removed: { glyph: "−", colour: t.catBreakage },
};

const VISUALLY_HIDDEN: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
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
}

export function ChangesPanel({ groups, phone = false, fill = false, placeholder, about }: ChangesPanelProps) {
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
        {groups && groups.length > 0 ? (
          <ChangeList groups={groups} phone={phone} />
        ) : placeholder ? (
          <div style={{ marginTop: 12, fontFamily: FIGTREE, fontSize: 13, lineHeight: 1.5, color: t.text2 }}>{placeholder}</div>
        ) : groups ? (
          <p style={{ margin: "12px 0 0", fontFamily: FIGTREE, fontSize: 13, color: t.text2 }}>
            Nothing in the record reads differently from its source yet.
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

export default ChangesPanel;
