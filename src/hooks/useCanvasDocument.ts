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
  const [rowHeight, setRowHeight] = useState(32);
  const [layoutMode, setLayoutMode] =
    useState<'freeform' | 'pipeline'>('freeform');
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [versionNumber, setVersionNumber] =
    useState(1);
  const autosaveTimer = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

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
        setBlocksRaw((blockData as any[]).map(adaptDbBlock));
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
      const nextRow = getNextRow(blocksRaw);
      const newBlock: CanvasBlock = {
        id: crypto.randomUUID(),
        type,
        textContent: '',
        subheading: null,
        position: {
          col: position?.col ?? 1,
          row: position?.row ?? nextRow,
          colSpan: position?.colSpan ?? 12,
          rowSpan: position?.rowSpan ?? 1,
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
    [blocksRaw, setBlocks]
  );

  const updateBlock = useCallback(
    (id: string, patch: Partial<CanvasBlock>) => {
      setBlocks(prev =>
        prev.map(b =>
          b.id === id ? { ...b, ...patch } : b
        )
      );
    },
    [setBlocks]
  );

  const deleteBlock = useCallback(
    (id: string) => {
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
    [setBlocks]
  );

  const moveBlock = useCallback(
    (id: string, position: BlockPosition) => {
      const wouldCollide = blocksRaw.some(
        b => b.id !== id &&
          positionsOverlap(position, b.position)
      );
      if (wouldCollide) return false;
      updateBlock(id, { position });
      return true;
    },
    [blocksRaw, updateBlock]
  );

  // ── Stage operations ──────────────────────────────
  const addStage = useCallback((title: string) => {
    const newStage: CanvasStage = {
      id: crypto.randomUUID(),
      contentId: contentId ?? '',
      stageNumber: stages.length + 1,
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
    setIsDirty(true);
  }, [stages, contentId]);

  const assignBlockToStage = useCallback(
    (blockId: string, stageId: string | null) => {
      // Remove from all stages first
      setStages(prev =>
        prev.map(s => ({
          ...s,
          blockIds: s.blockIds.filter(
            id => id !== blockId
          ),
        }))
      );
      // Add to target stage
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
    [updateBlock]
  );

  // ── Arrow operations ──────────────────────────────
  const addArrow = useCallback(
    (
      fromBlockId: string,
      toBlockId: string,
      fromEdge: BlockArrow['fromEdge'],
      toEdge: BlockArrow['toEdge'],
      arrowType: ArrowType = 'produces'
    ) => {
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
      };
      setArrows(prev => [...prev, arrow]);
      setIsDirty(true);
      return arrow.id;
    },
    []
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
    // Upsert all blocks with canvas positions
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

    // Rebuild arrows
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

    // Rebuild stages
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

    // Update content_items canvas config
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
    blocks,
    arrows, setArrows,
    stages, setStages,
    columnCount, setColumnCount,
    rowHeight, setRowHeight,
    layoutMode, setLayoutMode,
    isDirty,
    loading,
    addBlock,
    updateBlock,
    deleteBlock,
    moveBlock,
    addStage,
    assignBlockToStage,
    addArrow,
    saveDocument,
    saveVersion,
    loadDocument,
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
    // Spread all other DB columns
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
