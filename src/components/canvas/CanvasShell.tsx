import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
import { BlockContextMenu } from './BlockContextMenu';
import { ARROW_TYPE_META } from '@/lib/canvas-types';
import { readingOrder, snapToGridDot, nearestEdge, getEdgeMidpoint, orthogonalPath, getBlockSnapPoints, preventStageOverlap, gridToPixels } from '@/lib/canvas-utils';
import { ClearAllDialog } from './ClearAllDialog';

import type { EvidenceMediaType } from './CanvasHeader';

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
  embedded?: boolean;
  showAnnotations?: boolean;
  onSave?: () => void;
  onPublish?: () => void;
  saving?: boolean;
  submitting?: boolean;
  onBack?: () => void;
  // Evidence
  evidenceMediaType?: EvidenceMediaType;
  evidenceMediaFiles?: File[];
  evidenceMediaPreviews?: string[];
  evidenceCaption?: string;
  onEvidenceMediaTypeChange?: (t: EvidenceMediaType) => void;
  onEvidenceMediaFilesChange?: (files: File[], previews: string[]) => void;
  onEvidenceCaptionChange?: (v: string) => void;
  // View-mode block click handler: opens a focus panel for the clicked block
  onBlockClick?: (block: CanvasBlockType) => void;
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

  // ── Stage tab bar scroll arrows ─────────────────
  const stageTabsScrollRef = useRef<HTMLDivElement>(null);
  const [showStageTabsLeftArrow, setShowStageTabsLeftArrow] = useState(false);
  const [showStageTabsRightArrow, setShowStageTabsRightArrow] = useState(false);

  useEffect(() => {
    const el = stageTabsScrollRef.current;
    if (!el) return;

    const updateArrows = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      const hasOverflow = scrollWidth > clientWidth;
      setShowStageTabsLeftArrow(hasOverflow && scrollLeft > 0);
      setShowStageTabsRightArrow(hasOverflow && scrollLeft + clientWidth < scrollWidth - 1);
    };

    updateArrows();

    el.addEventListener('scroll', updateArrows);

    const resizeObserver = new ResizeObserver(updateArrows);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', updateArrows);
      resizeObserver.disconnect();
    };
  }, [doc.stages.length, mode]);

  const scrollStageTabs = (direction: 'left' | 'right') => {
    const el = stageTabsScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === 'left' ? -200 : 200, behavior: 'smooth' });
  };

  // ── Selection ───────────────────────────────────
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(new Set());

  // ── Marquee selection ──────────────────────────
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null);
  const isMarqueeSelecting = marqueeStart !== null && marqueeEnd !== null;

  // ── Context menu ───────────────────────────────
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // ── Grammar check toast ────────────────────────
  const [grammarToast, setGrammarToast] = useState<string | null>(null);

  const isBlockSelected = (id: string) => selectedBlockIds.has(id);

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

      // Escape — deselect & close context menu
      if (e.key === 'Escape') {
        setSelectedBlockIds(new Set());
        setContextMenu(null);
        return;
      }

      // Select all
      if (meta && e.key === 'a') {
        e.preventDefault();
        setSelectedBlockIds(new Set(filteredBlocks.map(b => b.id)));
        return;
      }

      const selectedIds = Array.from(selectedBlockIds);
      const firstSelectedId = selectedIds[0];

      if (selectedBlockIds.size === 0) {
        // Tab to select first block
        if (e.key === 'Tab') {
          e.preventDefault();
          const sorted = readingOrder([...filteredBlocks]);
          if (sorted.length > 0) setSelectedBlockIds(new Set([sorted[0].id]));
        }
        return;
      }

      // Backspace / Delete — delete all selected blocks
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        for (const id of selectedIds) {
          doc.deleteBlock(id);
        }
        setSelectedBlockIds(new Set());
        return;
      }

      // Ctrl+D — duplicate (all selected)
      if (meta && e.key === 'd') {
        e.preventDefault();
        const newIds: string[] = [];
        for (const id of selectedIds) {
          const newId = doc.duplicateBlock(id);
          if (newId) newIds.push(newId);
        }
        if (newIds.length > 0) setSelectedBlockIds(new Set(newIds));
        return;
      }

      // Arrow keys — nudge (applies to first selected block)
      const block = doc.blocks.find(b => b.id === firstSelectedId);
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
        const idx = sorted.findIndex(b => b.id === firstSelectedId);
        const next = e.shiftKey
          ? sorted[(idx - 1 + sorted.length) % sorted.length]
          : sorted[(idx + 1) % sorted.length];
        if (next) setSelectedBlockIds(new Set([next.id]));
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, selectedBlockIds, doc, zoom]);

  // ── Arrow drawing state (unlimited waypoints) ──────
  type EdgeType = 'top' | 'right' | 'bottom' | 'left';
  const [arrowDrawing, setArrowDrawing] = useState<{
    fromBlockId: string;
    fromEdge?: EdgeType;
    waypoints: { x: number; y: number }[];
    cursorSnapped: { x: number; y: number } | null;
  } | null>(null);

  // Magnetized snap-point target during arrow drawing
  const [magnetizedTarget, setMagnetizedTarget] = useState<{
    blockId: string;
    edge: EdgeType;
    point: { x: number; y: number };
  } | null>(null);

  // Clear All dialog state
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const handleCanvasMouseMove = (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    if (!arrowDrawing || colWidth === 0) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / zoom;
    const rawY = (e.clientY - rect.top) / zoom;

    // Check magnetization to snap points on all blocks
    let magnetized: { blockId: string; edge: EdgeType; point: { x: number; y: number } } | null = null;
    let minDist = 20;
    for (const block of doc.blocks) {
      if (block.id === arrowDrawing.fromBlockId) continue;
      const snapPoints = getBlockSnapPoints(block.position, colWidth, doc.rowHeight);
      for (const sp of snapPoints) {
        const dist = Math.hypot(rawX - sp.point.x, rawY - sp.point.y);
        if (dist < minDist) {
          minDist = dist;
          magnetized = { blockId: block.id, edge: sp.edge, point: sp.point };
        }
      }
    }

    setMagnetizedTarget(magnetized);

    if (magnetized) {
      setArrowDrawing(prev => prev ? { ...prev, cursorSnapped: magnetized.point } : null);
    } else {
      const snapped = snapToGridDot(rawX, rawY, colWidth, doc.rowHeight);
      setArrowDrawing(prev => prev ? { ...prev, cursorSnapped: snapped } : null);
    }
  };

  // Start drawing from a block (optionally with a specific edge)
  const handleArrowDrawStart = (blockId: string, edge?: EdgeType) => {
    setArrowDrawing({
      fromBlockId: blockId,
      fromEdge: edge,
      waypoints: [],
      cursorSnapped: null,
    });
    setMagnetizedTarget(null);
  };

  // Click on the canvas grid → lock a waypoint (unlimited)
  const handleCanvasClickForArrow = (e: React.MouseEvent) => {
    if (!arrowDrawing || colWidth === 0) return;
    // If clicking on a block, that's handled by onArrowDrawEnd
    if ((e.target as HTMLElement).closest('[data-canvas-block]')) return;

    // If magnetized to a snap point, complete the arrow there
    if (magnetizedTarget) {
      handleArrowDrawEnd(magnetizedTarget.blockId, magnetizedTarget.edge);
      return;
    }

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / zoom;
    const rawY = (e.clientY - rect.top) / zoom;
    const snapped = snapToGridDot(rawX, rawY, colWidth, doc.rowHeight);

    setArrowDrawing(prev => prev ? {
      ...prev,
      waypoints: [...prev.waypoints, snapped],
    } : null);
  };

  // Complete the arrow by clicking a target block (or snap point)
  const handleArrowDrawEnd = (toBlockId: string, snapEdge?: EdgeType) => {
    if (!arrowDrawing) return;
    if (arrowDrawing.fromBlockId === toBlockId) {
      // Cancel if clicking the same block
      setArrowDrawing(null);
      setMagnetizedTarget(null);
      return;
    }

    const fromBlock = doc.blocks.find(b => b.id === arrowDrawing.fromBlockId);
    const toBlock = doc.blocks.find(b => b.id === toBlockId);
    if (!fromBlock || !toBlock) { setArrowDrawing(null); setMagnetizedTarget(null); return; }

    // Use explicit edges if provided, otherwise auto-detect
    const fromEdge = arrowDrawing.fromEdge
      ?? nearestEdge(
        arrowDrawing.waypoints[0]
          ?? getEdgeMidpoint(toBlock.position, 'left', colWidth, doc.rowHeight),
        fromBlock.position, colWidth, doc.rowHeight
      );

    const toEdge = snapEdge
      ?? nearestEdge(
        arrowDrawing.waypoints[arrowDrawing.waypoints.length - 1]
          ?? getEdgeMidpoint(fromBlock.position, 'right', colWidth, doc.rowHeight),
        toBlock.position, colWidth, doc.rowHeight
      );

    doc.addArrow(
      arrowDrawing.fromBlockId,
      toBlockId,
      fromEdge,
      toEdge,
      'produces',
      arrowDrawing.waypoints.length > 0
        ? arrowDrawing.waypoints : undefined
    );
    setArrowDrawing(null);
    setMagnetizedTarget(null);
  };

  // Cancel arrow drawing on Escape
  useEffect(() => {
    if (!arrowDrawing) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setArrowDrawing(null);
        setMagnetizedTarget(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [arrowDrawing]);

  // Build the live drawing path for ArrowOverlay using orthogonal routing
  const getDrawingPathStr = () => {
    if (!arrowDrawing || !arrowDrawing.cursorSnapped || colWidth === 0) return null;
    const fromBlock = doc.blocks.find(b => b.id === arrowDrawing.fromBlockId);
    if (!fromBlock) return null;

    const fromEdge = arrowDrawing.fromEdge
      ?? nearestEdge(
        arrowDrawing.waypoints[0] ?? arrowDrawing.cursorSnapped,
        fromBlock.position, colWidth, doc.rowHeight
      );
    const startPt = getEdgeMidpoint(fromBlock.position, fromEdge, colWidth, doc.rowHeight);

    // If magnetized, route to the target edge properly
    const toEdge = magnetizedTarget ? magnetizedTarget.edge : null;

    return orthogonalPath(
      startPt, fromEdge,
      arrowDrawing.cursorSnapped, toEdge,
      arrowDrawing.waypoints,
      doc.rowHeight
    );
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

  // Filter blocks by active stage tab. Sticky notes are canvas-level
  // annotations and are always visible regardless of the active stage tab.
  const filteredBlocks = activeStageTab
    ? doc.blocks.filter(b => b.stageId === activeStageTab || b.type === 'sticky_note')
    : doc.blocks;

  // When a stage is deleted, reset tab
  useEffect(() => {
    if (activeStageTab && !doc.stages.find(s => s.id === activeStageTab)) {
      setActiveStageTab(null);
    }
  }, [doc.stages, activeStageTab]);

  // Stage overlap prevention — shift blocks in later stages
  // down when they overlap with earlier stages
  useEffect(() => {
    if (mode !== 'edit' || doc.stages.length < 2) return;
    const adjusted = preventStageOverlap(doc.stages, doc.blocks);
    const needsUpdate = adjusted.some(b => {
      const orig = doc.blocks.find(ob => ob.id === b.id);
      return orig && orig.position.row !== b.position.row;
    });
    if (needsUpdate) {
      doc.restoreSnapshot({ blocks: adjusted });
    }
  }, [doc.blocks, doc.stages, mode]);

  // Handle inserting block with stage auto-assignment. Sticky notes are
  // canvas-level annotations and are never attached to a stage.
  const handleInsertBlock = useCallback((type: string, position: Partial<CanvasBlockType['position']>) => {
    const id = doc.addBlock(type, position);
    if (activeStageTab && type !== 'sticky_note') {
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

  // Deselect when clicking empty canvas (unless marquee just happened)
  const handleCanvasClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-canvas-block]')) return;
    if (contextMenu) return;
    setSelectedBlockIds(new Set());
  };

  // Marquee mouse-down on the canvas
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (mode !== 'edit') return;
    if (arrowDrawing) return;
    if (e.button !== 0) return; // left click only
    // Ignore if clicking a block or interactive element
    if ((e.target as HTMLElement).closest('[data-canvas-block]')) return;
    if ((e.target as HTMLElement).closest('button, input, textarea')) return;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    setMarqueeStart({ x, y });
    setMarqueeEnd({ x, y });
    setContextMenu(null);
  };

  // Marquee mouse-move on the canvas
  const handleMarqueeMove = (e: React.MouseEvent) => {
    if (!marqueeStart) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    setMarqueeEnd({ x, y });
  };

  // Marquee mouse-up — compute intersections
  const handleMarqueeUp = () => {
    if (!marqueeStart || !marqueeEnd || colWidth === 0) {
      setMarqueeStart(null);
      setMarqueeEnd(null);
      return;
    }
    const left = Math.min(marqueeStart.x, marqueeEnd.x);
    const right = Math.max(marqueeStart.x, marqueeEnd.x);
    const top = Math.min(marqueeStart.y, marqueeEnd.y);
    const bottom = Math.max(marqueeStart.y, marqueeEnd.y);

    // If the marquee is too small, treat as a click (clear selection)
    if (right - left < 3 && bottom - top < 3) {
      setSelectedBlockIds(new Set());
      setMarqueeStart(null);
      setMarqueeEnd(null);
      return;
    }

    const intersecting = new Set<string>();
    for (const block of filteredBlocks) {
      const px = gridToPixels(block.position, colWidth, doc.rowHeight);
      const blockLeft = px.x;
      const blockTop = px.y;
      const blockRight = px.x + px.w;
      const blockBottom = px.y + px.h;
      const overlaps =
        blockLeft < right &&
        blockRight > left &&
        blockTop < bottom &&
        blockBottom > top;
      if (overlaps) intersecting.add(block.id);
    }
    setSelectedBlockIds(intersecting);
    setMarqueeStart(null);
    setMarqueeEnd(null);
  };

  // Block click — supports shift+click for additive selection
  const handleBlockSelect = (blockId: string, e?: React.MouseEvent) => {
    if (e?.shiftKey) {
      setSelectedBlockIds(prev => {
        const next = new Set(prev);
        if (next.has(blockId)) next.delete(blockId);
        else next.add(blockId);
        return next;
      });
    } else {
      setSelectedBlockIds(new Set([blockId]));
    }
    setContextMenu(null);
  };

  // Right-click on a block — show context menu
  const handleBlockContextMenu = (blockId: string, e: React.MouseEvent) => {
    if (mode !== 'edit') return;
    // If the clicked block isn't in the selection, select it
    setSelectedBlockIds(prev => {
      if (prev.has(blockId)) return prev;
      return new Set([blockId]);
    });
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // Context menu actions
  const contextMoveToStage = (stageId: string) => {
    for (const id of selectedBlockIds) {
      doc.assignBlockToStage(id, stageId);
    }
  };
  const contextRemoveFromStage = () => {
    for (const id of selectedBlockIds) {
      doc.assignBlockToStage(id, null);
    }
  };
  const contextDelete = () => {
    for (const id of selectedBlockIds) {
      doc.deleteBlock(id);
    }
    setSelectedBlockIds(new Set());
  };

  // Grammar check
  const handleGrammarCheck = useCallback(() => {
    const fixText = (input: string): string => {
      if (!input) return input;
      let text = input;

      // Collapse double spaces → single
      text = text.replace(/  +/g, ' ');

      // Trailing whitespace on each line
      text = text.replace(/[ \t]+(\r?\n)/g, '$1');
      text = text.replace(/[ \t]+$/, '');

      // Common typo fixes (word-boundary aware)
      const typoReplacements: Array<[RegExp, string]> = [
        [/\bteh\b/g, 'the'],
        [/\bdont\b/g, "don't"],
        [/\bcant\b/g, "can't"],
        [/\bwont\b/g, "won't"],
        [/\bim\b/g, "I'm"],
        [/\bive\b/g, "I've"],
        [/\brecieve\b/g, 'receive'],
        [/\bseperate\b/g, 'separate'],
        [/\boccured\b/g, 'occurred'],
        [/\bdefinately\b/g, 'definitely'],
      ];
      for (const [re, rep] of typoReplacements) {
        text = text.replace(re, rep);
      }

      // Capitalisation after sentence-ending punctuation
      text = text.replace(/([.!?])(\s+)([a-z])/g, (_m, p, w, c) =>
        `${p}${w}${c.toUpperCase()}`
      );

      // Ensure text starts with a capital letter
      const firstLetterIdx = text.search(/[a-zA-Z]/);
      if (firstLetterIdx !== -1) {
        const ch = text[firstLetterIdx];
        if (ch >= 'a' && ch <= 'z') {
          text = text.slice(0, firstLetterIdx) + ch.toUpperCase() + text.slice(firstLetterIdx + 1);
        }
      }

      return text;
    };

    let corrections = 0;
    let blocksChanged = 0;
    for (const block of doc.blocks) {
      if (!block.textContent) continue;
      const corrected = fixText(block.textContent);
      if (corrected !== block.textContent) {
        // Count number of character differences as an approximation
        // of corrections; simpler: count distinct replacements.
        let diffs = 0;
        const original = block.textContent;
        // Count collapsed double spaces
        const dblMatches = original.match(/  +/g);
        if (dblMatches) diffs += dblMatches.length;
        const trailingMatches = original.match(/[ \t]+(\r?\n|$)/g);
        if (trailingMatches) diffs += trailingMatches.length;
        const typoPatterns = [
          /\bteh\b/g, /\bdont\b/g, /\bcant\b/g, /\bwont\b/g,
          /\bim\b/g, /\bive\b/g, /\brecieve\b/g, /\bseperate\b/g,
          /\boccured\b/g, /\bdefinately\b/g,
        ];
        for (const re of typoPatterns) {
          const matches = original.match(re);
          if (matches) diffs += matches.length;
        }
        const capMatches = original.match(/[.!?]\s+[a-z]/g);
        if (capMatches) diffs += capMatches.length;
        if (diffs === 0) diffs = 1;

        corrections += diffs;
        blocksChanged += 1;
        doc.updateBlock(block.id, { textContent: corrected });
      }
    }
    setGrammarToast(
      `Grammar check complete — ${corrections} correction${corrections === 1 ? '' : 's'} made across ${blocksChanged} block${blocksChanged === 1 ? '' : 's'}.`
    );
  }, [doc]);

  // Auto-dismiss grammar toast
  useEffect(() => {
    if (!grammarToast) return;
    const t = setTimeout(() => setGrammarToast(null), 4000);
    return () => clearTimeout(t);
  }, [grammarToast]);

  return (
    <div style={{
      display: 'flex',
      height: props.embedded ? 'auto' : '100%',
      overflow: props.embedded ? 'visible' : 'hidden',
      background: 'rgba(6,6,10,0.65)',
      position: 'relative',
      minHeight: props.embedded ? 80 : undefined,
    }}>

      {/* TOC sidebar — hidden when embedded */}
      {!props.embedded && <CanvasTOC
        open={tocOpen}
        onToggle={() => setTocOpen(o => !o)}
        stages={doc.stages}
        blocks={doc.blocks}
        mode={mode}
        onBlockClick={blockId => {
          setSelectedBlockIds(new Set([blockId]));
          document.getElementById(`canvas-block-${blockId}`)
            ?.scrollIntoView({
              behavior: 'smooth', block: 'center'
            });
        }}
        onBlockChange={(id, patch) => doc.updateBlock(id, patch)}
        onBlockDepthChange={(id, depth) => doc.updateBlock(id, { depth })}
        onStageReorder={(newStages) => doc.setStages(newStages)}
        onBlockReorder={(stageId, newBlockIds) => {
          doc.setStages(prev =>
            prev.map(s => s.id === stageId ? { ...s, blockIds: newBlockIds } : s)
          );
        }}
        onStageAdd={title => doc.addStage(title)}
      />}

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
          onDescriptionChange={props.onDescriptionChange}
          onPostTypeClick={props.onPostTypeClick}
          onCoverChange={props.onCoverChange}
          evidenceMediaType={props.evidenceMediaType}
          evidenceMediaFiles={props.evidenceMediaFiles}
          evidenceMediaPreviews={props.evidenceMediaPreviews}
          evidenceCaption={props.evidenceCaption}
          onEvidenceMediaTypeChange={props.onEvidenceMediaTypeChange}
          onEvidenceMediaFilesChange={props.onEvidenceMediaFilesChange}
          onEvidenceCaptionChange={props.onEvidenceCaptionChange}
        />}

        {/* Stage tab bar */}
        {mode === 'edit' && doc.stages.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
            overflow: 'hidden',
            position: 'relative',
          }}>
            {showStageTabsLeftArrow && (
              <button
                onClick={() => scrollStageTabs('left')}
                aria-label="Scroll stage tabs left"
                style={{
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(10,10,16,0.90)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 6,
                  color: 'rgba(255,255,255,0.40)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <ChevronLeft size={14} />
              </button>
            )}
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <div
                ref={stageTabsScrollRef}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
                <button
                  onClick={() => setActiveStageTab(null)}
                  style={{
                    padding: '4px 12px', fontSize: 11, fontWeight: 600,
                    borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: !activeStageTab ? 'rgba(139,69,19,0.15)' : 'rgba(255,255,255,0.04)',
                    color: !activeStageTab ? '#8B4513' : 'rgba(255,255,255,0.40)',
                    transition: 'all 0.15s',
                    flexShrink: 0,
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
                      background: activeStageTab === s.id ? 'rgba(139,69,19,0.15)' : 'rgba(255,255,255,0.04)',
                      color: activeStageTab === s.id ? '#8B4513' : 'rgba(255,255,255,0.40)',
                      transition: 'all 0.15s',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {s.title}
                  </button>
                ))}
                <button
                  onClick={() => doc.addStage(`Stage ${doc.stages.length + 1}`)}
                  style={{
                    padding: '4px 8px', fontSize: 11, border: 'none', cursor: 'pointer',
                    background: 'none', color: 'rgba(255,255,255,0.25)',
                    flexShrink: 0,
                  }}
                >
                  + Stage
                </button>
              </div>
              {showStageTabsLeftArrow && (
                <div
                  style={{
                    pointerEvents: 'none',
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width: 32,
                    background: 'linear-gradient(to right, rgba(10,10,16,0.95), transparent)',
                  }}
                />
              )}
              {showStageTabsRightArrow && (
                <div
                  style={{
                    pointerEvents: 'none',
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    right: 0,
                    width: 32,
                    background: 'linear-gradient(to left, rgba(10,10,16,0.95), transparent)',
                  }}
                />
              )}
            </div>
            {showStageTabsRightArrow && (
              <button
                onClick={() => scrollStageTabs('right')}
                aria-label="Scroll stage tabs right"
                style={{
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(10,10,16,0.90)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 6,
                  color: 'rgba(255,255,255,0.40)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <ChevronRight size={14} />
              </button>
            )}
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
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={(e) => {
            handleCanvasMouseMove(e);
            handleMarqueeMove(e);
          }}
          onMouseUp={handleMarqueeUp}
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
              selected={isBlockSelected(block.id)}
              onSelect={(e) => handleBlockSelect(block.id, e)}
              onContextMenu={(e) => handleBlockContextMenu(block.id, e)}
              onPositionChange={pos =>
                doc.moveBlock(block.id, pos)
              }
              onBlockChange={patch =>
                doc.updateBlock(block.id, patch)
              }
              onDelete={() => doc.deleteBlock(block.id)}
              onArrowDrawStart={(edge) => handleArrowDrawStart(block.id, edge)}
              isArrowDrawing={arrowDrawing !== null}
              onArrowDrawEnd={(edge) => handleArrowDrawEnd(block.id, edge)}
              magnetizedEdge={magnetizedTarget?.blockId === block.id ? magnetizedTarget.edge : null}
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
              onBlockClick={props.onBlockClick}
            />
          ))}

          {/* Marquee rectangle */}
          {isMarqueeSelecting && marqueeStart && marqueeEnd && (
            <div
              style={{
                position: 'absolute',
                left: Math.min(marqueeStart.x, marqueeEnd.x),
                top: Math.min(marqueeStart.y, marqueeEnd.y),
                width: Math.abs(marqueeEnd.x - marqueeStart.x),
                height: Math.abs(marqueeEnd.y - marqueeStart.y),
                border: '1px solid rgba(139,69,19,0.6)',
                background: 'rgba(139,69,19,0.08)',
                pointerEvents: 'none',
                zIndex: 50,
              }}
            />
          )}

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

      {/* Grammar check toast */}
      {grammarToast && (
        <div style={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(34,197,94,0.15)',
          border: '1px solid rgba(34,197,94,0.3)',
          color: '#22C55E',
          fontSize: 12,
          borderRadius: 8,
          padding: '8px 16px',
          zIndex: 150,
          fontFamily: 'Inter, sans-serif',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          {grammarToast}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <BlockContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          stages={doc.stages}
          onMoveToStage={contextMoveToStage}
          onRemoveFromStage={contextRemoveFromStage}
          onDelete={contextDelete}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Edit mode toolbar at bottom — hidden when embedded */}
      {mode === 'edit' && !props.embedded && (
        <CanvasToolbar
          doc={doc}
          onSave={props.onSave}
          onPublish={props.onPublish}
          saving={props.saving}
          submitting={props.submitting}
          onTemplates={() => setTemplateLibOpen(true)}
          onHistory={() => setVersionHistoryOpen(true)}
          onAnnotations={() => setAnnotationsOpen(true)}
          onGrammarCheck={handleGrammarCheck}
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
          onClearAll={() => setClearDialogOpen(true)}
        />
      )}

      {/* Template library panel */}
      <TemplateLibrary
        open={templateLibOpen}
        onClose={() => setTemplateLibOpen(false)}
        currentBlocks={doc.blocks}
        onApply={(newBlocks, newArrows) => {
          const prepared = newBlocks.map(b => ({
            ...b,
            id: b.id ?? crypto.randomUUID(),
          }));
          doc.restoreSnapshot({
            blocks: [
              ...doc.blocks,
              ...prepared,
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
          // If a stage is active, assign all new blocks to it
          if (activeStageTab) {
            for (const block of prepared) {
              doc.assignBlockToStage(block.id!, activeStageTab);
            }
          }
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

      {/* Clear All confirmation dialog */}
      <ClearAllDialog
        open={clearDialogOpen}
        onClose={() => setClearDialogOpen(false)}
        onConfirm={() => {
          doc.restoreSnapshot({
            blocks: [],
            arrows: [],
            stages: [],
          });
        }}
      />
    </div>
  );
}
