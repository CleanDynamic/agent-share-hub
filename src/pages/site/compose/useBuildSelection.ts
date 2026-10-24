/* CA-20 P3: choosing several tiles and sessions at once, on the composer.

   Cmd or Ctrl click adds a tile or a session head to the selection (or takes it off), Shift click adds the range from the one
   chosen last. A plain click works as it does now, and ends a selection. Escape ends it. Cmd or Ctrl A, with no field or
   window taking the keys, chooses every tile; "Select all in this session" chooses one session's tiles. On a phone a long press
   starts choosing, and taps then add and take off until it is cleared.

   The cards are many and draw their own clicks, so the modifier keys are read where every click first passes (the document, in the
   capture phase) and held for that one event: `selectTile` is what the List's tiles call as they always have, and it knows
   whether the click carried a key. Nothing here writes to the build. */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { allTiles, extended, inOrder, kindsIn, orderOf, chosenKey, sameChosen, tilesOfSession, toggled, type Drawn, type Chosen, type ChosenKind } from "@/lib/build/buildSelection";

export interface BuildSelection {
  /** What is chosen, in the order the build is drawn. */
  items: Chosen[];
  size: number;
  tiles: ReadonlySet<string>;
  sessions: ReadonlySet<string>;
  isPicked: (kind: ChosenKind, id: string) => boolean;
  /** The List's tile click: with Cmd, Ctrl or Shift it chooses; without, it selects as it did and ends a selection. */
  selectTile: (id: string) => void;
  /** A session head's click. True when it was a choosing click (the head then does nothing else). */
  clickHead: (key: string, event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }) => boolean;
  clear: () => void;
  selectAll: () => void;
  selectSession: (key: string) => void;
  /** CA-25: chooses these session heads (those that are in the build), and no tiles. */
  selectSessions: (keys: readonly string[]) => void;
  /** A phone, once a long press has started choosing. */
  choosing: boolean;
}

const NONE = { meta: false, ctrl: false, shift: false };

/** Whether a key press belongs to a field, the post editor or a window: those keep their own keys. */
export function takesKeys(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.closest('[contenteditable="true"]')) return true;
  if (target.closest("input, textarea, select")) return true;
  return false;
}

/** A menu or a window is open: its own keys come first. */
export const overlayOpen = (): boolean => Boolean(document.querySelector('[role="menu"], [role="dialog"], [role="alertdialog"], [data-radix-popper-content-wrapper]'));

const LONG_PRESS_MS = 500;
const SLOP = 10;

export const BuildSelectionContext = createContext<BuildSelection | null>(null);
export const useBuildSelectionContext = (): BuildSelection | null => useContext(BuildSelectionContext);

