/**
 * Deep-link helpers for blueprint viewer.
 *
 * URL convention (uses content id — the existing /content/:id route):
 *   /content/{id}                 → top of blueprint
 *   /content/{id}#stage-{stageId} → scroll & open that stage
 *   /content/{id}#block-{blockId} → open parent stage, scroll & select block
 *
 * Spec language called this `/b/{slug}` but the actual route is
 * `/content/:id`. Hash convention is identical; we just use id as the path
 * segment.
 */

import { PULSE_MS, pulseRing } from "@/lib/theme/motion";

export function blueprintUrl(contentId: string): string {
  return `/content/${contentId}`;
}

export function stageDeepLink(contentId: string, stageId: string): string {
  return `/content/${contentId}#stage-${stageId}`;
}

export function blockDeepLink(contentId: string, blockId: string): string {
  return `/content/${contentId}#block-${blockId}`;
}

export type ParsedHash =
  | { kind: "stage"; id: string }
  | { kind: "block"; id: string }
  | null;

export function parseDeepLinkHash(hash: string): ParsedHash {
  const h = (hash || "").replace(/^#/, "");
  if (!h) return null;
  if (h.startsWith("stage-")) return { kind: "stage", id: h.slice("stage-".length) };
  if (h.startsWith("block-")) return { kind: "block", id: h.slice("block-".length) };
  return null;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  // Fallback for older browsers / insecure contexts.
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function absoluteUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

/**
 * One-shot pulse on an element, for a deep link that has just landed.
 *
 * BG-P32. The outline half of this was already right; the box-shadow half was
 * not — `box-shadow` cannot be composited, so transitioning it re-rasterised
 * the element on every frame of the fade. The ring is the outline alone now,
 * and it comes from `pulseRing` in the motion module, which is the single copy
 * of an effect this codebase had hand-rolled four separate times.
 *
 * Returns its cancel function, so a caller that navigates away mid-pulse can
 * leave nothing behind.
 */
export function pulseElement(el: HTMLElement, durationMs = PULSE_MS): () => void {
  return pulseRing(el, { holdMs: durationMs });
}
