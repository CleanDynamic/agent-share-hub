// A pill (UI-P84, refined look): Geist Mono 10.5, 18 high, `0 6px`, radius 4, `--pill` under `--on-pill`. A tone
// recolours it: `evidence` and `breakage` use their fill and ink, `lit-ink` is the amber ink on the pill fill (amber
// is light, never a fill), and a category uses its `-fill` and ink.

import type { CSSProperties, ReactNode } from "react";

import type { Category } from "@/lib/theme/category";
import { r } from "@/lib/theme/radius";
import { t, tokenVar, type TokenName } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export type PillTone = "evidence" | "breakage" | "lit-ink" | Category;

export interface PillProps {
  children: ReactNode;
  tone?: PillTone;
  style?: CSSProperties;
}

function paint(tone: PillTone | undefined): CSSProperties {
  switch (tone) {
    case undefined:
      return { background: t.module, color: t.text };
    case "evidence":
      return { background: t.evidenceFill, color: t.evidence };
    case "breakage":
      return { background: t.breakageFill, color: t.breakage };
    case "lit-ink":
      return { background: t.module, color: t.litInk };
    default:
      /* Synth 16: the tint names the category; the words are the ink (a hue on its own tint fell under 4.5:1 on Noon). */
      return {
        background: tokenVar(`cat-${tone}-fill` as TokenName),
        color: t.text,
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
        height: 24,
        padding: "0 10px",
        borderRadius: r.chip,
        fontFamily: FIGTREE,
        fontSize: 13,
        fontWeight: 500,
        lineHeight: "16px",
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
