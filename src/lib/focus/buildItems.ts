// CA-26: the build list's items, as the keyboard and the windows' focus return see them.
//
// One definition of what holds a place in the arrow order (a tile, a session head, a part head), how one is told apart from
// another once the list redraws, and where focus lands when the element that had it is gone.

/** Everything in the build list that holds a place in the arrow order. */
export const ROVING_ITEM = '[data-testid="step-card"], [data-testid="sent-with-tile"], [data-testid="result-card"], [data-testid="session-head"], [data-testid="workstream-head"], [data-testid="add-to-session"], [data-testid="add-part-row"], [data-testid="add-session-row"]';

/** An item's name that survives a redraw: its node, its session, or its part. */
export const itemKey = (item: HTMLElement): string => {
  const node = item.dataset.nodeId ?? item.dataset.tileId;
  if (node) return `n:${node}`;
  const session = item.closest<HTMLElement>("[data-session-key]")?.dataset.sessionKey;
  if (item.dataset.testid === "session-head" && session) return `s:${session}`;
  if (item.dataset.workstreamKey) return `w:${item.dataset.workstreamKey}`;
  // An add row: named by the row and by the session or part it stands in.
  const scope = item.closest<HTMLElement>("[data-session-key]")?.dataset.sessionKey ?? "";
  if (item.dataset.testid?.startsWith("add-")) return `a:${item.dataset.testid}:${scope}`;
  return "";
};

/** Not `aria-hidden`: a menu or a window that is open hides the page behind it from assistive technology, and the page's items are still where they were. */
export const shown = (el: HTMLElement): boolean => !el.closest("[hidden]") && el.style.visibility !== "hidden";

export const itemsOf = (root: ParentNode): HTMLElement[] => [...root.querySelectorAll<HTMLElement>(ROVING_ITEM)].filter(shown);

export const buildListRoot = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-testid="build-list"]');

/** Where an element sat in the build: the item holding it, that item's name and its place among the items. */
export interface Place {
  key: string;
  index: number;
}

export function placeOf(el: Element | null): Place | null {
  const root = buildListRoot();
  const item = el?.closest<HTMLElement>(ROVING_ITEM);
  if (!root || !item || !root.contains(item)) return null;
  return { key: itemKey(item), index: Math.max(itemsOf(root).indexOf(item), 0) };
}

/** The item a place now points at: the same item, or the one now standing in its place, or the last one. */
export function itemAt(place: Place | null): HTMLElement | null {
  const root = buildListRoot();
  if (!root) return null;
  const items = itemsOf(root);
  if (place) {
    const same = place.key ? items.find((item) => itemKey(item) === place.key) : undefined;
    if (same) return same;
    if (items.length > 0) return items[Math.min(place.index, items.length - 1)];
  }
  return items[0] ?? null;
}

/** Focus the Build panel when the list has no item to take it. */
export const buildPanel = (): HTMLElement | null => document.querySelector<HTMLElement>('[aria-label="Build"]') ?? buildListRoot();
