// Apart from ReferenceWindows.tsx so the composer can name it without loading those windows (SV-26 P3).

import { centre } from "@/components/build/partNav";
import { flashOutline } from "@/components/post/RefLinks";

/** The words a link is made of, in the post: to the middle, focused, outlined. */
export function showWords(to: string) {
  window.setTimeout(() => {
    const el = document.querySelector<HTMLElement>(`[data-ref="${CSS.escape(to)}"]`);
    if (!el) return;
    centre(el);
    el.focus({ preventScroll: true });
    flashOutline(el);
  }, 0);
}
