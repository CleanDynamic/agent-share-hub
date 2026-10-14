// A pill (UI-P84, refined look): Geist Mono 10.5, 18 high, `0 6px`, radius 4, `--pill` under `--on-pill`. A tone
// recolours it: `evidence` and `breakage` use their fill and ink, `lit-ink` is the amber ink on the pill fill (amber
// is light, never a fill), and a category uses its `-fill` and ink.

import type { CSSProperties, ReactNode } from "react";

import type { Category } from "@/lib/theme/category";
import { t, tokenVar, type TokenName } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

export type PillTone = "evidence" | "breakage" | "lit-ink" | Category;

export interface PillProps {
  children: ReactNode;
  tone?: PillTone;
  style?: CSSProperties;
}

function paint(tone: PillTone | undefined): CSSProperties {
  switch (tone) {
    case undefined:
      return { background: t.pill, color: t.onPill };
    case "evidence":
      return { background: t.evidenceFill, color: t.evidence };
    case "breakage":
      return { background: t.breakageFill, color: t.breakage };
    case "lit-ink":
      return { background: t.pill, color: t.litInk };
    default:
      return {
        background: tokenVar(`cat-${tone}-fill` as TokenName),
        color: tokenVar(`cat-${tone}` as TokenName),
      };
  }
}

export function Pill({ children, tone, style }: PillProps) {
  return (
    <span
      data-ui="pill"
      data-tone={tone}
      style={{
        display: "inline-flex",
        alignItems: "center",
        boxSizing: "border-box",
        height: 18,
        padding: "0 6px",
        borderRadius: 4,
        fontFamily: DM_MONO,
        fontSize: 10.5,
        lineHeight: "normal",
        whiteSpace: "nowrap",
        ...paint(tone),
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export default Pill;
