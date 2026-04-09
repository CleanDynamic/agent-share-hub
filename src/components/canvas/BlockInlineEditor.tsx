import type { CanvasBlock } from '@/lib/canvas-types';

interface BlockInlineEditorProps {
  block: CanvasBlock;
  onChange: (patch: Partial<CanvasBlock>) => void;
}

export function BlockInlineEditor({
  block,
  onChange,
}: BlockInlineEditorProps) {
  return (
    <div style={{ width: '100%' }}>
      <textarea
        value={block.textContent ?? ''}
        onChange={e => onChange({ textContent: e.target.value })}
        placeholder={`${block.type.replace(/_/g, ' ')}…`}
        rows={4}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          resize: 'vertical',
          fontSize: 13,
          lineHeight: 1.6,
          color: 'rgba(255,255,255,0.80)',
          fontFamily: 'Inter, sans-serif',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}
