import { NodeViewWrapper } from '@tiptap/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StageThumbnail, type ThumbnailBlock } from './stage/StageThumbnail';
import { TemplatePicker } from './stage/TemplatePicker';
import { useDocumentStore } from '@/lib/documentStore';
import { toggleStageMissing } from '@/lib/bountyMissing';

interface StageGridNodeProps {
  node: any;
  updateAttributes: (attrs: Record<string, any>) => void;
  extension: any;
  editor: any;
  selected: boolean;
  getPos?: () => number | undefined;
}

export function StageGridNode({ node, updateAttributes, editor }: StageGridNodeProps) {
  const stageId = node.attrs.stageId as string | null;
  const fallbackTitle = (node.attrs.stageTitle as string) ?? '';
  const openTemplatesOnMount = Boolean(node.attrs.openTemplatesOnMount);

  // Pull this stage's record from the document store (single source of truth)
  const stageRecord = useDocumentStore((s) => (stageId ? s.stages[stageId] : undefined));
  const blocksMap = useDocumentStore((s) => s.blocks);
  const stagesMap = useDocumentStore((s) => s.stages);
  const connectionsMap = useDocumentStore((s) => s.connections);
  const updateStage = useDocumentStore((s) => s.updateStage);
  const openStageAction = useDocumentStore((s) => s.openStage);
  const editorMode = useDocumentStore((s) => s.editorMode);
  const isBounty = editorMode === 'bounty';

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerWithEmpty, setPickerWithEmpty] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);

  // Auto-open picker when inserted via the slash menu
  useEffect(() => {
    if (openTemplatesOnMount) {
      setPickerWithEmpty(true);
      setPickerOpen(true);
      try { updateAttributes({ openTemplatesOnMount: false }); } catch (_) { /* noop */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTemplatesOnMount]);

  // Live data from the store
  const stageName = stageRecord?.stage_name ?? fallbackTitle ?? '';

  // Stage number = order_in_document + 1, fall back to insertion order
  const stageNumber = useMemo(() => {
    if (!stageId) return 1;
    if (stageRecord?.order_in_document != null) return stageRecord.order_in_document + 1;
    const ordered = Object.values(stagesMap).sort(
      (a, b) => (a.order_in_document ?? 0) - (b.order_in_document ?? 0),
    );
    const idx = ordered.findIndex((s) => s.id === stageId);
    return idx >= 0 ? idx + 1 : 1;
  }, [stageId, stageRecord?.order_in_document, stagesMap]);

  // Blocks belonging to this stage (in z_index / creation order)
  const stageBlocks = useMemo(() => {
    if (!stageId) return [] as ThumbnailBlock[];
    const list = Object.values(blocksMap)
      .filter((b) => b.stage_id === stageId)
      .sort((a, b) => {
        const za = (a.z_index ?? 0) - (b.z_index ?? 0);
        if (za !== 0) return za;
        return (a.created_at ?? '').localeCompare(b.created_at ?? '');
      });
    return list.map((b) => ({
      id: b.id,
      type: b.type as ThumbnailBlock['type'],
      name: b.name,
      position_x: b.position_x,
      position_y: b.position_y,
      width: b.width,
      height: b.height,
    }));
  }, [blocksMap, stageId]);

  // Connections that touch any block belonging to this stage
  const stageConnections = useMemo(() => {
    if (!stageId) return [];
    const blockIds = new Set(
      Object.values(blocksMap).filter((b) => b.stage_id === stageId).map((b) => b.id),
    );
    return Object.values(connectionsMap).filter(
      (c) => blockIds.has(c.from_block_id) || blockIds.has(c.to_block_id),
    );
  }, [connectionsMap, blocksMap, stageId]);

  const handleRename = useCallback(
    (name: string) => {
      updateAttributes({ stageTitle: name });
      if (stageId) updateStage(stageId, { stage_name: name });
    },
    [stageId, updateAttributes, updateStage],
  );

  // ── Open lifecycle ────────────────────────────────────────
  // The thumbnail stays mounted in document flow; the middle-panel
  // host (Upload.tsx) reads `stageOpen` from the document store and
  // swaps in <StageFullscreen /> when something is open. Closing is
  // owned by StageFullscreen itself.
  const handleOpen = useCallback(() => {
    if (!stageId) return;
    // Flush the latest article JSON to the parent cache BEFORE the editor
    // unmounts; otherwise the inserted Stage Grid node would be lost when
    // the user returns to the article view.
    try {
      const storage = (editor?.storage as any);
      const publish = storage?.articleEditor?.publishLatest;
      if (typeof publish === 'function') publish();
    } catch (_) { /* noop */ }
    openStageAction(stageId);
  }, [stageId, openStageAction, editor]);

  // ── Render ────────────────────────────────────────────────
  return (
    <NodeViewWrapper data-stage-grid="" data-stage-id={stageId ?? undefined}>
      <div ref={wrapperRef}>
        <StageThumbnail
          stageNumber={stageNumber}
          stageName={stageName}
          blocks={stageBlocks}
          connections={stageConnections}
          onOpen={handleOpen}
          onRename={editor?.isEditable ? handleRename : undefined}
          isBounty={isBounty}
          isMissing={Boolean(stageRecord?.is_missing)}
          missingDescription={stageRecord?.missing_description ?? null}
          onToggleMissing={
            isBounty && stageId && editor?.isEditable
              ? () => { toggleStageMissing(stageId); }
              : undefined
          }
        />
      </div>
      {stageId ? (
        <TemplatePicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          stageId={stageId}
          showEmptyOption={pickerWithEmpty}
        />
      ) : null}
    </NodeViewWrapper>
  );
}
