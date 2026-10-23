/* CA-18 P4: Details beside the build, sized by its content.

   The aside renders the panel twice over its life, never at once. First as a measuring copy (`plan.measure`): every piece in a block of
   its own, whose width this component sets, so `measure(width)` is the heights the browser gives at that width. `layoutDetails` picks the
   columns from those; the panel is then drawn in them. When the text on show changes, or the window does, it is measured again. */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { t } from "@/lib/theme/tokens";

import type { DetailsPlan } from "./DetailsPanel";
import { layoutDetails, type DetailsLayout, type Measured } from "./detailsLayout";

/** Sticky, 16 below the 52 header. */
export const ASIDE_TOP = 68;
/** Details' bottom stays this far inside the window. */
const BOTTOM_ROOM = 24;

const MEASURING: DetailsPlan = { measure: true, columnWidth: 0, columns: [] };

interface Shown {
  layout: DetailsLayout;
  plan: DetailsPlan | undefined;
  /** What the copy said when measured, and for what window. */
  text: string;
  key: string;
}

export interface DetailsAsideProps {
  inner: number;
  windowHeight: number;
  render: (plan?: DetailsPlan) => ReactNode;
  label?: string;
}

function measureAt(host: HTMLElement, width: number): Measured {
  host.style.width = `${width}px`;
  const height = (key: string) => host.querySelector<HTMLElement>(`[data-measure="${key}"]`)?.offsetHeight ?? 0;
  const sections = Array.from(host.querySelectorAll<HTMLElement>("[data-measure]"))
    .filter((node) => node.dataset.measure !== "head" && node.dataset.measure !== "foot")
    .map((node) => ({ key: node.dataset.measure as string, height: node.offsetHeight, prose: node.querySelector("[data-prose]") !== null }));
  return { head: height("head"), foot: height("foot"), sections };
}

export function DetailsAside({ inner, windowHeight, render, label = "Details" }: DetailsAsideProps) {
  const row = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [top, setTop] = useState(ASIDE_TOP);
  const key = `${inner}x${windowHeight}x${top}`;

  useLayoutEffect(() => {
    const at = row.current ? Math.round(row.current.getBoundingClientRect().top + (window.scrollY || 0)) : ASIDE_TOP;
    if (at !== top) setTop(at);
    const node = host.current;
    if (!node) return;
    if (shown && shown.key === key && node.textContent === shown.text) return;
    if (shown) {
      setShown(null);
      return;
    }
    const height = Math.max(320, windowHeight - at - BOTTOM_ROOM);
    const body = node.querySelector('[data-testid="details-measure"]');
    const measured = (width: number) => measureAt(node, width);
    const layout = body ? layoutDetails({ inner, height, measure: measured }) : null;
    const same = node.textContent ?? "";
    node.style.width = "";
    if (!layout || !layout.beside || layout.columns === 0) {
      setShown({ layout: layout ?? layoutDetails({ inner, height, measure: () => ({ head: 0, foot: 0, sections: [] }) }), plan: undefined, text: same, key });
      return;
    }
    setShown({ layout, plan: { columnWidth: layout.columnWidth, columns: layout.assignment, cut: layout.cut }, text: same, key });
  });

  const layout = shown?.layout;
  const width = layout && layout.width > 0 ? layout.width : undefined;
  return (
    <div ref={row} style={{ alignSelf: "stretch", flex: "0 0 auto", minWidth: 0 }}>
      <section
        aria-label={label}
        data-testid="details-aside"
        data-columns={layout?.columns}
        data-scrolls={layout?.scrolls ? "true" : undefined}
        style={{
          position: "sticky",
          top: ASIDE_TOP,
          maxHeight: Math.max(320, windowHeight - Math.max(top, ASIDE_TOP) - BOTTOM_ROOM),
          overflowY: layout?.scrolls ? "auto" : "visible",
          boxSizing: "border-box",
          color: t.text,
        }}
      >
        <div ref={host} style={{ width }}>
          {render(shown ? shown.plan : MEASURING)}
        </div>
      </section>
    </div>
  );
}

export default DetailsAside;

/** The window's size, kept current. The composer's widths come from the window alone. */
export function useWindowSize(): { width: number; height: number } {
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  useEffect(() => {
    const on = () => setSize((held) => (held.width === window.innerWidth && held.height === window.innerHeight ? held : { width: window.innerWidth, height: window.innerHeight }));
    window.addEventListener("resize", on);
    on();
    return () => window.removeEventListener("resize", on);
  }, []);
  return size;
}
