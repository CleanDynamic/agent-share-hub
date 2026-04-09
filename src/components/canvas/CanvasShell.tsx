import { useRef, useState, useEffect, useCallback } from 'react';
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
import { readingOrder, snapToGridDot, nearestEdge, getEdgeMidpoint, polylinePath } from '@/lib/canvas-utils';

interface CanvasShellProps {
  mode: 'edit' | 'view';
  doc: ReturnType<typeof useCanvasDocument>;
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
  const [containerWidth, setContainerWidth] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  const [templateLibOpen, setTemplateLibOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [annotationsOpen, setAnnotationsOpen] = useState(false);
  const [activeStageTab, setActiveStageTab] = useState<string | null>(null);

  // ── Selection ───────────────────────────────────
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  // Zoom
  const ZOOM_LEVELS = [0.5, 0.75, 1.0, 1.25];
  const [zoom, setZoom] = useState(0.5);
  const zoomIn = () => setZoom(z => {
    const i = ZOOM_LEVELS.indexOf(z);
    return i < ZOOM_LEVELS.length - 1 ? ZOOM_LEVELS[i + 1] : z;
  });
  const zoomOut = () => setZoom(z => {
    const i = ZOOM_LEVELS.indexOf(z);
    return i > 0 ? ZOOM_LEVELS[i - 1] : z;
  });

  // ── Keyboard shortcuts ──────────────────────────
  useEffect(() => {
    if (mode !== 'edit') return;

    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Zoom shortcuts (always active)
      if (meta) {
        if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomIn(); return; }
        if (e.key === '-') { e.preventDefault(); zoomOut(); return; }
        if (e.key === '0') { e.preventDefault(); setZoom(1.0); return; }
      }

      // Don't handle block shortcuts if typing in an input
      if (isInput) return;

      // Undo / Redo
      if (meta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        doc.undo();
        return;
      }
      if (meta && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        doc.redo();
        return;
      }

      // Escape — deselect
      if (e.key === 'Escape') {
        setSelectedBlockId(null);
        return;
      }

      // Select all
      if (meta && e.key === 'a') {
        e.preventDefault();
        // Just select first block for now (multi-select is complex)
        if (filteredBlocks.length > 0) {
          setSelectedBlockId(filteredBlocks[0].id);
        }
        return;
      }

      if (!selectedBlockId) {
        // Tab to select first block
        if (e.key === 'Tab') {
          e.preventDefault();
          const sorted = readingOrder([...filteredBlocks]);
          if (sorted.length > 0) setSelectedBlockId(sorted[0].id);
        }
        return;
      }

      // Backspace / Delete — delete selected block
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        doc.deleteBlock(selectedBlockId);
        setSelectedBlockId(null);
        return;
      }

      // Ctrl+D — duplicate
      if (meta && e.key === 'd') {
        e.preventDefault();
        const newId = doc.duplicateBlock(selectedBlockId);
        if (newId) setSelectedBlockId(newId);
        return;
      }

      // Arrow keys — nudge
      const block = doc.blocks.find(b => b.id === selectedBlockId);
      if (!block) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const newCol = Math.min(doc.columnCount - block.position.colSpan + 1, block.position.col + 1);
        if (newCol !== block.position.col) {
          doc.moveBlock(block.id, { ...block.position, col: newCol });
        }
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const newCol = Math.max(1, block.position.col - 1);
        if (newCol !== block.position.col) {
          doc.moveBlock(block.id, { ...block.position, col: newCol });
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        doc.moveBlock(block.id, { ...block.position, row: block.position.row + 1 });
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const newRow = Math.max(1, block.position.row - 1);
        doc.moveBlock(block.id, { ...block.position, row: newRow });
        return;
      }

      // Tab — cycle to next block
      if (e.key === 'Tab') {
        e.preventDefault();
        const sorted = readingOrder([...filteredBlocks]);
        const idx = sorted.findIndex(b => b.id === selectedBlockId);
        const next = e.shiftKey
          ? sorted[(idx - 1 + sorted.length) % sorted.length]
          : sorted[(idx + 1) % sorted.length];
        if (next) setSelectedBlockId(next.id);
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, selectedBlockId, doc, zoom]);

