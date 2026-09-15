import { useEffect, useRef, useState } from 'react';
import { GripVertical, FileText, Code2, Image, Zap, GitCompare, Bot, Workflow, SlidersHorizontal, Wrench, BookOpen, ListChecks, Type, ChevronRight, ChevronDown, Video } from 'lucide-react';
import { gridToPixels } from '@/lib/canvas-utils';
import type { CanvasBlock as CanvasBlockType, CanvasStage, BlockPosition } from '@/lib/canvas-types';
import { BlockEditModal } from './BlockEditModal';
import { BlockViewerInCanvas } from './BlockViewerInCanvas';
import { ExecutionPanel } from './ExecutionPanel';
import { type } from "@/lib/theme/type";
import { colourAlpha } from "@/lib/theme/tokens";
import { feedback } from '@/lib/theme/motion';

const BLOCK_TYPE_LABELS: Record<string, string> = {
  prompt: 'Prompt', code: 'Code', text: 'Text', long_text: 'Long Text',
  image: 'Image', result: 'Result', comparison: 'Comparison',
  agent_config: 'Agent Config', workflow: 'Workflow', model_params: 'Model Params',
  tool_setup: 'Tool Setup', resource: 'Resource', tutorial_step: 'Tutorial Step',
  section_heading: 'Heading', sticky_note: 'Note', video: 'Video',
};

const BLOCK_ICONS: Record<string, React.ReactNode> = {
  prompt: <Zap size={14} />, code: <Code2 size={14} />, text: <FileText size={14} />,
  long_text: <FileText size={14} />, image: <Image size={14} />, result: <ListChecks size={14} />,
  comparison: <GitCompare size={14} />, agent_config: <Bot size={14} />,
  workflow: <Workflow size={14} />, model_params: <SlidersHorizontal size={14} />,
  tool_setup: <Wrench size={14} />, resource: <BookOpen size={14} />,
  tutorial_step: <ListChecks size={14} />, section_heading: <Type size={14} />,
  video: <Video size={14} />,
};

type EdgeType = 'top' | 'right' | 'bottom' | 'left';

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
  onSelect?: (e?: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onPositionChange: (p: BlockPosition) => void;
  onBlockChange: (patch: Partial<CanvasBlockType>) => void;
  onDelete: () => void;
  onArrowDrawStart: (edge: EdgeType) => void;
  isArrowDrawing: boolean;
  onArrowDrawEnd: (edge?: EdgeType) => void;
  magnetizedEdge?: EdgeType | null;
  onAssignStage: (blockId: string, stageId: string | null) => void;
  onInsertResultBlock?: (block: Partial<CanvasBlockType>) => void;
}

