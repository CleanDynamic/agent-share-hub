/* SV-02: the grey mono type chip (`STEP`, `PROMPT`): the only chip that sits in a row (series README, Visual grammar 6).

   Geist Mono 10.5, line-height 18, padding `0 6px`, radius 4, `--control` fill, `--text2` text, upper case. A tone
   changes the text colour only. Plain text, so a screen reader reads the word as it is written. */

import type { ReactNode } from "react";

import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

export type ChipTone = "evidence" | "breakage" | "lit";

const TONE: Record<ChipTone, string> = { evidence: t.evidence, breakage: t.catBreakage, lit: t.lit };

export function TypeChip({ children, tone }: { children: ReactNode; tone?: ChipTone }) {
  return (
    <span
      data-ui="type-chip"
      style={{
        display: "inline-block",
        boxSizing: "border-box",
        padding: "0 6px",
        borderRadius: r.chip,
        background: t.control,
        color: tone ? TONE[tone] : t.text2,
        fontFamily: DM_MONO, fontSize: 10.5, fontWeight: 400, lineHeight: "18px", textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export default TypeChip;
