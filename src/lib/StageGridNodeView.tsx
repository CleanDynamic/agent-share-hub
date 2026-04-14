import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { useState, useRef, useLayoutEffect } from 'react';
import { useCanvasDocument } from '@/hooks/useCanvasDocument';
import { CanvasShell } from '@/components/canvas/CanvasShell';
import { BlockFocusPanel } from '@/components/canvas/BlockFocusPanel';
import type { CanvasBlock, BlockArrow } from '@/lib/canvas-types';
import { ARROW_TYPE_META } from '@/lib/canvas-types';

// ─── Compact Arrow Overlay (simplified, non-interactive) ───────
function CompactArrowOverlay({
  arrows,
  blocks,
}: {
  arrows: BlockArrow[];
  blocks: CanvasBlock[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<Array<{
    id: string; d: string; color: string; dash: string;
    label: string | null; midX: number; midY: number;
  }>>([]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const newPaths: typeof paths = [];
    const blockMap = new Map(blocks.map(b => [b.id, b]));

    arrows.forEach(arrow => {
      const fromEl = container.parentElement?.querySelector(
        `#canvas-block-${arrow.fromBlockId}`
      ) as HTMLElement | null;
      const toEl = container.parentElement?.querySelector(
        `#canvas-block-${arrow.toBlockId}`
      ) as HTMLElement | null;

      const allTargetIds = arrow.toBlockIds && arrow.toBlockIds.length > 0
        ? arrow.toBlockIds
        : [arrow.toBlockId];

      allTargetIds.forEach((targetId, idx) => {
        const targetEl = container.parentElement?.querySelector(
          `#canvas-block-${targetId}`
        ) as HTMLElement | null;

        if (!fromEl || !targetEl) return;
        const parentRect = container.parentElement!.getBoundingClientRect();
        const fromRect = fromEl.getBoundingClientRect();
        const toRect = targetEl.getBoundingClientRect();

        const fromX = fromRect.left + fromRect.width / 2 - parentRect.left;
        const fromY = fromRect.top + fromRect.height / 2 - parentRect.top;
        const toX = toRect.left + toRect.width / 2 - parentRect.left;
        const toY = toRect.top + toRect.height / 2 - parentRect.top;

        // Simple curved path
        const midX = (fromX + toX) / 2;
        const midY = (fromY + toY) / 2;
        const cx = midX;
        const cy = Math.min(fromY, toY) - 20;
        const d = `M ${fromX} ${fromY} Q ${cx} ${cy} ${toX} ${toY}`;

        const meta = ARROW_TYPE_META[arrow.arrowType];
        const fromIsSticky = blockMap.get(arrow.fromBlockId)?.type === 'sticky_note';
        const toIsSticky = blockMap.get(targetId)?.type === 'sticky_note';
        const dash = (fromIsSticky || toIsSticky) ? '2,3' : meta.dash;

        newPaths.push({
          id: `${arrow.id}-${idx}`,
          d,
          color: arrow.color ?? meta.color,
          dash,
          label: idx === 0 ? arrow.label : null,
          midX, midY,
        });
      });
    });

    setPaths(newPaths);
  }, [arrows, blocks]);

  if (arrows.length === 0) return null;

  return (
    <div ref={containerRef} style={{
      position: 'absolute', inset: 0,
      pointerEvents: 'none', zIndex: 8,
    }}>
      <svg style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        overflow: 'visible',
      }}>
        <defs>
          {Object.entries(ARROW_TYPE_META).map(([type, meta]) => (
            <marker
              key={type}
              id={`compact-arrow-${type}`}
              viewBox="0 0 10 10"
              refX="9" refY="5"
              markerWidth="8" markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={meta.color} />
            </marker>
          ))}
        </defs>
        {paths.map(p => (
          <g key={p.id}>
            <path
              d={p.d}
              fill="none"
              stroke={p.color}
              strokeWidth={2}
              strokeDasharray={p.dash}
              markerEnd={`url(#compact-arrow-${p.id.split('-')[0]})`}
              opacity={0.6}
            />
            {p.label && (
              <g>
                <rect
                  x={p.midX - 24} y={p.midY - 8}
                  width={48} height={16} rx={3}
                  fill="rgba(10,10,16,0.90)"
                  stroke={p.color} strokeWidth={1} strokeOpacity={0.4}
                />
                <text
                  x={p.midX} y={p.midY + 3}
                  textAnchor="middle" fontSize={8}
                  fontWeight={700} fontFamily="Inter, sans-serif"
                  fill={p.color} letterSpacing={0.5}
                >
                  {p.label}
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Compact Block Grid (view mode) ───────────────────────
function CompactBlockGrid({
  blocks,
  onBlockClick,
}: {
  blocks: CanvasBlock[];
  onBlockClick: (block: CanvasBlock) => void;
}) {
  const ordered = [...blocks].sort((a, b) =>
    a.position.row !== b.position.row
      ? a.position.row - b.position.row
      : a.position.col - b.position.col
  );

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(12, 1fr)',
      gap: 8,
      padding: '12px 16px 16px 16px',
    }}>
      {ordered.map(block => (
        <div
          key={block.id}
          id={`canvas-block-${block.id}`}
          onClick={() => onBlockClick(block)}
          style={{
            gridColumn: `${block.position.col} / span ${block.position.colSpan}`,
            padding: '10px 12px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'all 0.15s',
            minHeight: 60,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background =
              'rgba(255,255,255,0.06)';
            (e.currentTarget as HTMLElement).style.borderColor =
              'rgba(255,255,255,0.14)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background =
              'rgba(255,255,255,0.03)';
            (e.currentTarget as HTMLElement).style.borderColor =
              'rgba(255,255,255,0.07)';
          }}
        >
          {/* Block type chip */}
          <div style={{
            fontSize: 9, fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.10em',
            color: 'rgba(255,255,255,0.28)',
            marginBottom: 6,
          }}>
            {block.stageIndex && (
              <span style={{
                color: '#E8571A', marginRight: 6,
                fontFamily: 'monospace',
              }}>
                {block.stageIndex}
              </span>
            )}
            {block.type?.replace(/_/g, ' ')}
          </div>

          {/* Block subheading */}
          {block.subheading && (
            <div style={{
              fontSize: 13, fontWeight: 600,
              color: 'rgba(255,255,255,0.80)',
              fontFamily: "'Playfair Display', serif",
              lineHeight: 1.3, marginBottom: 4,
            }}>
              {block.subheading}
            </div>
          )}

          {/* Content preview */}
          <div style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.42)',
            lineHeight: 1.55, overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {block.textContent?.substring(0, 100)}
          </div>

          {/* Click hint */}
          <div style={{
            marginTop: 8, fontSize: 10,
            color: 'rgba(255,255,255,0.18)',
          }}>
            Click to view full block →
          </div>
        </div>
      ))}
    </div>
  );
}

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
        data-toc-anchor={`stage-${stageGridId}`}
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

        {/* The canvas shell (edit) or compact block grid (view) */}
        <div style={{ height: 'auto', minHeight: 120 }}>
          {stageGridId ? (
            mode === 'view' ? (
              <div style={{ position: 'relative' }}>
                <CompactBlockGrid
                  blocks={canvasDoc.blocks}
                  onBlockClick={openFocusPanel}
                />
                <CompactArrowOverlay
                  arrows={canvasDoc.arrows}
                  blocks={canvasDoc.blocks}
                />
              </div>
            ) : canvasDoc.blocks.length === 0 ? (
              /* Empty stage — show CTA */
              <div style={{
                padding: '32px 24px', textAlign: 'center',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 8,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'rgba(232,87,26,0.08)',
                  border: '1px dashed rgba(232,87,26,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, color: 'rgba(232,87,26,0.50)',
                }}>
                  +
                </div>
                <div style={{
                  fontSize: 12, color: 'rgba(255,255,255,0.30)',
                  fontFamily: 'Inter, sans-serif',
                }}>
                  Click <strong style={{ color: 'rgba(255,255,255,0.50)' }}>+ Block</strong> in the canvas to add blocks
                </div>
              </div>
            ) : (
              <CanvasShell
                mode={mode}
                doc={canvasDoc}
                title=""
                description=""
                postType="build"
                hideHeader={true}
                embedded={true}
                height="auto"
                onSave={() => canvasDoc.saveDocument(stageGridId)}
              />
            )
          ) : (
            <div style={{
              padding: 24, textAlign: 'center',
              fontSize: 12, color: 'rgba(255,255,255,0.25)',
            }}>
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
