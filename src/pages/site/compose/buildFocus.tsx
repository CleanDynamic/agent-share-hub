/* CA-26 P1: where the keyboard is on the build page.
   - `SkipToBuild`: the first focusable element on the page; hidden until focused; Enter moves focus to the build list's current item.
   - `useRovingList`: the build list is one Tab stop. Its tiles and heads take turns holding `tabindex="0"`; the arrows move between
     them; the controls inside an item leave the Tab order and are reached with Right and Left from the item.
   - `useItemRing`: the focus ring on an item that holds focus itself (the one `ring()` from controls.ts, spread only for a keyboard). */

import { useEffect, useRef, useState, type CSSProperties, type FocusEvent } from "react";

import { HEADER_HEIGHT } from "@/components/shell/chromeSize";
import { ROVING_ITEM, itemAt, itemKey, itemsOf, shown } from "@/lib/focus/buildItems";
import { ring } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";
import { useFoundRing } from "@/components/build/FindHit";
import { jumpToEdge } from "./largeBuild";
import { text } from "./refinedStyles";

import { takesKeys } from "./useBuildSelection";

const INNER = 'button, a[href], input, select, textarea, [role="button"], [contenteditable="true"], [tabindex]';
const innerOf = (item: HTMLElement): HTMLElement[] =>
  [...item.querySelectorAll<HTMLElement>(INNER)].filter((el) => el.closest(ROVING_ITEM) === item && !el.matches(ROVING_ITEM) && shown(el) && !el.hasAttribute("disabled"));

/** The item a Tab press lands on: the last one that had focus, or the first. */
export function currentBuildItem(): HTMLElement | null {
  const root = document.querySelector<HTMLElement>('[data-testid="build-list"]');
  if (!root) return null;
  return root.querySelector<HTMLElement>(`:is(${ROVING_ITEM})[tabindex="0"]`) ?? itemsOf(root)[0] ?? null;
}

/** Skip to build: focus goes to the build list's current item, or to the Build panel when the list has none. */
export function focusBuild(): boolean {
  const target = currentBuildItem() ?? document.querySelector<HTMLElement>('[aria-label="Build"]');
  if (!target) return false;
  target.focus();
  target.scrollIntoView?.({ block: "nearest" });
  return true;
}

