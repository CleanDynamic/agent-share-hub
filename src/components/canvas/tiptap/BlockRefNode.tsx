import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { useCallback } from 'react';

/**
 * BlockRefNode
 *
 * React renderer for the `blockRef` inline TipTap node.
 * Renders a compact inline chip with a type-coloured dot and the
 * referenced block's title.
 *
 * Clicking scrolls to the target block inside its stage grid and
 * briefly highlights it with a type-coloured box-shadow.
 */

// Block type → dot colour (mirrors canvas block colour palette)
const BLOCK_TYPE_DOT_COLOR: Record<string, string> = {
  text: 'rgba(255,255,255,0.50)',
  prompt: '#E8571A',
  code: '#16A34A',
  result: '#7C3AED',
};

function getDotColor(type: string): string {
  return BLOCK_TYPE_DOT_COLOR[type] ?? BLOCK_TYPE_DOT_COLOR.text;
}

/** Convert a dot colour to an rgba string at 0.4 opacity for the highlight ring. */
function highlightShadow(dotColor: string): string {
  // Handle #hex colours
  if (dotColor.startsWith('#')) {
    const hex = dotColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `0 0 0 2px rgba(${r},${g},${b},0.4)`;
  }
  // Handle rgba(...) colours — replace the alpha
  const rgbaMatch = dotColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbaMatch) {
    return `0 0 0 2px rgba(${rgbaMatch[1]},${rgbaMatch[2]},${rgbaMatch[3]},0.4)`;
  }
  return `0 0 0 2px rgba(255,255,255,0.4)`;
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

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Apply temporary highlight ring
    const shadow = highlightShadow(dotColor);
    const prevShadow = el.style.boxShadow;
    const prevTransition = el.style.transition;

    el.style.boxShadow = shadow;
    el.style.transition = 'box-shadow 0.15s ease-in';

    // Fade out after a short pause
    const timer = setTimeout(() => {
      el.style.transition = 'box-shadow 1.5s ease-out';
      el.style.boxShadow = prevShadow || 'none';

      // Clean up inline styles after animation completes
      const cleanup = setTimeout(() => {
        el.style.boxShadow = prevShadow;
        el.style.transition = prevTransition;
      }, 1600);

      // Store cleanup timer on element for GC
      (el as any).__blockRefCleanup = cleanup;
    }, 400);

    // Cancel any previous highlight animation on this element
    if ((el as any).__blockRefTimer) clearTimeout((el as any).__blockRefTimer);
    if ((el as any).__blockRefCleanup) clearTimeout((el as any).__blockRefCleanup);
    (el as any).__blockRefTimer = timer;
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
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 4,
          padding: '1px 8px',
          fontFamily: 'Figtree, sans-serif',
          fontSize: 12,
          fontWeight: 500,
          lineHeight: 1.4,
          color: 'rgba(255,255,255,0.82)',
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
