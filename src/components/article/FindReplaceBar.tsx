import * as React from 'react';
import type { Editor } from '@tiptap/react';
import {
  ChevronUp,
  ChevronDown,
  X,
  CaseSensitive,
  Regex,
  WholeWord,
  ChevronRight,
} from 'lucide-react';
import { searchPluginKey } from './SearchHighlight';
import { useDocumentStore } from '@/lib/documentStore';

interface FindReplaceBarProps {
  editor: Editor | null;
  open: boolean;
  showReplace: boolean;
  onClose: () => void;
  onToggleReplace: (open: boolean) => void;
}

const BAR_HEIGHT = 40;

const inputStyle: React.CSSProperties = {
  height: 26,
  borderRadius: 6,
  border: '1px solid hsl(var(--foreground) / 0.1)',
  background: 'hsl(var(--foreground) / 0.04)',
  color: 'hsl(var(--foreground) / 0.95)',
  padding: '0 8px',
  fontSize: 12,
  outline: 'none',
  fontFamily: 'Inter, sans-serif',
};

interface IconBtnProps {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}

function IconBtn({ active, disabled, title, onClick, children }: IconBtnProps) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 26,
        height: 26,
        borderRadius: 6,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        border: 'none',
        background: active
          ? 'hsl(var(--foreground) / 0.14)'
          : hover
            ? 'hsl(var(--foreground) / 0.08)'
            : 'transparent',
        color: active ? 'hsl(18 79% 60%)' : 'hsl(var(--foreground) / 0.75)',
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

