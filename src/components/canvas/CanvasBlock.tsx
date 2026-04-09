import { useRef, useState } from 'react';
import { gridToPixels, positionsOverlap } from '@/lib/canvas-utils';
import type { CanvasBlock as CanvasBlockType, CanvasStage, BlockPosition } from '@/lib/canvas-types';
import { BlockInlineEditor } from './BlockInlineEditor';
import { BlockViewerInCanvas } from './BlockViewerInCanvas';
import { ExecutionPanel } from './ExecutionPanel';

interface CanvasBlockProps {
  block: CanvasBlockType;
  mode: 'edit' | 'view';
  colWidth: number;
  rowHeight: number;
  columnCount: number;
  allBlocks: CanvasBlockType[];
  stages: CanvasStage[];
  postType: string;
  onPositionChange: (p: BlockPosition) => void;
  onBlockChange: (patch: Partial<CanvasBlockType>) => void;
  onDelete: () => void;
  onArrowDrawStart: (
    blockId: string,
    edge: 'top' | 'right' | 'bottom' | 'left'
  ) => void;
  isArrowDrawing: boolean;
  onArrowDrawEnd: (
    blockId: string,
    edge: 'top' | 'right' | 'bottom' | 'left'
  ) => void;
  onAssignStage: (blockId: string, stageId: string | null) => void;
  onInsertResultBlock?: (block: Partial<CanvasBlockType>) => void;
}

