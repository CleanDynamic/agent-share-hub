import { useRef, useState, useEffect } from 'react';
import { useCanvasDocument } from '@/hooks/useCanvasDocument';
import { CanvasTOC } from './CanvasTOC';
import { CanvasToolbar } from './CanvasToolbar';
import { CanvasHeader } from './CanvasHeader';
import { DotGrid } from './DotGrid';
import { CanvasBlock } from './CanvasBlock';
import type { CanvasBlock as CanvasBlockType } from '@/lib/canvas-types';
import { CanvasInsertZone } from './CanvasInsertZone';
import { ArrowOverlay } from './ArrowOverlay';
import { TemplateLibrary } from './TemplateLibrary';
import { VersionHistory } from './VersionHistory';
import { AnnotationsList } from './AnnotationsList';
import { ARROW_TYPE_META } from '@/lib/canvas-types';

interface CanvasShellProps {
  mode: 'edit' | 'view';
  doc: ReturnType<typeof useCanvasDocument>;
  // Header props
  title: string;
  description: string;
  postType: string;
  difficulty?: string | null;
  coverPreview?: string | null;
  onTitleChange?: (v: string) => void;
  onDescriptionChange?: (v: string) => void;
  onCoverChange?: (
    f: File | null, p: string | null
  ) => void;
  onPostTypeClick?: () => void;
  hideHeader?: boolean;
  showAnnotations?: boolean;
  // Edit mode actions
  onSave?: () => void;
  onPublish?: () => void;
  saving?: boolean;
  submitting?: boolean;
  onBack?: () => void;
}

