// The page heading (UI-P09): eyebrow, title, and a line under it.
//
// It stands on the backdrop above a phone's panels (`bare`: padding 4px 2px, and
// the title is 30 to 36px at −0.035em), and on desktop the same three parts sit
// inside the page's header panel (`in-panel`: no padding of its own, because the
// panel has it, at that page's own sizes). The title is an `h1` in the display
// face, line-height 1; the line under it is Figtree 14 at 1.5 in `--text2`.

import type { ReactNode } from "react";

import { t } from "@/lib/theme/tokens";
import { display, FIGTREE } from "@/lib/theme/type";

import { Eyebrow } from "./Eyebrow";

export interface PageHeadingProps {
  eyebrow: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  /** The title's size in px: 30, 32, 34 or 36 on a phone; the page's own on desktop. */
  size: number;
  variant?: "bare" | "in-panel";
}

export function PageHeading({ eyebrow, title, sub, size, variant = "bare" }: PageHeadingProps) {
  return (
    <div
      data-ui="page-heading"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: variant === "bare" ? "4px 2px" : undefined,
      }}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 style={{ ...display(size, { mobilePageHeading: variant === "bare" }), margin: 0, color: t.text }}>
        {title}
      </h1>
      {sub ? (
        <div style={{ fontFamily: FIGTREE, fontSize: 14, lineHeight: 1.5, color: t.text2 }}>{sub}</div>
      ) : null}
    </div>
  );
}

export default PageHeading;
