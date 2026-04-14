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
  category: 'content' | 'structure' | 'media';
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
    id: 'stage', title: 'Stage Grid', category: 'content',
    description: 'Embed a canvas with blocks, arrows, and stages',
    emoji: '⊞', keywords: ['stage', 'grid', 'canvas', 'blocks', 'prompt'],
    action: (_editor, { onInsertStageGrid }) => onInsertStageGrid('Stage'),
  },
  {
    id: 'h2', title: 'Heading', category: 'structure',
    description: 'Large section heading',
    emoji: 'H', keywords: ['heading', 'h2', 'title', 'section'],
    action: editor => editor?.chain().focus().setHeading({ level: 2 }).run(),
  },
  {
    id: 'h3', title: 'Sub-heading', category: 'structure',
    description: 'Smaller section heading',
    emoji: 'h', keywords: ['subheading', 'h3', 'subtitle'],
    action: editor => editor?.chain().focus().setHeading({ level: 3 }).run(),
  },
  {
    id: 'code', title: 'Code Block', category: 'content',
    description: 'Monospace code with syntax colour',
    emoji: '{ }', keywords: ['code', 'terminal', 'command', 'shell'],
    action: editor => editor?.chain().focus().setCodeBlock().run(),
  },
  {
    id: 'quote', title: 'Callout', category: 'content',
    description: 'Highlighted blockquote',
    emoji: '"', keywords: ['quote', 'callout', 'highlight', 'note'],
    action: editor => editor?.chain().focus().setBlockquote().run(),
  },
  {
    id: 'image', title: 'Image / Video', category: 'media',
    description: 'Embed an image or video URL',
    emoji: '🖼', keywords: ['image', 'photo', 'video', 'media'],
    action: editor => {
      const url = window.prompt('Paste image or video URL:');
      if (!url) return;
      if (/\.(mp4|webm|mov|ogg)$/i.test(url)) {
        editor?.chain().focus().insertContent({
          type: 'paragraph',
          content: [{ type: 'text', text: `[video: ${url}]` }],
        }).run();
      } else {
        editor?.chain().focus().setImage({ src: url }).run();
      }
    },
  },
  {
    id: 'divider', title: 'Divider', category: 'structure',
    description: 'Horizontal separator line',
    emoji: '—', keywords: ['divider', 'separator', 'line', 'rule', 'hr'],
    action: editor => editor?.chain().focus().setHorizontalRule().run(),
  },
  {
    id: 'bulletlist', title: 'Bullet List', category: 'structure',
    description: 'Unordered list',
    emoji: '•', keywords: ['list', 'bullet', 'ul', 'items'],
    action: editor => editor?.chain().focus().toggleBulletList().run(),
  },
  {
    id: 'numberedlist', title: 'Numbered List', category: 'structure',
    description: 'Ordered step-by-step list',
    emoji: '1.', keywords: ['numbered', 'ordered', 'steps', 'ol'],
    action: editor => editor?.chain().focus().toggleOrderedList().run(),
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  content: 'Content',
  structure: 'Structure',
  media: 'Media',
};

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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const filter = query || filterProp || '';

  const filtered = filter
    ? COMMANDS.filter(cmd =>
        cmd.title.toLowerCase().includes(filter.toLowerCase()) ||
        cmd.keywords.some(k => k.includes(filter.toLowerCase()))
      )
    : COMMANDS;

  // Group by category
  const grouped = filtered.reduce<Record<string, Command[]>>((acc, cmd) => {
    const cat = cmd.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(cmd);
    return acc;
  }, {});
  const categoryOrder = ['content', 'structure', 'media'];
  const flatFiltered = categoryOrder.flatMap(cat => grouped[cat] || []);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowDown') {
        setSelectedIndex(i => Math.min(i + 1, flatFiltered.length - 1));
        return true;
      }
      if (event.key === 'ArrowUp') {
        setSelectedIndex(i => Math.max(i - 1, 0));
        return true;
      }
      if (event.key === 'Enter') {
        const cmd = flatFiltered[selectedIndex];
        if (cmd) executeCommand(cmd);
        return true;
      }
      return false;
    },
  }));

  useEffect(() => { setSelectedIndex(0); }, [filter]);

  const executeCommand = (cmd: Command) => {
    cmd.action(editor, {
      onInsertStageGrid,
      onInsertBlockRef: onInsertBlockRef || (() => {}),
    });
    onDismiss?.();
  };

  // Compute flat index for category rendering
  let flatIndex = 0;

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 99 }}
        onClick={onDismiss}
      />
      <div
        ref={menuRef}
        style={{
          position: 'absolute',
          top: (position?.top ?? 0) + 8,
          left: Math.max(0, position?.left ?? 0),
          zIndex: 100,
          background: 'rgba(10,10,16,0.95)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 12,
          padding: '6px 0',
          width: 280,
          boxShadow: '0 16px 48px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.04)',
        }}
      >
        {/* Filter display */}
        {filter && (
          <div style={{
            padding: '6px 14px 8px 14px', fontSize: 12,
            color: 'rgba(255,255,255,0.35)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            marginBottom: 4, fontFamily: 'monospace',
          }}>
            /{filter}
          </div>
        )}

        {flatFiltered.length === 0 ? (
          <div style={{
            padding: '16px', textAlign: 'center',
            fontSize: 12, color: 'rgba(255,255,255,0.25)',
          }}>
            No commands found
          </div>
        ) : (
          categoryOrder.map(cat => {
            const cmds = grouped[cat];
            if (!cmds?.length) return null;
            return (
              <div key={cat}>
                {/* Category header */}
                <div style={{
                  fontSize: 9, fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'rgba(255,255,255,0.20)',
                  padding: '8px 14px 4px 14px',
                }}>
                  {CATEGORY_LABELS[cat]}
                </div>
                {cmds.map(cmd => {
                  const myIndex = flatFiltered.indexOf(cmd);
                  const isSelected = myIndex === selectedIndex;
                  return (
                    <div
                      key={cmd.id}
                      onClick={() => executeCommand(cmd)}
                      style={{
                        display: 'flex', alignItems: 'center',
                        gap: 10, padding: '8px 14px',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(232,87,26,0.10)' : 'transparent',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={() => setSelectedIndex(myIndex)}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: isSelected ? 'rgba(232,87,26,0.15)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${isSelected ? 'rgba(232,87,26,0.30)' : 'rgba(255,255,255,0.08)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: cmd.emoji.length === 1 && cmd.emoji.charCodeAt(0) > 255 ? 15 : 12,
                        fontWeight: 700,
                        color: isSelected ? '#E8571A' : 'rgba(255,255,255,0.45)',
                        fontFamily: 'monospace', flexShrink: 0,
                      }}>
                        {cmd.emoji}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 600,
                          color: isSelected ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.65)',
                          lineHeight: 1.2,
                        }}>
                          {cmd.title}
                        </div>
                        <div style={{
                          fontSize: 11, color: 'rgba(255,255,255,0.28)',
                          marginTop: 1, lineHeight: 1.3,
                        }}>
                          {cmd.description}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}

        {/* Keyboard hints */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '6px 14px', marginTop: 4,
          display: 'flex', gap: 12, alignItems: 'center',
        }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', display: 'flex', gap: 4, alignItems: 'center' }}>
            <kbd style={{
              padding: '1px 4px', background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)', borderRadius: 3,
              fontSize: 9, fontFamily: 'monospace',
            }}>↑↓</kbd>
            navigate
          </span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', display: 'flex', gap: 4, alignItems: 'center' }}>
            <kbd style={{
              padding: '1px 4px', background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)', borderRadius: 3,
              fontSize: 9, fontFamily: 'monospace',
            }}>↵</kbd>
            select
          </span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', display: 'flex', gap: 4, alignItems: 'center' }}>
            <kbd style={{
              padding: '1px 4px', background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)', borderRadius: 3,
              fontSize: 9, fontFamily: 'monospace',
            }}>esc</kbd>
            close
          </span>
        </div>
      </div>
    </>
  );
});
