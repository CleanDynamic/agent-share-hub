import * as React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MoreHorizontal, GripVertical, Columns2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useDocumentStore } from '@/lib/documentStore';
import { feedback } from '@/lib/theme/motion';

interface CompareBlockData {
  blockId: string;
  label?: string;
  [key: string]: unknown;
}

const COMPARE_COLOR = 'var(--cat-media)';

const PORT_STYLE: React.CSSProperties = {
  width: 8,
  height: 8,
  background: 'var(--evidence)',
  border: '2px solid white',
  opacity: 0,
  transition: feedback("opacity"),
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
          ? 'border-border bg-foreground/[0.02]'
          : 'border-transparent bg-transparent',
      )}
    >
      {children ?? (
        <span className="text-[11px] text-muted-foreground">{placeholder}</span>
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
        'group relative rounded-xl border bg-[var(--recess)]',
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
        <Columns2 size={12} className="text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Compare
        </span>
        <div className="flex-1" />
        <button
          type="button"
          className="text-muted-foreground hover:text-muted-foreground transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal size={14} />
        </button>
        <GripVertical size={14} className="text-muted-foreground" />
      </div>

      {/* Column header inputs */}
      <div className="flex items-center gap-2 mb-2">
        <input
          value={columnALabel}
          onChange={(e) => patchProps({ columnALabel: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'flex-1 px-2 py-1 rounded-md text-center',
            'bg-[var(--cat-media)]/10 border border-[var(--cat-media)]/20',
            'text-[11px] font-semibold text-[var(--cat-media)]',
            'outline-none focus:border-[var(--cat-media)]/40 transition-colors',
          )}
        />
        <div className="w-px h-4 bg-muted" />
        <input
          value={columnBLabel}
          onChange={(e) => patchProps({ columnBLabel: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'flex-1 px-2 py-1 rounded-md text-center',
            'bg-[var(--cat-media)]/10 border border-[var(--cat-media)]/20',
            'text-[11px] font-semibold text-[var(--cat-media)]',
            'outline-none focus:border-[var(--cat-media)]/40 transition-colors',
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
              'bg-foreground/[0.02] border border-dashed border-border',
              'text-[11px] text-foreground placeholder:text-muted-foreground',
              'px-2 py-2 outline-none focus:border-border transition-colors',
            )}
          />
        </div>
        <div className="w-px bg-muted self-stretch" />
        <div className="flex-1">
          <textarea
            value={columnBContent}
            onChange={(e) => patchProps({ columnBContent: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Drop block here"
            className={cn(
              'w-full min-h-[80px] resize-none rounded-md',
              'bg-foreground/[0.02] border border-dashed border-border',
              'text-[11px] text-foreground placeholder:text-muted-foreground',
              'px-2 py-2 outline-none focus:border-border transition-colors',
            )}
          />
        </div>
      </div>
    </div>
  );
}
