import { forwardRef, useEffect, useImperativeHandle, useState, useCallback } from 'react';
import { LayoutGrid, Heading2, Code, Image, Quote, Minus, Link2 } from 'lucide-react';
import type { CanvasBlock, CanvasStage } from '@/lib/canvas-types';

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
        background: 'rgba(16,16,24,0.95)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 12,
        padding: 6,
        minWidth: 240,
        maxHeight: 320,
        overflowY: 'auto' as const,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        fontFamily: 'Inter, sans-serif',
      }}>
        {items.map((item, i) => {
          const isSelected = i === selectedIndex;
          return (
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
                borderLeft: isSelected ? '2px solid #E8571A' : '2px solid transparent',
                borderRadius: 8,
                background: isSelected
                  ? 'rgba(232,87,26,0.08)'
                  : 'transparent',
                color: 'rgba(255,255,255,0.90)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 100ms',
              }}
            >
              <span style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 6,
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.45)',
                flexShrink: 0,
              }}>
                {item.icon}
              </span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.90)' }}>{item.label}</div>
                <div style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.40)' }}>
                  {item.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  }
);

SlashCommandMenu.displayName = 'SlashCommandMenu';

// ─── Block type → dot colour (matches BlockRefNode palette) ──
const BLOCK_TYPE_DOT_COLOR: Record<string, string> = {
  text: 'rgba(255,255,255,0.50)',
  prompt: '#E8571A',
  code: '#16A34A',
  result: '#7C3AED',
};

function getBlockDotColor(type: string): string {
  return BLOCK_TYPE_DOT_COLOR[type] ?? BLOCK_TYPE_DOT_COLOR.text;
}

function BlockTypeDot({ type }: { type: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: getBlockDotColor(type),
      }}
    />
  );
}

function getBlockDisplayTitle(block: CanvasBlock): string {
  const sub = (block.subheading ?? '').trim();
  if (sub) return sub;
  const text = (block.textContent ?? '').trim().replace(/\s+/g, ' ');
  if (text) return text.length > 48 ? `${text.slice(0, 45)}…` : text;
  const typeLabel = block.type.charAt(0).toUpperCase() + block.type.slice(1);
  return `Untitled ${typeLabel}`;
}

export interface SlashCanvasDoc {
  blocks?: CanvasBlock[];
  stages?: CanvasStage[];
}

function buildBlockRefItems(
  filter: string,
  canvasDoc: SlashCanvasDoc | null | undefined,
): SlashCommandItem[] {
  const blocks = canvasDoc?.blocks ?? [];
  const stages = canvasDoc?.stages ?? [];
  const stageById = new Map(stages.map(s => [s.id, s]));
  const lowerFilter = filter.trim().toLowerCase();

  return blocks
    .map<SlashCommandItem>((block) => {
      const stage = block.stageId ? stageById.get(block.stageId) ?? null : null;
      const stageName = stage?.title ?? 'No stage';
      const title = getBlockDisplayTitle(block);
      return {
        id: `blockref-${block.id}`,
        label: title,
        description: `— ${stageName}`,
        icon: <BlockTypeDot type={block.type} />,
        action: (editor) => {
          editor
            .chain()
            .focus()
            .deleteRange(editor.state.selection)
            .insertContent({
              type: 'blockRef',
              attrs: {
                blockId: block.id,
                blockTitle: title,
                blockType: block.type,
                stageId: block.stageId ?? '',
              },
            })
            .run();
        },
      };
    })
    .filter((item) => {
      if (!lowerFilter) return true;
      return (
        item.label.toLowerCase().includes(lowerFilter) ||
        item.description.toLowerCase().includes(lowerFilter)
      );
    });
}

// Slash command items factory
export function getSlashCommandItems(
  query: string,
  onAddStage: () => string | null,
  canvasDoc?: SlashCanvasDoc | null,
): SlashCommandItem[] {
  const lowerQuery = query.toLowerCase();
  const BLOCKREF_PREFIX = 'blockref';

  // When the slash query begins with "blockref", transition the palette
  // into a block picker showing every block across every stage, filtered
  // by the remainder of the query.
  if (lowerQuery.startsWith(BLOCKREF_PREFIX)) {
    const filter = query.slice(BLOCKREF_PREFIX.length);
    const items = buildBlockRefItems(filter, canvasDoc);
    if (items.length > 0) return items;
    // Fall through if there are no blocks — still show the command entry.
  }

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
    // New: Block Reference — opens a block picker (handled by the editor's
    // slash command dispatcher, which expands the query to "blockref").
    {
      id: 'blockref',
      label: 'Block Reference',
      description: 'Link to a block in any stage',
      icon: <Link2 size={14} />,
      action: () => {
        // No-op. ArticleEditor's executeSlashCommand detects id === 'blockref'
        // and transforms the query into the block picker.
      },
    },
  ];

  if (!query) return all;
  return all.filter(item =>
    item.label.toLowerCase().includes(lowerQuery) ||
    item.id.toLowerCase().includes(lowerQuery)
  );
}
