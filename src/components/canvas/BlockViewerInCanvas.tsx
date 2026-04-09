import type { CanvasBlock } from '@/lib/canvas-types';

interface BlockViewerInCanvasProps {
  block: CanvasBlock;
  postType: string;
}

export function BlockViewerInCanvas({
  block,
}: BlockViewerInCanvasProps) {
  return (
    <div style={{
      fontSize: 13,
      lineHeight: 1.6,
      color: 'rgba(255,255,255,0.75)',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }}>
      {block.textContent || (
        <span style={{ color: 'rgba(255,255,255,0.20)' }}>
          {block.type.replace(/_/g, ' ')}
        </span>
      )}
    </div>
  );
}
