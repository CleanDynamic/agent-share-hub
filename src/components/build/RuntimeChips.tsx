/* CA-13 P5 to P7 — the small marks a runtime tile carries: one row of helper chips under an agent's tools (each with its
   provider's mark and, when it did something on the run, a quiet second line), the answer shape's chip beside the app and
   model, and the "Trace" link. Drawn once for the composer's list, the build page, Preview and the windows. PURE. */

import type { CSSProperties } from "react";

import type { OutputShape } from "@/lib/build/answerShape";
import { shapeChip } from "@/lib/build/answerShape";
import { helperChip, helperDidLine, markTool, type Helper } from "@/lib/build/helpers";
import { traceLabel } from "@/lib/build/trace";
import { t } from "@/lib/theme/tokens";
import { ToolMark } from "@/pages/site/compose/refinedPieces";
import { chipStyle, text } from "@/pages/site/compose/refinedStyles";

export function HelperChips({ helpers, decisionName, indent = 0, style }: { helpers: readonly Helper[]; decisionName?: (id: string) => string | undefined; indent?: number; style?: CSSProperties }) {
  if (helpers.length === 0) return null;
  return (
    <span data-testid="helper-chips" role="list" aria-label="Helpers it used" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 6, paddingLeft: indent, ...style }}>
      {helpers.map((helper, index) => {
        const label = helperChip(helper, decisionName);
        const did = helperDidLine(helper);
        return (
          <span key={`${helper.job}-${index}`} role="listitem" data-testid="helper-chip" data-job={helper.job} style={{ display: "inline-flex", flexDirection: "column", gap: 2, minWidth: 0, maxWidth: "100%" }}>
            <span style={chipStyle}>
              <ToolMark tool={markTool(helper.provider, helper.job)} size={14} />
              {label}
            </span>
            {did ? <span data-testid="helper-did" style={{ ...text(11.5, 400, t.label), paddingLeft: 8 }}>{did}</span> : null}
          </span>
        );
      })}
    </span>
  );
}

/** "Returns JSON · Order", next to the app and model. */
export function ShapeChip({ shape, indent = 0 }: { shape: OutputShape; indent?: number }) {
  const label = shapeChip(shape);
  if (!label) return null;
  return (
    <span data-testid="shape-chip" style={{ ...chipStyle, alignSelf: "flex-start", marginLeft: indent }}>
      {label}
    </span>
  );
}

/** "Trace", opening in a new tab; LangSmith links get its name, any other host shows its domain. */
export function TraceLink({ url }: { url: string }) {
  return (
    <a data-testid="trace-link" href={url} target="_blank" rel="noopener noreferrer" style={{ ...text(12, 500, t.text2), textDecoration: "underline" }}>
      Trace · {traceLabel(url)}
    </a>
  );
}
