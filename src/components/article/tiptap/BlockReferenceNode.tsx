import * as React from 'react';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { useDocumentStore } from '@/lib/documentStore';

/**
 * BlockReferenceNode
 *
 * Inline chip for the `blockReference` TipTap node. Subscribes to the
 * referenced block via documentStore so the displayed name updates
 * live. If the block is missing/deleted, renders a strike-through error
 * chip.
 *
 * Click → scroll to the block in its parent stage (expanding the stage
 * if needed) and pulse the block briefly.
 */

const BLOCK_TYPE_DOT_COLOR: Record<string, string> = {
  text: 'rgba(255,255,255,0.50)',
  heading: 'rgba(255,255,255,0.65)',
  prompt: '#E8571A',
  code: '#16A34A',
  result: '#7C3AED',
  agent: '#3B82F6',
  model: '#06B6D4',
  tool: '#F59E0B',
  note: '#F5C518',
  resource: '#A855F7',
  workflow: '#EC4899',
  compare: '#22D3EE',
};

function getDotColor(type: string): string {
  return BLOCK_TYPE_DOT_COLOR[type] ?? BLOCK_TYPE_DOT_COLOR.text;
}

interface BlockRefAttrs {
  blockId: string;
  blockName: string;
  blockType: string;
  stageId: string;
}

const PULSE_COLOR = 'rgba(232,87,26,0.20)';

function pulseBlock(blockId: string) {
  const el =
    document.getElementById(`canvas-block-${blockId}`) ||
    document.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`);
  if (!el) return;

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const prevShadow = el.style.boxShadow;
  const prevTransition = el.style.transition;

  el.style.transition = 'box-shadow 120ms ease-out';
  el.style.boxShadow = `0 0 0 4px ${PULSE_COLOR}`;

  window.setTimeout(() => {
    el.style.transition = 'box-shadow 480ms ease-in';
    el.style.boxShadow = prevShadow || 'none';
    window.setTimeout(() => {
      el.style.transition = prevTransition;
    }, 520);
  }, 600);
}

function expandStageIfCollapsed(stageId: string) {
  if (!stageId) return;
  // Stage collapse state lives in the document store; if a "collapsed"
  // flag exists, flip it. Otherwise this is a no-op.
  try {
    const state = useDocumentStore.getState() as unknown as {
      stages: Record<string, { collapsed?: boolean }>;
      updateStage?: (id: string, patch: Record<string, unknown>) => void;
    };
    const stage = state.stages?.[stageId];
    if (stage?.collapsed && state.updateStage) {
      state.updateStage(stageId, { collapsed: false });
    }
  } catch {
    /* ignore */
  }
}

export function BlockReferenceNode({ node, selected }: ReactNodeViewProps) {
  const attrs = node.attrs as BlockRefAttrs;
  const { blockId, blockType, stageId } = attrs;

  // Subscribe to the live block (so renames update the chip)
  const liveBlock = useDocumentStore((s) => s.blocks[blockId]);
  const liveStage = useDocumentStore((s) =>
    liveBlock ? s.stages[liveBlock.stage_id] : s.stages[stageId],
  );

  const exists = !!liveBlock;
  const liveName =
    liveBlock?.name?.trim() ||
    (liveBlock?.properties as Record<string, unknown> | undefined)?.title?.toString().trim() ||
    attrs.blockName?.trim() ||
    'Untitled block';
  const dotColor = getDotColor(liveBlock?.type ?? blockType);
  const stageName = liveStage?.stage_name ?? '';

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!exists) return;
    if (liveBlock) expandStageIfCollapsed(liveBlock.stage_id);
    pulseBlock(liveBlock?.id ?? blockId);
  };

  if (!exists) {
    return (
      <NodeViewWrapper as="span" style={{ display: 'inline' }}>
        <span
          data-block-reference=""
          data-block-id={blockId}
          contentEditable={false}
          title="Referenced block no longer exists."
          aria-label="Missing block reference"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            verticalAlign: 'baseline',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.30)',
            borderRadius: 4,
            padding: '1px 8px',
            fontFamily: 'Figtree, sans-serif',
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1.4,
            color: 'rgba(239, 68, 68, 0.85)',
            textDecoration: 'line-through',
            cursor: 'help',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            outline: selected ? '2px solid rgba(255,255,255,0.25)' : 'none',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.8)',
              flexShrink: 0,
              display: 'inline-block',
            }}
          />
          {attrs.blockName?.trim() || 'Untitled block'}
        </span>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="span" style={{ display: 'inline' }}>
      <span
        data-block-reference=""
        data-block-id={blockId}
        contentEditable={false}
        title={stageName ? `${liveName} — ${stageName}` : liveName}
        onClick={handleClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          verticalAlign: 'baseline',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 4,
          padding: '1px 8px',
          fontFamily: 'Figtree, sans-serif',
          fontSize: 12,
          fontWeight: 500,
          lineHeight: 1.4,
          color: 'rgba(255,255,255,0.85)',
          cursor: 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          outline: selected ? '2px solid rgba(255,255,255,0.25)' : 'none',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: dotColor,
            flexShrink: 0,
            display: 'inline-block',
          }}
        />
        {liveName}
      </span>
    </NodeViewWrapper>
  );
}
