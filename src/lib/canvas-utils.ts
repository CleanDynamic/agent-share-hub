import type {
  BlockPosition, CanvasBlock, CanvasStage
} from './canvas-types';

// Snap raw pixel coords to nearest grid cell
export function snapToGrid(
  pixelX: number,
  pixelY: number,
  colWidth: number,
  rowHeight: number
): { col: number; row: number } {
  return {
    col: Math.max(1, Math.round(pixelX / colWidth) + 1),
    row: Math.max(1, Math.round(pixelY / rowHeight) + 1),
  };
}

// Grid position → pixel rect
export function gridToPixels(
  position: BlockPosition,
  colWidth: number,
  rowHeight: number
): { x: number; y: number; w: number; h: number } {
  return {
    x: (position.col - 1) * colWidth,
    y: (position.row - 1) * rowHeight,
    w: position.colSpan * colWidth,
    h: position.rowSpan * rowHeight,
  };
}

// Collision detection between two positions
export function positionsOverlap(
  a: BlockPosition,
  b: BlockPosition
): boolean {
  return (
    a.col < b.col + b.colSpan &&
    a.col + a.colSpan > b.col &&
    a.row < b.row + b.rowSpan &&
    a.row + a.rowSpan > b.row
  );
}

// Find the next available row below all blocks
export function getNextRow(
  blocks: CanvasBlock[]
): number {
  if (blocks.length === 0) return 1;
  return (
    Math.max(
      ...blocks.map(b =>
        b.position.row + b.position.rowSpan
      )
    ) + 1
  );
}

// Sort blocks by reading order (top→bottom, left→right)
export function readingOrder(
  blocks: CanvasBlock[]
): CanvasBlock[] {
  return [...blocks].sort((a, b) =>
    a.position.row !== b.position.row
      ? a.position.row - b.position.row
      : a.position.col - b.position.col
  );
}

// Assign stage indices (1a, 1b, 2a…) to all blocks
export function assignStageIndices(
  stages: CanvasStage[],
  blocks: CanvasBlock[]
): CanvasBlock[] {
  const stageMap = new Map(stages.map(s => [s.id, s]));
  const counters: Record<string, number> = {};

  const ordered = readingOrder(blocks);
  return ordered.map(block => {
    if (!block.stageId) {
      return { ...block, stageIndex: null };
    }
    const stage = stageMap.get(block.stageId);
    if (!stage) return { ...block, stageIndex: null };
    counters[block.stageId] =
      (counters[block.stageId] ?? 0) + 1;
    const letter = String.fromCharCode(
      96 + counters[block.stageId]
    ); // a, b, c, d…
    return {
      ...block,
      stageIndex: `${stage.stageNumber}${letter}`,
    };
  });
}

// Get edge midpoint pixel position for arrow drawing
export function getEdgeMidpoint(
  position: BlockPosition,
  edge: 'top' | 'right' | 'bottom' | 'left',
  colWidth: number,
  rowHeight: number
): { x: number; y: number } {
  const px = gridToPixels(position, colWidth, rowHeight);
  switch (edge) {
    case 'top':
      return { x: px.x + px.w / 2, y: px.y };
    case 'right':
      return { x: px.x + px.w, y: px.y + px.h / 2 };
    case 'bottom':
      return { x: px.x + px.w / 2, y: px.y + px.h };
    case 'left':
      return { x: px.x, y: px.y + px.h / 2 };
  }
}

// Snap a pixel position to the nearest grid dot
export function snapToGridDot(
  x: number, y: number,
  colWidth: number, rowHeight: number
): { x: number; y: number } {
  return {
    x: Math.round(x / colWidth) * colWidth,
    y: Math.round(y / rowHeight) * rowHeight,
  };
}

// Determine which edge of a block is closest to a given point
export function nearestEdge(
  point: { x: number; y: number },
  position: BlockPosition,
  colWidth: number,
  rowHeight: number
): 'top' | 'right' | 'bottom' | 'left' {
  const edges: Array<{ edge: 'top' | 'right' | 'bottom' | 'left'; pt: { x: number; y: number } }> = [
    { edge: 'top',    pt: getEdgeMidpoint(position, 'top', colWidth, rowHeight) },
    { edge: 'right',  pt: getEdgeMidpoint(position, 'right', colWidth, rowHeight) },
    { edge: 'bottom', pt: getEdgeMidpoint(position, 'bottom', colWidth, rowHeight) },
    { edge: 'left',   pt: getEdgeMidpoint(position, 'left', colWidth, rowHeight) },
  ];
  let best = edges[0];
  let bestDist = Infinity;
  for (const e of edges) {
    const d = Math.hypot(e.pt.x - point.x, e.pt.y - point.y);
    if (d < bestDist) { bestDist = d; best = e; }
  }
  return best.edge;
}

// Build a polyline SVG path through a set of points (straight segments)
export function polylinePath(
  points: { x: number; y: number }[]
): string {
  if (points.length === 0) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

// Build TOC entries from stages and blocks
export function buildCanvasTOC(
  stages: CanvasStage[],
  blocks: CanvasBlock[]
): TOCEntry[] {
  const entries: TOCEntry[] = [];
  const ungrouped = blocks.filter(b => !b.stageId);

  // Staged blocks grouped under their stage
  for (const stage of stages) {
    entries.push({
      type: 'stage',
      id: stage.id,
      number: `${stage.stageNumber}`,
      label: stage.title,
      blockId: null,
      children: stage.blockIds
        .map(bid => blocks.find(b => b.id === bid))
        .filter(Boolean)
        .map(block => ({
          type: 'block' as const,
          id: block!.id,
          number: block!.stageIndex ?? '',
          label: block!.subheading
            || block!.type?.replace(/_/g, ' ')
            || 'Block',
          blockId: block!.id,
          children: [],
        })),
    });
  }

  // Ungrouped blocks at end
  for (const block of ungrouped) {
    entries.push({
      type: 'block',
      id: block.id,
      number: '',
      label: block.subheading
        || block.type?.replace(/_/g, ' ')
        || 'Block',
      blockId: block.id,
      children: [],
    });
  }

  return entries;
}

export interface TOCEntry {
  type: 'stage' | 'block';
  id: string;
  number: string;
  label: string;
  blockId: string | null;
  children: TOCEntry[];
}
