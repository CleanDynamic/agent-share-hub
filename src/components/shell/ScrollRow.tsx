// The sideways row (UI-P19): lenses, tabs, filters, tracks and step chips on a phone.
//
// A flex row that scrolls horizontally with its scrollbar hidden and 10px of
// bleed past each edge (`margin: 0 -10px; padding: 0 10px`, the page gutter), so
// a half-visible chip says there is more. 14 before the UI-P55 density pass took
// the gutter to 10; the tightened board keeps a −14px margin (the pass never maps
// a negative value), which on a 390 screen would push the row 4px past the right
// edge, so the bleed follows the gutter instead. `gap` is the drawn 6 or 8,
// rendered through the table (4, 6). Children never shrink: each is wrapped
// in a box that cannot, because a chip squeezed to fit is a chip that no longer
// reads. `scrollbar-width` is inline; the WebKit pseudo-element is the one rule
// in index.css (`.bg-scroll-row::-webkit-scrollbar`).

import { Children, type KeyboardEvent, type ReactNode } from "react";

import { denseSpace } from "@/lib/theme/density";

export interface ScrollRowProps {
  gap?: 6 | 8;
  /** Names the row for assistive tech when it is a group of controls. */
  label?: string;
  /** The row is a tablist (UI-P38): its children are `FilterChip tab`s, and the arrow keys, Home and End move between them. */
  tablist?: boolean;
  children?: ReactNode;
}

export function ScrollRow({ gap = 8, label, tablist = false, children }: ScrollRowProps) {
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const tabs = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')];
    const at = tabs.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    const last = tabs.length - 1;
    const next =
      event.key === "ArrowRight" ? (at === last ? 0 : at + 1)
      : event.key === "ArrowLeft" ? (at === 0 ? last : at - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  };

  return (
    <div
      data-ui="scroll-row"
      className="bg-scroll-row"
      role={tablist ? "tablist" : label ? "group" : undefined}
      aria-label={label}
      onKeyDown={tablist ? move : undefined}
      style={{
        display: "flex",
        gap: denseSpace(gap),
        overflowX: "auto",
        /* 4px above and below, taken back by the margin: a scroll row clips what hangs outside it, and a chip's 44px touch area hangs 4px. */
        margin: "-4px -10px",
        padding: "4px 10px",
        scrollbarWidth: "none",
      }}
    >
      {Children.toArray(children).map((child, index) => (
        <div key={index} role={tablist ? "presentation" : undefined} style={{ flexShrink: 0 }}>
          {child}
        </div>
      ))}
    </div>
  );
}

export default ScrollRow;
