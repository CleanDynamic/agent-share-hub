/* MS-06 — the map editor's state: the layout, what is selected, what a tool would do, undo and saving. Every tool (MS-07 to
   MS-12) changes the map only through `apply`.

   THE LAYOUT. The stored one, or the plain arrangement (`startFromBuild`) until the first change (README Decision 4). The
   first change writes the whole layout at once, which makes the plain arrangement real; after that each step is saved
   400 ms after the last one, so three quick changes are one write. A save that fails says so the way the composer's other
   writes do (`onSaveError`, the error toast with Retry) and leaves the layout on screen; the next change saves it again.

   UNDO. The map keeps its own steps, 100 of them, separate from the build's history (`useBuildHistory`): that one holds 50
   database writes undone through the node queue, and its Ctrl Z acts wherever the focus is, so a Ctrl Z in the List would
   take back a map change the maker can't see. One `apply` is one step, whatever adjustments the operation made with it.

   THE BUILD CHANGING. A tile added in the List is unplaced (it shows in "On the map", not on the canvas); a tile the build
   no longer has stays in its box as "Removed from the build" (README Decision 6). Whatever the layout now breaks in the
   build's order, or a two-way arrow no longer allowed or no longer level, is listed in `problems`, checked on the geometry
   the canvas drew (`setGeometry`), and nothing changes until the maker presses Fix. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { geometryOf, type MapGeometry, type Measure } from "@/lib/build/mapGeometry";
import { boxOfTile, nodeById, sortTiles, unplaceTile, type MapLayout, type TreeResult } from "@/lib/build/mapLayout";
import { orderProblems, tileOptionsOf, twoWayProblems, type OrderFacts } from "@/lib/build/mapOrder";

/** One user action is one step; this many are kept. */
export const MAP_UNDO_LIMIT = 100;
/** A step is saved this long after the last one. */
export const MAP_SAVE_DEBOUNCE_MS = 400;

export const MAP_EDITOR_COPY = {
  undone: (sentence: string) => `Undone: ${sentence}`,
  redone: (sentence: string) => `Redone: ${sentence}`,
  nothingToUndo: "Nothing to undo on the map.",
  nothingToRedo: "Nothing to redo on the map.",
  saveFailed: "Couldn't save the map. Try again.",
  fixed: "The map follows the build again.",
};

/** Where a refusal is shown: by the pointer during a drag, or under the floating bar after a click. */
export type RefusalAt = { pointer: { x: number; y: number } } | "selection";

export interface MapRefusal {
  reason: string;
  at: RefusalAt;
  /** Changes with every refusal, so the same reason twice is shown and announced again. */
  n: number;
}

/** Something the layout no longer allows after the build changed: a broken order or a two-way arrow. */
export interface MapProblem {
  kind: "order" | "twoWay";
  sentence: string;
}

export interface MapEditorInput {
  /** The stored layout as the canvas reads it (`fromStorage`), or null when nothing is stored. */
  stored: MapLayout | null;
  /** The plain arrangement, drawn until the first change. */
  plain: MapLayout;
  /** Write a layout (the page: `setMapLayout` through the node queue, legacy keys swapped out first). */
  save: (layout: MapLayout) => Promise<unknown>;
  /** The composer's live region. */
  announce: (message: string) => void;
  /** A save failed: the composer's own save error, with a retry. */
  onSaveError?: (cause: unknown, retry: () => void) => void;
  /** The build's order, for the checks and Fix. Absent: no checks. */
  facts?: OrderFacts;
}

interface Step {
  layout: MapLayout;
  sentence: string;
}

