// Block type data is now consumed by CanvasToolbar dropdown.
// This component is kept minimal — just a spacer at the bottom of the canvas.

import { getNextRow } from '@/lib/canvas-utils';
import type { CanvasBlock } from '@/lib/canvas-types';

interface CanvasInsertZoneProps {
  blocks: CanvasBlock[];
  colWidth: number;
  rowHeight: number;
  columnCount: number;
  onInsert: (type: string, position: any) => void;
}

export function CanvasInsertZone({ blocks, rowHeight }: CanvasInsertZoneProps) {
  const nextRow = getNextRow(blocks);
  const y = (nextRow - 1) * rowHeight + 16;

  // Just render a subtle spacer so the canvas has room at the bottom
  return (
    <div style={{
      position: 'absolute',
      left: 0, right: 0,
      top: y,
      height: 80,
      pointerEvents: 'none',
    }} />
  );
}
