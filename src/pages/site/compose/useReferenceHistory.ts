/* CA-19 P2 — one undo history for every colour and link action, on the composer.

   A step is taken by `step(sentence, { move, edit })`: `edit` changes the post's links on a transaction (the composer's
   link panel, the colour picker, the group and Colours windows all come through here), `move` is a colour move from
   referenceGroups.ts whose link instructions are applied to the same transaction. The transaction goes to the editor with
   `addToHistory: false`, so the post's own Ctrl or Cmd Z still undoes typing only, and the colours go to the composer's
   writers. Then the step is recorded and its sentence becomes the notice.

   Every other edit of the post moves the steps' positions, as the editor's own history does. Undo and Redo put the links
   and the colours back exactly; a reload starts empty, and everything is already saved. */

import type { Editor } from "@tiptap/react";
import type { Transaction } from "@tiptap/pm/state";
import { useCallback, useEffect, useRef, useState } from "react";

import { applyLinkInstructions, applyRefChanges, refChangesOf } from "@/lib/build/linkRules";
import type { ColourMove, ColourWrites } from "@/lib/build/referenceGroups";
import {
  afterRedo,
  afterUndo,
  canRedo,
  canUndo,
  EMPTY_HISTORY,
  invertColours,
  mapHistory,
  record,
  takeRedo,
  takeUndo,
  type HistoryStep,
  type ReferenceHistory,
} from "@/lib/build/referenceHistory";

/** What an edit of the post's links reports: the words it wrote in, if any. False: nothing to do, no step. */
export type LinkEdit = (tr: Transaction) => { inserted?: { at: number; size: number } } | void | false;

export interface ReferenceHistoryInput {
  editor: Editor | null;
  /** Hands a move's writes to the composer's writers. */
  applyColours: (writes: ColourWrites) => void;
}

export interface Notice {
  sentence: string;
  /** Changes with every step, so the same sentence twice still restarts the notice. */
  n: number;
}

export interface ReferenceHistoryControls {
  step: (sentence: string, change: { move?: ColourMove | null; edit?: LinkEdit }) => boolean;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  notice: Notice | null;
  dismiss: () => void;
  /** Tests and dev pages: the history as it stands. */
  read: () => ReferenceHistory;
}

/** Marks the history's own transactions, which the editor's other listeners can tell apart. */
export const HISTORY_META = "referenceHistory";

export function useReferenceHistory({ editor, applyColours }: ReferenceHistoryInput): ReferenceHistoryControls {
  const history = useRef<ReferenceHistory>(EMPTY_HISTORY);
  const [, redraw] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const applyRef = useRef(applyColours);
  applyRef.current = applyColours;
  const set = (next: ReferenceHistory) => {
    history.current = next;
    redraw((n) => n + 1);
  };

  // Every edit of the post moves the positions the steps hold.
  useEffect(() => {
    if (!editor) return;
    const onTransaction = ({ transaction }: { transaction: Transaction }) => {
      if (!transaction.docChanged) return;
      history.current = mapHistory(history.current, (pos, assoc) => transaction.mapping.map(pos, assoc));
    };
    editor.on("transaction", onTransaction);
    return () => {
      editor.off("transaction", onTransaction);
    };
  }, [editor]);

  const live = editor && !editor.isDestroyed ? editor : null;

  const step = useCallback(
    (sentence: string, { move, edit }: { move?: ColourMove | null; edit?: LinkEdit }) => {
      let refs: HistoryStep["refs"];
      if (live && (edit || move?.links)) {
        const before = live.state.doc;
        const tr = live.state.tr;
        const result = edit ? edit(tr) : undefined;
        if (result === false) return false;
        applyLinkInstructions(tr, move?.links);
        if (tr.docChanged) {
          tr.setMeta("addToHistory", false).setMeta(HISTORY_META, true);
          refs = refChangesOf(before, tr, result ? result.inserted : undefined);
          live.view.dispatch(tr);
        }
      } else if (edit) return false;
      const colours = move ? { writes: move.writes, undo: move.undo } : undefined;
      if (colours) applyRef.current(colours.writes);
      if (!colours && !refs?.length) return false;
      set(record(history.current, { sentence, ...(colours ? { colours } : null), ...(refs?.length ? { refs } : null) }));
      setNotice((current) => ({ sentence, n: (current?.n ?? 0) + 1 }));
      return true;
    },
    [live],
  );

  /** Puts a step back the other way, and returns its inverse. */
  const reverse = useCallback(
    (taken: HistoryStep): HistoryStep => {
      let refs: HistoryStep["refs"];
      if (taken.refs?.length && live) {
        const tr = live.state.tr;
        refs = applyRefChanges(tr, taken.refs);
        tr.setMeta("addToHistory", false).setMeta(HISTORY_META, true);
        live.view.dispatch(tr);
      }
      if (taken.colours) applyRef.current(taken.colours.undo);
      const colours = invertColours(taken);
      return { sentence: taken.sentence, ...(colours ? { colours } : null), ...(refs ? { refs } : null) };
    },
    [live],
  );

  const undo = useCallback(() => {
    const taken = takeUndo(history.current);
    if (!taken) return;
    history.current = taken.history;
    set(afterUndo(history.current, reverse(taken.step)));
    setNotice(null);
  }, [reverse]);

  const redo = useCallback(() => {
    const taken = takeRedo(history.current);
    if (!taken) return;
    history.current = taken.history;
    set(afterRedo(history.current, reverse(taken.step)));
    setNotice(null);
  }, [reverse]);

  return {
    step,
    undo,
    redo,
    canUndo: canUndo(history.current),
    canRedo: canRedo(history.current),
    notice,
    dismiss: useCallback(() => setNotice(null), []),
    read: () => history.current,
  };
}

/**
 * Ctrl or Cmd Z undoes, and Ctrl or Cmd Shift Z redoes, while one of the reference windows is open (the link panel, the
 * colour picker, the group window, the Colours window). Heard first, so the post's own history never sees them then.
 */
export function useHistoryKeys(active: boolean, controls: Pick<ReferenceHistoryControls, "undo" | "redo">): void {
  const ref = useRef(controls);
  ref.current = controls;
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      event.preventDefault();
      event.stopPropagation();
      if (key === "y" || event.shiftKey) ref.current.redo();
      else ref.current.undo();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active]);
}
