import { NodeViewWrapper } from '@tiptap/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StageGridFrame } from './stage/StageGridFrame';
import { StageCanvas } from './stage/StageCanvas';
import { TemplatePicker } from './stage/TemplatePicker';
import { useDocumentStore } from '@/lib/documentStore';

interface StageGridNodeProps {
  node: any;
  updateAttributes: (attrs: Record<string, any>) => void;
  extension: any;
  editor: any;
  selected: boolean;
  getPos?: () => number | undefined;
}

export function StageGridNode({ node, updateAttributes, editor, getPos }: StageGridNodeProps) {
  const stageId = node.attrs.stageId as string | null;
  const fallbackTitle = (node.attrs.stageTitle as string) ?? '';
  const persistedHeight = (node.attrs.height as number | null) ?? 280;
  const openTemplatesOnMount = Boolean(node.attrs.openTemplatesOnMount);

  // Pull this stage's record from the document store (single source of truth)
  const stageRecord = useDocumentStore((s) => (stageId ? s.stages[stageId] : undefined));
  const blocksMap = useDocumentStore((s) => s.blocks);
  const stagesMap = useDocumentStore((s) => s.stages);
  const updateStage = useDocumentStore((s) => s.updateStage);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerWithEmpty, setPickerWithEmpty] = useState(false);

  // Auto-open picker when inserted via the slash menu
  useEffect(() => {
    if (openTemplatesOnMount) {
      setPickerWithEmpty(true);
      setPickerOpen(true);
      // Clear the transient flag so it doesn't reopen on remount.
      try { updateAttributes({ openTemplatesOnMount: false }); } catch (_) { /* noop */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTemplatesOnMount]);

  // Live data from the store (falls back to TipTap attrs while the stage record
  // hasn't been hydrated yet)
  const stageName = stageRecord?.stage_name ?? fallbackTitle;
  const widthMode = stageRecord?.width_mode ?? 'wide';
  const height = stageRecord?.height ?? persistedHeight;

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

  const blockCount = useMemo(() => {
    if (!stageId) return 0;
    let count = 0;
    for (const b of Object.values(blocksMap)) {
      if (b.stage_id === stageId) count++;
    }
    return count;
  }, [blocksMap, stageId]);

  const handleRename = useCallback(
    (name: string) => {
      updateAttributes({ stageTitle: name });
      if (stageId) updateStage(stageId, { stage_name: name });
    },
    [stageId, updateAttributes, updateStage],
  );

  const handleResize = useCallback(
    (newHeight: number) => {
      const clamped = Math.round(Math.max(200, Math.min(600, newHeight)));
      updateAttributes({ height: clamped });
      if (stageId) updateStage(stageId, { height: clamped });
    },
    [stageId, updateAttributes, updateStage],
  );

  const handleDelete = useCallback(() => {
    if (!editor || typeof getPos !== 'function') return;
    const pos = getPos();
    if (typeof pos !== 'number') return;
    editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
  }, [editor, getPos, node]);

  // Phase-4 placeholders
  const handleQuickInsert = useCallback(() => {
    /* coming in Phase 4 */
  }, []);

  const handleExpand = useCallback(() => {
    /* coming in Phase 4 */
  }, []);

  const handleOpenTemplates = useCallback(() => {
    setPickerWithEmpty(false);
    setPickerOpen(true);
  }, []);

  return (
    <NodeViewWrapper data-stage-grid="" data-stage-id={stageId ?? undefined}>
      <StageGridFrame
        stageNumber={stageNumber}
        stageName={stageName}
        blockCount={blockCount}
        widthMode={widthMode}
        height={height}
        onRename={handleRename}
        onResize={handleResize}
        onDelete={editor?.isEditable ? handleDelete : undefined}
        onExpand={handleExpand}
        onQuickInsert={handleQuickInsert}
        onOpenTemplates={editor?.isEditable && stageId ? handleOpenTemplates : undefined}
      >
        {stageId ? <StageCanvas stageId={stageId} /> : null}
      </StageGridFrame>
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
