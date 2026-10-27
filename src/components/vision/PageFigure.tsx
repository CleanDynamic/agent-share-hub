/* SV-02: a page's leading number and the line under it (series README, Visual grammar 4).

   The number is 20/500, -0.015em, line-height 1.2; `size="room"` (Home) is 32/500, -0.02em, 1.1. The meta line is 13 in
   `--text2`, built from parts: each plain, or toned by meaning, `evidence` for worked or growth, `breakage` for failed,
   `lit` for not tested or edited. It sits 4 under the number at the boards' 20px line (SV-09). Home's room (SV-10) draws
   its meta line 6 under the number, 12 in `--label`. The README allows at most two toned clauses in a line. Numbers are tabular. */

import { Fragment, type ReactNode } from "react";

import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export type FigureTone = "evidence" | "breakage" | "lit";

export interface FigurePart {
  text: ReactNode;
  tone?: FigureTone;
}

export interface PageFigureProps {
  figure: ReactNode;
  parts?: readonly FigurePart[];
  size?: "page" | "room";
  /** Text between the parts. */
  separator?: string;
}

const TONE: Record<FigureTone, string> = { evidence: t.evidence, breakage: t.catBreakage, lit: t.lit };

export function PageFigure({ figure, parts = [], size = "page", separator = " · " }: PageFigureProps) {
  const room = size === "room";
  return (
    <div data-ui="page-figure" style={{ fontFamily: FIGTREE, fontVariantNumeric: "tabular-nums" }}>
      <div
        style={{
          fontSize: room ? 32 : 20,
          fontWeight: 500,
          letterSpacing: room ? "-0.02em" : "-0.015em",
          lineHeight: room ? 1.1 : 1.2,
          color: t.text,
        }}
      >
        {figure}
      </div>
      {parts.length > 0 ? (
        <div style={room ? { marginTop: 6, fontSize: 12, fontWeight: 400, lineHeight: "20px", color: t.label } : { marginTop: 4, fontSize: 13, fontWeight: 400, lineHeight: "20px", color: t.text2 }}>
          {parts.map((part, index) => (
            <Fragment key={index}>
              {index > 0 ? separator : null}
              {part.tone ? <span style={{ color: TONE[part.tone] }}>{part.text}</span> : part.text}
            </Fragment>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default PageFigure;
