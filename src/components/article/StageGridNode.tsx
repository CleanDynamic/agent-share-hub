import { NodeViewWrapper } from '@tiptap/react';
import { useCallback, useMemo } from 'react';
import { StageGridFrame } from './stage/StageGridFrame';
import { StageCanvas } from './stage/StageCanvas';
import { useTemplatePickerStore } from './stage/TemplatePicker';
import { useDocumentStore } from '@/lib/documentStore';
import { applyTemplateToStage } from '@/lib/stageTemplates';

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
  const fallbackTitle = (node.attrs.stageTitle as string) ?? 'Untitled stage';
  const persistedHeight = (node.attrs.height as number | null) ?? 400;

  // Pull this stage's record from the document store (single source of truth)
  const stageRecord = useDocumentStore((s) => (stageId ? s.stages[stageId] : undefined));
  const blocksMap = useDocumentStore((s) => s.blocks);
  const stagesMap = useDocumentStore((s) => s.stages);
  const updateStage = useDocumentStore((s) => s.updateStage);
  const addBlock = useDocumentStore((s) => s.addBlock);
  const addConnection = useDocumentStore((s) => s.addConnection);
  const openTemplatePicker = useTemplatePickerStore((s) => s.open);

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
      const clamped = Math.round(Math.max(280, Math.min(800, newHeight)));
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
    if (!stageId) return;
    openTemplatePicker({
      showEmpty: false,
      onSelectTemplate: (template) => {
        applyTemplateToStage(stageId, template, { addBlock, addConnection });
      },
    });
  }, [stageId, openTemplatePicker, addBlock, addConnection]);

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
        onOpenTemplates={handleOpenTemplates}
      >
        {stageId ? <StageCanvas stageId={stageId} /> : null}
      </StageGridFrame>
    </NodeViewWrapper>
  );
}