export function CanvasShell(props: CanvasShellProps) {
  const {
    mode, doc, title, description, postType,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] =
    useState(0);
  const [tocOpen, setTocOpen] = useState(true);
  const [templateLibOpen, setTemplateLibOpen] =
    useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] =
    useState(false);
  const [annotationsOpen, setAnnotationsOpen] =
    useState(false);

  // ── Arrow drawing state ───────────────────────────
  const [drawingFrom, setDrawingFrom] = useState<{
    blockId: string;
    edge: 'top'|'right'|'bottom'|'left';
  } | null>(null);
  const [mousePos, setMousePos] = useState<{
    x: number; y: number;
  } | null>(null);
  const [pendingArrow, setPendingArrow] = useState<{
    fromBlockId: string;
    fromEdge: 'top'|'right'|'bottom'|'left';
  } | null>(null);

  // Track mouse position for live arrow drawing
  const handleCanvasMouseMove = (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    if (!drawingFrom) return;
    const rect = (
      e.currentTarget as HTMLDivElement
    ).getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleArrowDrawStart = (
    blockId: string,
    edge: 'top'|'right'|'bottom'|'left'
  ) => {
    setDrawingFrom({ blockId, edge });
    setPendingArrow({ fromBlockId: blockId,
      fromEdge: edge });
  };

  const handleArrowDrawEnd = (
    toBlockId: string,
    toEdge: 'top'|'right'|'bottom'|'left'
  ) => {
    if (!pendingArrow) return;
    if (pendingArrow.fromBlockId !== toBlockId) {
      doc.addArrow(
        pendingArrow.fromBlockId,
        toBlockId,
        pendingArrow.fromEdge,
        toEdge,
        'produces'
      );
    }
    setDrawingFrom(null);
    setMousePos(null);
    setPendingArrow(null);
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      setContainerWidth(
        entries[0].contentRect.width
      );
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Total canvas height: extent of all blocks + buffer
  const canvasHeight = doc.blocks.length === 0
    ? 600
    : Math.max(
        600,
        Math.max(
          ...doc.blocks.map(b =>
            (b.position.row + b.position.rowSpan - 1)
            * doc.rowHeight
          )
        ) + 200
      );

  const colWidth = containerWidth > 0
    ? containerWidth / doc.columnCount : 0;

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      overflow: 'hidden',
      background: 'rgba(6,6,10,1)',
      position: 'relative',
    }}>

      {/* TOC sidebar */}
      <CanvasTOC
        open={tocOpen}
        onToggle={() => setTocOpen(o => !o)}
        stages={doc.stages}
        blocks={doc.blocks}
        mode={mode}
        onBlockClick={blockId => {
          document.getElementById(`canvas-block-${blockId}`)
            ?.scrollIntoView({
              behavior: 'smooth', block: 'center'
            });
        }}
        onStageAdd={title => doc.addStage(title)}
      />

      {/* Main scroll area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* Document header */}
        {!props.hideHeader && <CanvasHeader
          mode={mode}
          title={title}
          description={description}
          postType={postType}
          difficulty={props.difficulty}
          coverPreview={props.coverPreview}
          onTitleChange={props.onTitleChange}
          onDescriptionChange={
            props.onDescriptionChange
          }
          onPostTypeClick={props.onPostTypeClick}
          onCoverChange={props.onCoverChange}
        />}

        {/* The grid */}
        <div
          ref={containerRef}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={() => {
            setDrawingFrom(null);
            setMousePos(null);
          }}
          style={{
            position: 'relative',
            flex: 1,
            minHeight: canvasHeight,
            width: '100%',
          }}
        >
          {/* Dot grid — edit mode only */}
          {mode === 'edit' && containerWidth > 0 && (
            <DotGrid
              columnCount={doc.columnCount}
              rowHeight={doc.rowHeight}
              width={containerWidth}
              height={canvasHeight}
            />
          )}

          {/* Stage zones — coloured backgrounds */}
          {doc.stages.map(stage => {
            const stageBlocks = doc.blocks.filter(
              b => b.stageId === stage.id
            );
            if (stageBlocks.length === 0) return null;

            const minRow = Math.min(
              ...stageBlocks.map(b => b.position.row)
            );
            const maxRow = Math.max(
              ...stageBlocks.map(b =>
                b.position.row + b.position.rowSpan
              )
            );

            return (
              <div
                key={stage.id}
                style={{
                  position: 'absolute',
                  left: 0, right: 0,
                  top: (minRow - 1) * doc.rowHeight - 8,
                  height: (maxRow - minRow + 1)
                    * doc.rowHeight + 16,
                  background: stage.colour,
                  borderLeft:
                    `2px solid ${stage.colour
                      .replace('0.06', '0.25')}`,
                  borderRadius: 8,
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
              />
            );
          })}

          {/* Blocks */}
          {colWidth > 0 && doc.blocks.map(block => (
            <CanvasBlock
              key={block.id}
              block={block}
              mode={mode}
              colWidth={colWidth}
              rowHeight={doc.rowHeight}
              columnCount={doc.columnCount}
              allBlocks={doc.blocks}
              stages={doc.stages}
              postType={postType}
              showAnnotations={props.showAnnotations}
              onPositionChange={pos =>
                doc.moveBlock(block.id, pos)
              }
              onBlockChange={patch =>
                doc.updateBlock(block.id, patch)
              }
              onDelete={() => doc.deleteBlock(block.id)}
              onArrowDrawStart={handleArrowDrawStart}
              isArrowDrawing={drawingFrom !== null}
              onArrowDrawEnd={handleArrowDrawEnd}
              onAssignStage={(blockId, stageId) =>
                doc.assignBlockToStage(blockId, stageId)
              }
              onInsertResultBlock={(blockData: Partial<CanvasBlockType>) => {
                const id = doc.addBlock(
                  blockData.type ?? 'result',
                  blockData.position
                );
                doc.updateBlock(id, {
                  textContent: blockData.textContent,
                  subheading: blockData.subheading,
                });
              }}
            />
          ))}

          {/* Arrow overlay */}
          {colWidth > 0 && (
            <ArrowOverlay
              arrows={doc.arrows}
              blocks={doc.blocks}
              colWidth={colWidth}
              rowHeight={doc.rowHeight}
              canvasWidth={containerWidth}
              canvasHeight={canvasHeight}
              mode={mode}
              drawingFrom={drawingFrom}
              mousePos={mousePos}
              onArrowComplete={handleArrowDrawEnd}
              onArrowDelete={id =>
                doc.setArrows(prev =>
                  prev.filter(a => a.id !== id)
                )
              }
              onArrowTypeChange={(id, type) => {
                const meta = ARROW_TYPE_META[type];
                doc.setArrows(prev =>
                  prev.map(a =>
                    a.id === id
                      ? { ...a, arrowType: type,
                          label: meta.label,
                          color: meta.color }
                      : a
                  )
                );
              }}
              onArrowLabelChange={(id, label) =>
                doc.setArrows(prev =>
                  prev.map(a =>
                    a.id === id ? { ...a, label } : a
                  )
                )
              }
            />
          )}

          {/* Insert zones — edit mode only */}
          {mode === 'edit' && colWidth > 0 && (
            <CanvasInsertZone
              blocks={doc.blocks}
              colWidth={colWidth}
              rowHeight={doc.rowHeight}
              columnCount={doc.columnCount}
              onInsert={(type, position) =>
                doc.addBlock(type, position)
              }
            />
          )}

        </div>
      </div>

      {/* Edit mode toolbar at bottom */}
      {mode === 'edit' && (
        <CanvasToolbar
          doc={doc}
          onSave={props.onSave}
          onPublish={props.onPublish}
          saving={props.saving}
          submitting={props.submitting}
          onTemplates={() => setTemplateLibOpen(true)}
          onHistory={() => setVersionHistoryOpen(true)}
          onAnnotations={() => setAnnotationsOpen(true)}
          annotationCount={doc.blocks.filter(
            b => b.creatorAnnotation
          ).length}
          onBack={props.onBack}
          blockCount={doc.blocks.length}
        />
      )}

      {/* Template library panel */}
      <TemplateLibrary
        open={templateLibOpen}
        onClose={() => setTemplateLibOpen(false)}
        currentBlocks={doc.blocks}
        onApply={(newBlocks, newArrows) => {
          doc.restoreSnapshot({
            blocks: [
              ...doc.blocks,
              ...newBlocks.map(b => ({
                ...b,
                id: b.id ?? crypto.randomUUID(),
              })),
            ],
            arrows: [
              ...doc.arrows,
              ...newArrows.map(a => ({
                ...a,
                id: crypto.randomUUID(),
              })),
            ],
            stages: doc.stages,
          });
        }}
      />

      {/* Annotations list panel */}
      <AnnotationsList
        open={annotationsOpen}
        onClose={() => setAnnotationsOpen(false)}
        blocks={doc.blocks}
        onBlockFocus={blockId => {
          document.getElementById(
            `canvas-block-${blockId}`
          )?.scrollIntoView({ behavior: 'smooth' });
          setAnnotationsOpen(false);
        }}
        onBlockChange={(id, patch) =>
          doc.updateBlock(id, patch)
        }
      />

      {/* Version history panel */}
      <VersionHistory
        open={versionHistoryOpen}
        onClose={() => setVersionHistoryOpen(false)}
        contentId={doc.contentId ?? ''}
        currentVersion={doc.versionNumber}
        onRestore={doc.restoreSnapshot}
        onSaveVersion={label =>
          doc.saveVersion(doc.contentId ?? '', label)
        }
      />
    </div>
  );
}
