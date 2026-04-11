import { useState, useEffect, useCallback,
  useRef, useMemo } from 'react';
import { supabase } from
  '@/integrations/supabase/client';
import {
  CanvasBlock, BlockArrow, CanvasStage,
  CanvasDocument, BlockPosition,
  ARROW_TYPE_META, ArrowType,
} from '@/lib/canvas-types';
import {
  getNextRow, assignStageIndices,
  readingOrder, positionsOverlap,
} from '@/lib/canvas-utils';

interface CanvasSnapshot {
  blocks: CanvasBlock[];
  arrows: BlockArrow[];
  stages: CanvasStage[];
}

const MAX_UNDO = 50;

export function useCanvasDocument(
  contentId: string | null
) {
  const [blocksRaw, setBlocksRaw] =
    useState<CanvasBlock[]>([]);
  const [arrows, setArrows] =
    useState<BlockArrow[]>([]);
  const [stages, setStages] =
    useState<CanvasStage[]>([]);
  const [columnCount, setColumnCount] =
    useState(12);
  const [rowHeight, setRowHeight] = useState(24);
  const [layoutMode, setLayoutMode] =
    useState<'freeform' | 'pipeline'>('freeform');
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [versionNumber, setVersionNumber] =
    useState(1);
  const autosaveTimer = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  // ── Undo / Redo ─────────────────────────────────
  const undoStack = useRef<CanvasSnapshot[]>([]);
  const redoStack = useRef<CanvasSnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushUndo = useCallback(() => {
    undoStack.current.push({
      blocks: [...blocksRaw],
      arrows: [...arrows],
      stages: [...stages],
    });
    if (undoStack.current.length > MAX_UNDO) {
      undoStack.current.shift();
    }
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, [blocksRaw, arrows, stages]);

  const undo = useCallback(() => {
    const snap = undoStack.current.pop();
    if (!snap) return;
    redoStack.current.push({
      blocks: [...blocksRaw],
      arrows: [...arrows],
      stages: [...stages],
    });
    setBlocksRaw(snap.blocks);
    setArrows(snap.arrows);
    setStages(snap.stages);
    setIsDirty(true);
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
  }, [blocksRaw, arrows, stages]);

  const redo = useCallback(() => {
    const snap = redoStack.current.pop();
    if (!snap) return;
    undoStack.current.push({
      blocks: [...blocksRaw],
      arrows: [...arrows],
      stages: [...stages],
    });
    setBlocksRaw(snap.blocks);
    setArrows(snap.arrows);
    setStages(snap.stages);
    setIsDirty(true);
    setCanRedo(redoStack.current.length > 0);
    setCanUndo(true);
  }, [blocksRaw, arrows, stages]);

  // Derived: blocks with stage indices assigned
  const blocks = useMemo(
    () => assignStageIndices(stages, blocksRaw),
    [stages, blocksRaw]
  );

  // ── Load ─────────────────────────────────────────
  useEffect(() => {
    if (!contentId) return;
    loadDocument(contentId);
  }, [contentId]);

  const loadDocument = async (id: string) => {
    setLoading(true);
    try {
      const [
        { data: blockData },
        { data: arrowData },
        { data: stageData },
        { data: itemData },
      ] = await Promise.all([
        supabase
          .from('content_blocks')
          .select('*')
          .eq('content_id', id)
          .order('canvas_row' as any, { ascending: true })
          .order('canvas_col' as any, { ascending: true }),
        supabase
          .from('canvas_arrows' as any)
          .select('*')
          .eq('content_id', id),
        supabase
          .from('canvas_stages' as any)
          .select('*')
          .eq('content_id', id)
          .order('stage_number', { ascending: true }),
        supabase
          .from('content_items')
          .select(
            'canvas_column_count, canvas_row_height,' +
            'canvas_layout_mode'
          )
          .eq('id', id)
          .single(),
      ]);

      if (blockData) {
        const adapted = (blockData as any[]).map(adaptDbBlock);
        const allDefault = adapted.length > 0 && adapted.every(
          b => b.position.col === 1
            && b.position.row === 1
            && b.position.colSpan === 12
        );

        if (allDefault) {
          const linearLayout = adapted
            .sort((a, b) => {
              const aPos = (a as any).position ?? 0;
              const bPos = (b as any).position ?? 0;
              return aPos - bPos;
            })
            .map((block, i) => ({
              ...block,
              position: {
                col: 1,
                row: i * 4 + 1,
                colSpan: 12,
                rowSpan: 3,
              },
            }));
          setBlocksRaw(linearLayout);
        } else {
          setBlocksRaw(adapted);
        }
      }
      if (arrowData) {
        setArrows((arrowData as any[]).map(adaptDbArrow));
      }
      if (stageData) {
        setStages((stageData as any[]).map(adaptDbStage));
      }
      if (itemData) {
        const item = itemData as any;
        setColumnCount(
          item.canvas_column_count ?? 12
        );
        setRowHeight(
          item.canvas_row_height ?? 32
        );
        setLayoutMode(
          item.canvas_layout_mode ?? 'freeform'
        );
      }
      // Clear undo/redo on load
      undoStack.current = [];
      redoStack.current = [];
      setCanUndo(false);
      setCanRedo(false);
    } finally {
      setLoading(false);
    }
  };

  // ── Block operations ──────────────────────────────
  const setBlocks = useCallback(
    (updater: CanvasBlock[] |
      ((prev: CanvasBlock[]) => CanvasBlock[])
    ) => {
      setBlocksRaw(updater);
      setIsDirty(true);
      scheduleAutosave();
    },
    []
  );

  const addBlock = useCallback(
    (type: string, position?: Partial<BlockPosition>) => {
      pushUndo();
      const nextRow = getNextRow(blocksRaw);
      const colSpan = position?.colSpan ?? 3;
      const centerCol = Math.max(1, Math.floor((columnCount - colSpan) / 2) + 1);
      const newBlock: CanvasBlock = {
        id: crypto.randomUUID(),
        type,
        textContent: '',
        subheading: null,
        position: {
          col: position?.col ?? centerCol,
          row: position?.row ?? nextRow,
          colSpan,
          rowSpan: position?.rowSpan ?? 5,
        },
        stageId: null,
        stageIndex: null,
        isLocked: false,
        lockType: 'none',
        mobileOrder: null,
        creatorAnnotation: null,
      };
      setBlocks(prev => [...prev, newBlock]);
      return newBlock.id;
    },
    [blocksRaw, setBlocks, pushUndo, columnCount]
  );

  const updateBlock = useCallback(
    (id: string, patch: Partial<CanvasBlock>) => {
      pushUndo();
      setBlocks(prev =>
        prev.map(b =>
          b.id === id ? { ...b, ...patch } : b
        )
      );
    },
    [setBlocks, pushUndo]
  );

  const deleteBlock = useCallback(
    (id: string) => {
      pushUndo();
      setBlocks(prev => prev.filter(b => b.id !== id));
      setArrows(prev =>
        prev.filter(
          a => a.fromBlockId !== id &&
            a.toBlockId !== id
        )
      );
      setStages(prev =>
        prev.map(s => ({
          ...s,
          blockIds: s.blockIds.filter(bid => bid !== id),
        }))
      );
    },
    [setBlocks, pushUndo]
  );

  const moveBlock = useCallback(
    (id: string, position: BlockPosition) => {
      const wouldCollide = blocksRaw.some(
        b => b.id !== id &&
          positionsOverlap(position, b.position)
      );
      if (wouldCollide) return false;
      pushUndo();
      updateBlock(id, { position });
      return true;
    },
    [blocksRaw, updateBlock, pushUndo]
  );

  // ── Duplicate block ───────────────────────────────
  const duplicateBlock = useCallback(
    (id: string) => {
      const source = blocksRaw.find(b => b.id === id);
      if (!source) return null;
      pushUndo();
      const newBlock: CanvasBlock = {
        ...source,
        id: crypto.randomUUID(),
        position: {
          ...source.position,
          row: source.position.row + source.position.rowSpan + 1,
        },
      };
      setBlocks(prev => [...prev, newBlock]);
      return newBlock.id;
    },
    [blocksRaw, setBlocks, pushUndo]
  );

  // ── Stage operations ──────────────────────────────
  const addStage = useCallback((title: string) => {
    pushUndo();
    const stageId = crypto.randomUUID();
    const stageNum = stages.length + 1;
    const newStage: CanvasStage = {
      id: stageId,
      contentId: contentId ?? '',
      stageNumber: stageNum,
      title,
      description: null,
      estimatedMinutes: null,
      difficulty: null,
      blockIds: [],
      colour: STAGE_COLOURS[
        stages.length % STAGE_COLOURS.length
      ],
    };
    setStages(prev => [...prev, newStage]);

    // Auto-create a tutorial_step block for this stage
    const nextRow = getNextRow(blocksRaw);
    const colSpan = 3;
    const centerCol = Math.max(1, Math.floor((columnCount - colSpan) / 2) + 1);
    const tutorialBlock: CanvasBlock = {
      id: crypto.randomUUID(),
      type: 'tutorial_step',
      textContent: '',
      subheading: `Stage ${stageNum}: ${title}`,
      position: {
        col: centerCol,
        row: nextRow,
        colSpan,
        rowSpan: 5,
      },
      stageId,
      stageIndex: null,
      isLocked: false,
      lockType: 'none',
      mobileOrder: null,
      creatorAnnotation: null,
      tutorialMedia: 'text',
      tutorialText: null,
    };
    setBlocks(prev => [...prev, tutorialBlock]);
    // Also assign block to stage
    setStages(prev =>
      prev.map(s =>
        s.id === stageId
          ? { ...s, blockIds: [...s.blockIds, tutorialBlock.id] }
          : s
      )
    );

    setIsDirty(true);
  }, [stages, contentId, pushUndo, blocksRaw, columnCount, setBlocks]);

  const deleteStage = useCallback((stageId: string) => {
    pushUndo();
    // Unassign blocks from this stage
    setBlocksRaw(prev => prev.map(b =>
      b.stageId === stageId ? { ...b, stageId: null } : b
    ));
    setStages(prev => prev.filter(s => s.id !== stageId));
    setIsDirty(true);
  }, [pushUndo]);

  const assignBlockToStage = useCallback(
    (blockId: string, stageId: string | null) => {
      pushUndo();
      setStages(prev =>
        prev.map(s => ({
          ...s,
          blockIds: s.blockIds.filter(
            id => id !== blockId
          ),
        }))
      );
      if (stageId) {
        setStages(prev =>
          prev.map(s =>
            s.id === stageId
              ? { ...s, blockIds: [...s.blockIds, blockId] }
              : s
          )
        );
      }
      updateBlock(blockId, { stageId });
      setIsDirty(true);
    },
    [updateBlock, pushUndo]
  );

  // ── Arrow operations ──────────────────────────────
  const addArrow = useCallback(
    (
      fromBlockId: string,
      toBlockId: string,
      fromEdge: BlockArrow['fromEdge'],
      toEdge: BlockArrow['toEdge'],
      arrowType: ArrowType = 'produces',
      waypoints?: { x: number; y: number }[]
    ) => {
      pushUndo();
      const meta = ARROW_TYPE_META[arrowType];
      const arrow: BlockArrow = {
        id: crypto.randomUUID(),
        fromBlockId,
        toBlockId,
        fromEdge,
        toEdge,
        label: meta.label,
        arrowType,
        color: meta.color,
        ...(waypoints ? { waypoints } : {}),
      };
      setArrows(prev => [...prev, arrow]);
      setIsDirty(true);
      return arrow.id;
    },
    [pushUndo]
  );

  // ── Save ──────────────────────────────────────────
  const scheduleAutosave = useCallback(() => {
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
    }
    autosaveTimer.current = setTimeout(() => {
      if (contentId) saveDocument(contentId, true);
    }, 2500);
  }, [contentId]);

  const saveDocument = async (
    id: string,
    silent = false
  ) => {
    for (const block of blocks) {
      await supabase
        .from('content_blocks')
        .upsert({
          id: block.id,
          content_id: id,
          block_type: block.type,
          text_content: block.textContent,
          subheading: block.subheading,
          canvas_col: block.position.col,
          canvas_row: block.position.row,
          canvas_col_span: block.position.colSpan,
          canvas_row_span: block.position.rowSpan,
          stage_id: block.stageId,
          stage_index: block.stageIndex,
          is_locked: block.isLocked,
          lock_type: block.lockType,
          mobile_order: block.mobileOrder,
          creator_annotation:
            block.creatorAnnotation,
          position: block.position.row * 100
            + block.position.col,
        } as any);
    }

    await supabase
      .from('canvas_arrows' as any)
      .delete()
      .eq('content_id', id);
    if (arrows.length > 0) {
      await supabase
        .from('canvas_arrows' as any)
        .insert(
          arrows.map(a => ({
            ...a,
            content_id: id,
          })) as any
        );
    }

    await supabase
      .from('canvas_stages' as any)
      .delete()
      .eq('content_id', id);
    if (stages.length > 0) {
      await supabase
        .from('canvas_stages' as any)
        .insert(
          stages.map(s => ({
            id: s.id,
            content_id: id,
            stage_number: s.stageNumber,
            title: s.title,
            description: s.description,
            estimated_minutes: s.estimatedMinutes,
            difficulty: s.difficulty,
            block_ids: s.blockIds,
            colour: s.colour,
          })) as any
        );
    }

    await supabase
      .from('content_items')
      .update({
        canvas_column_count: columnCount,
        canvas_row_height: rowHeight,
        canvas_layout_mode: layoutMode,
      } as any)
      .eq('id', id);

    setIsDirty(false);
  };

  // ── Restore snapshot ──────────────────────────────
  const restoreSnapshot = useCallback(
    (snapshot: any) => {
      if (snapshot.blocks) {
        setBlocksRaw(snapshot.blocks);
      }
      if (snapshot.arrows) {
        setArrows(snapshot.arrows);
      }
      if (snapshot.stages) {
        setStages(snapshot.stages);
      }
      if (snapshot.columnCount) {
        setColumnCount(snapshot.columnCount);
      }
      if (snapshot.layoutMode) {
        setLayoutMode(snapshot.layoutMode);
      }
      setIsDirty(true);
    },
    []
  );

  // ── Version snapshot ──────────────────────────────
  const saveVersion = async (
    id: string,
    label?: string
  ) => {
    const snapshot = {
      blocks,
      arrows,
      stages,
      columnCount,
      rowHeight,
      layoutMode,
    };
    const nextVersion = versionNumber + 1;
    await supabase
      .from('canvas_versions' as any)
      .insert({
        content_id: id,
        version_number: nextVersion,
        snapshot: snapshot as any,
        label: label ?? `v${nextVersion}`,
      } as any);
    setVersionNumber(nextVersion);
  };

  return {
    contentId,
    blocks,
    arrows, setArrows,
    stages, setStages,
    columnCount, setColumnCount,
    rowHeight, setRowHeight,
    layoutMode, setLayoutMode,
    isDirty,
    loading,
    versionNumber,
    addBlock,
    updateBlock,
    deleteBlock,
    moveBlock,
    duplicateBlock,
    addStage,
    deleteStage,
    assignBlockToStage,
    addArrow,
    saveDocument,
    saveVersion,
    restoreSnapshot,
    loadDocument,
    undo, redo, canUndo, canRedo,
  };
}

