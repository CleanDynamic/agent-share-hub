import { Extension } from '@tiptap/react';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

export interface SearchOptions {
  searchTerm: string;
  caseSensitive: boolean;
  regex: boolean;
  wholeWord: boolean;
  activeIndex: number; // index of the active match within results
}

export interface SearchMatch {
  from: number;
  to: number;
}

export interface SearchPluginState {
  options: SearchOptions;
  matches: SearchMatch[];
  decorations: DecorationSet;
}

export const searchPluginKey = new PluginKey<SearchPluginState>('searchHighlight');

const HIGHLIGHT_CLASS = 'sh-match';
const ACTIVE_CLASS = 'sh-match-active';

declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    searchHighlight: {
      setSearch: (opts: Partial<SearchOptions>) => ReturnType;
      clearSearch: () => ReturnType;
      gotoMatch: (index: number) => ReturnType;
      replaceCurrent: (replacement: string) => ReturnType;
      replaceAll: (replacement: string) => ReturnType;
    };
  }
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRegex(opts: SearchOptions): RegExp | null {
  const term = opts.searchTerm;
  if (!term) return null;
  const flags = `g${opts.caseSensitive ? '' : 'i'}`;
  let pattern = opts.regex ? term : escapeRegex(term);
  if (opts.wholeWord) pattern = `\\b(?:${pattern})\\b`;
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

/**
 * Walk the doc, building a flat plain-text version with a position map so we
 * can run a single regex over the whole document and translate matches back
 * to PM positions.
 */
function collectText(doc: PMNode) {
  let text = '';
  const map: number[] = []; // map[textIndex] = doc pos
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) {
        map.push(pos + i);
      }
      text += node.text;
    } else if (node.isBlock && text.length > 0 && !text.endsWith('\n')) {
      // Insert a separator that doesn't accidentally satisfy \b unexpectedly.
      text += '\n';
      map.push(pos);
    }
    return true;
  });
  return { text, map };
}

function findMatches(doc: PMNode, opts: SearchOptions): SearchMatch[] {
  const re = buildRegex(opts);
  if (!re) return [];
  const { text, map } = collectText(doc);
  if (!text) return [];
  const matches: SearchMatch[] = [];
  let m: RegExpExecArray | null;
  let safety = 0;
  while ((m = re.exec(text)) !== null) {
    if (safety++ > 10000) break;
    const start = m.index;
    const end = start + m[0].length;
    if (end === start) {
      re.lastIndex++;
      continue;
    }
    const fromPos = map[start];
    const toPos = (map[end - 1] ?? map[map.length - 1]) + 1;
    if (fromPos != null && toPos != null) {
      matches.push({ from: fromPos, to: toPos });
    }
  }
  return matches;
}

function buildDecorations(matches: SearchMatch[], activeIndex: number) {
  const decos = matches.map((mt, i) =>
    Decoration.inline(mt.from, mt.to, {
      class: i === activeIndex ? `${HIGHLIGHT_CLASS} ${ACTIVE_CLASS}` : HIGHLIGHT_CLASS,
    }),
  );
  return DecorationSet.empty.add(
    // empty doc node — but DecorationSet.add wants a doc; use create instead
    // Will be replaced via DecorationSet.create below.
    null as unknown as PMNode,
    decos,
  );
}

const DEFAULT_OPTIONS: SearchOptions = {
  searchTerm: '',
  caseSensitive: false,
  regex: false,
  wholeWord: false,
  activeIndex: 0,
};

export const SearchHighlight = Extension.create({
  name: 'searchHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchPluginState>({
        key: searchPluginKey,
        state: {
          init: (_config, state) => ({
            options: { ...DEFAULT_OPTIONS },
            matches: [],
            decorations: DecorationSet.empty,
          }),
          apply(tr, prev, _oldState, newState) {
            const meta = tr.getMeta(searchPluginKey) as
              | { options?: Partial<SearchOptions>; clear?: boolean }
              | undefined;

            let options = prev.options;
            let recompute = false;

            if (meta?.clear) {
              return {
                options: { ...DEFAULT_OPTIONS },
                matches: [],
                decorations: DecorationSet.empty,
              };
            }

            if (meta?.options) {
              options = { ...options, ...meta.options };
              recompute = true;
            }

            if (tr.docChanged) recompute = true;

            if (!recompute) {
              return {
                options,
                matches: prev.matches,
                decorations: prev.decorations.map(tr.mapping, tr.doc),
              };
            }

            const matches = findMatches(newState.doc, options);
            const activeIndex =
              matches.length === 0
                ? 0
                : Math.max(0, Math.min(options.activeIndex, matches.length - 1));
            const decorations = DecorationSet.create(
              newState.doc,
              matches.map((mt, i) =>
                Decoration.inline(mt.from, mt.to, {
                  class: i === activeIndex ? `${HIGHLIGHT_CLASS} ${ACTIVE_CLASS}` : HIGHLIGHT_CLASS,
                }),
              ),
            );
            return {
              options: { ...options, activeIndex },
              matches,
              decorations,
            };
          },
        },
        props: {
          decorations(state) {
            return searchPluginKey.getState(state)?.decorations ?? null;
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      setSearch:
        (opts) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchPluginKey, { options: opts });
            dispatch(tr);
          }
          return true;
        },
      clearSearch:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchPluginKey, { clear: true });
            dispatch(tr);
          }
          return true;
        },
      gotoMatch:
        (index) =>
        ({ tr, state, dispatch }) => {
          const ps = searchPluginKey.getState(state);
          if (!ps || ps.matches.length === 0) return false;
          const total = ps.matches.length;
          const next = ((index % total) + total) % total;
          if (dispatch) {
            tr.setMeta(searchPluginKey, { options: { activeIndex: next } });
            // scroll active into view
            const m = ps.matches[next];
            if (m) {
              tr.scrollIntoView();
            }
            dispatch(tr);
          }
          return true;
        },
      replaceCurrent:
        (replacement) =>
        ({ tr, state, dispatch }) => {
          const ps = searchPluginKey.getState(state);
          if (!ps || ps.matches.length === 0) return false;
          const m = ps.matches[ps.options.activeIndex] ?? ps.matches[0];
          if (!m) return false;
          if (dispatch) {
            tr.insertText(replacement, m.from, m.to);
            // After replacement, recompute by re-setting search options
            tr.setMeta(searchPluginKey, { options: { activeIndex: ps.options.activeIndex } });
            dispatch(tr);
          }
          return true;
        },
      replaceAll:
        (replacement) =>
        ({ tr, state, dispatch }) => {
          const ps = searchPluginKey.getState(state);
          if (!ps || ps.matches.length === 0) return false;
          // Apply from end to start so positions stay valid
          const sorted = [...ps.matches].sort((a, b) => b.from - a.from);
          for (const m of sorted) {
            tr.insertText(replacement, m.from, m.to);
          }
          if (dispatch) {
            tr.setMeta(searchPluginKey, { options: { activeIndex: 0 } });
            dispatch(tr);
          }
          return true;
        },
    };
  },
});

export function getSearchState(state: EditorState): SearchPluginState | undefined {
  return searchPluginKey.getState(state);
}
