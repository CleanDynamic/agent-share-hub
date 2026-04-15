import { NodeViewWrapper } from '@tiptap/react';
import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { DotGrid } from '@/components/canvas/DotGrid';
import { CanvasBlock } from '@/components/canvas/CanvasBlock';
import { ArrowOverlay } from '@/components/canvas/ArrowOverlay';
import { ARROW_TYPE_META } from '@/lib/canvas-types';
import type { CanvasBlock as CanvasBlockType, BlockArrow } from '@/lib/canvas-types';
import { gridToPixels, nearestEdge, getEdgeMidpoint, orthogonalPath, getBlockSnapPoints } from '@/lib/canvas-utils';
import { Plus, GripVertical } from 'lucide-react';
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

export function StageGridNode({ node, updateAttributes, editor, selected, getPos }: StageGridNodeProps) {
  const stageId = node.attrs.stageId as string | null;
  const stageTitle = node.attrs.stageTitle as string;
  const doc = useArticleCanvasDoc(editor);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(stageTitle);
  const [localBlocks, setLocalBlocks] = useState<CanvasBlockType[]>([]);
  const isEditable = editor?.isEditable ?? false;

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
    const maxRow = Math.max(
      ...stageBlocks.map((b: CanvasBlockType) => b.position.row + b.position.rowSpan)
    );
    return Math.max((maxRow + 2) * rowHeight, isEditable ? 200 : 120);
  }, [stageBlocks, rowHeight, isEditable]);

  // Stage colour
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

  const handleAddBlock = useCallback(async (type: string) => {
    if (!doc || !stageId || !doc.contentId) return;

    const existingCount = stageBlocks.length;
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
    const blockId = crypto.randomUUID();

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
      stageId,
      stageIndex: null,
      isLocked: false,
      lockType: 'none',
      mobileOrder: null,
      creatorAnnotation: null,
    };

    // Optimistic local state — block appears immediately
    setLocalBlocks(prev => [...prev, newBlock]);

    // Persist to Supabase
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
    // Move ProseMirror's NodeSelection to this stage grid. This propagates
    // via onSelectionUpdate in ArticleEditor → selectedStageId in Upload,
    // and also drives the `selected` prop that styles the border below.
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
        {/* Stage header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(200,200,210,0.04)',
        }}>
          {isEditable && (
            <div
              data-drag-handle
              style={{ cursor: 'grab', color: 'rgba(255,255,255,0.20)' }}
            >
              <GripVertical size={14} />
            </div>
          )}
          <div style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: stageColour.replace('0.06', '0.5'),
            flexShrink: 0,
          }} />
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
                fontFamily: "'Playfair Display', serif",
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
                color: 'rgba(255,255,255,0.75)',
                fontFamily: "'Playfair Display', serif",
                cursor: isEditable ? 'text' : 'default',
                letterSpacing: '0.02em',
              }}
              title={isEditable ? 'Click to rename' : undefined}
            >
              {stageTitle}
            </span>
          )}
          <span style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.25)',
            fontFamily: 'Inter, sans-serif',
          }}>
            {stageBlocks.length} block{stageBlocks.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Mini canvas grid */}
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            minHeight: canvasHeight,
            overflow: 'hidden',
          }}
        >
          {/* Dot grid in edit mode */}
          {isEditable && containerWidth > 0 && (
            <DotGrid
              columnCount={columnCount}
              rowHeight={rowHeight}
              width={containerWidth}
              height={canvasHeight}
            />
          )}

          {/* Blocks */}
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
              canvasHeight={canvasHeight}
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

          {/* Empty state */}
          {stageBlocks.length === 0 && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              minHeight: canvasHeight,
              gap: 8,
              color: 'rgba(255,255,255,0.25)',
              fontSize: 12,
            }}>
              <div>No blocks in this stage</div>
              {isEditable && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {['text', 'prompt', 'code', 'result'].map(type => (
                    <button
                      key={type}
                      onClick={() => handleAddBlock(type)}
                      style={{
                        padding: '4px 10px',
                        fontSize: 10,
                        fontWeight: 600,
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.10)',
                        borderRadius: 6,
                        color: 'rgba(255,255,255,0.45)',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      + {type}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mini toolbar in edit mode */}
        {isEditable && stageBlocks.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 12px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(200,200,210,0.03)',
          }}>
            <button
              onClick={() => handleAddBlock('text')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 10px',
                fontSize: 10,
                fontWeight: 600,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 6,
                color: 'rgba(255,255,255,0.40)',
                cursor: 'pointer',
              }}
            >
              <Plus size={10} /> Block
            </button>
            <span style={{
              marginLeft: 'auto',
              fontSize: 10,
              color: 'rgba(255,255,255,0.20)',
            }}>
              {stageBlocks.length} block{stageBlocks.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
