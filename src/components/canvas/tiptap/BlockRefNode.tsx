import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { useCallback } from 'react';
import { pulseRing } from '@/lib/theme/motion';
import { scrollBehavior } from '@/lib/theme/motion';

/**
 * BlockRefNode
 *
 * React renderer for the `blockRef` inline TipTap node.
 * Renders a compact inline chip with a type-coloured dot and the
 * referenced block's title.
 *
 * Clicking scrolls to the target block inside its stage grid and
 * briefly rings it in the block type's own colour.
 */

// Block type → dot colour (mirrors canvas block colour palette)
const BLOCK_TYPE_DOT_COLOR: Record<string, string> = {
  text: 'var(--recess)',
  prompt: 'var(--action)',
  code: 'var(--cat-configuration)',
  result: 'var(--cat-agents)',
};

function getDotColor(type: string): string {
  return BLOCK_TYPE_DOT_COLOR[type] ?? BLOCK_TYPE_DOT_COLOR.text;
}

interface BlockRefAttrs {
  blockId: string;
  blockTitle: string;
  blockType: string;
  stageId: string;
}

export function BlockRefNode({ node }: ReactNodeViewProps) {
  const attrs = node.attrs as BlockRefAttrs;
  const { blockId, blockTitle, blockType } = attrs;
  const dotColor = getDotColor(blockType);
  const label = blockTitle?.trim() || 'Untitled block';

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const el = document.getElementById(`canvas-block-${blockId}`);
    if (!el) return;

    el.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });

    /* BG-P32. Was a hand-rolled box-shadow pulse — an uncompositable property
       eased `ease-in` on the way in, both forbidden by the theme, and the
       second of four copies of the same effect. `pulseRing` is the one copy
       now, and it returns its own cancel rather than parking two timer ids on
       the DOM node to be cleared by the next click. */
    (el as unknown as { __blockRefCancel?: () => void }).__blockRefCancel?.();
    (el as unknown as { __blockRefCancel?: () => void }).__blockRefCancel = pulseRing(el, {
      colour: dotColor,
    });
  }, [blockId, dotColor]);

  return (
    <NodeViewWrapper as="span" style={{ display: 'inline' }}>
      <span
        data-block-ref=""
        contentEditable={false}
        title={label}
        onClick={handleClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
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
        <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
      </span>
    </NodeViewWrapper>
  );
}
