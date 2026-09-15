import * as React from 'react';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { useDocumentStore } from '@/lib/documentStore';
import { pulseRing } from '@/lib/theme/motion';
import { scrollBehavior } from '@/lib/theme/motion';

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
  text: 'var(--recess)',
  heading: 'var(--recess)',
  prompt: 'var(--action)',
  code: 'var(--cat-configuration)',
  result: 'var(--cat-agents)',
  agent: 'var(--cat-data)',
  model: 'var(--cat-data)',
  tool: 'var(--cat-configuration)',
  note: 'var(--cat-narrative)',
  resource: 'var(--cat-artefact)',
  workflow: 'var(--cat-media)',
  compare: 'var(--cat-evidence)',
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

const PULSE_COLOR = 'color-mix(in srgb, var(--action) 20%, transparent)';

function pulseBlock(blockId: string) {
  const el =
    document.getElementById(`canvas-block-${blockId}`) ||
    document.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`);
  if (!el) return;

  el.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });

  /* BG-P32. Was a hand-rolled box-shadow pulse easing `ease-in` on the way
     out — two rules the theme forbids, and the third of four copies of the
     same effect in this codebase. `pulseRing` is the one copy now. */
  pulseRing(el, { colour: PULSE_COLOR });
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
            background: 'color-mix(in srgb, var(--cat-breakage) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--cat-breakage) 30%, transparent)',
            borderRadius: 4,
            padding: '1px 8px',
            fontFamily: 'Figtree, sans-serif',
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1.4,
            color: 'color-mix(in srgb, var(--cat-breakage) 85%, transparent)',
            textDecoration: 'line-through',
            cursor: 'help',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            outline: selected ? '2px solid var(--line)' : 'none',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: 'color-mix(in srgb, var(--cat-breakage) 80%, transparent)',
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
          background: 'var(--recess)',
          border: '1px solid var(--line)',
          borderRadius: 4,
          padding: '1px 8px',
          fontFamily: 'Figtree, sans-serif',
          fontSize: 12,
          fontWeight: 500,
          lineHeight: 1.4,
          color: 'var(--text)',
          cursor: 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          outline: selected ? '2px solid var(--line)' : 'none',
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
