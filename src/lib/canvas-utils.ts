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

// Snap a value to the nearest grid line
function snapVal(v: number, step: number): number {
  return Math.round(v / step) * step;
}

// Generate an orthogonal (Manhattan) path snapped to grid dots.
// The path leaves `from` in the direction of `fromEdge`, turns
// at right angles along grid lines, and arrives at `to` from
// the direction of `toEdge`.
export function orthogonalPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromEdge: string,
  toEdge: string,
  gridX: number,  // colWidth  (horizontal grid spacing)
  gridY: number   // rowHeight (vertical grid spacing)
): string {
  const GAP = Math.max(gridX, gridY); // clearance before first turn

  // Step out from the edge by one grid unit
  const stepOut = (pt: { x: number; y: number }, edge: string, dist: number) => {
    switch (edge) {
      case 'top':    return { x: pt.x, y: pt.y - dist };
      case 'bottom': return { x: pt.x, y: pt.y + dist };
      case 'left':   return { x: pt.x - dist, y: pt.y };
      case 'right':  return { x: pt.x + dist, y: pt.y };
      default:       return pt;
    }
  };

  const a = stepOut(from, fromEdge, GAP);
  const b = stepOut(to, toEdge, GAP);

  // Snap waypoints to grid
  const ax = snapVal(a.x, gridX);
  const ay = snapVal(a.y, gridY);
  const bx = snapVal(b.x, gridX);
  const by = snapVal(b.y, gridY);

  // Build the polyline waypoints
  const pts: { x: number; y: number }[] = [from];

  const isVerticalFrom = fromEdge === 'top' || fromEdge === 'bottom';
  const isVerticalTo   = toEdge === 'top'  || toEdge === 'bottom';

  if (isVerticalFrom && isVerticalTo) {
    // Both vertical: go out vertically, across horizontally, in vertically
    const midY = snapVal((ay + by) / 2, gridY);
    pts.push({ x: from.x, y: midY });
    pts.push({ x: to.x,   y: midY });
  } else if (!isVerticalFrom && !isVerticalTo) {
    // Both horizontal: go out horizontally, across vertically, in horizontally
    const midX = snapVal((ax + bx) / 2, gridX);
    pts.push({ x: midX, y: from.y });
    pts.push({ x: midX, y: to.y });
  } else if (isVerticalFrom && !isVerticalTo) {
    // Vertical out, horizontal in
    pts.push({ x: from.x, y: by });
  } else {
    // Horizontal out, vertical in
    pts.push({ x: bx, y: from.y });
  }

  pts.push(to);

  // Build SVG path with rounded corners
  const R = Math.min(gridX, gridY) * 0.4; // corner radius
  let d = `M ${pts[0].x} ${pts[0].y}`;

  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const next = pts[i + 1];

    // Vectors to prev and next
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;

    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    if (len1 === 0 || len2 === 0) {
      d += ` L ${curr.x} ${curr.y}`;
      continue;
    }

    const r = Math.min(R, len1 / 2, len2 / 2);

    const startX = curr.x - (dx1 / len1) * r;
    const startY = curr.y - (dy1 / len1) * r;
    const endX   = curr.x + (dx2 / len2) * r;
    const endY   = curr.y + (dy2 / len2) * r;

    d += ` L ${startX} ${startY}`;
    d += ` Q ${curr.x} ${curr.y} ${endX} ${endY}`;
  }

  d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  return d;
}

// Legacy alias kept for the live-drawing preview line (cursor follow)
export function bezierPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  _fromEdge: string,
  _toEdge: string
): string {
  // Simple straight line for live drawing feedback
  return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
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