export interface MapEditor {
  layout: MapLayout;
  /** Node or tile ids. A tile and a box are never selected together, and tiles one at a time. */
  selected: string[];
  /** Select a box or a tile; `add` (Shift) adds a box to boxes already selected. Null clears. */
  select: (id: string | null, add?: boolean) => void;
  hover: string | null;
  setHover: (id: string | null) => void;
  /** What a tool would do, drawn over the layout at 60% until it applies or is left (MS-07). */
  preview: MapLayout | null;
  setPreview: (layout: MapLayout | null) => void;
  /** The one way a tool changes the map. */
  apply: (result: TreeResult, sentence: string, at?: RefusalAt) => boolean;
  /** A result checked against the build's order, as `apply` checks it: for a tool that tries several places. */
  check: (result: TreeResult) => TreeResult;
  /** Show and announce a refusal that didn't come from an operation (a drag over a place that isn't allowed). */
  refuse: (reason: string, at?: RefusalAt) => void;
  refusal: MapRefusal | null;
  clearRefusal: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** The canvas's geometry for the layout it drew, and the measure it used. */
  setGeometry: (layout: MapLayout, geometry: MapGeometry, measure?: Measure) => void;
  /** The geometry of the layout on screen, once the canvas has drawn it. */
  geometry: MapGeometry | null;
  /** The measure the canvas drew with, to lay out a preview the same way (MS-07). */
  measure: Measure | null;
  problems: MapProblem[];
  fix: () => void;
  /** Whether a layout has been written (or the stored one exists). */
  stored: boolean;
}

