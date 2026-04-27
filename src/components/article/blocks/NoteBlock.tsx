import * as React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MoreHorizontal, StickyNote } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useDocumentStore } from '@/lib/documentStore';

type NoteColor = 'yellow' | 'pink' | 'blue' | 'green';

interface NoteBlockData {
  blockId: string;
  label?: string;
  [key: string]: unknown;
}

const colorStyles: Record<NoteColor, { bg: string; border: string; text: string }> = {
  yellow: {
    bg: 'bg-[#F59E0B]/20',
    border: 'border-[#F59E0B]/30',
    text: 'text-[#FCD34D]',
  },
  pink: {
    bg: 'bg-[#EC4899]/20',
    border: 'border-[#EC4899]/30',
    text: 'text-[#F9A8D4]',
  },
  blue: {
    bg: 'bg-[#3B82F6]/20',
    border: 'border-[#3B82F6]/30',
    text: 'text-[#93C5FD]',
  },
  green: {
    bg: 'bg-[#22C55E]/20',
    border: 'border-[#22C55E]/30',
    text: 'text-[#86EFAC]',
  },
};

const dotColors: Record<NoteColor, string> = {
  yellow: 'bg-[#F59E0B]',
  pink: 'bg-[#EC4899]',
  blue: 'bg-[#3B82F6]',
  green: 'bg-[#22C55E]',
};

const PORT_STYLE: React.CSSProperties = {
  width: 8,
  height: 8,
  background: '#2EC4B6',
  border: '2px solid white',
  opacity: 0,
  transition: 'opacity 150ms ease',
};

export function NoteBlockNode({ id, data, selected }: NodeProps) {
  const blockId = (data as NoteBlockData).blockId ?? id;

  const block = useDocumentStore((s) => s.blocks[blockId]);
  const updateBlock = useDocumentStore((s) => s.updateBlock);

  const [showColorPicker, setShowColorPicker] = React.useState(false);

  // Slight random rotation for sticky-note feel — stable per block id.
  const rotation = React.useMemo(() => {
    let hash = 0;
    for (let i = 0; i < blockId.length; i++) {
      hash = (hash * 31 + blockId.charCodeAt(i)) | 0;
    }
    return (((hash % 400) / 100) - 2).toFixed(1);
  }, [blockId]);

  if (!block) return null;

  const props = (block.properties ?? {}) as {
    color?: NoteColor;
    text?: string;
  };

  const color: NoteColor = props.color ?? 'yellow';
  const text = props.text ?? '';
  const styles = colorStyles[color];

  const patchProps = (patch: Record<string, unknown>) => {
    updateBlock(blockId, {
      properties: { ...(block.properties ?? {}), ...patch },
    });
  };

  return (
    <div
      className={cn(
        'group relative rounded-xl border backdrop-blur-md shadow-lg w-[260px]',
        styles.bg,
        styles.border,
        selected && 'ring-2 ring-white/30',
      )}
      style={{
        padding: 12,
        transform: `rotate(${rotation}deg)`,
      }}
    >
      <Handle type="target" position={Position.Top} style={PORT_STYLE} />
      <Handle type="source" position={Position.Bottom} style={PORT_STYLE} />
      <Handle type="target" position={Position.Left} style={PORT_STYLE} />
      <Handle type="source" position={Position.Right} style={PORT_STYLE} />

      {/* Header Row */}
      <div className="flex items-center gap-2 mb-2">
        <StickyNote size={12} className="text-white/70" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
          Note
        </span>

        {/* Color picker */}
        <div className="relative ml-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowColorPicker((v) => !v);
            }}
            className={cn(
              'w-4 h-4 rounded-full border border-white/20',
              dotColors[color],
            )}
          />
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 z-10 flex gap-1.5 p-2 bg-[rgba(22,22,30,0.95)] border border-white/10 rounded-md shadow-lg">
              {(['yellow', 'pink', 'blue', 'green'] as NoteColor[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    patchProps({ color: c });
                    setShowColorPicker(false);
                  }}
                  className={cn(
                    'w-5 h-5 rounded-full transition-transform hover:scale-110',
                    dotColors[c],
                    c === color &&
                      'ring-2 ring-white/50 ring-offset-1 ring-offset-[rgba(22,22,30,0.95)]',
                  )}
                />
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

      {/* Note text */}
      <textarea
        value={text}
        onChange={(e) => patchProps({ text: e.target.value })}
        onClick={(e) => e.stopPropagation()}
        placeholder="Write a note..."
        className={cn(
          'w-full h-[80px] bg-transparent outline-none resize-none',
          'text-sm leading-relaxed font-medium',
          'placeholder:text-white/20',
          styles.text,
        )}
      />
    </div>
  );
}
