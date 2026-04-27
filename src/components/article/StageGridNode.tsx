import { NodeViewWrapper } from '@tiptap/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { StageGridFrame } from './stage/StageGridFrame';
import { StageCanvas } from './stage/StageCanvas';
import { StageThumbnail, type ThumbnailBlock } from './stage/StageThumbnail';
import { TemplatePicker } from './stage/TemplatePicker';
import { useDocumentStore } from '@/lib/documentStore';
import { eventBus } from '@/lib/eventBus';

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
  const connectionsMap = useDocumentStore((s) => s.connections);
  const updateStage = useDocumentStore((s) => s.updateStage);
  const isOpen = useDocumentStore((s) => (stageId ? Boolean(s.stageOpen[stageId]) : false));
  const openStageAction = useDocumentStore((s) => s.openStage);
  const closeStageAction = useDocumentStore((s) => s.closeStage);

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

  const blockCount = stageBlocks.length;

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

  const handleQuickInsert = useCallback(() => { /* coming in Phase 4 */ }, []);
  const handleExpand = useCallback(() => { /* coming in Phase 4 */ }, []);

  const handleOpenTemplates = useCallback(() => {
    setPickerWithEmpty(false);
    setPickerOpen(true);
  }, []);

  // ── Open / close lifecycle ────────────────────────────────
  const handleOpen = useCallback(() => {
    if (!stageId) return;
    openStageAction(stageId);
    eventBus.emit('stage:opened', { stageId });
  }, [stageId, openStageAction]);

  const handleClose = useCallback(() => {
    if (!stageId) return;
    closeStageAction(stageId);
    eventBus.emit('stage:closed', { stageId });
    // Scroll the thumbnail back into view once layout has settled.
    setTimeout(() => {
      const el = wrapperRef.current;
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  }, [stageId, closeStageAction]);

  // Escape closes whichever stage is open (this instance only handles itself).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, handleClose]);

  // Ensure 'stage:closed' is emitted if the node is unmounted (e.g. deleted)
  // while open, so the editor host can restore its header strip.
  useEffect(() => {
    return () => {
      if (isOpen && stageId) {
        eventBus.emit('stage:closed', { stageId });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render ────────────────────────────────────────────────
  if (!isOpen) {
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

  // Full mode — fill the entire middle panel.
  return (
    <NodeViewWrapper data-stage-grid="" data-stage-id={stageId ?? undefined} data-stage-open="true">
      {/* Placeholder kept in document flow so scroll-on-close lands here. */}
      <div ref={wrapperRef} aria-hidden="true" style={{ height: 1, margin: 0, padding: 0 }} />

      <div
        data-stage-fullscreen-portal=""
        contentEditable={false}
        style={{
          position: 'fixed',
          // The middle panel of the editor lives between the 200px left nav
          // and the workspace tools panel on the right. The host page uses
          // `data-editor-middle-panel` for these bounds; we read its rect at
          // runtime via getBoundingClientRect through the wrapper ref below.
          inset: 0,
          zIndex: 40,
          pointerEvents: 'none',
        }}
      >
        <FullStageOverlay
          onBack={handleClose}
          stageNumber={stageNumber}
          stageName={stageName}
          blockCount={blockCount}
          widthMode={widthMode}
          height={height}
          stageId={stageId}
          onRename={handleRename}
          onResize={handleResize}
          onDelete={editor?.isEditable ? handleDelete : undefined}
          onExpand={handleExpand}
          onQuickInsert={handleQuickInsert}
          onOpenTemplates={editor?.isEditable && stageId ? handleOpenTemplates : undefined}
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

interface FullStageOverlayProps {
  onBack: () => void;
  stageNumber: number;
  stageName: string;
  blockCount: number;
  widthMode: 'narrow' | 'wide' | 'full';
  height: number;
  stageId: string | null;
  onRename: (n: string) => void;
  onResize: (h: number) => void;
  onDelete?: () => void;
  onExpand?: () => void;
  onQuickInsert?: () => void;
  onOpenTemplates?: () => void;
}

function FullStageOverlay({
  onBack,
  stageNumber,
  stageName,
  blockCount,
  widthMode,
  height,
  stageId,
  onRename,
  onResize,
  onDelete,
  onExpand,
  onQuickInsert,
  onOpenTemplates,
}: FullStageOverlayProps) {
  // Compute bounds of the host's middle panel so the overlay sits exactly
  // between the left nav and the right workspace panel.
  const [bounds, setBounds] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  useEffect(() => {
    const compute = () => {
      const host =
        (document.querySelector('[data-editor-middle-panel]') as HTMLElement | null) ??
        // Sensible fallback: use the closest scroll container of the editor.
        (document.querySelector('[data-stage-grid]')?.closest('div[style*="overflow"]') as HTMLElement | null);
      if (host) {
        const r = host.getBoundingClientRect();
        setBounds({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else {
        setBounds({ top: 0, left: 0, width: window.innerWidth, height: window.innerHeight });
      }
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, []);

  if (!bounds) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: bounds.top,
        left: bounds.left,
        width: bounds.width,
        height: bounds.height,
        background: 'rgba(15,15,20,0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: 'auto',
        overflow: 'hidden',
      }}
    >
      {/* Back-to-article bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 16px 8px',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            background: 'rgba(255,255,255,0.04)',
            border: '0.5px solid rgba(255,255,255,0.06)',
            borderRadius: 6,
            color: 'rgba(255,255,255,0.75)',
            fontFamily: 'Inter, sans-serif',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 120ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
          }}
          title="Back to article (Esc)"
        >
          <ArrowLeft size={14} strokeWidth={1.8} />
          Back to article
        </button>
      </div>

      {/* Stage frame fills the rest of the panel */}
      <div style={{ flex: 1, minHeight: 0, padding: '0 16px 16px', display: 'flex' }}>
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>
          <StageGridFrame
            stageNumber={stageNumber}
            stageName={stageName}
            blockCount={blockCount}
            widthMode={widthMode}
            height={height}
            onRename={onRename}
            onResize={onResize}
            onDelete={onDelete}
            onExpand={onExpand}
            onQuickInsert={onQuickInsert}
            onOpenTemplates={onOpenTemplates}
          >
            {stageId ? <StageCanvas stageId={stageId} /> : null}
          </StageGridFrame>
        </div>
      </div>
    </div>
  );
}
