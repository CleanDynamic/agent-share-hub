import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';

/**
 * BlockRefNode
 *
 * React renderer for the `blockRef` inline TipTap node.
 * Renders a compact inline chip with a type-coloured dot and the
 * referenced block's title.
 *
 * Clicking is a no-op for now — scroll-to-block will be added in Series I.
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

interface BlockRefAttrs {
  blockId: string;
  blockTitle: string;
  blockType: string;
  stageId: string;
}

export function BlockRefNode({ node }: ReactNodeViewProps) {
  const attrs = node.attrs as BlockRefAttrs;
  const { blockTitle, blockType } = attrs;
  const dotColor = getDotColor(blockType);
  const label = blockTitle?.trim() || 'Untitled block';

  return (
    <NodeViewWrapper as="span" style={{ display: 'inline' }}>
      <span
        data-block-ref=""
        contentEditable={false}
        title={label}
        onClick={(e) => {
          // Placeholder: scroll-to-block will be wired up in Series I.
          e.preventDefault();
          e.stopPropagation();
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          verticalAlign: 'baseline',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 4,
          padding: '1px 8px',
          fontFamily: 'Inter, sans-serif',
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