export function CanvasBlock({
  block, mode, colWidth, rowHeight, columnCount,
  allBlocks, stages, postType, showAnnotations,
  selected, onSelect, onContextMenu,
  onPositionChange, onBlockChange, onDelete,
  onArrowDrawStart, isArrowDrawing, onArrowDrawEnd,
  magnetizedEdge,
  onAssignStage, onInsertResultBlock,
}: CanvasBlockProps) {
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [ghost, setGhost] = useState<BlockPosition | null>(null);
  const [ghostValid, setGhostValid] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [executionOpen, setExecutionOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [stagePickerOpen, setStagePickerOpen] = useState(false);
  const [hoveredSnapEdge, setHoveredSnapEdge] = useState<EdgeType | null>(null);

  const dragStartRef = useRef({ x: 0, y: 0, origCol: 0, origRow: 0 });
  const rafIdRef = useRef<number | null>(null);
  const dropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel pending RAF / timers on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (dropTimerRef.current !== null) {
        clearTimeout(dropTimerRef.current);
      }
    };
  }, []);
  const isStickyNote = block.type === 'sticky_note';
  const stickyCollapsed = isStickyNote && block.isCollapsed === true;

  // For collapsed sticky notes, shrink the rendered height to a single row.
  const effectivePosition = stickyCollapsed
    ? { ...block.position, rowSpan: 1 }
    : block.position;
  const gridPx = gridToPixels(effectivePosition, colWidth, rowHeight);
  // Use pixel positions when available; fall back to grid-derived position
  const blockX = block.position_x ?? gridPx.x;
  const blockY = block.position_y ?? gridPx.y;
  const blockW = gridPx.w;
  const blockH = gridPx.h;
  const inset = 4;

  const BLOCK_ACCENT: Record<string, string> = {
    // BG-P29. The last eight literals here resolve into the nine part-category
    // hues, which is the table this map was always a private copy of. Each goes
    // to the category the block TYPE belongs to rather than to the nearest hue:
    // a result is evidence, an image and a video are media, a tutorial step and
    // a sticky note are narrative, a tool setup is configuration, model params
    // are agents, a resource is data.
    //
    // `--recess` on the three prose types is NOT a borrowed surface token: it
    // is the same value as the `?? 'var(--recess)'` fallback below, and it
    // means "this type carries no hue" — which a heading and a body block
    // correctly do not.
    prompt: 'var(--action)', code: 'var(--cat-data)', result: 'var(--cat-evidence)',
    agent_config: 'var(--cat-agents)', workflow: 'var(--evidence)', comparison: 'var(--cat-media)',
    image: 'var(--cat-media)', tutorial_step: 'var(--cat-narrative)',
    section_heading: 'var(--recess)', text: 'var(--recess)',
    long_text: 'var(--recess)', tool_setup: 'var(--cat-configuration)',
    model_params: 'var(--cat-agents)', resource: 'var(--cat-data)',
    sticky_note: 'var(--cat-narrative)', video: 'var(--cat-media)',
  };
  const accent = BLOCK_ACCENT[block.type] ?? 'var(--recess)';

  const toggleStickyCollapsed = () => {
    if (!isStickyNote) return;
    onBlockChange({ isCollapsed: !block.isCollapsed });
  };

  // ── Drag (free-form pixel positioning) ───────────
  const handleDragMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'edit') return;
    const target = e.target as HTMLElement;
    // Don't start drag from toolbar buttons
    if (target.closest('button') || target.closest('[data-no-drag]')) return;
    e.preventDefault();

    // Cancel any in-flight drop animation
    if (dropTimerRef.current !== null) {
      clearTimeout(dropTimerRef.current);
      dropTimerRef.current = null;
    }
    setDropping(false);
    setDragging(true);
    setDragOffset({ x: 0, y: 0 });
    dragStartRef.current = {
      x: e.clientX, y: e.clientY,
      origCol: block.position.col,
      origRow: block.position.row,
    };

    let pendingDx = 0;
    let pendingDy = 0;

    const flush = () => {
      rafIdRef.current = null;
      setDragOffset({ x: pendingDx, y: pendingDy });
    };

    const move = (ev: MouseEvent) => {
      pendingDx = ev.clientX - dragStartRef.current.x;
      pendingDy = ev.clientY - dragStartRef.current.y;
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(flush);
      }
    };

    const up = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);

      // Compute new pixel position (clamped so block stays inside container)
      const newX = Math.max(0, blockX + pendingDx);
      const newY = Math.max(0, blockY + pendingDy);

      // Commit the new pixel position
      onBlockChange({ position_x: newX, position_y: newY });
      setDragging(false);
      setDropping(false);
      setDragOffset(null);
      setGhost(null);
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

  const typeLabel = BLOCK_TYPE_LABELS[block.type] ?? block.type;
  const icon = BLOCK_ICONS[block.type] ?? <FileText size={14} />;

  // Selection ring style
  const selectionBorder = selected
    ? '2px solid color-mix(in srgb, var(--cat-data) 70%, transparent)'
    : hovered ? '1px solid var(--line)' : '1px solid var(--line)';

  return (
    <>
      {/* The block */}
      <div
        data-canvas-block
        data-block-id={block.id}
        id={`canvas-block-${block.id}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setStagePickerOpen(false); }}
        onMouseDown={handleDragMouseDown}
        onContextMenu={(e) => {
          if (mode === 'edit' && onContextMenu) {
            e.preventDefault();
            e.stopPropagation();
            onContextMenu(e);
          }
        }}
        onClick={(e) => {
          if (mode === 'edit') {
            e.stopPropagation();
            if (isArrowDrawing) {
              onArrowDrawEnd();
            } else {
              onSelect?.(e);
            }
          }
        }}
        onDoubleClick={() => {
          if (mode !== 'edit') return;
          if (isStickyNote) {
            toggleStickyCollapsed();
          } else {
            setEditModalOpen(true);
          }
        }}
        style={{
          position: 'absolute',
          left: blockX + inset, top: blockY + inset,
          width: blockW - inset * 2, height: blockH - inset * 2,
          transform: dragOffset
            ? `translate(${dragOffset.x}px, ${dragOffset.y}px) scale(${dragging && !dropping ? 1.03 : 1})`
            : undefined,
          transition: dropping
            ? 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)'
            : 'none',
          zIndex: dragging ? 50 : 10,
          boxShadow: dragging
            ? 'var(--elev-overlay)'
            : undefined,
          cursor: mode === 'edit'
            ? (dragging ? 'grabbing' : 'grab')
            : 'default',
          willChange: dragging ? 'transform' : undefined,
          boxSizing: 'border-box',
        }}
      >
        {isStickyNote ? (
          /* ── STICKY NOTE ── */
          <div
            style={{
              height: '100%',
              position: 'relative',
              background: 'color-mix(in srgb, var(--lit) 10%, transparent)',
              borderLeft: '3px solid var(--lit)',
              borderTop: '1px solid color-mix(in srgb, var(--lit) 20%, transparent)',
              borderRight: '1px solid color-mix(in srgb, var(--lit) 20%, transparent)',
              borderBottom: '1px solid color-mix(in srgb, var(--lit) 20%, transparent)',
              borderRadius: 6,
              padding: '6px 10px 6px 22px',
              overflow: 'hidden',
              boxShadow: selected
                ? '0 0 0 1px color-mix(in srgb, var(--lit) 45%, transparent), var(--elev-raised)'
                : hovered ? 'var(--elev-raised)' : 'none',
              fontStyle: 'italic',
              fontSize: 12,
              color: 'var(--text2)',
              lineHeight: 1.5,
              fontFamily: 'Figtree, sans-serif',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {/* Collapse toggle — top-left */}
            {mode === 'edit' && (
              <button
                data-no-drag
                onClick={e => {
                  e.stopPropagation();
                  toggleStickyCollapsed();
                }}
                onMouseDown={e => e.stopPropagation()}
                title={stickyCollapsed ? 'Expand note' : 'Collapse note'}
                style={{
                  position: 'absolute',
                  top: 4, left: 4,
                  width: 14, height: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  color: 'color-mix(in srgb, var(--lit) 70%, transparent)',
                  cursor: 'pointer',
                  padding: 0,
                  zIndex: 3,
                }}
              >
                {stickyCollapsed
                  ? <ChevronRight size={11} />
                  : <ChevronDown size={11} />}
              </button>
            )}

            {/* Note text */}
            {stickyCollapsed
              ? ((block.textContent || '').slice(0, 30)
                  + ((block.textContent || '').length > 30 ? '…' : ''))
              : (block.textContent || (mode === 'edit'
                  ? 'Double-click to collapse · Click Edit to write…'
                  : ''))}

            {/* Folded-corner effect */}
            <div
              style={{
                position: 'absolute',
                top: 0, right: 0,
                width: 0, height: 0,
                borderStyle: 'solid',
                borderWidth: '0 10px 10px 0',
                borderColor: 'transparent color-mix(in srgb, var(--lit) 25%, transparent) transparent transparent',
                pointerEvents: 'none',
              }}
            />

            {/* Hover toolbar — small Edit/Del/Arrow row */}
            {mode === 'edit' && (hovered || selected) && (
              <div
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                style={{
                  position: 'absolute', bottom: 2, right: 2,
                  display: 'flex', alignItems: 'center', gap: 2,
                  background: 'var(--bg)',
                  border: '1px solid color-mix(in srgb, var(--lit) 20%, transparent)',
                  borderRadius: 4, padding: '1px 3px',
                  zIndex: 30,
                }}
              >
                <button
                  data-no-drag
                  onClick={e => {
                    e.stopPropagation();
                    if (deleteConfirm) { onDelete(); setDeleteConfirm(false); }
                    else { setDeleteConfirm(true); setTimeout(() => setDeleteConfirm(false), 2500); }
                  }}
                  onMouseLeave={() => setDeleteConfirm(false)}
                  style={{
                    background: deleteConfirm ? 'color-mix(in srgb, var(--cat-breakage) 15%, transparent)' : 'none',
                    border: 'none',
                    color: deleteConfirm ? 'color-mix(in srgb, var(--cat-breakage) 80%, transparent)' : 'var(--text2)',
                    cursor: 'pointer', fontSize: 9, padding: '0 3px', borderRadius: 3,
                  }}
                >
                  {deleteConfirm ? '✕' : 'Del'}
                </button>
                <button
                  data-no-drag
                  onClick={e => { e.stopPropagation(); setEditModalOpen(true); }}
                  style={{
                    background: 'none', border: 'none',
                    color: 'var(--text2)',
                    cursor: 'pointer', fontSize: 9, padding: '0 3px',
                  }}
                >
                  Edit
                </button>
                <button
                  data-no-drag
                  onClick={e => { e.stopPropagation(); onArrowDrawStart('right'); }}
                  style={{
                    background: 'none', border: 'none',
                    color: 'var(--text2)',
                    cursor: 'pointer', fontSize: 9, padding: '0 3px',
                  }}
                >
                  →
                </button>
              </div>
            )}
          </div>
        ) : mode === 'edit' ? (
          /* ── EDIT MODE: Compact card ── */
          <div
            style={{
              height: '100%',
              background: selected ? `${colourAlpha(accent, 0.063)}` : 'var(--recess)',
              border: selectionBorder,
              borderRadius: 10,
              overflow: 'hidden',
              cursor: 'pointer',
              // BG-P32: box-shadow cannot be composited, so it is set rather
              // than eased. The border still crosses over.
              transition: feedback('border-color'),
              boxShadow: selected
                ? `0 0 0 1px ${colourAlpha(accent, 0.314)}, var(--elev-raised)`
                : hovered ? 'var(--elev-raised)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}
          >
            {/* Header row with badge square + chip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px 4px', minHeight: 0 }}>
              {/* Colour badge square */}
              <div style={{
                width: 20, height: 20, borderRadius: 4,
                background: accent, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text)', fontSize: 11,
              }}>
                {icon}
              </div>

              {/* Type chip */}
              <div style={{
                fontSize: 10, fontWeight: 500,
                color: 'var(--text2)',
                background: 'var(--recess)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-chip)', padding: '1px 8px',
              }}>
                {typeLabel}
              </div>

              <div style={{ flex: 1 }} />

              {/* Drag grip */}
              <div
                className="drag-grip"
                title="Drag to move"
                onClick={e => e.stopPropagation()}
                style={{
                  flexShrink: 0, width: 16, height: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'grab', color: hovered ? 'var(--text2)' : 'var(--text2)',
                  borderRadius: 3,
                }}
              >
                <GripVertical size={10} />
              </div>
            </div>

            {/* Card body */}
            <div style={{ flex: 1, padding: '2px 10px 6px', minHeight: 0, overflow: 'hidden' }}>
              {block.subheading && (
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>
                  {block.subheading}
                </div>
              )}
              {block.textContent && (
                <div style={{
                  fontSize: 11, color: 'var(--text2)',
                  lineHeight: 1.4,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {block.textContent.slice(0, 120)}
                </div>
              )}
            </div>

            {/* Hover toolbar */}
            {(hovered || selected) && (
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'absolute', bottom: 4, right: 4,
                  display: 'flex', alignItems: 'center', gap: 2,
                  background: 'var(--bg)',
                  border: '1px solid var(--line)',
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
                    background: deleteConfirm ? 'color-mix(in srgb, var(--cat-breakage) 15%, transparent)' : 'none',
                    border: deleteConfirm ? '1px solid color-mix(in srgb, var(--cat-breakage) 30%, transparent)' : 'none',
                    color: deleteConfirm ? 'color-mix(in srgb, var(--cat-breakage) 80%, transparent)' : 'var(--text2)',
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
                    color: 'var(--text2)',
                    cursor: 'pointer', fontSize: 10, padding: '1px 4px',
                  }}
                >
                  Edit
                </button>

                {/* Arrow/link button */}
                <button
                  onClick={e => { e.stopPropagation(); onArrowDrawStart('right'); }}
                  style={{
                    background: 'none', border: 'none',
                    color: 'var(--text2)',
                    cursor: 'pointer', fontSize: 10, padding: '1px 4px',
                  }}
                >
                  →
                </button>

                {stages.length > 0 && (
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={e => { e.stopPropagation(); setStagePickerOpen(o => !o); }}
                      style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 10, padding: '1px 4px' }}
                    >
                      {block.stageId ? 'S' : '+S'}
                    </button>
                    {stagePickerOpen && (
                      <div style={{
                        position: 'absolute', bottom: '100%', right: 0, marginBottom: 4,
                        background: 'var(--bg)', border: '1px solid var(--line)',
                        borderRadius: 6, padding: '4px 0', minWidth: 120, zIndex: 50,
                        boxShadow: 'var(--elev-raised)',
                      }}>
                        <button onClick={() => { onAssignStage(block.id, null); setStagePickerOpen(false); }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 10px', background: 'none', border: 'none', fontSize: 10, color: 'var(--text2)', cursor: 'pointer' }}>
                          No stage
                        </button>
                        {stages.map(s => (
                          <button key={s.id}
                            onClick={() => { onAssignStage(block.id, s.id); setStagePickerOpen(false); }}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 10px', background: 'none', border: 'none', fontSize: 10, color: block.stageId === s.id ? 'var(--cat-data)' : 'var(--text2)', cursor: 'pointer', fontWeight: block.stageId === s.id ? 700 : 400 }}>
                            {s.stageNumber}. {s.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {(block.type === 'prompt' || block.type === 'code') && (
                  <button onClick={e => { e.stopPropagation(); setExecutionOpen(true); }}
                    style={{ background: 'color-mix(in srgb, var(--cat-configuration) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--cat-configuration) 25%, transparent)', borderRadius: 3, padding: '1px 5px', color: 'var(--cat-configuration)', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>
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
                background: `${colourAlpha(accent, 0.094)}`, border: `1px solid ${colourAlpha(accent, 0.188)}`,
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
            background: block.type === 'section_heading' ? 'transparent' : 'var(--recess)',
            border: block.type === 'section_heading' ? 'none' : '1px solid var(--line)',
            borderRadius: 10, overflow: 'hidden',
            backdropFilter: 'blur(16px)',
            position: 'relative',
          }}>
            {showAnnotations && block.creatorAnnotation && (
              <div title={block.creatorAnnotation} style={{
                position: 'absolute', top: 8, right: 8, width: 18, height: 18,
                background: 'color-mix(in srgb, var(--cat-breakage) 20%, transparent)', border: '1px solid color-mix(in srgb, var(--cat-breakage) 40%, transparent)',
                borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, cursor: 'help', zIndex: 2,
              }}>✎</div>
            )}

            <div style={{ padding: 12, overflowY: 'auto', maxHeight: '100%', boxSizing: 'border-box' }}>
              {block.type === 'section_heading' ? (
                <h2 style={{ ...type.cardTitle,   color: 'var(--text)', margin: 0 }}>
                  {block.textContent}
                </h2>
              ) : (
                <BlockViewerInCanvas block={block} postType={postType} />
              )}
            </div>

            {block.isLocked && block.lockType === 'blur' && (
              <div style={{
                position: 'absolute', inset: 0, backdropFilter: 'blur(16px)',
                background: 'var(--recess)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', borderRadius: 10,
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Download to unlock</div>
              </div>
            )}
          </div>
        )}

        {/* ── Resize handles (edit only) ── */}
        {mode === 'edit' && (
          <>
            <div onMouseDown={handleResizeRight} style={{
              position: 'absolute', right: -2, top: '20%', height: '60%', width: 5,
              cursor: 'ew-resize', background: 'color-mix(in srgb, var(--cat-data) 60%, transparent)', borderRadius: 2, zIndex: 25,
              opacity: hovered || selected ? 1 : 0.2, transition: feedback("opacity"),
            }} />
            <div onMouseDown={handleResizeBottom} style={{
              position: 'absolute', bottom: -2, left: '20%', width: '60%', height: 5,
              cursor: 'ns-resize', background: 'color-mix(in srgb, var(--cat-data) 60%, transparent)', borderRadius: 2, zIndex: 25,
              opacity: hovered || selected ? 1 : 0.2, transition: feedback("opacity"),
            }} />
            <div onMouseDown={e => { handleResizeRight(e); handleResizeBottom(e); }} style={{
              position: 'absolute', bottom: -3, right: -3, width: 7, height: 7,
              cursor: 'se-resize', background: 'var(--cat-data)', borderRadius: '50%', zIndex: 26,
              border: '2px solid var(--bg)',
              opacity: hovered || selected ? 1 : 0.25, transition: feedback("opacity"),
            }} />
          </>
        )}

        {/* Arrow drawing indicator — glow when arrow mode active */}
        {mode === 'edit' && isArrowDrawing && (
          <div style={{
            position: 'absolute', inset: -2,
            border: '2px dashed color-mix(in srgb, var(--cat-data) 40%, transparent)',
            borderRadius: 10, pointerEvents: 'none', zIndex: 26,
          }} />
        )}

        {/* Snap-point indicators */}
        {mode === 'edit' && (hovered || isArrowDrawing) && (
          (['top', 'right', 'bottom', 'left'] as const).map(edge => {
            const isHoveredSnap = hoveredSnapEdge === edge;
            const isMagnetized = magnetizedEdge === edge;
            const size = isHoveredSnap || isMagnetized ? 12 : 8;
            const bg = isHoveredSnap || isMagnetized
              ? 'var(--cat-data)'
              : 'color-mix(in srgb, var(--cat-data) 50%, transparent)';

            // All snap points positioned with left/top + translate(-50%,-50%)
            const posStyle: React.CSSProperties =
              edge === 'top'
                ? { left: '50%', top: 0 }
                : edge === 'right'
                ? { left: '100%', top: '50%' }
                : edge === 'bottom'
                ? { left: '50%', top: '100%' }
                : { left: 0, top: '50%' };

            return (
              <div
                key={edge}
                data-no-drag
                onMouseEnter={() => setHoveredSnapEdge(edge)}
                onMouseLeave={() => setHoveredSnapEdge(null)}
                onClick={e => {
                  e.stopPropagation();
                  if (isArrowDrawing) {
                    onArrowDrawEnd(edge);
                  } else {
                    onArrowDrawStart(edge);
                  }
                }}
                onMouseDown={e => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  ...posStyle,
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  background: bg,
                  border: '2px solid var(--cat-data)',
                  zIndex: 30,
                  cursor: 'crosshair',
                  transition: feedback("background-color"),
                  boxSizing: 'border-box',
                  transform: 'translate(-50%, -50%)',
                  ...(isMagnetized ? {
                    animation: 'snapPointPulse 1s ease-in-out infinite',
                  } : {}),
                }}
              />
            );
          })
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