// ── Stage colour palette ──────────────────────────
const STAGE_COLOURS = [
  'rgba(232,87,26,0.06)',
  'rgba(46,196,182,0.06)',
  'rgba(124,58,237,0.06)',
  'rgba(59,130,246,0.06)',
  'rgba(245,158,11,0.06)',
  'rgba(34,197,94,0.06)',
];

// ── DB adapters ───────────────────────────────────
function adaptDbBlock(row: any): CanvasBlock {
  return {
    id: row.id,
    type: row.block_type ?? 'text',
    textContent: row.text_content ?? '',
    subheading: row.subheading ?? null,
    position: {
      col: row.canvas_col ?? 1,
      row: row.canvas_row ?? 1,
      colSpan: row.canvas_col_span ?? 12,
      rowSpan: row.canvas_row_span ?? 1,
    },
    stageId: row.stage_id ?? null,
    stageIndex: row.stage_index ?? null,
    isLocked: row.is_locked ?? false,
    lockType: row.lock_type ?? 'none',
    mobileOrder: row.mobile_order ?? null,
    creatorAnnotation:
      row.creator_annotation ?? null,
    ...row,
  };
}

function adaptDbArrow(row: any): BlockArrow {
  return {
    id: row.id,
    fromBlockId: row.from_block_id,
    toBlockId: row.to_block_id,
    fromEdge: row.from_edge,
    toEdge: row.to_edge,
    label: row.label ?? null,
    arrowType: row.arrow_type ?? 'produces',
    color: row.color ??
      ARROW_TYPE_META[
        (row.arrow_type as ArrowType) ?? 'produces'
      ].color,
  };
}

function adaptDbStage(row: any): CanvasStage {
  return {
    id: row.id,
    contentId: row.content_id,
    stageNumber: row.stage_number,
    title: row.title,
    description: row.description ?? null,
    estimatedMinutes: row.estimated_minutes ?? null,
    difficulty: row.difficulty ?? null,
    blockIds: row.block_ids ?? [],
    colour: row.colour ?? 'rgba(232,87,26,0.06)',
  };
}
