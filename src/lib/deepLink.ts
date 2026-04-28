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
 * One-shot pulse animation on an element. Uses inline animation so we don't
 * need a global CSS class.
 */
export function pulseElement(el: HTMLElement, durationMs = 700) {
  const previousOutline = el.style.outline;
  const previousTransition = el.style.transition;
  const previousBoxShadow = el.style.boxShadow;
  el.style.transition = "box-shadow 200ms ease-out, outline-color 200ms ease-out";
  el.style.outline = "2px solid rgba(46,196,182,0.95)";
  el.style.boxShadow = "0 0 0 6px rgba(46,196,182,0.20), 0 0 24px rgba(46,196,182,0.35)";
  window.setTimeout(() => {
    el.style.outline = previousOutline;
    el.style.boxShadow = previousBoxShadow;
    window.setTimeout(() => {
      el.style.transition = previousTransition;
    }, 220);
  }, durationMs);
}