  // ── Arrow drawing state (new waypoint system) ──────
  const [arrowDrawing, setArrowDrawing] = useState<{
    fromBlockId: string;
    waypoints: { x: number; y: number }[];  // max 2 locked waypoints
    cursorSnapped: { x: number; y: number } | null;
  } | null>(null);

  const handleCanvasMouseMove = (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    if (!arrowDrawing || colWidth === 0) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / zoom;
    const rawY = (e.clientY - rect.top) / zoom;
    const snapped = snapToGridDot(rawX, rawY, colWidth, doc.rowHeight);
    setArrowDrawing(prev => prev ? { ...prev, cursorSnapped: snapped } : null);
  };

  // Start drawing from a block
  const handleArrowDrawStart = (blockId: string) => {
    setArrowDrawing({
      fromBlockId: blockId,
      waypoints: [],
      cursorSnapped: null,
    });
  };

  // Click on the canvas grid → lock a waypoint (max 2)
  const handleCanvasClickForArrow = (e: React.MouseEvent) => {
    if (!arrowDrawing || colWidth === 0) return;
    // If clicking on a block, that's handled by onArrowDrawEnd
    if ((e.target as HTMLElement).closest('[data-canvas-block]')) return;
    if (arrowDrawing.waypoints.length >= 2) return; // max 2 waypoints

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / zoom;
    const rawY = (e.clientY - rect.top) / zoom;
    const snapped = snapToGridDot(rawX, rawY, colWidth, doc.rowHeight);

    setArrowDrawing(prev => prev ? {
      ...prev,
      waypoints: [...prev.waypoints, snapped],
    } : null);
  };

  // Complete the arrow by clicking a target block
  const handleArrowDrawEnd = (toBlockId: string) => {
    if (!arrowDrawing) return;
    if (arrowDrawing.fromBlockId === toBlockId) {
      // Cancel if clicking the same block
      setArrowDrawing(null);
      return;
    }

    const fromBlock = doc.blocks.find(b => b.id === arrowDrawing.fromBlockId);
    const toBlock = doc.blocks.find(b => b.id === toBlockId);
    if (!fromBlock || !toBlock) { setArrowDrawing(null); return; }

    // Auto-detect edges based on first/last waypoint or block centers
    const firstWaypoint = arrowDrawing.waypoints[0]
      ?? getEdgeMidpoint(toBlock.position, 'left', colWidth, doc.rowHeight);
    const lastWaypoint = arrowDrawing.waypoints[arrowDrawing.waypoints.length - 1]
      ?? getEdgeMidpoint(fromBlock.position, 'right', colWidth, doc.rowHeight);

    const fromEdge = nearestEdge(firstWaypoint, fromBlock.position, colWidth, doc.rowHeight);
    const toEdge = nearestEdge(lastWaypoint, toBlock.position, colWidth, doc.rowHeight);

    doc.addArrow(
      arrowDrawing.fromBlockId,
      toBlockId,
      fromEdge,
      toEdge,
      'produces'
    );
    setArrowDrawing(null);
  };

