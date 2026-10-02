/* UI-P30 — a result, inside the part viewer.

   When the selected part is evidence (a result, a run log, a screenshot, an
   eval run, a recording, a comparison), the viewer says so before it shows it:
   the `CategoryChip` "evidence" and the date the evidence carries, in DM Mono 10
   `--label`, then the result itself — its picture or its words, drawn by the
   anatomy's own renderer — inside a radius 10 frame.

   PURE. */

import type { ReactNode } from "react";

import { CategoryChip } from "@/components/brand/CategoryChip";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

export function ResultFrame({ date, children }: { date: string | null; children: ReactNode }) {
  return (
    <div data-testid="build-result" style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <CategoryChip category="evidence" label="evidence" />
        {date ? <span style={{ fontFamily: DM_MONO, fontSize: 10, color: t.label }}>{date}</span> : null}
      </div>
      <div
        data-testid="build-result-frame"
        style={{ borderRadius: r.media, border: `1px solid ${t.line}`, padding: "12px 14px", overflow: "hidden", minWidth: 0 }}
      >
        {children}
      </div>
    </div>
  );
}

export default ResultFrame;
