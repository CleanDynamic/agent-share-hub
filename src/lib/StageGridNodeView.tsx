import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { useState } from 'react';
import { useCanvasDocument } from '@/hooks/useCanvasDocument';
import { CanvasShell } from '@/components/canvas/CanvasShell';
import { BlockFocusPanel } from '@/components/canvas/BlockFocusPanel';
import type { CanvasBlock } from '@/lib/canvas-types';

export function StageGridNodeView({
  node,
  updateAttributes,
  selected,
  editor,
}: NodeViewProps) {
  const { stageGridId, stageId, label } = node.attrs;
  const mode = editor.isEditable ? 'edit' : 'view';
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelVal, setLabelVal] = useState(label);
  const [focusedBlock, setFocusedBlock] = useState<CanvasBlock | null>(null);

  const openFocusPanel = (block: CanvasBlock) => {
    setFocusedBlock(block);
  };

  // Each stage grid has its own canvas document
  // scoped to its stageGridId (used as contentId)
  const canvasDoc = useCanvasDocument(stageGridId);

  const handleLabelSave = () => {
    updateAttributes({ label: labelVal });
    setEditingLabel(false);
  };

  return (
    <NodeViewWrapper>
      <div
        contentEditable={false}
        style={{
          margin: '20px 0',
          borderRadius: 12,
          overflow: 'hidden',
          border: selected
            ? '2px solid rgba(232,87,26,0.50)'
            : '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(10,10,18,0.60)',
          transition: 'border-color 0.15s',
        }}
      >
        {/* Stage grid header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          {editingLabel && mode === 'edit' ? (
            <input
              autoFocus
              value={labelVal}
              onChange={e => setLabelVal(e.target.value)}
              onBlur={handleLabelSave}
              onKeyDown={e => {
                if (e.key === 'Enter') handleLabelSave();
                if (e.key === 'Escape') setEditingLabel(false);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(232,87,26,0.40)',
                outline: 'none',
                fontSize: 12,
                fontWeight: 700,
                color: '#E8571A',
                textTransform: 'uppercase',
                letterSpacing: '0.10em',
                padding: '2px 0',
                width: 180,
              }}
            />
          ) : (
            <div
              onClick={() => mode === 'edit' && setEditingLabel(true)}
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.10em',
                color: 'rgba(232,87,26,0.70)',
                cursor: mode === 'edit' ? 'text' : 'default',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#E8571A',
                  opacity: 0.7,
                }}
              />
              {label}
              {mode === 'edit' && (
                <span
                  style={{
                    fontSize: 9,
                    color: 'rgba(255,255,255,0.20)',
                    fontWeight: 400,
                  }}
                >
                  (click to rename)
                </span>
              )}
            </div>
          )}

          {/* Block count indicator */}
          <div
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.25)',
            }}
          >
            {canvasDoc.blocks.length} block
            {canvasDoc.blocks.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* The canvas shell */}
        <div
          style={{
            minHeight: canvasDoc.blocks.length === 0 ? 120 : 'auto',
          }}
        >
          {stageGridId ? (
            <CanvasShell
              mode={mode}
              doc={canvasDoc}
              title=""
              description=""
              postType="build"
              hideHeader={true}
              embedded={true}
              onSave={() => canvasDoc.saveDocument(stageGridId)}
              onBlockClick={mode === 'view' ? openFocusPanel : undefined}
            />
          ) : (
            <div
              style={{
                padding: 24,
                textAlign: 'center',
                fontSize: 12,
                color: 'rgba(255,255,255,0.25)',
              }}
            >
              Loading stage...
            </div>
          )}
        </div>
      </div>

      {/* Block focus panel — opens when a block is clicked in view mode */}
      {mode === 'view' && (
        <BlockFocusPanel
          block={focusedBlock}
          onClose={() => setFocusedBlock(null)}
        />
      )}
    </NodeViewWrapper>
  );
}
