import * as React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MoreHorizontal, GripVertical, Columns2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useDocumentStore } from '@/lib/documentStore';

interface CompareBlockData {
  blockId: string;
  label?: string;
  [key: string]: unknown;
}

const COMPARE_COLOR = '#EC4899';

const PORT_STYLE: React.CSSProperties = {
  width: 8,
  height: 8,
  background: '#2EC4B6',
  border: '2px solid white',
  opacity: 0,
  transition: 'opacity 150ms ease',
};

function DropZone({
  children,
  placeholder = 'Drop block here',
}: {
  children?: React.ReactNode;
  placeholder?: string;
}) {
  const isEmpty = !children;
  return (
    <div
      className={cn(
        'flex-1 min-h-[80px] rounded-md border border-dashed',
        'flex items-center justify-center px-2 py-3',
        isEmpty
          ? 'border-white/15 bg-white/[0.02]'
          : 'border-transparent bg-transparent',
      )}
    >
      {children ?? (
        <span className="text-[11px] text-white/40">{placeholder}</span>
      )}
    </div>
  );
}

export function CompareBlockNode({ id, data, selected }: NodeProps) {
  const blockId = (data as CompareBlockData).blockId ?? id;

  const block = useDocumentStore((s) => s.blocks[blockId]);
  const updateBlock = useDocumentStore((s) => s.updateBlock);

  if (!block) return null;

  const props = (block.properties ?? {}) as {
    columnALabel?: string;
    columnBLabel?: string;
    columnAContent?: string;
    columnBContent?: string;
  };

  const columnALabel = props.columnALabel ?? 'A';
  const columnBLabel = props.columnBLabel ?? 'B';
  const columnAContent = props.columnAContent ?? '';
  const columnBContent = props.columnBContent ?? '';

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

      {/* Header row */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ background: COMPARE_COLOR }}
        />
        <Columns2 size={12} className="text-white/60" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
          Compare
        </span>
        <div className="flex-1" />
        <button
          type="button"
          className="text-white/40 hover:text-white/80 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal size={14} />
        </button>
        <GripVertical size={14} className="text-white/30" />
      </div>

      {/* Column header inputs */}
      <div className="flex items-center gap-2 mb-2">
        <input
          value={columnALabel}
          onChange={(e) => patchProps({ columnALabel: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'flex-1 px-2 py-1 rounded-md text-center',
            'bg-[#EC4899]/10 border border-[#EC4899]/20',
            'text-[11px] font-semibold text-[#EC4899]',
            'outline-none focus:border-[#EC4899]/40 transition-colors',
          )}
        />
        <div className="w-px h-4 bg-white/10" />
        <input
          value={columnBLabel}
          onChange={(e) => patchProps({ columnBLabel: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'flex-1 px-2 py-1 rounded-md text-center',
            'bg-[#EC4899]/10 border border-[#EC4899]/20',
            'text-[11px] font-semibold text-[#EC4899]',
            'outline-none focus:border-[#EC4899]/40 transition-colors',
          )}
        />
      </div>

      {/* Two-column content */}
      <div className="flex gap-2">
        <div className="flex-1">
          <textarea
            value={columnAContent}
            onChange={(e) => patchProps({ columnAContent: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Drop block here"
            className={cn(
              'w-full min-h-[80px] resize-none rounded-md',
              'bg-white/[0.02] border border-dashed border-white/15',
              'text-[11px] text-white/80 placeholder:text-white/40',
              'px-2 py-2 outline-none focus:border-white/30 transition-colors',
            )}
          />
        </div>
        <div className="w-px bg-white/10 self-stretch" />
        <div className="flex-1">
          <textarea
            value={columnBContent}
            onChange={(e) => patchProps({ columnBContent: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Drop block here"
            className={cn(
              'w-full min-h-[80px] resize-none rounded-md',
              'bg-white/[0.02] border border-dashed border-white/15',
              'text-[11px] text-white/80 placeholder:text-white/40',
              'px-2 py-2 outline-none focus:border-white/30 transition-colors',
            )}
          />
        </div>
      </div>
    </div>
  );
}