  // Cancel arrow drawing on Escape
  useEffect(() => {
    if (!arrowDrawing) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setArrowDrawing(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [arrowDrawing]);

  // Build the live drawing path for ArrowOverlay (computed in render, after colWidth)
  const getDrawingPathStr = () => {
    if (!arrowDrawing || !arrowDrawing.cursorSnapped || colWidth === 0) return null;
    const fromBlock = doc.blocks.find(b => b.id === arrowDrawing.fromBlockId);
    if (!fromBlock) return null;
    const firstWp = arrowDrawing.waypoints[0] ?? arrowDrawing.cursorSnapped;
    const fromEdge = nearestEdge(firstWp, fromBlock.position, colWidth, doc.rowHeight);
    const startPt = getEdgeMidpoint(fromBlock.position, fromEdge, colWidth, doc.rowHeight);
    const points = [startPt, ...arrowDrawing.waypoints, arrowDrawing.cursorSnapped];
    return polylinePath(points);
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

  // Filter blocks by active stage tab
  const filteredBlocks = activeStageTab
    ? doc.blocks.filter(b => b.stageId === activeStageTab)
    : doc.blocks;

  // When a stage is deleted, reset tab
  useEffect(() => {
    if (activeStageTab && !doc.stages.find(s => s.id === activeStageTab)) {
      setActiveStageTab(null);
    }
  }, [doc.stages, activeStageTab]);

  // Handle inserting block with stage auto-assignment
  const handleInsertBlock = useCallback((type: string, position: Partial<CanvasBlockType['position']>) => {
    const id = doc.addBlock(type, position);
    if (activeStageTab) {
      doc.assignBlockToStage(id, activeStageTab);
    }
    return id;
  }, [doc, activeStageTab]);

  // Total canvas height
  const canvasHeight = filteredBlocks.length === 0
    ? 400
    : Math.max(
        400,
        Math.max(
          ...filteredBlocks.map(b =>
            (b.position.row + b.position.rowSpan - 1)
            * doc.rowHeight
          )
        ) + 200
      );

  const colWidth = containerWidth > 0
    ? containerWidth / doc.columnCount : 0;

  // Deselect when clicking empty canvas
  const handleCanvasClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-canvas-block]')) return;
    setSelectedBlockId(null);
  };

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
          setSelectedBlockId(blockId);
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
        minHeight: 0,
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

        {/* Stage tab bar */}
        {mode === 'edit' && doc.stages.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 2,
            padding: '6px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
            overflowX: 'auto',
          }}>
            <button
              onClick={() => setActiveStageTab(null)}
              style={{
                padding: '4px 12px', fontSize: 11, fontWeight: 600,
                borderRadius: 6, border: 'none', cursor: 'pointer',
                background: !activeStageTab ? 'rgba(232,87,26,0.15)' : 'rgba(255,255,255,0.04)',
                color: !activeStageTab ? '#E8571A' : 'rgba(255,255,255,0.40)',
                transition: 'all 0.15s',
              }}
            >
              All
            </button>
            {doc.stages.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveStageTab(s.id)}
                style={{
                  padding: '4px 12px', fontSize: 11, fontWeight: 600,
                  borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: activeStageTab === s.id ? 'rgba(232,87,26,0.15)' : 'rgba(255,255,255,0.04)',
                  color: activeStageTab === s.id ? '#E8571A' : 'rgba(255,255,255,0.40)',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.stageNumber}. {s.title}
              </button>
            ))}
            <button
              onClick={() => doc.addStage(`Stage ${doc.stages.length + 1}`)}
              style={{
                padding: '4px 8px', fontSize: 11, border: 'none', cursor: 'pointer',
                background: 'none', color: 'rgba(255,255,255,0.25)',
              }}
            >
              + Stage
            </button>
          </div>
        )}

        {/* Empty stage state */}
        {mode === 'edit' && activeStageTab && filteredBlocks.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '60px 20px', gap: 8,
            color: 'rgba(255,255,255,0.30)', fontSize: 13,
          }}>
            <div>No blocks in this stage yet</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>
              Add a block from the toolbar or assign existing blocks to this stage
            </div>
          </div>
        )}

        {/* The grid */}
        <div
          ref={containerRef}
          onMouseMove={handleCanvasMouseMove}
          onClick={(e) => {
            handleCanvasClickForArrow(e);
            handleCanvasClick(e);
          }}
          style={{
            position: 'relative',
            flex: 1,
            minHeight: canvasHeight / zoom,
            width: `${100 / zoom}%`,
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            cursor: arrowDrawing ? 'crosshair' : undefined,
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
            const stageBlocks = filteredBlocks.filter(
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
          {colWidth > 0 && filteredBlocks.map(block => (
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
              selected={selectedBlockId === block.id}
              onSelect={() => setSelectedBlockId(block.id)}
              onPositionChange={pos =>
                doc.moveBlock(block.id, pos)
              }
              onBlockChange={patch =>
                doc.updateBlock(block.id, patch)
              }
              onDelete={() => doc.deleteBlock(block.id)}
              onArrowDrawStart={() => handleArrowDrawStart(block.id)}
              isArrowDrawing={arrowDrawing !== null}
              onArrowDrawEnd={() => handleArrowDrawEnd(block.id)}
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
              drawingPathStr={getDrawingPathStr()}
              drawingWaypoints={arrowDrawing?.waypoints ?? []}
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
                handleInsertBlock(type, position)
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
          onInsertBlock={(type, position) =>
            handleInsertBlock(type, position)
          }
          onUndo={doc.canUndo ? doc.undo : undefined}
          onRedo={doc.canRedo ? doc.redo : undefined}
          zoom={zoom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
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