export function useRovingList(rootRef: { current: HTMLElement | null }, onSelect?: (id: string) => void): void {
  const last = useRef<{ key: string; index: number } | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const lastEl = useRef<HTMLElement | null>(null);
  const bound = useRef<HTMLElement | null>(null);
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (root === bound.current) return;
    cleanup.current?.();
    bound.current = root;
    if (!root) return;

    const apply = () => {
      // The item that had focus was taken out of the page (Delete, a removal in a menu): focus goes to the item now in its place.
      if (lastEl.current && !lastEl.current.isConnected && (!document.activeElement || document.activeElement === document.body)) {
        const stand = itemAt(last.current);
        lastEl.current = null;
        stand?.focus();
      }
      const items = itemsOf(root);
      const at = last.current ? items.findIndex((item) => itemKey(item) === last.current?.key) : -1;
      const current = items[at >= 0 ? at : Math.min(last.current?.index ?? 0, Math.max(items.length - 1, 0))];
      for (const item of items) {
        const want = item === current ? "0" : "-1";
        if (item.getAttribute("tabindex") !== want) item.setAttribute("tabindex", want);
        for (const inner of innerOf(item)) if (inner.getAttribute("tabindex") !== "-1" && inner !== document.activeElement) inner.setAttribute("tabindex", "-1");
      }
    };
    apply();
    const watch = new MutationObserver(apply);
    watch.observe(root, { childList: true, subtree: true });

    const onFocusIn = (event: FocusEvent | globalThis.FocusEvent) => {
      const item = (event.target as HTMLElement | null)?.closest<HTMLElement>(ROVING_ITEM);
      if (!item) return;
      const items = itemsOf(root);
      last.current = { key: itemKey(item), index: Math.max(items.indexOf(item), 0) };
      lastEl.current = item;
      apply();
      item.scrollIntoView?.({ block: "nearest" });
    };

    const move = (items: HTMLElement[], to: HTMLElement | undefined) => {
      if (!to) return;
      to.focus();
      const id = to.dataset.nodeId ?? to.dataset.tileId;
      if (id) select.current?.(id);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const item = target?.closest<HTMLElement>(ROVING_ITEM);
      if (!target || !item) return;
      if (target === item) {
        const items = itemsOf(root);
        const at = items.indexOf(item);
        if (event.key === "ArrowDown") move(items, items[Math.min(at + 1, items.length - 1)]);
        else if (event.key === "ArrowUp") move(items, items[Math.max(at - 1, 0)]);
        else if (event.key === "Home" || event.key === "End") {
          // In a windowed build the first or last tile may not be drawn: it is chosen, drawn and gone to.
          const end = event.key === "End";
          if (!jumpToEdge(root, end, (id) => select.current?.(id))) move(items, end ? items.at(-1) : items[0]);
        }
        else if (event.key === "ArrowRight") {
          const first = innerOf(item)[0];
          if (!first) return;
          first.focus();
        } else return;
        event.preventDefault();
        // Not the item's own (a menu button opens on ArrowDown) and not the page's (the shortcuts move the selection by it).
        event.stopPropagation();
        return;
      }
      if (takesKeys(target) || (event.key !== "ArrowRight" && event.key !== "ArrowLeft")) return;
      const own = innerOf(item);
      const at = own.indexOf(target.closest<HTMLElement>(INNER) ?? target);
      if (at < 0) return;
      if (event.key === "ArrowRight") own[Math.min(at + 1, own.length - 1)]?.focus();
      else if (at === 0) item.focus();
      else own[at - 1]?.focus();
      event.preventDefault();
    };

    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("keydown", onKeyDown);
    cleanup.current = () => {
      watch.disconnect();
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("keydown", onKeyDown);
    };
  });

  useEffect(() => () => cleanup.current?.(), []);
}

/** The ring for an element that holds focus itself: only when the focus came from a keyboard. */
export function useItemRing(id?: string | null): { ring: CSSProperties; bind: { onFocus: (event: FocusEvent<HTMLElement>) => void; onBlur: (event: FocusEvent<HTMLElement>) => void } } {
  const [on, setOn] = useState(false);
  const found = useFoundRing(id);
  return {
    ring: { ...ring(on), ...found },
    bind: {
      onFocus: (event) => {
        if (event.target !== event.currentTarget) return;
        let keyboard = true;
        try {
          keyboard = event.currentTarget.matches(":focus-visible");
        } catch {
          keyboard = true;
        }
        setOn(keyboard);
      },
      onBlur: (event) => {
        if (event.target === event.currentTarget) setOn(false);
      },
    },
  };
}

/** "Skip to build": the page's first stop. Hidden until focused, then at the top-left of the composer box. */
export function SkipToBuild() {
  const [focused, setFocused] = useState(false);
  const hidden: CSSProperties = { position: "absolute", width: 1, height: 1, margin: -1, padding: 0, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 };
  const shown: CSSProperties = {
    position: "absolute",
    left: 18,
    top: HEADER_HEIGHT + 12,
    zIndex: 40,
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    height: 32,
    padding: "0 12px",
    borderRadius: 8,
    background: t.window,
    border: `1px solid ${t.windowBorder}`,
    textDecoration: "none",
    ...text(13, 500, t.text),
    ...ring(true),
  };
  return (
    <a
      href="#build"
      data-testid="skip-to-build"
      style={focused ? shown : hidden}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onClick={(event) => {
        if (focusBuild()) event.preventDefault();
      }}
    >
      Skip to build
    </a>
  );
}
