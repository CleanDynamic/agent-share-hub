import { forwardRef, useEffect, useImperativeHandle, useState, useCallback } from 'react';
import { LayoutGrid, Heading2, Code, Image, Quote, Minus } from 'lucide-react';

export interface SlashCommandItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: (editor: any) => void;
}

interface SlashCommandMenuProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

export const SlashCommandMenu = forwardRef<any, SlashCommandMenuProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const upHandler = useCallback(() => {
      setSelectedIndex(i => (i + items.length - 1) % items.length);
    }, [items.length]);

    const downHandler = useCallback(() => {
      setSelectedIndex(i => (i + 1) % items.length);
    }, [items.length]);

    const enterHandler = useCallback(() => {
      if (items[selectedIndex]) command(items[selectedIndex]);
    }, [items, selectedIndex, command]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') { upHandler(); return true; }
        if (event.key === 'ArrowDown') { downHandler(); return true; }
        if (event.key === 'Enter') { enterHandler(); return true; }
        return false;
      },
    }));

    if (items.length === 0) return null;

    return (
      <div style={{
        background: 'rgba(16,16,22,0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 10,
        padding: 4,
        minWidth: 220,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        fontFamily: 'Inter, sans-serif',
      }}>
        {items.map((item, i) => (
          <button
            key={item.id}
            onClick={() => command(item)}
            onMouseEnter={() => setSelectedIndex(i)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '8px 10px',
              border: 'none',
              borderRadius: 7,
              background: i === selectedIndex
                ? 'rgba(139,69,19,0.15)'
                : 'transparent',
              color: i === selectedIndex
                ? 'rgba(255,255,255,0.85)'
                : 'rgba(255,255,255,0.55)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.1s',
            }}
          >
            <span style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'rgba(255,255,255,0.06)',
              color: i === selectedIndex ? '#8B4513' : 'rgba(255,255,255,0.35)',
              flexShrink: 0,
            }}>
              {item.icon}
            </span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{item.label}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.30)' }}>
                {item.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }
);

SlashCommandMenu.displayName = 'SlashCommandMenu';

// Slash command items factory
export function getSlashCommandItems(query: string, onAddStage: () => string | null): SlashCommandItem[] {
  const all: SlashCommandItem[] = [
    {
      id: 'stage',
      label: 'Stage Grid',
      description: 'Embed a canvas stage',
      icon: <LayoutGrid size={14} />,
      action: (editor) => {
        const stageId = onAddStage();
        if (stageId) {
          editor.chain().focus()
            .deleteRange(editor.state.selection)
            .insertContent({
              type: 'stageGrid',
              attrs: { stageId, stageTitle: `Stage ${Date.now().toString(36)}` },
            })
            .run();
        }
      },
    },
    {
      id: 'heading',
      label: 'Heading',
      description: 'Section heading',
      icon: <Heading2 size={14} />,
      action: (editor) => {
        editor.chain().focus()
          .deleteRange(editor.state.selection)
          .setHeading({ level: 2 })
          .run();
      },
    },
    {
      id: 'code',
      label: 'Code Block',
      description: 'Monospace code block',
      icon: <Code size={14} />,
      action: (editor) => {
        editor.chain().focus()
          .deleteRange(editor.state.selection)
          .setCodeBlock()
          .run();
      },
    },
    {
      id: 'image',
      label: 'Image',
      description: 'Embed an image',
      icon: <Image size={14} />,
      action: (editor) => {
        const url = window.prompt('Image URL:');
        if (url) {
          editor.chain().focus()
            .deleteRange(editor.state.selection)
            .setImage({ src: url })
            .run();
        }
      },
    },
    {
      id: 'quote',
      label: 'Quote',
      description: 'Blockquote / callout',
      icon: <Quote size={14} />,
      action: (editor) => {
        editor.chain().focus()
          .deleteRange(editor.state.selection)
          .setBlockquote()
          .run();
      },
    },
    {
      id: 'divider',
      label: 'Divider',
      description: 'Horizontal rule',
      icon: <Minus size={14} />,
      action: (editor) => {
        editor.chain().focus()
          .deleteRange(editor.state.selection)
          .setHorizontalRule()
          .run();
      },
    },
  ];

  if (!query) return all;
  return all.filter(item =>
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    item.id.toLowerCase().includes(query.toLowerCase())
  );
}
