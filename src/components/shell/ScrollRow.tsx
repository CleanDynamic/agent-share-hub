// The sideways row (UI-P19): lenses, tabs, filters, tracks and step chips on a phone.
//
// A flex row that scrolls horizontally with its scrollbar hidden and 14px of
// bleed past each edge (`margin: 0 -14px; padding: 0 14px`, the page gutter), so
// a half-visible chip says there is more. Children never shrink: each is wrapped
// in a box that cannot, because a chip squeezed to fit is a chip that no longer
// reads. `scrollbar-width` is inline; the WebKit pseudo-element is the one rule
// in index.css (`.bg-scroll-row::-webkit-scrollbar`).

import { Children, type ReactNode } from "react";

export interface ScrollRowProps {
  gap?: 6 | 8;
  /** Names the row for assistive tech when it is a group of controls. */
  label?: string;
  children?: ReactNode;
}

export function ScrollRow({ gap = 8, label, children }: ScrollRowProps) {
  return (
    <div
      data-ui="scroll-row"
      className="bg-scroll-row"
      role={label ? "group" : undefined}
      aria-label={label}
      style={{
        display: "flex",
        gap,
        overflowX: "auto",
        margin: "0 -14px",
        padding: "0 14px",
        scrollbarWidth: "none",
      }}
    >
      {Children.toArray(children).map((child, index) => (
        <div key={index} style={{ flexShrink: 0 }}>
          {child}
        </div>
      ))}
    </div>
  );
}

export default ScrollRow;
