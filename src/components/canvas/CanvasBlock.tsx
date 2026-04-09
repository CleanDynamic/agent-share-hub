import { useRef, useState } from 'react';
import { GripVertical, FileText, Code2, Image, Zap, GitCompare, Bot, Workflow, SlidersHorizontal, Wrench, BookOpen, ListChecks, Type, ChevronRight } from 'lucide-react';
import { gridToPixels, positionsOverlap } from '@/lib/canvas-utils';
import type { CanvasBlock as CanvasBlockType, CanvasStage, BlockPosition } from '@/lib/canvas-types';
import { BlockEditModal } from './BlockEditModal';
import { BlockViewerInCanvas } from './BlockViewerInCanvas';
import { ExecutionPanel } from './ExecutionPanel';

const BLOCK_TYPE_LABELS: Record<string, string> = {
  prompt: 'Prompt', code: 'Code', text: 'Text', long_text: 'Long Text',
  image: 'Image', result: 'Result', comparison: 'Comparison',
  agent_config: 'Agent Config', workflow: 'Workflow', model_params: 'Model Params',
  tool_setup: 'Tool Setup', resource: 'Resource', tutorial_step: 'Tutorial Step',
  section_heading: 'Heading',
};

const BLOCK_ICONS: Record<string, React.ReactNode> = {
  prompt: <Zap size={14} />, code: <Code2 size={14} />, text: <FileText size={14} />,
  long_text: <FileText size={14} />, image: <Image size={14} />, result: <ListChecks size={14} />,
  comparison: <GitCompare size={14} />, agent_config: <Bot size={14} />,
  workflow: <Workflow size={14} />, model_params: <SlidersHorizontal size={14} />,
  tool_setup: <Wrench size={14} />, resource: <BookOpen size={14} />,
  tutorial_step: <ListChecks size={14} />, section_heading: <Type size={14} />,
};

interface CanvasBlockProps {
  block: CanvasBlockType;
  mode: 'edit' | 'view';
  colWidth: number;
  rowHeight: number;
  columnCount: number;
  allBlocks: CanvasBlockType[];
  stages: CanvasStage[];
  postType: string;
  showAnnotations?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onPositionChange: (p: BlockPosition) => void;
  onBlockChange: (patch: Partial<CanvasBlockType>) => void;
  onDelete: () => void;
  onArrowDrawStart: () => void;
  isArrowDrawing: boolean;
  onArrowDrawEnd: () => void;
  onAssignStage: (blockId: string, stageId: string | null) => void;
  onInsertResultBlock?: (block: Partial<CanvasBlockType>) => void;
}

