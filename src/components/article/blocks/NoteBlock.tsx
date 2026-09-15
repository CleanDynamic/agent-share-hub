import * as React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MoreHorizontal, StickyNote } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useDocumentStore } from '@/lib/documentStore';
import { feedback } from '@/lib/theme/motion';

type NoteColor = 'yellow' | 'pink' | 'blue' | 'green';

interface NoteBlockData {
  blockId: string;
  label?: string;
  [key: string]: unknown;
}

/* BG-P28. The four note colours keep their four IDENTITIES — an author who
   made a note yellow still gets a distinct note — but each is now a measured
   ground/ink pair from the part hues rather than a Post-it hex with a second,
   lighter hex for its text. The pale inks (#FCD34D, #F9A8D4, #93C5FD, #86EFAC)
   were the tell: they exist only because the ground beneath them was assumed
   dark, and every one of them fails on the Exhibition room. */
const colorStyles: Record<NoteColor, { bg: string; border: string; text: string }> = {
  yellow: {
    bg: 'bg-[var(--cat-artefact-fill)]',
    border: 'border-[var(--cat-artefact)]',
    text: 'text-[var(--cat-artefact)]',
  },
  pink: {
    bg: 'bg-[var(--cat-media-fill)]',
    border: 'border-[var(--cat-media)]',
    text: 'text-[var(--cat-media)]',
  },
  blue: {
    bg: 'bg-[var(--cat-data-fill)]',
    border: 'border-[var(--cat-data)]',
    text: 'text-[var(--cat-data)]',
  },
  green: {
    bg: 'bg-[var(--cat-configuration-fill)]',
    border: 'border-[var(--cat-configuration)]',
    text: 'text-[var(--cat-configuration)]',
  },
};

const dotColors: Record<NoteColor, string> = {
  yellow: 'bg-[var(--cat-artefact)]',
  pink: 'bg-[var(--cat-media)]',
  blue: 'bg-[var(--cat-data)]',
  green: 'bg-[var(--cat-configuration)]',
};

const PORT_STYLE: React.CSSProperties = {
  width: 8,
  height: 8,
  background: 'var(--evidence)',
  border: '2px solid white',
  opacity: 0,
  transition: feedback("opacity"),
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
        selected && 'ring-2 ring-border',
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
        <StickyNote size={12} className="text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
              'w-4 h-4 rounded-full border border-border',
              dotColors[color],
            )}
          />
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 z-10 flex gap-1.5 p-2 bg-[var(--recess)] border border-border rounded-md shadow-lg">
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
                    'w-5 h-5 rounded-full transition-feedback hover:opacity-75',
                    dotColors[c],
                    c === color &&
                      'ring-2 ring-border ring-offset-1 ring-offset-[var(--recess)]',
                  )}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex-1" />
        <button
          type="button"
          className="text-muted-foreground hover:text-muted-foreground transition-colors"
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
          'placeholder:text-muted-foreground',
          styles.text,
        )}
      />
    </div>
  );
}
