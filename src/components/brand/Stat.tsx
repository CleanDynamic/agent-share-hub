// A stat (UI-P09): a label over a number, optionally "of" something, optionally a
// bar. The number is DM Mono 22px at −0.02em in `--text` and sits on a baseline
// row with its "/ of" in 12px `--text2`; the bar, when there is one, is a
// `StripedBar` 10px tall and says the same figure a second way — the number is
// always printed, so the bar is never the only carrier of a value.

import type { ReactNode } from "react";

import { t } from "@/lib/theme/tokens";
import { mono } from "@/lib/theme/type";

import { Eyebrow } from "./Eyebrow";
import { Skeleton } from "./Skeleton";
import { StripedBar, type StripedBarProps } from "./StripedBar";

export interface StatProps {
  label: ReactNode;
  value: ReactNode;
  /** "/ {of}", after the value. */
  of?: ReactNode;
  /** A bar under the number. `height` is fixed at 10 here. */
  bar?: Pick<StripedBarProps, "value" | "colour" | "label" | "valueText" | "ticks">;
  /**
   * UI-P37 — the bar's place while the figure loads: a 10px bone, so the cell is the
   * height it will be. Never a bar drawn at zero, which would say a number nobody knows.
   */
  barLoading?: boolean;
}

export function Stat({ label, value, of, bar, barLoading = false }: StatProps) {
  return (
    <span data-ui="stat" style={{ display: "contents" }}>
      <Eyebrow size={10}>{label}</Eyebrow>
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <span style={{ ...mono(22), lineHeight: "normal", color: t.text, letterSpacing: "-0.02em" }}>{value}</span>
        {of !== undefined ? (
          <span style={{ ...mono(12), lineHeight: "normal", color: t.text2 }}>&nbsp;/ {of}</span>
        ) : null}
      </div>
      {bar ? <StripedBar {...bar} height={10} /> : barLoading ? <Skeleton height={10} radius={5} /> : null}
    </span>
  );
}

export default Stat;
