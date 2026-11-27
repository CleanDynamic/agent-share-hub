// 29e: new posts inserted above the reading position (a refresh while scrolled down, a live insert) keep the post being read
// where it is. While the page is scrolled, the item at the top of the screen is remembered with its distance from the top;
// when nodes are added before it, `window.scrollY` is adjusted by however far it moved, in the same frame (a MutationObserver
// callback runs before the next paint). Nothing runs at the top of the page, where new content is meant to push down, or
// above 768px. Inserted nodes only: a change inside the item itself is the browser's to anchor.

const ITEM = 'article, li, [role="article"], [data-feed-item]';
const isPhone = (): boolean => typeof window.matchMedia === "function" && window.matchMedia("(max-width: 767px)").matches;

/** Pure: the scroll correction after the anchor moved from `was` to `now` (viewport tops). */
export function anchorShift(was: number, now: number, scrollY: number): number {
  if (scrollY <= 0) return 0;
  const moved = now - was;
  return Math.abs(moved) < 1 ? 0 : moved;
}

/** `bar` is how far the fixed top bar covers the page, so the remembered item is the first one under it. */
export function installReadingAnchor(root: HTMLElement, bar = 56): () => void {
  let anchor: HTMLElement | null = null;
  let top = 0;

  const remember = () => {
    if (!isPhone() || window.scrollY <= 0) {
      anchor = null;
      return;
    }
    const hit = document.elementFromPoint(Math.round(window.innerWidth / 2), bar + 8);
    const item = hit?.closest<HTMLElement>(ITEM) ?? null;
    anchor = item && root.contains(item) ? item : null;
    if (anchor) top = anchor.getBoundingClientRect().top;
  };

  const observer = new MutationObserver((records) => {
    const item = anchor;
    if (!item || !item.isConnected) return;
    const before = records.some((record) =>
      Array.from(record.addedNodes).some(
        (node) => node.nodeType === 1 && !item.contains(node) && Boolean(item.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING),
      ),
    );
    if (!before) return;
    const shift = anchorShift(top, item.getBoundingClientRect().top, window.scrollY);
    if (shift) window.scrollBy({ top: shift, behavior: "auto" });
    remember();
  });

  observer.observe(root, { childList: true, subtree: true });
  window.addEventListener("scroll", remember, { passive: true });
  remember();
  return () => {
    observer.disconnect();
    window.removeEventListener("scroll", remember);
  };
}
