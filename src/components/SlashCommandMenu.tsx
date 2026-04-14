import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Editor } from '@tiptap/core';

export interface SlashCommandMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface Command {
  id: string;
  title: string;
  description: string;
  emoji: string;
  keywords: string[];
  action: (
    editor: Editor | null,
    extras: {
      onInsertStageGrid: (label: string) => void;
      onInsertBlockRef: (block: any) => void;
    }
  ) => void;
}

const COMMANDS: Command[] = [
  {
    id: 'stage',
    title: 'Stage Grid',
    description:
      'Embed a canvas with blocks, arrows, and stages',
    emoji: '⊞',
    keywords: ['stage', 'grid', 'canvas',
      'blocks', 'prompt'],
    action: (editor, { onInsertStageGrid }) => {
      onInsertStageGrid('Stage');
    },
  },
  {
    id: 'h2',
    title: 'Heading',
    description: 'Large section heading',
    emoji: 'H',
    keywords: ['heading', 'h2', 'title',
      'section'],
    action: editor => {
      editor?.chain().focus()
        .setHeading({ level: 2 }).run();
    },
  },
  {
    id: 'h3',
    title: 'Sub-heading',
    description: 'Smaller section heading',
    emoji: 'h',
    keywords: ['subheading', 'h3', 'subtitle'],
    action: editor => {
      editor?.chain().focus()
        .setHeading({ level: 3 }).run();
    },
  },
  {
    id: 'code',
    title: 'Code Block',
    description: 'Monospace code with syntax colour',
    emoji: '{ }',
    keywords: ['code', 'terminal', 'command',
      'shell', 'python'],
    action: editor => {
      editor?.chain().focus()
        .setCodeBlock().run();
    },
  },
  {
    id: 'quote',
    title: 'Callout',
    description: 'Highlighted blockquote',
    emoji: '"',
    keywords: ['quote', 'callout', 'highlight',
      'note', 'tip'],
    action: editor => {
      editor?.chain().focus()
        .setBlockquote().run();
    },
  },
  {
    id: 'image',
    title: 'Image / Video',
    description: 'Embed an image or video URL',
    emoji: '🖼',
    keywords: ['image', 'photo', 'video',
      'media', 'screenshot'],
    action: editor => {
      const url = window.prompt(
        'Paste image or video URL:'
      );
      if (!url) return;
      const isVideo =
        /\.(mp4|webm|mov|ogg)$/i.test(url);
      if (isVideo) {
        editor?.chain().focus().insertContent({
          type: 'paragraph',
          content: [{
            type: 'text',
            text: `[video: ${url}]`,
          }],
        }).run();
      } else {
        editor?.chain().focus()
          .setImage({ src: url }).run();
      }
    },
  },
  {
    id: 'divider',
    title: 'Divider',
    description: 'Horizontal separator line',
    emoji: '—',
    keywords: ['divider', 'separator', 'line',
      'rule', 'hr'],
    action: editor => {
      editor?.chain().focus()
        .setHorizontalRule().run();
    },
  },
  {
    id: 'bulletlist',
    title: 'Bullet List',
    description: 'Unordered list',
    emoji: '•',
    keywords: ['list', 'bullet', 'ul', 'items'],
    action: editor => {
      editor?.chain().focus()
        .toggleBulletList().run();
    },
  },
  {
    id: 'numberedlist',
    title: 'Numbered List',
    description: 'Ordered step-by-step list',
    emoji: '1.',
    keywords: ['numbered', 'ordered', 'steps',
      'ol', '123'],
    action: editor => {
      editor?.chain().focus()
        .toggleOrderedList().run();
    },
  },
];

interface SlashCommandMenuProps {
  editor: Editor | null;
  query: string;
  command: (props: { id: string }) => void;
  onInsertStageGrid: (label: string) => void;
  position?: { top: number; left: number };
  filter?: string;
  onFilterChange?: (f: string) => void;
  onDismiss?: () => void;
  availableBlocks?: any[];
  onInsertBlockRef?: (block: any) => void;
}

