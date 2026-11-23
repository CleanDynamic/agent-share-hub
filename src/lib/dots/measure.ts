/* Synth 06: measuring a real layout into dot shapes (DotSkeleton).

   The loading state renders the real component tree with its content hidden (`opacity: 0`); this reads it and says what
   to draw on one shared lattice:
   - every text line is a bar as wide as the line, `BAR` of the font size tall, the last line of a paragraph thinning;
   - a border or outline is a dotted outline;
   - a fill (a button, a number box) is a faint dot fill;
   - an icon (an <svg>) is a small cluster of dots;
   - an avatar or a picture (an <img>, <video>, <canvas>, a background image, or a round or square filled box named
     `data-dot="block"`) is a solid block with its real radius.
   An element may say what it is with `data-dot="bar|block|fill|outline|skip"`. `skip` and its children are not drawn. */

import { BAR, type Shape } from "./fluid";

const ALPHA_ZERO = /^(transparent|rgba?\([^)]*[,/]\s*0(\.0+)?\s*\)|color\(.*\/\s*0\))$/i;

/** A computed colour that paints something. */
export const paints = (colour: string): boolean => colour !== "" && !ALPHA_ZERO.test(colour.trim());

const radiusOf = (cs: CSSStyleDeclaration, width: number, height: number): number => {
  const value = cs.borderTopLeftRadius ?? "";
  const n = parseFloat(value);
  if (Number.isNaN(n)) return 0;
  return value.trim().endsWith("%") ? (n / 100) * Math.min(width, height) : n;
};

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const relative = (rect: Box, host: Box): Box => ({ left: rect.left - host.left, top: rect.top - host.top, width: rect.width, height: rect.height });

/** The lines of one text node: its client rects, joined where they share a line. */
export function linesOf(rects: readonly Box[]): Box[] {
  const lines: Box[] = [];
  for (const rect of rects) {
    if (rect.width <= 0 || rect.height <= 0) continue;
    const same = lines.find((line) => Math.abs(line.top - rect.top) < rect.height / 2);
    if (same) {
      const right = Math.max(same.left + same.width, rect.left + rect.width);
      same.left = Math.min(same.left, rect.left);
      same.width = right - same.left;
    } else lines.push({ ...rect });
  }
  return lines.sort((a, b) => a.top - b.top);
}

/** A text line as a bar: `BAR` of the font size tall, centred on the line, exactly as wide. */
export function barOf(line: Box, fontSize: number, tail: boolean): Shape {
  const height = Math.max(4, Math.round(fontSize * BAR));
  return { x: line.left, y: line.top + (line.height - height) / 2, width: line.width, height, radius: Math.min(2, height / 2), kind: "bar", tail };
}

export function measureLayout(root: HTMLElement): Shape[] {
  const host = root.getBoundingClientRect();
  const out: Shape[] = [];

  const walk = (el: Element) => {
    if (!(el instanceof HTMLElement) && !(el instanceof SVGElement)) return;
    const mark = el.getAttribute("data-dot");
    if (mark === "skip") return;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return;
    const rect = relative(el.getBoundingClientRect(), host.width || host.height ? host : { left: 0, top: 0, width: 0, height: 0 });
    const has = rect.width > 0 && rect.height > 0;
    const radius = has ? radiusOf(cs, rect.width, rect.height) : 0;

    if (el instanceof SVGSVGElement) {
      if (has) out.push({ x: rect.left, y: rect.top, width: rect.width, height: rect.height, radius: rect.width / 2, kind: "block" });
      return;
    }

    if (has) {
      const pictured = el instanceof HTMLImageElement || el instanceof HTMLVideoElement || el instanceof HTMLCanvasElement || (cs.backgroundImage !== "" && cs.backgroundImage !== "none");
      const shape = (kind: Shape["kind"]): Shape => ({ x: rect.left, y: rect.top, width: rect.width, height: rect.height, radius, kind });
      if (mark === "bar") out.push({ ...shape("bar"), radius: Math.min(2, rect.height / 2) });
      else if (mark === "block" || pictured) out.push(shape("block"));
      else {
        const filled = paints(cs.backgroundColor);
        const bordered = parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== "none" && paints(cs.borderTopColor);
        const outlined = parseFloat(cs.outlineWidth) > 0 && cs.outlineStyle !== "none";
        if (mark === "fill" || (filled && mark !== "outline")) out.push(shape("fill"));
        if (mark === "outline" || bordered || outlined) out.push(shape("outline"));
      }
    }

    /* Text: each text node's lines, the last line of an element with more than one thinning. */
    const fontSize = parseFloat(cs.fontSize) || 15;
    const lines: Box[] = [];
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType !== 3 || !(node.textContent ?? "").trim() || typeof document.createRange !== "function") continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      if (typeof range.getClientRects !== "function") continue;
      const rects = Array.from(range.getClientRects()).map((r) => relative(r, host));
      lines.push(...linesOf(rects));
    }
    lines.forEach((line, at) => out.push(barOf(line, fontSize, lines.length > 1 && at === lines.length - 1)));

    for (const child of Array.from(el.children)) walk(child);
  };

  for (const child of Array.from(root.children)) walk(child);
  return out;
}