export function useMapEditor({ stored, plain, save, announce, onSaveError, facts }: MapEditorInput): MapEditor {
  /** The layout once the maker has changed something this visit; null until then. */
  const [local, setLocal] = useState<MapLayout | null>(null);
  const layout = local ?? stored ?? plain;
  const [past, setPast] = useState<Step[]>([]);
  const [future, setFuture] = useState<Step[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [hover, setHover] = useState<string | null>(null);
  const [preview, setPreview] = useState<MapLayout | null>(null);
  const [refusal, setRefusal] = useState<MapRefusal | null>(null);
  const [drawn, setDrawn] = useState<{ layout: MapLayout; geometry: MapGeometry } | null>(null);
  const measure = useRef<Measure | null>(null);
  const [sizes, setSizes] = useState<Measure | null>(null);

  const latest = useRef({ save, announce, onSaveError, layout });
  latest.current = { save, announce, onSaveError, layout };

  /* ── saving ── */
  const written = useRef(stored !== null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<MapLayout | null>(null);
  const write = useCallback((next: MapLayout) => {
    const retry = () => write(latest.current.layout);
    latest.current.save(next).then(
      () => {
        written.current = true;
      },
      (cause: unknown) => latest.current.onSaveError?.(cause, retry),
    );
  }, []);
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const next = pending.current;
    pending.current = null;
    if (next) write(next);
  }, [write]);
  const schedule = useCallback(
    (next: MapLayout) => {
      pending.current = next;
      // The first change makes the plain arrangement real at once; later steps wait for a pause.
      if (!written.current) return flush();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, MAP_SAVE_DEBOUNCE_MS);
    },
    [flush],
  );
  // Leaving the editor writes what is still waiting.
  useEffect(() => flush, [flush]);

  /* ── selection ── */
  const isBox = useCallback((id: string) => nodeById(layout, id)?.kind === "box", [layout]);
  const select = useCallback(
    (id: string | null, add = false) => {
      setRefusal(null);
      if (id === null) return setSelected([]);
      setSelected((was) => {
        if (add && isBox(id) && was.length > 0 && was.every(isBox)) return was.includes(id) ? was.filter((each) => each !== id) : [...was, id];
        return [id];
      });
    },
    [isBox],
  );
  /** What is selected that the layout still has. A tile counts while some box holds it. */
  const keep = useCallback((ids: string[], next: MapLayout) => ids.filter((id) => nodeById(next, id) || boxOfTile(next, id)), []);

  /* ── steps ── */
  const move = useCallback(
    (next: MapLayout) => {
      setLocal(next);
      setPreview(null);
      setSelected((was) => keep(was, next));
      schedule(next);
    },
    [keep, schedule],
  );
  const refuse = useCallback((reason: string, at: RefusalAt = "selection") => {
    setRefusal((was) => ({ reason, at, n: (was?.n ?? 0) + 1 }));
    latest.current.announce(reason);
  }, []);
  /**
   * A step may never put a later tile before an earlier one: with the build's facts and the canvas's measure, a result that
   * breaks an order fact the layout didn't already break is refused with that fact's sentence.
   */
  const check = useCallback(
    (result: TreeResult): TreeResult => {
      const drawnWith = measure.current;
      if (!("layout" in result) || !facts || !drawnWith) return result;
      const now = latest.current.layout;
      const known = new Set(orderProblems(now, geometryOf(now, drawnWith), facts).map((fact) => fact.sentence));
      const fresh = orderProblems(result.layout, geometryOf(result.layout, drawnWith), facts).find((fact) => !known.has(fact.sentence));
      return fresh ? { ok: false, reason: fresh.sentence } : result;
    },
    [facts],
  );
  const apply = useCallback(
    (proposed: TreeResult, sentence: string, at?: RefusalAt) => {
      const result = check(proposed);
      if ("reason" in result) {
        refuse(result.reason, at);
        return false;
      }
      setRefusal(null);
      const before = latest.current.layout;
      setPast((was) => [...was, { layout: before, sentence }].slice(-MAP_UNDO_LIMIT));
      setFuture([]);
      move(result.layout);
      latest.current.announce(sentence);
      return true;
    },
    [move, refuse, check],
  );
  const undo = useCallback(() => {
    setRefusal(null);
    const step = past.at(-1);
    if (!step) return latest.current.announce(MAP_EDITOR_COPY.nothingToUndo);
    setPast(past.slice(0, -1));
    setFuture((was) => [...was, { layout: latest.current.layout, sentence: step.sentence }].slice(-MAP_UNDO_LIMIT));
    move(step.layout);
    latest.current.announce(MAP_EDITOR_COPY.undone(step.sentence));
  }, [past, move]);
  const redo = useCallback(() => {
    setRefusal(null);
    const step = future.at(-1);
    if (!step) return latest.current.announce(MAP_EDITOR_COPY.nothingToRedo);
    setFuture(future.slice(0, -1));
    setPast((was) => [...was, { layout: latest.current.layout, sentence: step.sentence }].slice(-MAP_UNDO_LIMIT));
    move(step.layout);
    latest.current.announce(MAP_EDITOR_COPY.redone(step.sentence));
  }, [future, move]);

  /* ── the build changing ── */
  const setGeometry = useCallback((of: MapLayout, geometry: MapGeometry, given?: Measure) => {
    if (given) {
      measure.current = given;
      setSizes(given);
    }
    setDrawn((was) => (was?.layout === of && was.geometry === geometry ? was : { layout: of, geometry }));
  }, []);
  const geometry = drawn?.layout === layout ? drawn.geometry : null;
  const problems = useMemo<MapProblem[]>(() => {
    if (!facts || !geometry) return [];
    return [
      ...orderProblems(layout, geometry, facts).map((fact): MapProblem => ({ kind: "order", sentence: fact.sentence })),
      ...twoWayProblems(layout, geometry, facts).map((problem): MapProblem => ({ kind: "twoWay", sentence: problem.reason })),
    ];
  }, [facts, geometry, layout]);
  const fix = useCallback(() => {
    if (!facts || !geometry) return;
    const { buildOrder } = tileOptionsOf(facts);
    // Tiles inside a box go back into build order; a tile that still reads before an earlier one in another box comes off
    // the canvas (it is unplaced, and can be placed again); a two-way arrow no longer allowed or level is removed.
    const sorted = sortTiles(layout, buildOrder);
    let next = "layout" in sorted ? sorted.layout : layout;
    for (const fact of orderProblems(layout, geometry, facts)) {
      const a = boxOfTile(next, fact.before);
      const b = boxOfTile(next, fact.after);
      if (!a || !b || a.id === b.id) continue;
      const out = unplaceTile(next, fact.after);
      if ("layout" in out) next = out.layout;
    }
    const gone = new Set(twoWayProblems(layout, geometry, facts).map((problem) => problem.index));
    if (gone.size) next = { ...next, twoWay: next.twoWay.filter((_, at) => !gone.has(at)) };
    apply({ ok: true, layout: next, changed: [] }, MAP_EDITOR_COPY.fixed);
  }, [facts, geometry, layout, apply]);

  return {
    layout,
    selected,
    select,
    hover,
    setHover,
    preview,
    setPreview,
    apply,
    check,
    refuse,
    refusal,
    clearRefusal: useCallback(() => setRefusal(null), []),
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    setGeometry,
    geometry,
    measure: sizes,
    problems,
    fix,
    stored: stored !== null || local !== null,
  };
}
