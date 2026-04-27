import { useMemo, useState, type CSSProperties, type DragEvent } from 'react';
import { Search } from 'lucide-react';

import {
  PANEL_CARD_BACKGROUND,
  PANEL_DIVIDER,
  PANEL_INPUT_BACKGROUND,
  PANEL_INPUT_BORDER,
  PANEL_INPUT_RADIUS,
} from './toolPanelStyles';

// ─── Block catalog ────────────────────────────────────────────────
interface BlockDef {
  type: string;
  label: string;
  description: string;
  color: string;
  category: 'Core' | 'AI' | 'Content' | 'Structural';
}

const BLOCKS: readonly BlockDef[] = [
  // Core (4)
  { type: 'text',     label: 'Text',     description: 'Plain text or notes',  color: 'rgba(255,255,255,0.60)', category: 'Core' },
  { type: 'heading',  label: 'Heading',  description: 'Section divider',      color: 'rgba(255,255,255,0.50)', category: 'Core' },
  { type: 'note',     label: 'Note',     description: 'Sticky note',          color: '#F59E0B',                category: 'Core' },
  { type: 'quote',    label: 'Quote',    description: 'Pull quote',           color: 'rgba(255,255,255,0.60)', category: 'Core' },
  // AI (4)
  { type: 'prompt',   label: 'Prompt',   description: 'AI prompt',            color: '#E8571A',                category: 'AI' },
  { type: 'agent',    label: 'Agent',    description: 'AI agent config',      color: '#7C3AED',                category: 'AI' },
  { type: 'model',    label: 'Model',    description: 'Model config',         color: '#A78BFA',                category: 'AI' },
  { type: 'result',   label: 'Result',   description: 'LLM output',           color: '#7C3AED',                category: 'AI' },
  // Content (5)
  { type: 'code',     label: 'Code',     description: 'Code snippet',         color: '#22C55E',                category: 'Content' },
  { type: 'image',    label: 'Image',    description: 'Visual',               color: 'rgba(255,255,255,0.60)', category: 'Content' },
  { type: 'video',    label: 'Video',    description: 'Video embed',          color: 'rgba(255,255,255,0.60)', category: 'Content' },
  { type: 'resource', label: 'Resource', description: 'Link card',            color: '#06B6D4',                category: 'Content' },
  { type: 'tutorial', label: 'Tutorial', description: 'Step-by-step',         color: '#2EC4B6',                category: 'Content' },
  // Structural (3)
  { type: 'tool',     label: 'Tool',     description: 'Tool setup',           color: '#3B82F6',                category: 'Structural' },
  { type: 'workflow', label: 'Workflow', description: 'Nested canvas',        color: '#3B82F6',                category: 'Structural' },
  { type: 'compare',  label: 'Compare',  description: 'Side-by-side',         color: '#EC4899',                category: 'Structural' },
];

const CATEGORIES = ['All', 'Core', 'AI', 'Content', 'Structural'] as const;
type Category = typeof CATEGORIES[number];

// Convert hex/rgba color → rgba with alpha override (for hex only — leave rgba as-is)
function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  // rgba(...) — replace trailing alpha
  return color.replace(/,\s*[0-9.]+\)$/, `,${alpha})`);
}

interface BlockLibraryToolProps {
  onBlockDragStart?: (blockType: string) => void;
  onBlockDoubleClick?: (blockType: string) => void;
  /** Single-click insert (used while a stage is open in full mode). */
  onBlockClick?: (blockType: string) => void;
}

export function BlockLibraryTool({
  onBlockDragStart,
  onBlockDoubleClick,
  onBlockClick,
}: BlockLibraryToolProps) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>('All');

  const counts = useMemo(() => {
    const c: Record<Category, number> = { All: BLOCKS.length, Core: 0, AI: 0, Content: 0, Structural: 0 };
    for (const b of BLOCKS) c[b.category]++;
    return c;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BLOCKS.filter((b) => {
      if (activeCategory !== 'All' && b.category !== activeCategory) return false;
      if (!q) return true;
      return (
        b.label.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.type.toLowerCase().includes(q)
      );
    });
  }, [query, activeCategory]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        gap: 8,
      }}
    >
      {/* 1. Search */}
      <div
        style={{
          height: 36,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 10px',
          background: PANEL_INPUT_BACKGROUND,
          border: PANEL_INPUT_BORDER,
          borderRadius: PANEL_INPUT_RADIUS,
        }}
      >
        <Search size={14} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${BLOCKS.length} blocks...`}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'rgba(255,255,255,0.85)',
            fontFamily: 'Inter, sans-serif',
            fontSize: 12,
            fontWeight: 400,
          }}
        />
      </div>

      {/* 2. Category pills */}
      <div
        style={{
          height: 28,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {CATEGORIES.map((cat) => {
          const active = cat === activeCategory;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              style={{
                flexShrink: 0,
                height: 22,
                padding: '4px 10px',
                borderRadius: 100,
                border: 'none',
                background: active ? 'rgba(232,87,26,0.12)' : 'rgba(255,255,255,0.04)',
                color: active ? '#E8571A' : 'rgba(255,255,255,0.55)',
                fontFamily: 'Inter, sans-serif',
                fontSize: 10,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background-color 120ms ease, color 120ms ease',
              }}
            >
              {cat} · {counts[cat]}
            </button>
          );
        })}
      </div>

      {/* 3. Blocks grid (internal scroll) */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          scrollbarWidth: 'none',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 6,
          alignContent: 'start',
        }}
      >
        {filtered.map((block) => (
          <BlockCard
            key={block.type}
            block={block}
            onDragStart={() => onBlockDragStart?.(block.type)}
            onDoubleClick={() => onBlockDoubleClick?.(block.type)}
            onClick={() => onBlockClick?.(block.type)}
          />
        ))}
        {filtered.length === 0 && (
          <div
            style={{
              gridColumn: '1 / -1',
              padding: '20px 8px',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.35)',
              fontFamily: 'Inter, sans-serif',
              fontSize: 11,
            }}
          >
            No blocks match "{query}"
          </div>
        )}
      </div>

      {/* 4. Bottom hint */}
      <div
        style={{
          height: 24,
          flexShrink: 0,
          padding: '6px 10px',
          borderTop: PANEL_DIVIDER,
          color: 'rgba(255,255,255,0.30)',
          fontFamily: 'Inter, sans-serif',
          fontSize: 10,
          fontWeight: 400,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        Drag into a stage or press / to insert
      </div>
    </div>
  );
}

interface BlockCardProps {
  block: BlockDef;
  onDragStart: () => void;
  onDoubleClick: () => void;
  onClick: () => void;
}

function BlockCard({ block, onDragStart, onDoubleClick, onClick }: BlockCardProps) {
  const [hover, setHover] = useState(false);

  const baseStyle: CSSProperties = {
    height: 60,
    borderRadius: 6,
    padding: '6px 8px',
    background: hover ? withAlpha(block.color, 0.06) : PANEL_CARD_BACKGROUND,
    border: `0.5px solid ${hover ? withAlpha(block.color, 0.20) : 'rgba(255,255,255,0.06)'}`,
    cursor: 'grab',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    transition: 'background-color 120ms ease, border-color 120ms ease',
    userSelect: 'none',
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/x-block-type', block.type);
    e.dataTransfer.setData('text/plain', block.type);
    onDragStart();
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={baseStyle}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: block.color,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 11,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.85)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {block.label}
        </span>
      </div>
      <div
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 10,
          fontWeight: 400,
          color: 'rgba(255,255,255,0.40)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {block.description}
      </div>
    </div>
  );
}