function TextBtn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 26,
        padding: '0 8px',
        borderRadius: 6,
        border: '1px solid hsl(var(--foreground) / 0.1)',
        background: hover ? 'hsl(var(--foreground) / 0.1)' : 'hsl(var(--foreground) / 0.06)',
        color: 'hsl(var(--foreground) / 0.9)',
        fontSize: 11,
        fontWeight: 500,
        fontFamily: 'Inter, sans-serif',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function FindReplaceBar({
  editor,
  open,
  showReplace,
  onClose,
  onToggleReplace,
}: FindReplaceBarProps) {
  const [term, setTerm] = React.useState('');
  const [replacement, setReplacement] = React.useState('');
  const [caseSensitive, setCaseSensitive] = React.useState(false);
  const [useRegex, setUseRegex] = React.useState(false);
  const [wholeWord, setWholeWord] = React.useState(false);
  const [, forceTick] = React.useReducer((x: number) => x + 1, 0);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const blocks = useDocumentStore((s) => s.blocks);
  const setSelection = useDocumentStore((s) => s.setSelection);

  // Push search options into the plugin whenever they change
  React.useEffect(() => {
    if (!editor) return;
    if (!open) {
      editor.commands.clearSearch();
      return;
    }
    editor.commands.setSearch({
      searchTerm: term,
      caseSensitive,
      regex: useRegex,
      wholeWord,
    });
  }, [editor, open, term, caseSensitive, useRegex, wholeWord]);

  // Re-render when plugin state changes
  React.useEffect(() => {
    if (!editor) return;
    const handler = () => forceTick();
    editor.on('transaction', handler);
    editor.on('selectionUpdate', handler);
    return () => {
      editor.off('transaction', handler);
      editor.off('selectionUpdate', handler);
    };
  }, [editor]);

  // Autofocus search when bar opens
  React.useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 10);
    }
  }, [open]);

  const pluginState = editor ? searchPluginKey.getState(editor.state) : undefined;
  const matches = pluginState?.matches ?? [];
  const activeIndex = pluginState?.options.activeIndex ?? 0;
  const total = matches.length;

  // Block-content matches (canvas blocks)
  const blockMatches = React.useMemo(() => {
    if (!term) return [];
    const flags = `g${caseSensitive ? '' : 'i'}`;
    let pattern = useRegex ? term : term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (wholeWord) pattern = `\\b(?:${pattern})\\b`;
    let re: RegExp;
    try {
      re = new RegExp(pattern, flags);
    } catch {
      return [];
    }
    const out: { blockId: string; field: string; preview: string }[] = [];
    Object.values(blocks).forEach((block) => {
      const props = (block.properties ?? {}) as Record<string, unknown>;
      Object.entries(props).forEach(([key, val]) => {
        if (typeof val !== 'string' || !val) return;
        if (re.test(val)) {
          out.push({
            blockId: block.id,
            field: key,
            preview: val.slice(0, 80),
          });
          re.lastIndex = 0;
        }
      });
    });
    return out;
  }, [blocks, term, caseSensitive, useRegex, wholeWord]);

  const next = () => editor?.commands.gotoMatch(activeIndex + 1);
  const prev = () => editor?.commands.gotoMatch(activeIndex - 1);

  const doReplace = () => {
    if (!editor || total === 0) return;
    editor.commands.replaceCurrent(replacement);
    // Re-trigger search after replace
    setTimeout(() => {
      editor.commands.setSearch({
        searchTerm: term,
        caseSensitive,
        regex: useRegex,
        wholeWord,
      });
    }, 0);
  };

  const doReplaceAll = () => {
    if (!editor || total === 0) return;
    editor.commands.replaceAll(replacement);
    setTimeout(() => {
      editor.commands.setSearch({
        searchTerm: term,
        caseSensitive,
        regex: useRegex,
        wholeWord,
      });
    }, 0);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) prev();
      else next();
    }
  };

  if (!open) return null;

  return (
    <div
      role="search"
      aria-label="Find and replace"
      style={{
        height: showReplace ? BAR_HEIGHT * 2 : BAR_HEIGHT,
        background: 'hsl(240 20% 8% / 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid hsl(var(--foreground) / 0.06)',
        padding: '6px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Find row */}
      <div
        style={{
          height: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <button
          type="button"
          onClick={() => onToggleReplace(!showReplace)}
          title={showReplace ? 'Hide replace' : 'Show replace'}
          style={{
            width: 18,
            height: 18,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            background: 'transparent',
            color: 'hsl(var(--foreground) / 0.6)',
            cursor: 'pointer',
            padding: 0,
            transform: showReplace ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 120ms ease',
          }}
        >
          <ChevronRight size={14} />
        </button>

        <input
          ref={searchInputRef}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Find"
          style={{ ...inputStyle, flex: 1, minWidth: 160 }}
        />

        <span
          style={{
            fontSize: 11,
            color: 'hsl(var(--foreground) / 0.55)',
            minWidth: 60,
            textAlign: 'right',
            whiteSpace: 'nowrap',
          }}
        >
          {term ? (total === 0 ? 'No results' : `${activeIndex + 1} of ${total}`) : '0 of 0'}
        </span>

        <IconBtn title="Previous match (⇧↵)" disabled={total === 0} onClick={prev}>
          <ChevronUp size={14} />
        </IconBtn>
        <IconBtn title="Next match (↵)" disabled={total === 0} onClick={next}>
          <ChevronDown size={14} />
        </IconBtn>

        <div style={{ width: 1, height: 18, background: 'hsl(var(--foreground) / 0.08)', margin: '0 2px' }} />

        <IconBtn
          title="Match case"
          active={caseSensitive}
          onClick={() => setCaseSensitive((v) => !v)}
        >
          <CaseSensitive size={14} />
        </IconBtn>
        <IconBtn title="Whole word" active={wholeWord} onClick={() => setWholeWord((v) => !v)}>
          <WholeWord size={14} />
        </IconBtn>
        <IconBtn title="Regular expression" active={useRegex} onClick={() => setUseRegex((v) => !v)}>
          <Regex size={14} />
        </IconBtn>

        {blockMatches.length > 0 ? (
          <button
            type="button"
            title="Matches in canvas blocks — click to jump"
            onClick={() => {
              const first = blockMatches[0];
              if (first) setSelection({ kind: 'block', ids: [first.blockId] });
            }}
            style={{
              height: 22,
              padding: '0 8px',
              borderRadius: 999,
              border: '1px solid hsl(18 79% 60% / 0.35)',
              background: 'hsl(18 79% 60% / 0.12)',
              color: 'hsl(18 79% 70%)',
              fontSize: 10,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            +{blockMatches.length} in blocks
          </button>
        ) : null}

        <div style={{ flex: 0 }} />

        <IconBtn title="Close (Esc)" onClick={onClose}>
          <X size={14} />
        </IconBtn>
      </div>

      {/* Replace row */}
      {showReplace ? (
        <div
          style={{
            height: 28,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            paddingLeft: 24,
          }}
        >
          <input
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) doReplaceAll();
                else doReplace();
              }
            }}
            placeholder="Replace with"
            style={{ ...inputStyle, flex: 1, minWidth: 160 }}
          />
          <TextBtn onClick={doReplace} disabled={total === 0} title="Replace current (↵)">
            Replace
          </TextBtn>
          <TextBtn onClick={doReplaceAll} disabled={total === 0} title="Replace all (⇧↵)">
            Replace all
          </TextBtn>
        </div>
      ) : null}
    </div>
  );
}