export function CanvasBlock({
  block, mode, colWidth, rowHeight, columnCount,
  allBlocks, stages, postType,
  onPositionChange, onBlockChange, onDelete,
  onArrowDrawStart, isArrowDrawing, onArrowDrawEnd,
  onAssignStage, onInsertResultBlock,
}: CanvasBlockProps) {

  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [ghost, setGhost] = useState<BlockPosition | null>(null);
  const [ghostValid, setGhostValid] = useState(true);
  const [annotationOpen, setAnnotationOpen] = useState(false);
  const [stagePickerOpen, setStagePickerOpen] = useState(false);
  const [executionOpen, setExecutionOpen] = useState(false);

  const dragStartRef = useRef({
    x: 0, y: 0, origCol: 0, origRow: 0,
  });

  const px = gridToPixels(block.position, colWidth, rowHeight);

  // ── Drag ─────────────────────────────────────────
  const handleDragMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'edit') return;
    const target = e.target as HTMLElement;
    if (target.closest(
      '.block-editor-area, .resize-handle,' +
      '.connection-point, .block-toolbar-btn'
    )) return;

    e.preventDefault();
    setDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      origCol: block.position.col,
      origRow: block.position.row,
    };

    let latestGhost: BlockPosition | null = null;
    let latestGhostValid = true;

    const move = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const newCol = Math.max(
        1,
        Math.min(
          columnCount - block.position.colSpan + 1,
          dragStartRef.current.origCol +
            Math.round(dx / colWidth)
        )
      );
      const newRow = Math.max(
        1,
        dragStartRef.current.origRow +
          Math.round(dy / rowHeight)
      );
      const proposed: BlockPosition = {
        ...block.position,
        col: newCol,
        row: newRow,
      };
      const collision = allBlocks.some(
        other => other.id !== block.id &&
          positionsOverlap(proposed, other.position)
      );
      latestGhost = proposed;
      latestGhostValid = !collision;
      setGhost(proposed);
      setGhostValid(!collision);
    };

    const up = () => {
      setDragging(false);
      if (latestGhost && latestGhostValid) {
        onPositionChange(latestGhost);
      }
      setGhost(null);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };

    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  // ── Resize right edge ─────────────────────────────
  const handleResizeRight = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (mode !== 'edit') return;
    const startX = e.clientX;
    const startSpan = block.position.colSpan;

    const move = (e: MouseEvent) => {
      const dx = e.clientX - startX;
      const newSpan = Math.max(
        1,
        Math.min(
          columnCount - block.position.col + 1,
          Math.round(startSpan + dx / colWidth)
        )
      );
      onPositionChange({
        ...block.position,
        colSpan: newSpan,
      });
    };

    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };

    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  // ── Resize bottom edge ────────────────────────────
  const handleResizeBottom = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (mode !== 'edit') return;
    const startY = e.clientY;
    const startSpan = block.position.rowSpan;

    const move = (e: MouseEvent) => {
      const dy = e.clientY - startY;
      const newSpan = Math.max(
        1,
        Math.round(startSpan + dy / rowHeight)
      );
      onPositionChange({
        ...block.position,
        rowSpan: newSpan,
      });
    };

    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };

    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  const ghostPx = ghost
    ? gridToPixels(ghost, colWidth, rowHeight)
    : null;

  // Block type colour for the top accent bar
  const BLOCK_ACCENT: Record<string, string> = {
    prompt: '#E8571A',
    code: '#3B82F6',
    result: '#22C55E',
    agent_config: '#7C3AED',
    workflow: '#2EC4B6',
    comparison: '#EC4899',
    image: '#F59E0B',
    tutorial_step: '#E8571A',
    section_heading: 'rgba(255,255,255,0.20)',
    text: 'rgba(255,255,255,0.08)',
    long_text: 'rgba(255,255,255,0.08)',
    tool_setup: '#06B6D4',
    model_params: '#A78BFA',
    resource: '#64748B',
  };
  const accent = BLOCK_ACCENT[block.type] ?? 'rgba(255,255,255,0.08)';

  return (
    <>
      {/* Ghost position indicator during drag */}
      {dragging && ghostPx && (
        <div style={{
          position: 'absolute',
          left: ghostPx.x, top: ghostPx.y,
          width: ghostPx.w, height: ghostPx.h,
          border: `2px dashed ${ghostValid
            ? 'rgba(232,87,26,0.50)'
            : 'rgba(239,68,68,0.50)'}`,
          borderRadius: 8,
          background: ghostValid
            ? 'rgba(232,87,26,0.05)'
            : 'rgba(239,68,68,0.05)',
          zIndex: 5,
          pointerEvents: 'none',
        }} />
      )}

      {/* The block itself */}
      <div
        id={`canvas-block-${block.id}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onMouseDown={handleDragMouseDown}
        style={{
          position: 'absolute',
          left: px.x, top: px.y,
          width: px.w,
          minHeight: px.h,
          zIndex: dragging ? 20 : 10,
          opacity: dragging ? 0.4 : 1,
          cursor: mode === 'edit' ? 'grab' : 'default',
          boxSizing: 'border-box',
        }}
      >
        {/* Block card surface */}
        <div style={{
          height: '100%',
          background: block.type === 'section_heading'
            ? 'transparent'
            : 'rgba(14,14,20,0.80)',
          border: block.type === 'section_heading'
            ? 'none'
            : hovered && mode === 'edit'
              ? `1px solid rgba(255,255,255,0.14)`
              : '1px solid rgba(255,255,255,0.06)',
          borderTop: block.type === 'section_heading'
            ? 'none'
            : `2px solid ${accent}`,
          borderRadius: 10,
          overflow: 'hidden',
          backdropFilter: 'blur(4px)',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          boxShadow: hovered && mode === 'edit'
            ? '0 4px 24px rgba(0,0,0,0.30)'
            : 'none',
          position: 'relative',
        }}>

          {/* Stage index badge */}
          {block.stageIndex && (
            <div style={{
              position: 'absolute',
              top: 8, left: 8,
              fontSize: 9, fontWeight: 700,
              color: accent,
              background: `${accent}18`,
              border: `1px solid ${accent}30`,
              borderRadius: 4,
              padding: '1px 6px',
              zIndex: 2,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              {block.stageIndex}
            </div>
          )}

          {/* Annotation indicator */}
          {block.creatorAnnotation && mode === 'edit' && (
            <button
              className="block-toolbar-btn"
              onClick={e => {
                e.stopPropagation();
                setAnnotationOpen(o => !o);
              }}
              style={{
                position: 'absolute',
                top: 8, right: 8,
                background: 'rgba(245,158,11,0.15)',
                border: '1px solid rgba(245,158,11,0.30)',
                borderRadius: 4, padding: '2px 6px',
                fontSize: 9, color: '#F59E0B',
                cursor: 'pointer', zIndex: 2,
              }}
            >
              Note
            </button>
          )}

          {/* Annotation popover */}
          {annotationOpen && (
            <div style={{
              position: 'absolute',
              top: 32, right: 8,
              width: 220, zIndex: 50,
              background: 'rgba(10,10,16,0.98)',
              border: '1px solid rgba(245,158,11,0.30)',
              borderRadius: 8, padding: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.50)',
            }}>
              <textarea
                value={block.creatorAnnotation ?? ''}
                onChange={e =>
                  onBlockChange({
                    creatorAnnotation: e.target.value
                  })
                }
                placeholder="Creator note (private)..."
                rows={3}
                style={{
                  width: '100%', background: 'transparent',
                  border: 'none', outline: 'none',
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.65)',
                  resize: 'none',
                  fontFamily: 'Inter, sans-serif',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Block content */}
          <div
            className="block-editor-area"
            style={{ padding: 16 }}
          >
            {/* Section heading renders differently */}
            {block.type === 'section_heading' ? (
              mode === 'edit' ? (
                <input
                  value={block.textContent ?? ''}
                  onChange={e =>
                    onBlockChange({ textContent: e.target.value })
                  }
                  placeholder="Section heading..."
                  style={{
                    width: '100%',
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: 18, fontWeight: 700,
                    color: 'rgba(255,255,255,0.90)',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '2px solid rgba(255,255,255,0.15)',
                    outline: 'none',
                    padding: '4px 0',
                    boxSizing: 'border-box',
                  }}
                />
              ) : (
                <h2 style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: 18, fontWeight: 700,
                  color: 'rgba(255,255,255,0.90)',
                  margin: 0,
                }}>
                  {block.textContent}
                </h2>
              )
            ) : mode === 'edit' ? (
              /* Edit mode: use inline editors */
              <BlockInlineEditor
                block={block}
                onChange={onBlockChange}
              />
            ) : (
              /* View mode: use content viewers */
              <BlockViewerInCanvas
                block={block}
                postType={postType}
              />
            )}
          </div>

          {/* Edit mode toolbar — appears on hover */}
          {mode === 'edit' && hovered && (
            <div
              className="block-toolbar-btn"
              style={{
                position: 'absolute',
                top: 8,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex', alignItems: 'center',
                gap: 4,
                background: 'rgba(10,10,16,0.95)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 6, padding: '3px 6px',
                zIndex: 30,
              }}
            >
              <button
                className="block-toolbar-btn"
                onClick={e => {
                  e.stopPropagation();
                  onDelete();
                }}
                style={{
                  background: 'none', border: 'none',
                  color: 'rgba(255,255,255,0.35)',
                  cursor: 'pointer', fontSize: 12,
                  padding: '2px 5px',
                }}
              >
                Delete
              </button>
              <button
                className="block-toolbar-btn"
                onClick={e => {
                  e.stopPropagation();
                  setAnnotationOpen(o => !o);
                }}
                style={{
                  background: 'none', border: 'none',
                  color: 'rgba(255,255,255,0.35)',
                  cursor: 'pointer', fontSize: 12,
                  padding: '2px 5px',
                }}
              >
                Note
              </button>

              {stages.length > 0 && (
                <div style={{ position: 'relative' }}>
                  <button
                    className="block-toolbar-btn"
                    onClick={e => {
                      e.stopPropagation();
                      setStagePickerOpen(o => !o);
                    }}
                    style={{
                      background: 'none', border: 'none',
                      color: 'rgba(255,255,255,0.35)',
                      cursor: 'pointer', fontSize: 12,
                      padding: '2px 5px',
                    }}
                  >
                    {block.stageId ? 'Stage' : '+ Stage'}
                  </button>

                  {stagePickerOpen && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0,
                      background: 'rgba(10,10,16,0.98)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 8, padding: '6px 0',
                      minWidth: 140, zIndex: 50,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.50)',
                    }}>
                      {/* None option */}
                      <button
                        onClick={() => {
                          onAssignStage(block.id, null);
                          setStagePickerOpen(false);
                        }}
                        style={{
                          display: 'block', width: '100%',
                          textAlign: 'left',
                          padding: '6px 12px', background: 'none',
                          border: 'none', fontSize: 12,
                          color: 'rgba(255,255,255,0.40)',
                          cursor: 'pointer',
                        }}
                      >
                        No stage
                      </button>
                      {stages.map(s => (
                        <button
                          key={s.id}
                          onClick={() => {
                            onAssignStage(block.id, s.id);
                            setStagePickerOpen(false);
                          }}
                          style={{
                            display: 'block', width: '100%',
                            textAlign: 'left',
                            padding: '6px 12px', background: 'none',
                            border: 'none', fontSize: 12,
                            color: block.stageId === s.id
                              ? '#E8571A'
                              : 'rgba(255,255,255,0.60)',
                            cursor: 'pointer',
                            fontWeight: block.stageId === s.id ? 700 : 400,
                          }}
                        >
                          {s.stageNumber}. {s.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {(block.type === 'prompt' ||
                block.type === 'code') && (
                <button
                  className="block-toolbar-btn"
                  onClick={e => {
                    e.stopPropagation();
                    setExecutionOpen(true);
                  }}
                  style={{
                    background: 'rgba(34,197,94,0.12)',
                    border: '1px solid rgba(34,197,94,0.25)',
                    borderRadius: 4, padding: '2px 8px',
                    color: '#22C55E', fontSize: 11,
                    fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Run
                </button>
              )}
            </div>
          )}

          {/* Locked overlay — view mode */}
          {block.isLocked &&
            block.lockType === 'blur' &&
            mode === 'view' && (
            <div style={{
              position: 'absolute', inset: 0,
              backdropFilter: 'blur(8px)',
              background: 'rgba(6,6,10,0.60)',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
            }}>
              <div style={{
                fontSize: 12, fontWeight: 600,
                color: 'rgba(255,255,255,0.50)',
              }}>
                Download to unlock
              </div>
            </div>
          )}
        </div>

        {/* ── Resize handles (edit only) ─────────── */}
        {mode === 'edit' && hovered && (
          <>
            {/* Right edge resize */}
            <div
              className="resize-handle"
              onMouseDown={handleResizeRight}
              style={{
                position: 'absolute',
                right: -4, top: '20%',
                height: '60%', width: 8,
                cursor: 'ew-resize',
                background: 'rgba(232,87,26,0.60)',
                borderRadius: 4, zIndex: 25,
              }}
            />

            {/* Bottom edge resize */}
            <div
              className="resize-handle"
              onMouseDown={handleResizeBottom}
              style={{
                position: 'absolute',
                bottom: -4, left: '20%',
                width: '60%', height: 8,
                cursor: 'ns-resize',
                background: 'rgba(232,87,26,0.60)',
                borderRadius: 4, zIndex: 25,
              }}
            />

            {/* Corner resize */}
            <div
              className="resize-handle"
              onMouseDown={e => {
                handleResizeRight(e);
                handleResizeBottom(e);
              }}
              style={{
                position: 'absolute',
                bottom: -5, right: -5,
                width: 10, height: 10,
                cursor: 'se-resize',
                background: '#E8571A',
                borderRadius: '50%', zIndex: 26,
                border: '2px solid rgba(6,6,10,0.80)',
              }}
            />
          </>
        )}

        {/* ── Connection points for arrows ──────── */}
        {mode === 'edit' && hovered && (
          <>
            {(['top', 'right', 'bottom', 'left'] as const).map(edge => {
              const edgeStyle = {
                top: {
                  top: -6, left: '50%',
                  transform: 'translateX(-50%)',
                  cursor: 'crosshair',
                },
                right: {
                  right: -6, top: '50%',
                  transform: 'translateY(-50%)',
                  cursor: 'crosshair',
                },
                bottom: {
                  bottom: -6, left: '50%',
                  transform: 'translateX(-50%)',
                  cursor: 'crosshair',
                },
                left: {
                  left: -6, top: '50%',
                  transform: 'translateY(-50%)',
                  cursor: 'crosshair',
                },
              }[edge];

              return (
                <div
                  key={edge}
                  className="connection-point"
                  onMouseDown={e => {
                    e.stopPropagation();
                    onArrowDrawStart(block.id, edge);
                  }}
                  onMouseUp={e => {
                    e.stopPropagation();
                    if (isArrowDrawing) {
                      onArrowDrawEnd(block.id, edge);
                    }
                  }}
                  style={{
                    position: 'absolute',
                    width: 12, height: 12,
                    borderRadius: '50%',
                    background: 'rgba(232,87,26,0.80)',
                    border: '2px solid rgba(6,6,10,0.90)',
                    zIndex: 27,
                    ...edgeStyle,
                  }}
                />
              );
            })}
          </>
        )}
      </div>

      {executionOpen && (
        <ExecutionPanel
          block={block}
          mode={mode}
          onClose={() => setExecutionOpen(false)}
          onAcceptResult={result => {
            onInsertResultBlock?.({
              textContent: result,
              type: 'result',
              subheading: 'Generated Output',
              position: {
                col: block.position.col,
                row: block.position.row
                  + block.position.rowSpan + 1,
                colSpan: block.position.colSpan,
                rowSpan: 3,
              },
            });
            setExecutionOpen(false);
          }}
        />
      )}
    </>
  );
}
