import * as React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MoreHorizontal, Heading as HeadingIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useDocumentStore } from '@/lib/documentStore';

type HeadingLevel = 'h1' | 'h2' | 'h3';

interface HeadingBlockData {
  blockId: string;
  label?: string;
  [key: string]: unknown;
}

const HEADING_COLOR = '#F59E0B';

const levelStyles: Record<HeadingLevel, string> = {
  h1: 'text-3xl font-bold',
  h2: 'text-2xl font-semibold',
  h3: 'text-xl font-medium',
};

const PORT_STYLE: React.CSSProperties = {
  width: 8,
  height: 8,
  background: '#2EC4B6',
  border: '2px solid white',
  opacity: 0,
  transition: 'opacity 150ms ease',
};

export function HeadingBlockNode({ id, data, selected }: NodeProps) {
  const blockId = (data as HeadingBlockData).blockId ?? id;

  const block = useDocumentStore((s) => s.blocks[blockId]);
  const updateBlock = useDocumentStore((s) => s.updateBlock);

  const [showLevelPicker, setShowLevelPicker] = React.useState(false);

  if (!block) return null;

  const props = (block.properties ?? {}) as {
    level?: HeadingLevel;
    text?: string;
  };

  const level: HeadingLevel = props.level ?? 'h1';
  const text = props.text ?? '';

  const patchProps = (patch: Record<string, unknown>) => {
    updateBlock(blockId, {
      properties: { ...(block.properties ?? {}), ...patch },
    });
  };

  return (
    <div
      className={cn(
        'group relative rounded-xl border bg-[rgba(20,20,28,0.75)]',
        'backdrop-blur-md shadow-lg w-[320px]',
        selected ? 'border-white/30' : 'border-white/10',
      )}
      style={{ padding: 12 }}
    >
      <Handle type="target" position={Position.Top} style={PORT_STYLE} />
      <Handle type="source" position={Position.Bottom} style={PORT_STYLE} />
      <Handle type="target" position={Position.Left} style={PORT_STYLE} />
      <Handle type="source" position={Position.Right} style={PORT_STYLE} />

      {/* Header Row */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ background: HEADING_COLOR }}
        />
        <HeadingIcon size={12} className="text-white/60" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
          Heading
        </span>

        {/* Level picker */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowLevelPicker((v) => !v);
            }}
            className="px-2 py-0.5 text-[10px] font-medium text-white/50 bg-white/[0.04] rounded hover:bg-white/[0.08] transition-colors"
          >
            {level.toUpperCase()}
          </button>
          {showLevelPicker && (
            <div className="absolute top-full left-0 mt-1 z-10 bg-[rgba(20,20,28,0.95)] border border-white/10 rounded-md shadow-lg overflow-hidden min-w-[60px]">
              {(['h1', 'h2', 'h3'] as HeadingLevel[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    patchProps({ level: l });
                    setShowLevelPicker(false);
                  }}
                  className={cn(
                    'w-full px-3 py-1 text-left text-[10px] font-medium',
                    'hover:bg-white/[0.06] transition-colors',
                    l === level ? 'text-white' : 'text-white/50',
                  )}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1" />
        <button
          type="button"
          className="text-white/40 hover:text-white/80 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      {/* Heading text */}
      <input
        value={text}
        onChange={(e) => patchProps({ text: e.target.value })}
        onClick={(e) => e.stopPropagation()}
        placeholder="Enter heading..."
        className={cn(
          'w-full bg-transparent outline-none',
          'text-white placeholder:text-white/20',
          levelStyles[level],
        )}
      />
    </div>
  );
}
