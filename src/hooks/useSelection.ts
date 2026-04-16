import { useCallback } from 'react';

import {
  useDocumentStore,
  type Selection,
  type SelectionKind,
} from '@/lib/documentStore';
import { eventBus } from '@/lib/eventBus';

export type AddableSelectionKind = Extract<
  SelectionKind,
  'block' | 'stage' | 'arrow'
>;

function toEventPayload(sel: Selection): {
  blockIds: readonly string[];
  arrowIds: readonly string[];
} {
  if (sel.kind === 'block') return { blockIds: sel.ids, arrowIds: [] };
  if (sel.kind === 'arrow') return { blockIds: [], arrowIds: sel.ids };
  return { blockIds: [], arrowIds: [] };
}

function selectionsEqual(a: Selection, b: Selection): boolean {
  if (a === b) return true;
  if (a.kind !== b.kind) return false;
  if (a.range !== b.range) return false;
  if (a.ids.length !== b.ids.length) return false;
  for (let i = 0; i < a.ids.length; i++) {
    if (a.ids[i] !== b.ids[i]) return false;
  }
  return true;
}

// Module-level subscription so the event fires exactly once per real change,
// regardless of how many components use the hook.
useDocumentStore.subscribe((state, prevState) => {
  if (selectionsEqual(state.selection, prevState.selection)) return;
  eventBus.emit('selection:change', toEventPayload(state.selection));
});

export function useSelection() {
  const selection = useDocumentStore((s) => s.selection);
  const setSelection = useDocumentStore((s) => s.setSelection);
  const clearSelection = useDocumentStore((s) => s.clearSelection);

  const selectProse = useCallback(
    (range?: unknown) => {
      setSelection({ kind: 'prose', ids: [], range });
    },
    [setSelection],
  );

  const selectBlock = useCallback(
    (id: string) => {
      setSelection({ kind: 'block', ids: [id] });
    },
    [setSelection],
  );

  const selectStage = useCallback(
    (id: string) => {
      setSelection({ kind: 'stage', ids: [id] });
    },
    [setSelection],
  );

  const selectArrow = useCallback(
    (id: string) => {
      setSelection({ kind: 'arrow', ids: [id] });
    },
    [setSelection],
  );

  const addToSelection = useCallback(
    (id: string, kind: AddableSelectionKind) => {
      const current = useDocumentStore.getState().selection;
      if (current.kind === kind) {
        if (current.ids.includes(id)) return;
        setSelection({ kind, ids: [...current.ids, id] });
        return;
      }
      setSelection({ kind, ids: [id] });
    },
    [setSelection],
  );

  const clear = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const isSelected = useCallback(
    (id: string): boolean => selection.ids.includes(id),
    [selection],
  );

  return {
    selection,
    selectProse,
    selectBlock,
    selectStage,
    selectArrow,
    addToSelection,
    clear,
    isSelected,
  };
}
