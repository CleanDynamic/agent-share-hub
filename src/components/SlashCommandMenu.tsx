import {
  useState,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import type { Editor } from '@tiptap/core';

interface SlashCommand {
  title: string;
  description: string;
  shortcut: string;
  emoji: string;
  action: (editor: Editor, onInsertStageGrid?: ((label: string) => void) | null) => void;
}

const COMMANDS: SlashCommand[] = [
  {
    title: 'Stage Grid',
    description: 'Embed a canvas stage with blocks',
    shortcut: '/stage',
    emoji: '\u229E',
    action: (_editor, onInsertStageGrid) => {
      onInsertStageGrid?.('Stage');
    },
  },
  {
    title: 'Heading',
    description: 'Large section heading',
    shortcut: '/h2',
    emoji: 'H',
    action: editor => {
      editor.chain().focus().setHeading({ level: 2 }).run();
    },
  },
  {
    title: 'Sub-heading',
    description: 'Smaller section heading',
    shortcut: '/h3',
    emoji: 'h',
    action: editor => {
      editor.chain().focus().setHeading({ level: 3 }).run();
    },
  },
  {
    title: 'Code Block',
    description: 'Monospace code section',
    shortcut: '/code',
    emoji: '{ }',
    action: editor => {
      editor.chain().focus().setCodeBlock().run();
    },
  },
  {
    title: 'Quote',
    description: 'Blockquote or callout',
    shortcut: '/quote',
    emoji: '\u201C',
    action: editor => {
      editor.chain().focus().setBlockquote().run();
    },
  },
  {
    title: 'Divider',
    description: 'Horizontal separator line',
    shortcut: '/divider',
    emoji: '\u2014',
    action: editor => {
      editor.chain().focus().setHorizontalRule().run();
    },
  },
  {
    title: 'Image',
    description: 'Standalone image or video',
    shortcut: '/image',
    emoji: '\uD83D\uDDBC',
    action: editor => {
      const url = window.prompt('Image URL:');
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    },
  },
];

export interface SlashCommandMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface SlashCommandMenuProps {
  editor: Editor;
  query: string;
  command: (props: { id: string }) => void;
  onInsertStageGrid?: ((label: string) => void) | null;
}

export const SlashCommandMenu = forwardRef<
  SlashCommandMenuRef,
  SlashCommandMenuProps
>(function SlashCommandMenu({ editor, query, command, onInsertStageGrid }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = COMMANDS.filter(
    cmd =>
      cmd.title.toLowerCase().includes(query.toLowerCase()) ||
      cmd.shortcut.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const selectItem = useCallback(
    (index: number) => {
      const item = filtered[index];
      if (!item) return;

      // Delete the slash and query text before running the action
      command({ id: item.shortcut });
      item.action(editor, onInsertStageGrid);
    },
    [filtered, editor, command, onInsertStageGrid]
  );

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex(i => (i <= 0 ? filtered.length - 1 : i - 1));
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex(i => (i >= filtered.length - 1 ? 0 : i + 1));
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      if (event.key === 'Escape') {
        return true;
      }
      return false;
    },
  }));

  if (filtered.length === 0) {
    return (
      <div
        style={{
          background: 'rgba(10,10,16,0.99)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10,
          padding: '12px 16px',
          width: 260,
          boxShadow: '0 12px 40px rgba(0,0,0,0.60)',
          fontSize: 12,
          color: 'rgba(255,255,255,0.35)',
        }}
      >
        No commands found
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      style={{
        background: 'rgba(10,10,16,0.99)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 10,
        padding: '6px 0',
        width: 260,
        boxShadow: '0 12px 40px rgba(0,0,0,0.60)',
        maxHeight: 320,
        overflowY: 'auto',
      }}
    >
      {filtered.map((cmd, index) => (
        <button
          key={cmd.shortcut}
          onClick={() => selectItem(index)}
          onMouseEnter={() => setSelectedIndex(index)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '8px 12px',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            background:
              index === selectedIndex
                ? 'rgba(232,87,26,0.12)'
                : 'transparent',
            color:
              index === selectedIndex
                ? '#E8571A'
                : 'rgba(255,255,255,0.75)',
            transition: 'background 0.1s',
            fontSize: 13,
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.06)',
              fontSize: 13,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {cmd.emoji}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
                lineHeight: '18px',
              }}
            >
              {cmd.title}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.35)',
                lineHeight: '14px',
              }}
            >
              {cmd.description}
            </div>
          </div>
          <span
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.20)',
              fontFamily: 'monospace',
              flexShrink: 0,
            }}
          >
            {cmd.shortcut}
          </span>
        </button>
      ))}
    </div>
  );
});
