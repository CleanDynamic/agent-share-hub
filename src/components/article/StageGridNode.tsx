import { NodeViewWrapper } from '@tiptap/react';
import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { DotGrid } from '@/components/canvas/DotGrid';
import { CanvasBlock } from '@/components/canvas/CanvasBlock';
import { ArrowOverlay } from '@/components/canvas/ArrowOverlay';
import { ARROW_TYPE_META } from '@/lib/canvas-types';
import type { CanvasBlock as CanvasBlockType, BlockArrow } from '@/lib/canvas-types';
import { gridToPixels, nearestEdge, getEdgeMidpoint, orthogonalPath, getBlockSnapPoints } from '@/lib/canvas-utils';
import { Plus, GripVertical, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface StageGridNodeProps {
  node: any;
  updateAttributes: (attrs: Record<string, any>) => void;
  extension: any;
  editor: any;
  selected: boolean;
  getPos?: () => number | undefined;
}

// Access the shared canvas document from editor storage
function useArticleCanvasDoc(editor: any) {
  return editor?.storage?.articleEditor?.canvasDoc ?? null;
}

const STAGE_MIN_HEIGHT = 200;
const STAGE_MAX_HEIGHT = 800;

// Block type colours
const BLOCK_TYPE_COLORS: Record<string, { dot: string; hoverBg: string; hoverBorder: string }> = {
  text: { dot: 'rgba(255,255,255,0.50)', hoverBg: 'rgba(255,255,255,0.06)', hoverBorder: 'rgba(255,255,255,0.20)' },
  prompt: { dot: '#E8571A', hoverBg: 'rgba(232,87,26,0.06)', hoverBorder: 'rgba(232,87,26,0.25)' },
  code: { dot: '#16A34A', hoverBg: 'rgba(22,163,74,0.06)', hoverBorder: 'rgba(22,163,74,0.25)' },
  result: { dot: '#7C3AED', hoverBg: 'rgba(124,58,237,0.06)', hoverBorder: 'rgba(124,58,237,0.25)' },
};

function getBlockTypeColor(type: string) {
  return BLOCK_TYPE_COLORS[type] ?? BLOCK_TYPE_COLORS.text;
}

// Compute stage index from document
function useStageIndex(editor: any, stageId: string | null): number {
  return useMemo(() => {
    if (!editor || !stageId) return 1;
    let index = 1;
    try {
      editor.state.doc.descendants((node: any) => {
        if (node.type.name === 'stageGrid') {
          if (node.attrs.stageId === stageId) return false; // stop
          index++;
        }
        return true;
      });
    } catch {
      // fallback
    }
    return index;
  }, [editor, stageId, editor?.state?.doc]);
}

export function StageGridNode({ node, updateAttributes, editor, selected, getPos }: StageGridNodeProps) {
  const stageId = node.attrs.stageId as string | null;
  const stageTitle = node.attrs.stageTitle as string;
  const gridSpacing = (node.attrs.gridSpacing as number) ?? 20;
  const persistedHeight = node.attrs.height as number | null;
  const doc = useArticleCanvasDoc(editor);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(stageTitle);
  const [localBlocks, setLocalBlocks] = useState<CanvasBlockType[]>([]);
  const [resizingHeight, setResizingHeight] = useState<number | null>(null);
  const [gripHovered, setGripHovered] = useState(false);
  const [closeHovered, setCloseHovered] = useState(false);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const isEditable = editor?.isEditable ?? false;
  const stageIndex = useStageIndex(editor, stageId);

  // Measure container width
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setContainerWidth(e.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Filter blocks and arrows for this stage
  const stageBlocks = useMemo(() => {
    if (!doc || !stageId) return [];
    const fromDoc = (doc.blocks ?? []).filter((b: CanvasBlockType) => b.stageId === stageId);
    const existingIds = new Set(fromDoc.map((b: CanvasBlockType) => b.id));
    const optimistic = localBlocks.filter(b => !existingIds.has(b.id));
    return [...fromDoc, ...optimistic];
  }, [doc?.blocks, stageId, localBlocks]);

  const stageArrows = useMemo(() => {
    if (!doc || !stageId) return [];
    const blockIds = new Set(stageBlocks.map((b: CanvasBlockType) => b.id));
    return (doc.arrows ?? []).filter(
      (a: BlockArrow) => blockIds.has(a.fromBlockId) && blockIds.has(a.toBlockId)
    );
  }, [doc?.arrows, stageBlocks]);

  const rowHeight = doc?.rowHeight ?? 24;
  const columnCount = doc?.columnCount ?? 12;
  const colWidth = containerWidth > 0 ? containerWidth / columnCount : 0;

  // Calculate canvas height from blocks
  const canvasHeight = useMemo(() => {
    if (stageBlocks.length === 0) return isEditable ? 200 : 120;
    const maxBottom = Math.max(
      ...stageBlocks.map((b: CanvasBlockType) => {
        const blockH = b.position.rowSpan * rowHeight;
        if (b.position_y != null) return b.position_y + blockH;
        return (b.position.row - 1) * rowHeight + blockH;
      })
    );
    return Math.max(maxBottom + 2 * rowHeight, isEditable ? 200 : 120);
  }, [stageBlocks, rowHeight, isEditable]);

  const effectiveHeight = resizingHeight ?? persistedHeight ?? canvasHeight;

  // Resize handle drag logic
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isEditable) return;
    const startY = e.clientY;
    const startHeight = effectiveHeight;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientY - startY;
      const clamped = Math.min(STAGE_MAX_HEIGHT, Math.max(STAGE_MIN_HEIGHT, startHeight + delta));
      setResizingHeight(clamped);
    };
    const onMouseUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      const delta = ev.clientY - startY;
      const final = Math.min(STAGE_MAX_HEIGHT, Math.max(STAGE_MIN_HEIGHT, startHeight + delta));
      setResizingHeight(null);
      updateAttributes({ height: final });
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [isEditable, effectiveHeight, updateAttributes]);

  const stage = doc?.stages?.find((s: any) => s.id === stageId);
  const stageColour = stage?.colour ?? 'rgba(200,200,210,0.06)';

  const handleTitleSave = () => {
    setIsEditingTitle(false);
    updateAttributes({ stageTitle: titleDraft });
    if (doc && stageId) {
      doc.setStages?.((prev: any[]) =>
        prev.map((s: any) => s.id === stageId ? { ...s, title: titleDraft } : s)
      );
    }
  };

  const handleDeleteStage = useCallback(() => {
    if (!editor || typeof getPos !== 'function') return;
    const pos = getPos();
    if (typeof pos !== 'number') return;
    const nodeSize = node.nodeSize;
    editor.chain().focus().deleteRange({ from: pos, to: pos + nodeSize }).run();
  }, [editor, getPos, node]);

  const handleAddBlock = useCallback(async (type: string) => {
    if (!doc || !stageId || !doc.contentId) return;

    const existingCount = stageBlocks.length;
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
    const blockId = crypto.randomUUID();

    const blockH = 5 * rowHeight;
    const newBlock: CanvasBlockType = {
      id: blockId,
      type,
      textContent: '',
      subheading: `${typeLabel} Block`,
      position: {
        col: 1,
        row: existingCount * 5 + 1,
        colSpan: 3,
        rowSpan: 5,
      },
      position_x: 20,
      position_y: existingCount * (blockH + 16),
      stageId,
      stageIndex: null,
      isLocked: false,
      lockType: 'none',
      mobileOrder: null,
      creatorAnnotation: null,
    };

    setLocalBlocks(prev => [...prev, newBlock]);

    await supabase.from('content_blocks').insert({
      id: blockId,
      content_id: doc.contentId,
      block_type: type,
      text_content: '',
      subheading: `${typeLabel} Block`,
      canvas_col: 0,
      canvas_row: existingCount * 120,
      canvas_col_span: 3,
      canvas_row_span: 5,
      position_x: 20,
      position_y: existingCount * (blockH + 16),
      stage_id: stageId,
      position: existingCount,
    } as any);
  }, [doc, stageId, stageBlocks.length]);

  if (!doc) {
    return (
      <NodeViewWrapper>
        <div style={{
          padding: 24,
          background: 'rgba(200,200,210,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          color: 'rgba(255,255,255,0.30)',
          fontSize: 13,
          textAlign: 'center',
          margin: '12px 0',
        }}>
          Loading stage…
        </div>
      </NodeViewWrapper>
    );
  }

  const handleSelect = () => {
    if (!editor || typeof getPos !== 'function') return;
    const pos = getPos();
    if (typeof pos !== 'number') return;
    editor.commands.setNodeSelection(pos);
  };

  return (
    <NodeViewWrapper>
      <div
        onClick={handleSelect}
        style={{
          margin: '16px 0',
          background: 'rgba(200,200,210,0.06)',
          border: selected
            ? '1px solid rgba(100,160,255,0.3)'
            : '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12,
          overflow: 'hidden',
          transition: 'border-color 0.15s',
        }}
      >
        {/* F-1: Refined stage header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.03)',
        }}>
          {isEditable && (
            <div
              data-drag-handle
              onMouseEnter={() => setGripHovered(true)}
              onMouseLeave={() => setGripHovered(false)}
              style={{
                cursor: 'grab',
                color: gripHovered ? 'rgba(255,255,255,0.40)' : 'rgba(255,255,255,0.20)',
                transition: 'color 150ms',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <GripVertical size={14} />
            </div>
          )}

          {/* Numbered badge */}
          <div style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'rgba(232,87,26,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#E8571A',
              fontFamily: 'Inter, sans-serif',
              lineHeight: 1,
            }}>
              {stageIndex}
            </span>
          </div>

          {isEditingTitle && isEditable ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={e => e.key === 'Enter' && handleTitleSave()}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 6,
                padding: '2px 8px',
                color: 'rgba(255,255,255,0.85)',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
                outline: 'none',
              }}
            />
          ) : (
            <span
              onClick={() => isEditable && setIsEditingTitle(true)}
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.80)',
                fontFamily: 'Inter, sans-serif',
                cursor: isEditable ? 'text' : 'default',
              }}
              title={isEditable ? 'Click to rename' : undefined}
            >
              {stageTitle}
            </span>
          )}

          {/* Block counter badge */}
          <span style={{
            fontSize: 11,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.30)',
            fontFamily: 'Inter, sans-serif',
            padding: '2px 8px',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 10,
          }}>
            {stageBlocks.length} block{stageBlocks.length !== 1 ? 's' : ''}
          </span>

          {/* Delete button */}
          {isEditable && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteStage();
              }}
              onMouseEnter={() => setCloseHovered(true)}
              onMouseLeave={() => setCloseHovered(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 20,
                height: 20,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: closeHovered ? 'rgba(239,68,68,0.80)' : 'rgba(255,255,255,0.20)',
                fontSize: 14,
                padding: 0,
                transition: 'color 150ms',
                flexShrink: 0,
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Mini canvas grid */}
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            height: effectiveHeight,
            overflow: 'hidden',
            backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)`,
            backgroundSize: `${gridSpacing}px ${gridSpacing}px`,
            backgroundAttachment: 'local',
          }}
        >
          {/* Dot grid in edit mode */}
          {isEditable && containerWidth > 0 && (
            <DotGrid
              columnCount={columnCount}
              rowHeight={rowHeight}
              width={containerWidth}
              height={effectiveHeight}
            />
          )}

          {/* F-3: Block cards */}
          {colWidth > 0 && stageBlocks.map((block: CanvasBlockType) => (
            <CanvasBlock
              key={block.id}
              block={block}
              mode={isEditable ? 'edit' : 'view'}
              colWidth={colWidth}
              rowHeight={rowHeight}
              columnCount={columnCount}
              allBlocks={stageBlocks}
              stages={doc.stages ?? []}
              postType="build"
              selected={false}
              onSelect={() => {}}
              onContextMenu={() => {}}
              onPositionChange={pos => doc.moveBlock(block.id, pos)}
              onBlockChange={patch => doc.updateBlock(block.id, patch)}
              onDelete={() => doc.deleteBlock(block.id)}
              onArrowDrawStart={() => {}}
              isArrowDrawing={false}
              onArrowDrawEnd={() => {}}
              magnetizedEdge={null}
              onAssignStage={(blockId, sid) => doc.assignBlockToStage(blockId, sid)}
              onInsertResultBlock={(blockData: Partial<CanvasBlockType>) => {
                const id = doc.addBlock(blockData.type ?? 'result', blockData.position);
                doc.updateBlock(id, {
                  textContent: blockData.textContent,
                  subheading: blockData.subheading,
                });
                doc.assignBlockToStage(id, stageId);
              }}
            />
          ))}

          {/* Arrow overlay */}
          {colWidth > 0 && stageArrows.length > 0 && (
            <ArrowOverlay
              arrows={stageArrows}
              blocks={stageBlocks}
              colWidth={colWidth}
              rowHeight={rowHeight}
              canvasWidth={containerWidth}
              canvasHeight={effectiveHeight}
              mode={isEditable ? 'edit' : 'view'}
              drawingPathStr=""
              drawingWaypoints={[]}
              onArrowDelete={id =>
                doc.setArrows((prev: BlockArrow[]) => prev.filter((a: BlockArrow) => a.id !== id))
              }
              onArrowTypeChange={(id: string, type: any) => {
                const meta = ARROW_TYPE_META[type as keyof typeof ARROW_TYPE_META];
                doc.setArrows((prev: BlockArrow[]) =>
                  prev.map((a: BlockArrow) =>
                    a.id === id ? { ...a, arrowType: type, label: meta.label, color: meta.color } : a
                  )
                );
              }}
              onArrowLabelChange={(id: string, label: string) =>
                doc.setArrows((prev: BlockArrow[]) =>
                  prev.map((a: BlockArrow) => a.id === id ? { ...a, label } : a)
                )
              }
            />
          )}

          {/* F-2: Refined empty state */}
          {stageBlocks.length === 0 && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              minHeight: effectiveHeight,
              position: 'relative',
            }}>
              <div style={{
                fontSize: 12,
                fontWeight: 400,
                color: 'rgba(255,255,255,0.18)',
                fontFamily: 'Inter, sans-serif',
                marginBottom: 'auto',
                marginTop: 'auto',
              }}>
                Drop blocks here or tap below
              </div>

              {/* F-2: Block insertion buttons at bottom */}
              {isEditable && (
                <div style={{
                  display: 'flex',
                  gap: 8,
                  justifyContent: 'center',
                  marginBottom: 12,
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                }}>
                  {['text', 'prompt', 'code', 'result'].map(type => {
                    const tc = getBlockTypeColor(type);
                    const isHov = hoveredButton === type;
                    return (
                      <button
                        key={type}
                        onClick={() => handleAddBlock(type)}
                        onMouseEnter={() => setHoveredButton(type)}
                        onMouseLeave={() => setHoveredButton(null)}
                        style={{
                          height: 30,
                          padding: '0 12px',
                          fontSize: 11,
                          fontWeight: 500,
                          fontFamily: 'Inter, sans-serif',
                          background: isHov ? tc.hoverBg : 'transparent',
                          border: `1px dashed ${isHov ? tc.hoverBorder : 'rgba(255,255,255,0.10)'}`,
                          borderRadius: 6,
                          color: 'rgba(255,255,255,0.40)',
                          cursor: 'pointer',
                          textTransform: 'capitalize' as const,
                          transition: 'all 150ms',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        + {type}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Vertical resize handle */}
        {isEditable && (
          <div
            onMouseDown={handleResizeStart}
            style={{
              height: 4,
              cursor: 'ns-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: resizingHeight != null
                ? 'rgba(100,160,255,0.15)'
                : 'rgba(255,255,255,0.03)',
              transition: resizingHeight != null ? 'none' : 'background 0.15s',
              userSelect: 'none',
            }}
            onMouseEnter={e => {
              if (resizingHeight == null) (e.currentTarget as HTMLElement).style.background = 'rgba(100,160,255,0.10)';
            }}
            onMouseLeave={e => {
              if (resizingHeight == null) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
            }}
          >
            <span style={{
              fontSize: 10,
              lineHeight: 1,
              color: 'rgba(255,255,255,0.25)',
              letterSpacing: 2,
              pointerEvents: 'none',
            }}>
              ⋯
            </span>
          </div>
        )}

        {/* Mini toolbar when blocks exist */}
        {isEditable && stageBlocks.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '8px 12px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(200,200,210,0.03)',
          }}>
            {['text', 'prompt', 'code', 'result'].map(type => {
              const tc = getBlockTypeColor(type);
              const isHov = hoveredButton === `bottom-${type}`;
              return (
                <button
                  key={type}
                  onClick={() => handleAddBlock(type)}
                  onMouseEnter={() => setHoveredButton(`bottom-${type}`)}
                  onMouseLeave={() => setHoveredButton(null)}
                  style={{
                    height: 30,
                    padding: '0 12px',
                    fontSize: 11,
                    fontWeight: 500,
                    fontFamily: 'Inter, sans-serif',
                    background: isHov ? tc.hoverBg : 'transparent',
                    border: `1px dashed ${isHov ? tc.hoverBorder : 'rgba(255,255,255,0.10)'}`,
                    borderRadius: 6,
                    color: 'rgba(255,255,255,0.40)',
                    cursor: 'pointer',
                    textTransform: 'capitalize' as const,
                    transition: 'all 150ms',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Plus size={10} style={{ marginRight: 4 }} /> {type}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
