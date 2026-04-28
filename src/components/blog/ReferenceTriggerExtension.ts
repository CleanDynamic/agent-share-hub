import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * ReferenceTriggerExtension
 *
 * When the user types `@` at the start of a word (start of line, or after
 * whitespace), opens the ReferencePickerModal. Tracks subsequent typed text
 * as the picker query, and tracks the trigger range so the host can later
 * delete it and replace it with an inline reference node.
 *
 * Loaded ONLY in blog mode. In blueprint mode `@` is a literal character.
 *
 * Lifecycle is controlled via callbacks passed by the editor host:
 *  - onOpen({ from, to, coords }): trigger fired
 *  - onUpdate({ from, to, query }): user typed/deleted within the range
 *  - onClose(): user broke the trigger (space, newline, escape outside)
 */

export interface ReferenceTriggerCallbacks {
  onOpen: (payload: {
    from: number;
    to: number;
    coords: { top: number; left: number; bottom: number };
  }) => void;
  onUpdate: (payload: { from: number; to: number; query: string }) => void;
  onClose: () => void;
}

const triggerKey = new PluginKey('referenceTrigger');

export const ReferenceTriggerExtension = Extension.create<ReferenceTriggerCallbacks>({
  name: 'referenceTrigger',

  addOptions() {
    return {
      onOpen: () => {},
      onUpdate: () => {},
      onClose: () => {},
    } as ReferenceTriggerCallbacks;
  },

  addProseMirrorPlugins() {
    const ext = this;

    let activeStart: number | null = null;

    return [
      new Plugin({
        key: triggerKey,
        props: {
          handleTextInput(view, from, _to, text) {
            if (text !== '@') return false;
            const { state } = view;
            const $pos = state.doc.resolve(from);
            const before = $pos.parent.textContent.slice(0, $pos.parentOffset);
            const charBefore = before.slice(-1);
            const isWordStart = before.length === 0 || /\s/.test(charBefore);
            if (!isWordStart) return false;

            // Allow the @ to be inserted, then schedule open.
            queueMicrotask(() => {
              const start = from;
              activeStart = start;
              const coords = view.coordsAtPos(start + 1);
              ext.options.onOpen({
                from: start,
                to: start + 1,
                coords: {
                  top: coords.top,
                  bottom: coords.bottom,
                  left: coords.left,
                },
              });
            });

            return false;
          },
        },
        appendTransaction(transactions, _oldState, newState) {
          if (activeStart == null) return null;

          // If document changed, recompute the active query and notify.
          const docChanged = transactions.some((tr) => tr.docChanged);
          if (!docChanged && !transactions.some((tr) => tr.selectionSet))
            return null;

          const start = activeStart;
          const cursorPos = newState.selection.from;

          // If cursor moved before the trigger, close.
          if (cursorPos <= start) {
            activeStart = null;
            ext.options.onClose();
            return null;
          }

          // Read text from start to cursor; first char must still be '@'.
          const slice = newState.doc.textBetween(start, cursorPos, '\n', '\n');
          if (!slice.startsWith('@')) {
            activeStart = null;
            ext.options.onClose();
            return null;
          }

          const query = slice.slice(1);
          if (query.includes(' ') || query.includes('\n')) {
            activeStart = null;
            ext.options.onClose();
            return null;
          }

          ext.options.onUpdate({ from: start, to: cursorPos, query });
          return null;
        },
      }),
    ];
  },
});

// Convenience helper exported alongside so the host can imperatively close.
export function makeReferenceTriggerExtension(callbacks: ReferenceTriggerCallbacks) {
  return ReferenceTriggerExtension.configure(callbacks);
}