export function useBuildSelection({ drawn, onSelect, phone }: { drawn: Drawn; onSelect: (id: string) => void; phone: boolean }): BuildSelection {
  const [chosen, setChosen] = useState<Chosen[]>([]);
  const [choosing, setChoosing] = useState(false);
  const order = useMemo(() => orderOf(drawn), [drawn]);
  const orderRef = useRef(order);
  orderRef.current = order;
  const drawnRef = useRef(drawn);
  drawnRef.current = drawn;
  const chosenRef = useRef(chosen);
  chosenRef.current = chosen;
  const choosingRef = useRef(choosing);
  choosingRef.current = choosing;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  /** The last one chosen, where Shift click starts. */
  const anchor = useRef<Chosen | null>(null);
  /** The keys the click being handled carried. */
  const mods = useRef(NONE);
  /** A long press just started choosing: the click that ends it is not a choosing click. */
  const swallow = useRef(false);

  const set = useCallback((next: Chosen[]) => {
    chosenRef.current = next;
    setChosen(next);
    if (next.length === 0) setChoosing(false);
  }, []);
  const clear = useCallback(() => {
    anchor.current = null;
    set([]);
  }, [set]);

  const choose = useCallback(
    (pick: Chosen, how: "toggle" | "range") => {
      const next = how === "range" ? extended(chosenRef.current, orderRef.current, anchor.current, pick) : toggled(chosenRef.current, pick);
      anchor.current = pick;
      set(next);
    },
    [set],
  );

  const selectTile = useCallback(
    (id: string) => {
      const pick: Chosen = { kind: "tile", id };
      const keys = mods.current;
      if (keys.meta || keys.ctrl) return choose(pick, "toggle");
      if (keys.shift) return choose(pick, "range");
      if (choosingRef.current) return choose(pick, "toggle");
      if (chosenRef.current.length > 0) clear();
      onSelectRef.current(id);
    },
    [choose, clear],
  );

  const clickHead = useCallback(
    (key: string, event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }): boolean => {
      const pick: Chosen = { kind: "session", id: key };
      if (event.metaKey || event.ctrlKey) choose(pick, "toggle");
      else if (event.shiftKey) choose(pick, "range");
      else if (choosingRef.current) choose(pick, "toggle");
      else return false;
      return true;
    },
    [choose],
  );

  const selectAll = useCallback(() => {
    const tiles = allTiles(orderRef.current);
    anchor.current = tiles.at(-1) ?? null;
    set(tiles);
  }, [set]);

  const selectSession = useCallback(
    (key: string) => {
      const tiles = tilesOfSession(drawnRef.current, key);
      anchor.current = tiles.at(-1) ?? null;
      set(tiles);
    },
    [set],
  );

  const selectSessions = useCallback(
    (keys: readonly string[]) => {
      const present = new Set(orderRef.current.map(chosenKey));
      const picks = keys.map((id): Chosen => ({ kind: "session", id })).filter((pick) => present.has(chosenKey(pick)));
      anchor.current = picks.at(-1) ?? null;
      set(picks);
    },
    [set],
  );

  /* The keys each click carries, read before any card sees it; held until the event has been handled. Shift keeps the browser from
     selecting text across the cards it is choosing. */
  useEffect(() => {
    let reset: number | undefined;
    const read = (event: MouseEvent | KeyboardEvent) => {
      mods.current = { meta: event.metaKey, ctrl: event.ctrlKey, shift: event.shiftKey };
      window.clearTimeout(reset);
      reset = window.setTimeout(() => {
        mods.current = NONE;
      }, 0);
    };
    const onMouseDown = (event: MouseEvent) => {
      if (event.shiftKey && event.target instanceof HTMLElement && event.target.closest("[data-node-id], [data-session-key]") && !takesKeys(event.target)) event.preventDefault();
    };
    const onClick = (event: MouseEvent) => {
      if (swallow.current) {
        swallow.current = false;
        event.stopPropagation();
        event.preventDefault();
        return;
      }
      read(event);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", read, true);
    document.addEventListener("mousedown", onMouseDown, true);
    return () => {
      window.clearTimeout(reset);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", read, true);
      document.removeEventListener("mousedown", onMouseDown, true);
    };
  }, []);

  /* A phone: a long press on a tile or a session head starts choosing. */
  useEffect(() => {
    if (!phone) return;
    let timer: number | undefined;
    let start: { x: number; y: number } | null = null;
    const stop = () => {
      window.clearTimeout(timer);
      start = null;
    };
    const down = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || !(event.target instanceof HTMLElement) || takesKeys(event.target)) return;
      const tile = event.target.closest<HTMLElement>("[data-node-id]");
      const head = event.target.closest<HTMLElement>("[data-session-key]");
      const pick: Chosen | null = tile?.dataset.nodeId ? { kind: "tile", id: tile.dataset.nodeId } : head?.dataset.sessionKey && event.target.closest('[data-testid="session-head"]') ? { kind: "session", id: head.dataset.sessionKey } : null;
      if (!pick) return;
      start = { x: event.clientX, y: event.clientY };
      timer = window.setTimeout(() => {
        swallow.current = true;
        window.setTimeout(() => (swallow.current = false), 600);
        setChoosing(true);
        choose(pick, "toggle");
      }, LONG_PRESS_MS);
    };
    const move = (event: PointerEvent) => {
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > SLOP) stop();
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerup", stop, true);
    document.addEventListener("pointercancel", stop, true);
    return () => {
      stop();
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", stop, true);
      document.removeEventListener("pointercancel", stop, true);
    };
  }, [phone, choose]);

  /* Escape ends it, once nothing else has taken the key (a menu or a window closes first); Cmd or Ctrl A chooses every tile. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && chosenRef.current.length > 0 && !overlayOpen() && !takesKeys(event.target)) {
        clear();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "a" && !takesKeys(event.target) && !overlayOpen()) {
        event.preventDefault();
        selectAll();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [clear, selectAll]);

  // Something taken out of the build is no longer chosen.
  useEffect(() => {
    const present = new Set(order.map(chosenKey));
    const kept = chosenRef.current.filter((entry) => present.has(chosenKey(entry)));
    if (kept.length !== chosenRef.current.length) set(kept);
  }, [order, set]);

  const items = useMemo(() => inOrder(chosen, order), [chosen, order]);
  const { tiles, sessions } = useMemo(() => {
    const kinds = kindsIn(chosen);
    return { tiles: new Set(kinds.tiles), sessions: new Set(kinds.sessions) };
  }, [chosen]);
  const isPicked = useCallback((kind: ChosenKind, id: string) => chosen.some((entry) => sameChosen(entry, { kind, id })), [chosen]);

  return useMemo(
    () => ({ items, size: chosen.length, tiles, sessions, isPicked, selectTile, clickHead, clear, selectAll, selectSession, selectSessions, choosing }),
    [items, chosen.length, tiles, sessions, isPicked, selectTile, clickHead, clear, selectAll, selectSession, selectSessions, choosing],
  );
}
