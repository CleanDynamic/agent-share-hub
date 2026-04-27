import * as React from 'react';
import { useDocumentStore } from '@/lib/documentStore';

const BLOCK_TYPE_DOT_COLOR: Record<string, string> = {
  text: 'rgba(255,255,255,0.50)',
  heading: 'rgba(255,255,255,0.65)',
  prompt: '#E8571A',
  code: '#16A34A',
  result: '#7C3AED',
  agent: '#3B82F6',
  model: '#06B6D4',
  tool: '#F59E0B',
  note: '#F5C518',
  resource: '#A855F7',
  workflow: '#EC4899',
  compare: '#22D3EE',
};

export interface BlockPickerItem {
  blockId: string;
  blockName: string;
  blockType: string;
  stageId: string;
  stageName: string;
}

interface BlockPickerMenuProps {
  isOpen: boolean;
  query: string;
  position: { x: number; y: number } | null;
  selectedIndex: number;
  onSelectedIndexChange: (i: number) => void;
  onSelect: (item: BlockPickerItem) => void;
  onClose: () => void;
  onItemsChange?: (items: BlockPickerItem[]) => void;
}

export function useBlockPickerItems(query: string): BlockPickerItem[] {
  const blocks = useDocumentStore((s) => s.blocks);
  const stages = useDocumentStore((s) => s.stages);

  return React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const all: BlockPickerItem[] = Object.values(blocks).map((b) => {
      const stage = stages[b.stage_id];
      const name =
        b.name?.trim() ||
        ((b.properties as Record<string, unknown> | undefined)?.title as string | undefined)?.trim() ||
        'Untitled block';
      return {
        blockId: b.id,
        blockName: name,
        blockType: b.type,
        stageId: b.stage_id,
        stageName: stage?.stage_name ?? 'Untitled stage',
      };
    });
    if (!q) return all.slice(0, 50);
    return all
      .filter(
        (it) =>
          it.blockName.toLowerCase().includes(q) ||
          it.stageName.toLowerCase().includes(q) ||
          it.blockType.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [blocks, stages, query]);
}

export function BlockPickerMenu({
  isOpen,
  query,
  position,
  selectedIndex,
  onSelectedIndexChange,
  onSelect,
  onClose,
  onItemsChange,
}: BlockPickerMenuProps) {
  const items = useBlockPickerItems(query);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    onItemsChange?.(items);
  }, [items, onItemsChange]);

  React.useEffect(() => {
    if (selectedIndex >= items.length) {
      onSelectedIndexChange(0);
    }
  }, [items.length, selectedIndex, onSelectedIndexChange]);

  React.useEffect(() => {
    if (!isOpen) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${selectedIndex}"]`,
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, isOpen]);

  if (!isOpen || !position) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: position.y,
        left: position.x,
        zIndex: 120,
        width: 320,
        maxHeight: 300,
        overflowY: 'auto',
        background: 'hsl(240 20% 8% / 0.98)',
        border: '1px solid hsl(var(--foreground) / 0.08)',
        borderRadius: 10,
        boxShadow: '0 10px 30px hsl(240 10% 2% / 0.55)',
        padding: 4,
        fontFamily: 'Inter, sans-serif',
      }}
      ref={listRef}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'hsl(var(--foreground) / 0.5)',
          padding: '6px 8px 4px',
        }}
      >
        Reference a block
      </div>
      {items.length === 0 ? (
        <div
          style={{
            padding: '12px 10px',
            fontSize: 12,
            color: 'hsl(var(--foreground) / 0.5)',
          }}
        >
          No blocks found
        </div>
      ) : (
        items.map((item, idx) => {
          const active = idx === selectedIndex;
          const dot =
            BLOCK_TYPE_DOT_COLOR[item.blockType] ?? BLOCK_TYPE_DOT_COLOR.text;
          return (
            <button
              key={item.blockId}
              type="button"
              data-idx={idx}
              onMouseEnter={() => onSelectedIndexChange(idx)}
              onClick={() => onSelect(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 8px',
                borderRadius: 6,
                border: 'none',
                background: active
                  ? 'hsl(var(--foreground) / 0.08)'
                  : 'transparent',
                color: 'hsl(var(--foreground) / 0.9)',
                fontSize: 12,
                fontFamily: 'Inter, sans-serif',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: dot,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.blockName}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: 'hsl(var(--foreground) / 0.45)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 120,
                }}
              >
                {item.stageName}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}
