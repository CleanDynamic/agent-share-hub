/* UI-P47 / UI-P48 — the composer's field styles, shared by its panels. */

import type { CSSProperties } from "react";

import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export const fieldBase: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: t.field,
  color: t.text,
  border: `1px solid ${t.line}`,
  borderRadius: r.control,
  fontFamily: FIGTREE,
  outline: "none",
};

/**
 * Draw a field as plain text: no border, no fill. `index.css` gives every
 * input, textarea and select a `--recess` fill and a 1px border marked
 * !important, so that no raw field changes size, and no style object can
 * outrank that. An inline declaration marked important can, and only a ref can
 * write one. React never touches the two properties afterwards, because the
 * field's style object does not name them.
 */
export function bareField(element: HTMLInputElement | HTMLTextAreaElement | null): void {
  if (!element) return;
  element.style.setProperty("background", "transparent", "important");
  element.style.setProperty("border-width", "0", "important");
}

/** A field that draws the focus ring as `ring()` does, on focus-visible only. */
export function useRing<T extends HTMLElement>() {
  const { state, handlers } = useInteractive<T>();
  return { handlers, style: ring(state.focusVisible) };
}
