// styleString: a style object as the string TipTap puts on an element (PT-05).
//
// The editor's blocks are drawn by ProseMirror, not React, and the site has no
// stylesheet for them, so each node renders with its style attribute. These
// helpers turn the same CSSProperties objects postType.ts hands PostBody into
// that attribute, and apply one to an element the node views build by hand.

import type { CSSProperties } from "react";

const UNITLESS = new Set(["fontWeight", "lineHeight", "opacity", "zIndex", "flex", "flexGrow", "flexShrink", "order"]);

const kebab = (name: string) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const valueOf = (name: string, value: string | number) => (typeof value === "number" && value !== 0 && !UNITLESS.has(name) ? `${value}px` : String(value));

/** `{ fontSize: 16, color: "var(--text)" }` as `font-size:16px;color:var(--text)`. */
export function styleString(style: CSSProperties): string {
  return Object.entries(style)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([name, value]) => `${kebab(name)}:${valueOf(name, value as string | number)}`)
    .join(";");
}

/** Adds a style object to an element's style attribute (var() values and all, as a browser reads them). */
export function applyStyle(element: HTMLElement, style: CSSProperties): void {
  element.setAttribute("style", [element.getAttribute("style"), styleString(style)].filter(Boolean).join(";"));
}
