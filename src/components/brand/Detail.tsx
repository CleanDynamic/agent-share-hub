// A detail (UI-P09): a label over a value. "Made for · finance ops". The label is
// the 10px eyebrow; the value is DM Mono 14px in `--text` — or a passed colour —
// on one line, clipped with an ellipsis rather than wrapped, because a wall label
// cell is a fixed shape and a long value must not change it.
//
// `display: contents`, so the eyebrow and the value are children of the wall
// label's cell column and take its gap, not a second box's.

import type { ReactNode } from "react";

import { t } from "@/lib/theme/tokens";
import { mono } from "@/lib/theme/type";

import { Eyebrow } from "./Eyebrow";

export interface DetailProps {
  label: ReactNode;
  value: ReactNode;
  /** Defaults to `--text`. */
  color?: string;
}

export function Detail({ label, value, color = t.text }: DetailProps) {
  return (
    <span data-ui="detail" style={{ display: "contents" }}>
      <Eyebrow size={10}>{label}</Eyebrow>
      <div
        style={{
          ...mono(14),
          lineHeight: "normal",
          color,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </div>
    </span>
  );
}

export default Detail;
