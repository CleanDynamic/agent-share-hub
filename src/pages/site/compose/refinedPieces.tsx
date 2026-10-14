/* UI-P93 — the composer's refined pieces, shared by its forks: the number tile (UI-P90's), the tool's mark and the
   quiet words of a row. Their styles are in `refinedStyles.ts`. */

import type { CSSProperties, ReactNode } from "react";

import { ModelMark } from "@/components/brand/ModelMark";
import { markFor } from "@/lib/models/marks";
import { CONTROL } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

import { text, tnum } from "./refinedStyles";

/* ── pieces ── */

/** The step's number in a 24 control tile, Geist Mono 11. */
export function NumberTile({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      style={{
        ...CONTROL,
        flexShrink: 0,
        minWidth: 24,
        height: 24,
        padding: "0 4px",
        boxSizing: "border-box",
        borderRadius: 6,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: DM_MONO,
        fontSize: 11,
        lineHeight: "normal",
        color: t.text,
        ...tnum,
      }}
    >
      {children}
    </span>
  );
}

/** The tool's real mark, or a 6px square when it has none. */
export function ToolMark({ tool, model, size }: { tool?: string | null; model?: string | null; size: 14 | 20 | 24 }) {
  if (markFor({ tool, model }) === null) {
    return <span aria-hidden="true" style={{ width: 6, height: 6, margin: (size - 6) / 2, borderRadius: 1, background: t.label, flexShrink: 0 }} />;
  }
  return (
    <span style={{ display: "inline-flex", flexShrink: 0, color: t.text }}>
      <ModelMark tool={tool} model={model} size={size} />
    </span>
  );
}

/** "Uses", "Goes into", "words": the quiet 11.5 `--label` words of a row. */
export function Quiet({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span style={{ ...text(11.5, 400, t.label), ...style }}>{children}</span>;
}