export function CanvasBlock({
  block, mode, colWidth, rowHeight, columnCount,
  allBlocks, stages, postType, showAnnotations,
  selected, onSelect,
  onPositionChange, onBlockChange, onDelete,
  onArrowDrawStart, isArrowDrawing, onArrowDrawEnd,
  onAssignStage, onInsertResultBlock,
}: CanvasBlockProps) {
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [ghost, setGhost] = useState<BlockPosition | null>(null);
  const [ghostValid, setGhostValid] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [executionOpen, setExecutionOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [stagePickerOpen, setStagePickerOpen] = useState(false);

  const dragStartRef = useRef({ x: 0, y: 0, origCol: 0, origRow: 0 });
  const px = gridToPixels(block.position, colWidth, rowHeight);
  const inset = 4;

  const BLOCK_ACCENT: Record<string, string> = {
    prompt: '#E8571A', code: '#3B82F6', result: '#22C55E',
    agent_config: '#7C3AED', workflow: '#2EC4B6', comparison: '#EC4899',
    image: '#F59E0B', tutorial_step: '#E8571A',
    section_heading: 'rgba(255,255,255,0.20)', text: 'rgba(255,255,255,0.15)',
    long_text: 'rgba(255,255,255,0.15)', tool_setup: '#06B6D4',
    model_params: '#A78BFA', resource: '#64748B',
  };
  const accent = BLOCK_ACCENT[block.type] ?? 'rgba(255,255,255,0.15)';

  // ── Drag ─────────────────────────────────────────
  const handleDragMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'edit') return;
    const target = e.target as HTMLElement;
    // Don't start drag from toolbar buttons
    if (target.closest('button') || target.closest('[data-no-drag]')) return;
    e.preventDefault();
    setDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, origCol: block.position.col, origRow: block.position.row };
    let latestGhost: BlockPosition | null = null;
    let latestGhostValid = true;

    const move = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const newCol = Math.max(1, Math.min(columnCount - block.position.colSpan + 1, dragStartRef.current.origCol + Math.round(dx / colWidth)));
      const newRow = Math.max(1, dragStartRef.current.origRow + Math.round(dy / rowHeight));
      const proposed: BlockPosition = { ...block.position, col: newCol, row: newRow };
      const collision = allBlocks.some(other => other.id !== block.id && positionsOverlap(proposed, other.position));
      latestGhost = proposed;
      latestGhostValid = !collision;
      setGhost(proposed);
      setGhostValid(!collision);
    };

    const up = () => {
      setDragging(false);
      if (latestGhost && latestGhostValid) onPositionChange(latestGhost);
      setGhost(null);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  // ── Resize ───────────────────────────────────────
  const handleResizeRight = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (mode !== 'edit') return;
    const startX = e.clientX;
    const startSpan = block.position.colSpan;
    const move = (e: MouseEvent) => {
      const newSpan = Math.max(1, Math.min(columnCount - block.position.col + 1, Math.round(startSpan + (e.clientX - startX) / colWidth)));
      onPositionChange({ ...block.position, colSpan: newSpan });
    };
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  const handleResizeBottom = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (mode !== 'edit') return;
    const startY = e.clientY;
    const startSpan = block.position.rowSpan;
    const move = (e: MouseEvent) => {
      const newSpan = Math.max(1, Math.round(startSpan + (e.clientY - startY) / rowHeight));
      onPositionChange({ ...block.position, rowSpan: newSpan });
    };
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  const ghostPx = ghost ? gridToPixels(ghost, colWidth, rowHeight) : null;

  const typeLabel = BLOCK_TYPE_LABELS[block.type] ?? block.type;
  const icon = BLOCK_ICONS[block.type] ?? <FileText size={14} />;

  // Selection ring style
  const selectionBorder = selected
    ? '2px solid rgba(232,87,26,0.70)'
    : hovered ? '1px solid rgba(255,255,255,0.16)' : '1px solid rgba(255,255,255,0.06)';

  return (
    <>
      {/* Ghost */}
      {dragging && ghostPx && (
        <div style={{
          position: 'absolute', left: ghostPx.x, top: ghostPx.y, width: ghostPx.w, height: ghostPx.h,
          border: `2px dashed ${ghostValid ? 'rgba(232,87,26,0.50)' : 'rgba(239,68,68,0.50)'}`,
          borderRadius: 8,
          background: ghostValid ? 'rgba(232,87,26,0.05)' : 'rgba(239,68,68,0.05)',
          zIndex: 5, pointerEvents: 'none',
        }} />
      )}

      {/* The block */}
      <div
        data-canvas-block
        id={`canvas-block-${block.id}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setStagePickerOpen(false); }}
        onMouseDown={handleDragMouseDown}
        onClick={(e) => {
          if (mode === 'edit') {
            e.stopPropagation();
            if (isArrowDrawing) {
              onArrowDrawEnd();
            } else {
              onSelect?.();
            }
          }
        }}
        onDoubleClick={() => {
          if (mode === 'edit') setEditModalOpen(true);
        }}
        style={{
          position: 'absolute',
          left: px.x + inset, top: px.y + inset,
          width: px.w - inset * 2, height: px.h - inset * 2,
          zIndex: dragging ? 20 : 10,
          opacity: dragging ? 0.4 : 1,
          cursor: mode === 'edit' ? (dragging ? 'grabbing' : 'grab') : 'default',
          boxSizing: 'border-box',
        }}
      >
        {mode === 'edit' ? (
          /* ── EDIT MODE: Compact card ── */
          <div
            style={{
              height: '100%',
              background: selected ? 'rgba(232,87,26,0.06)' : 'rgba(14,14,20,0.85)',
              border: selectionBorder,
              borderRadius: 8,
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              boxShadow: selected
                ? '0 0 0 1px rgba(232,87,26,0.30), 0 4px 20px rgba(0,0,0,0.3)'
                : hovered ? '0 4px 20px rgba(0,0,0,0.3)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}
          >
            {/* Accent bar top */}
            <div style={{ height: 2, background: accent, flexShrink: 0 }} />

            {/* Card body */}
            <div style={{ flex: 1, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6, minHeight: 0, overflow: 'hidden' }}>
              {/* Drag grip */}
              <div
                className="drag-grip"
                title="Drag to move"
                onClick={e => e.stopPropagation()}
                style={{
                  flexShrink: 0, width: 16, height: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'grab', color: hovered ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.15)',
                  borderRadius: 3,
                }}
              >
                <GripVertical size={10} />
              </div>

              {/* Icon */}
              <div style={{ flexShrink: 0, color: accent }}>
                {icon}
              </div>

              {/* Title + type label */}
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {block.subheading || typeLabel}
                </div>
                {block.subheading && (
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.30)', marginTop: 1, whiteSpace: 'nowrap' }}>
                    {typeLabel}
                  </div>
                )}
              </div>

              {/* Open indicator */}
              <div style={{ flexShrink: 0, color: 'rgba(255,255,255,0.12)' }}>
                <ChevronRight size={10} />
              </div>
            </div>

            {/* Optional grid note */}
            {block.textContent && (
              <div style={{
                padding: '0 8px 4px 30px',
                fontSize: 9, color: 'rgba(255,255,255,0.22)',
                lineHeight: 1.3,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {block.textContent.slice(0, 100)}
              </div>
            )}

            {/* Hover toolbar */}
            {(hovered || selected) && (
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'absolute', bottom: 4, right: 4,
                  display: 'flex', alignItems: 'center', gap: 2,
                  background: 'rgba(10,10,16,0.95)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 5, padding: '2px 4px',
                  zIndex: 30,
                }}
              >
                <button
                  onClick={e => {
                    e.stopPropagation();
                    if (deleteConfirm) { onDelete(); setDeleteConfirm(false); }
                    else { setDeleteConfirm(true); setTimeout(() => setDeleteConfirm(false), 2500); }
                  }}
                  onMouseLeave={() => setDeleteConfirm(false)}
                  style={{
                    background: deleteConfirm ? 'rgba(239,68,68,0.15)' : 'none',
                    border: deleteConfirm ? '1px solid rgba(239,68,68,0.3)' : 'none',
                    color: deleteConfirm ? 'rgba(239,68,68,0.8)' : 'rgba(255,255,255,0.35)',
                    cursor: 'pointer', fontSize: 10, padding: '1px 4px', borderRadius: 3,
                  }}
                >
                  {deleteConfirm ? '✕' : 'Del'}
                </button>

                {/* Edit button */}
                <button
                  onClick={e => { e.stopPropagation(); setEditModalOpen(true); }}
                  style={{
                    background: 'none', border: 'none',
                    color: 'rgba(255,255,255,0.35)',
                    cursor: 'pointer', fontSize: 10, padding: '1px 4px',
                  }}
                >
                  Edit
                </button>

                {/* Arrow/link button */}
                <button
                  onClick={e => { e.stopPropagation(); onArrowDrawStart(); }}
                  style={{
                    background: 'none', border: 'none',
                    color: 'rgba(255,255,255,0.35)',
                    cursor: 'pointer', fontSize: 10, padding: '1px 4px',
                  }}
                >
                  →
                </button>

                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={e => { e.stopPropagation(); setStagePickerOpen(o => !o); }}
                      style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 10, padding: '1px 4px' }}
                    >
                      {block.stageId ? 'S' : '+S'}
                    </button>
                    {stagePickerOpen && (
                      <div style={{
                        position: 'absolute', bottom: '100%', right: 0, marginBottom: 4,
                        background: 'rgba(10,10,16,0.98)', border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 6, padding: '4px 0', minWidth: 120, zIndex: 50,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.50)',
                      }}>
                        <button onClick={() => { onAssignStage(block.id, null); setStagePickerOpen(false); }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 10px', background: 'none', border: 'none', fontSize: 10, color: 'rgba(255,255,255,0.40)', cursor: 'pointer' }}>
                          No stage
                        </button>
                        {stages.map(s => (
                          <button key={s.id}
                            onClick={() => { onAssignStage(block.id, s.id); setStagePickerOpen(false); }}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 10px', background: 'none', border: 'none', fontSize: 10, color: block.stageId === s.id ? '#E8571A' : 'rgba(255,255,255,0.60)', cursor: 'pointer', fontWeight: block.stageId === s.id ? 700 : 400 }}>
                            {s.stageNumber}. {s.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {(block.type === 'prompt' || block.type === 'code') && (
                  <button onClick={e => { e.stopPropagation(); setExecutionOpen(true); }}
                    style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 3, padding: '1px 5px', color: '#22C55E', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>
                    Run
                  </button>
                )}
              </div>
            )}

            {/* Stage badge */}
            {block.stageIndex && (
              <div style={{
                position: 'absolute', top: 6, right: 6,
                fontSize: 8, fontWeight: 700, color: accent,
                background: `${accent}18`, border: `1px solid ${accent}30`,
                borderRadius: 3, padding: '0px 4px', zIndex: 2,
              }}>
                {block.stageIndex}
              </div>
            )}
          </div>
        ) : (
          /* ── VIEW MODE: Full content display ── */
          <div style={{
            height: '100%',
            background: block.type === 'section_heading' ? 'transparent' : 'rgba(14,14,20,0.80)',
            border: block.type === 'section_heading' ? 'none' : '1px solid rgba(255,255,255,0.06)',
            borderTop: block.type === 'section_heading' ? 'none' : `2px solid ${accent}`,
            borderRadius: 10, overflow: 'hidden',
            backdropFilter: 'blur(4px)',
            position: 'relative',
          }}>
            {showAnnotations && block.creatorAnnotation && (
              <div title={block.creatorAnnotation} style={{
                position: 'absolute', top: 8, right: 8, width: 18, height: 18,
                background: 'rgba(245,158,11,0.20)', border: '1px solid rgba(245,158,11,0.40)',
                borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, cursor: 'help', zIndex: 2,
              }}>✎</div>
            )}

            <div style={{ padding: 12, overflowY: 'auto', maxHeight: '100%', boxSizing: 'border-box' }}>
              {block.type === 'section_heading' ? (
                <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.90)', margin: 0 }}>
                  {block.textContent}
                </h2>
              ) : (
                <BlockViewerInCanvas block={block} postType={postType} />
              )}
            </div>

            {block.isLocked && block.lockType === 'blur' && (
              <div style={{
                position: 'absolute', inset: 0, backdropFilter: 'blur(8px)',
                background: 'rgba(6,6,10,0.60)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', borderRadius: 10,
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.50)' }}>Download to unlock</div>
              </div>
            )}
          </div>
        )}

        {/* ── Resize handles (edit only) ── */}
        {mode === 'edit' && (
          <>
            <div onMouseDown={handleResizeRight} style={{
              position: 'absolute', right: -2, top: '20%', height: '60%', width: 5,
              cursor: 'ew-resize', background: 'rgba(232,87,26,0.60)', borderRadius: 2, zIndex: 25,
              opacity: hovered || selected ? 1 : 0.2, transition: 'opacity 0.15s',
            }} />
            <div onMouseDown={handleResizeBottom} style={{
              position: 'absolute', bottom: -2, left: '20%', width: '60%', height: 5,
              cursor: 'ns-resize', background: 'rgba(232,87,26,0.60)', borderRadius: 2, zIndex: 25,
              opacity: hovered || selected ? 1 : 0.2, transition: 'opacity 0.15s',
            }} />
            <div onMouseDown={e => { handleResizeRight(e); handleResizeBottom(e); }} style={{
              position: 'absolute', bottom: -3, right: -3, width: 7, height: 7,
              cursor: 'se-resize', background: '#E8571A', borderRadius: '50%', zIndex: 26,
              border: '2px solid rgba(6,6,10,0.80)',
              opacity: hovered || selected ? 1 : 0.25, transition: 'opacity 0.15s',
            }} />
          </>
        )}

        {/* Arrow drawing indicator — glow when arrow mode active */}
        {mode === 'edit' && isArrowDrawing && (
          <div style={{
            position: 'absolute', inset: -2,
            border: '2px dashed rgba(232,87,26,0.40)',
            borderRadius: 10, pointerEvents: 'none', zIndex: 26,
          }} />
        )}
      </div>

      {/* Edit modal */}
      {editModalOpen && (
        <BlockEditModal
          block={block}
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onChange={onBlockChange}
        />
      )}

      {/* Execution panel */}
      {executionOpen && (
        <ExecutionPanel
          block={block}
          mode={mode}
          onClose={() => setExecutionOpen(false)}
          onAcceptResult={result => {
            onInsertResultBlock?.({
              textContent: result, type: 'result', subheading: 'Generated Output',
              position: {
                col: block.position.col,
                row: block.position.row + block.position.rowSpan + 1,
                colSpan: block.position.colSpan, rowSpan: 3,
              },
            });
            setExecutionOpen(false);
          }}
        />
      )}
    </>
  );
}
