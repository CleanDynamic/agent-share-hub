// The row (UI-P85, refined look): a hairline-separated line with a label at the left and a value at the right.
//
// `min-height` is 40, 48 or 56; the gap is 12. The label is 12.5 in `--text2`; the value is 12.5/500 in `--text`,
// tabular. `inModule` draws the hairline in `--hairline-module`, because a module is a lighter ground than the
// surface. Pass `children` for a row that is not a label and a value (the visitors' book) and the row keeps only its
// height, gap and hairline.

import type { CSSProperties, ElementType, ReactNode } from "react";

import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export interface RowProps {
  label?: ReactNode;
  value?: ReactNode;
  /** 40 by default. */
  height?: 40 | 48 | 56;
  /** Sits in a module, so the hairline is the module's. */
  inModule?: boolean;
  as?: ElementType;
  style?: CSSProperties;
  children?: ReactNode;
}

export function Row({ label, value, height = 40, inModule = false, as: Tag = "div", style, children }: RowProps) {
  return (
    <Tag
      data-ui="row"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        minHeight: height,
        boxSizing: "border-box",
        borderBottom: `1px solid ${inModule ? t.hairlineModule : t.hairline}`,
        fontFamily: FIGTREE,
        fontSize: 12.5,
        lineHeight: "normal",
        ...style,
      }}
    >
      {children ?? (
        <>
          <span style={{ flexGrow: 1, minWidth: 0, fontWeight: 400, color: t.text2 }}>{label}</span>
          <span
            style={{
              flexShrink: 0,
              fontWeight: 500,
              color: t.text,
              fontVariantNumeric: "tabular-nums",
              textAlign: "right",
            }}
          >
            {value}
          </span>
        </>
      )}
    </Tag>
  );
}

export default Row;
