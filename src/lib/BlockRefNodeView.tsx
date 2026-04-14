import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';

export function BlockRefNodeView({ node }: NodeViewProps) {
  const { blockId, stageIndex, label } = node.attrs;

  const handleClick = () => {
    const el = document.getElementById(
      `canvas-block-${blockId}`
    );
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <NodeViewWrapper as="span">
      <span
        contentEditable={false}
        onClick={handleClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '1px 8px',
          borderRadius: 9999,
          background: 'rgba(232,87,26,0.12)',
          border: '1px solid rgba(232,87,26,0.25)',
          fontSize: 11,
          fontWeight: 700,
          color: '#E8571A',
          cursor: 'pointer',
          fontFamily: 'monospace',
          verticalAlign: 'baseline',
          transition: 'background 0.12s',
          userSelect: 'none',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background =
            'rgba(232,87,26,0.20)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background =
            'rgba(232,87,26,0.12)';
        }}
      >
        {stageIndex && (
          <span style={{ opacity: 0.7 }}>{stageIndex}</span>
        )}
        {label}
      </span>
    </NodeViewWrapper>
  );
}