export const SlashCommandMenu = forwardRef<SlashCommandMenuRef, SlashCommandMenuProps>(function SlashCommandMenu({
  editor, query, command, onInsertStageGrid,
  position, filter: filterProp, onFilterChange, onDismiss,
  availableBlocks, onInsertBlockRef,
}, ref) {
  const [selectedIndex, setSelectedIndex] =
    useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const filter = query || filterProp || '';

  const filtered = filter
    ? COMMANDS.filter(cmd =>
        cmd.title.toLowerCase().includes(
          filter.toLowerCase()
        ) ||
        cmd.keywords.some(k =>
          k.includes(filter.toLowerCase())
        )
      )
    : COMMANDS;

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowDown') {
        setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
        return true;
      }
      if (event.key === 'ArrowUp') {
        setSelectedIndex(i => Math.max(i - 1, 0));
        return true;
      }
      if (event.key === 'Enter') {
        const cmd = filtered[selectedIndex];
        if (cmd) executeCommand(cmd);
        return true;
      }
      return false;
    },
  }));

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i =>
          Math.min(i + 1, filtered.length - 1)
        );
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filtered[selectedIndex];
        if (cmd) executeCommand(cmd);
      }
      if (e.key === 'Escape') {
        onDismiss?.();
      }
      // Handle typing to filter
      if (e.key.length === 1) {
        onFilterChange?.(filter + e.key);
      }
      if (e.key === 'Backspace') {
        if (filter.length > 0) {
          onFilterChange?.(filter.slice(0, -1));
        } else {
          onDismiss?.();
        }
      }
      // Handle typing to filter
      if (e.key.length === 1) {
        onFilterChange(filter + e.key);
      }
      if (e.key === 'Backspace') {
        if (filter.length > 0) {
          onFilterChange(filter.slice(0, -1));
        } else {
          onDismiss();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () =>
      document.removeEventListener('keydown', handler);
  }, [filter, selectedIndex, filtered]);

  // Reset selected index when filter changes
  useEffect(() => { setSelectedIndex(0); }, [filter]);

  const executeCommand = (cmd: Command) => {
    cmd.action(editor, {
      onInsertStageGrid,
      onInsertBlockRef: onInsertBlockRef || (() => {}),
    });
    onDismiss();
  };

  return (
    <>
      {/* Backdrop to dismiss */}
      <div
        style={{
          position: 'fixed', inset: 0,
          zIndex: 99,
        }}
        onClick={onDismiss}
      />
      <div
        ref={menuRef}
        style={{
          position: 'absolute',
          top: position.top + 8,
          left: Math.max(0, position.left),
          zIndex: 100,
          background: 'rgba(10,10,16,0.99)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10,
          padding: '6px 0',
          width: 260,
          boxShadow: '0 12px 40px rgba(0,0,0,0.60)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Filter display */}
        {filter && (
          <div style={{
            padding: '4px 12px 6px 12px',
            fontSize: 11,
            color: 'rgba(255,255,255,0.30)',
            borderBottom:
              '1px solid rgba(255,255,255,0.06)',
            marginBottom: 4,
            fontFamily: 'monospace',
          }}>
            /{filter}
          </div>
        )}

        {/* Command list */}
        {filtered.length === 0 ? (
          <div style={{
            padding: '12px', textAlign: 'center',
            fontSize: 12,
            color: 'rgba(255,255,255,0.25)',
          }}>
            No commands found
          </div>
        ) : (
          filtered.map((cmd, i) => (
            <div
              key={cmd.id}
              onClick={() => executeCommand(cmd)}
              style={{
                display: 'flex', alignItems: 'center',
                gap: 10, padding: '8px 12px',
                cursor: 'pointer',
                background: i === selectedIndex
                  ? 'rgba(232,87,26,0.10)' : 'transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={() =>
                setSelectedIndex(i)
              }
            >
              {/* Emoji icon */}
              <div style={{
                width: 28, height: 28,
                borderRadius: 6,
                background: i === selectedIndex
                  ? 'rgba(232,87,26,0.15)'
                  : 'rgba(255,255,255,0.06)',
                border: `1px solid ${i === selectedIndex
                  ? 'rgba(232,87,26,0.30)'
                  : 'rgba(255,255,255,0.08)'}`,
                display: 'flex', alignItems: 'center',
                justifyContent: 'center',
                fontSize: cmd.emoji.length === 1
                  && cmd.emoji.charCodeAt(0) > 255
                  ? 14 : 11,
                fontWeight: 700,
                color: i === selectedIndex
                  ? '#E8571A'
                  : 'rgba(255,255,255,0.50)',
                fontFamily: 'monospace',
                flexShrink: 0,
              }}>
                {cmd.emoji}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600,
                  color: i === selectedIndex
                    ? 'rgba(255,255,255,0.90)'
                    : 'rgba(255,255,255,0.70)',
                  lineHeight: 1.2,
                }}>
                  {cmd.title}
                </div>
                <div style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.30)',
                  marginTop: 1, lineHeight: 1.3,
                }}>
                  {cmd.description}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
});
