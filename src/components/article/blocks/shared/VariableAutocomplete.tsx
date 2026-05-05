/**
 * VariableAutocomplete
 *
 * Hook + popover that watches a textarea / input for `{{` triggers and shows
 * a list of named blocks the user can insert.
 *
 * Usage:
 *   const ref = React.useRef<HTMLTextAreaElement>(null);
 *   const ac = useVariableAutocomplete({
 *     value: prompt,
 *     onChange: setPrompt,
 *     ref,
 *     blocks: allBlocks,
 *     selfId: blockId,
 *   });
 *   <textarea ref={ref} ... />
 *   {ac.popover}
 */

import * as React from 'react';
import { listNamedBlocks } from '@/lib/variables';
import type { Block } from '@/types/document';

interface UseAutocompleteArgs {
  value: string;
  onChange: (next: string) => void;
  ref: React.RefObject<HTMLTextAreaElement | HTMLInputElement>;
  blocks: Record<string, Block>;
  selfId: string;
}

interface PopoverState {
  open: boolean;
  triggerStart: number; // index of the first char of the `{{`
  query: string;
  top: number;
  left: number;
  highlight: number;
}

const TYPE_COLOR: Record<string, string> = {
  prompt: '#8B5CF6',
  code: '#22C55E',
  text: 'rgba(255,255,255,0.6)',
  result: '#3B82F6',
  agent: '#E8571A',
  tool: '#06B6D4',
  model: '#EC4899',
  workflow: '#F59E0B',
  heading: '#FBBF24',
  resource: '#14B8A6',
  note: '#A78BFA',
};

export function useVariableAutocomplete({
  value,
  onChange,
  ref,
  blocks,
  selfId,
}: UseAutocompleteArgs) {
  const [state, setState] = React.useState<PopoverState>({
    open: false,
    triggerStart: -1,
    query: '',
    top: 0,
    left: 0,
    highlight: 0,
  });

  const named = React.useMemo(
    () => listNamedBlocks(blocks).filter((b) => b.id !== selfId),
    [blocks, selfId],
  );

  const filtered = React.useMemo(() => {
    if (!state.open) return named;
    const q = state.query.toLowerCase();
    if (!q) return named;
    return named.filter((b) => b.name.toLowerCase().includes(q));
  }, [named, state]);

  const close = React.useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  /**
   * Inspect the caret position after every change to decide whether the
   * popover should be open and what the current query is.
   */
  const updateFromCaret = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart ?? value.length;
    // Search backwards for the most recent `{{` that hasn't been closed.
    const before = value.slice(0, caret);
    const triggerIdx = before.lastIndexOf('{{');
    if (triggerIdx === -1) {
      close();
      return;
    }
    const between = before.slice(triggerIdx + 2);
    // Cancel if user typed `}}` or whitespace/newline after the trigger.
    if (/[}\n]/.test(between) || /\s/.test(between)) {
      close();
      return;
    }
    // Position the popover just below the input.
    const rect = el.getBoundingClientRect();
    setState({
      open: true,
      triggerStart: triggerIdx,
      query: between,
      top: rect.bottom + 4,
      left: rect.left + 12,
      highlight: 0,
    });
  }, [ref, value, close]);

  const onInput = React.useCallback(() => {
    updateFromCaret();
  }, [updateFromCaret]);

  const insert = React.useCallback(
    (name: string) => {
      const el = ref.current;
      if (!el) return;
      const caret = el.selectionStart ?? value.length;
      const head = value.slice(0, state.triggerStart);
      const tail = value.slice(caret);
      const inserted = `{{${name}}}`;
      const next = head + inserted + tail;
      onChange(next);
      close();
      // Restore caret position after the inserted token.
      requestAnimationFrame(() => {
        const pos = head.length + inserted.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    },
    [close, onChange, ref, state.triggerStart, value],
  );

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      if (!state.open || filtered.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setState((s) => ({
          ...s,
          highlight: (s.highlight + 1) % filtered.length,
        }));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setState((s) => ({
          ...s,
          highlight: (s.highlight - 1 + filtered.length) % filtered.length,
        }));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insert(filtered[state.highlight].name);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    },
    [state, filtered, insert, close],
  );

  // Close on click outside.
  React.useEffect(() => {
    if (!state.open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-variable-autocomplete-popover]')) return;
      if (target === ref.current) return;
      close();
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [state.open, close, ref]);

  const popover = state.open ? (
    <div
      data-variable-autocomplete-popover
      className="fixed z-[100] min-w-[200px] max-w-[280px] py-1 rounded-md shadow-lg"
      style={{
        top: state.top,
        left: state.left,
        background: 'rgba(22,22,30,0.98)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {filtered.length === 0 ? (
        <div className="px-3 py-2 text-[11px] text-white/40">
          No named blocks{state.query ? ` match "${state.query}"` : ''}.
        </div>
      ) : (
        filtered.map((b, i) => (
          <button
            key={b.id}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              insert(b.name);
            }}
            onMouseEnter={() =>
              setState((s) => ({ ...s, highlight: i }))
            }
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11.5px] transition-colors"
            style={{
              background:
                i === state.highlight ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{
                background:
                  TYPE_COLOR[b.type] ?? 'rgba(255,255,255,0.4)',
              }}
            />
            <span className="truncate">{b.name}</span>
            <span className="ml-auto text-[10px] uppercase tracking-wider text-white/35">
              {b.type}
            </span>
          </button>
        ))
      )}
    </div>
  ) : null;

  return { popover, onKeyDown, onInput };
}
