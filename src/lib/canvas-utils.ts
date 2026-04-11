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

// Convert a positive integer to a lowercase roman numeral
function toRoman(n: number): string {
  if (n <= 0) return '';
  const table: Array<[number, string]> = [
    [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
  ];
  let result = '';
  let remaining = n;
  for (const [v, s] of table) {
    while (remaining >= v) {
      result += s;
      remaining -= v;
    }
  }
  return result;
}

// Assign stage indices (1a, 1b, 1a.i, 1a.i.1…) to all blocks.
// depth 0 → letters (1a, 1b)
// depth 1 → roman numerals nested under depth 0 (1a.i, 1a.ii)
// depth 2 → numbers nested under depth 1 (1a.i.1, 1a.i.2)
// Staged blocks are ordered by stage.blockIds (TOC/reading order)
// with any unlisted staged blocks appended in reading order.
export function assignStageIndices(
  stages: CanvasStage[],
  blocks: CanvasBlock[]
): CanvasBlock[] {
  interface StageCounter {
    depth0: number;
    depth1: number;
    depth2: number;
    currentLetter: string;
    currentRoman: string;
  }

  const indexMap = new Map<string, string | null>();

  for (const stage of stages) {
    const ctr: StageCounter = {
      depth0: 0, depth1: 0, depth2: 0,
      currentLetter: '', currentRoman: '',
    };

    // Blocks tagged to this stage
    const stageBlocks = blocks.filter(b => b.stageId === stage.id);
    // Order by blockIds first, appending any missing in reading order
    const idOrder = new Map<string, number>();
    stage.blockIds.forEach((bid, i) => idOrder.set(bid, i));
    const ordered = [...stageBlocks].sort((a, b) => {
      const ai = idOrder.has(a.id) ? idOrder.get(a.id)! : Infinity;
      const bi = idOrder.has(b.id) ? idOrder.get(b.id)! : Infinity;
      if (ai !== bi) return ai - bi;
      // Fallback: reading order
      if (a.position.row !== b.position.row) return a.position.row - b.position.row;
      return a.position.col - b.position.col;
    });

    for (const block of ordered) {
      const depth = Math.max(0, Math.min(2, block.depth ?? 0));

      let stageIndex: string;
      if (depth === 0) {
        ctr.depth0 += 1;
        ctr.depth1 = 0;
        ctr.depth2 = 0;
        ctr.currentLetter = String.fromCharCode(96 + ctr.depth0);
        ctr.currentRoman = '';
        stageIndex = `${stage.stageNumber}${ctr.currentLetter}`;
      } else if (depth === 1) {
        if (!ctr.currentLetter) {
          ctr.depth0 += 1;
          ctr.currentLetter = String.fromCharCode(96 + ctr.depth0);
        }
        ctr.depth1 += 1;
        ctr.depth2 = 0;
        ctr.currentRoman = toRoman(ctr.depth1);
        stageIndex = `${stage.stageNumber}${ctr.currentLetter}.${ctr.currentRoman}`;
      } else {
        // depth === 2
        if (!ctr.currentLetter) {
          ctr.depth0 += 1;
          ctr.currentLetter = String.fromCharCode(96 + ctr.depth0);
        }
        if (!ctr.currentRoman) {
          ctr.depth1 += 1;
          ctr.currentRoman = toRoman(ctr.depth1);
        }
        ctr.depth2 += 1;
        stageIndex = `${stage.stageNumber}${ctr.currentLetter}.${ctr.currentRoman}.${ctr.depth2}`;
      }

      indexMap.set(block.id, stageIndex);
    }
  }

  return blocks.map(b => {
    if (!b.stageId) return { ...b, stageIndex: null };
    return { ...b, stageIndex: indexMap.get(b.id) ?? null };
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

// Compute a stub point offset from an edge midpoint
function stubPoint(
  pt: { x: number; y: number },
  edge: 'top' | 'right' | 'bottom' | 'left',
  stub: number
): { x: number; y: number } {
  switch (edge) {
    case 'top':    return { x: pt.x, y: pt.y - stub };
    case 'bottom': return { x: pt.x, y: pt.y + stub };
    case 'left':   return { x: pt.x - stub, y: pt.y };
    case 'right':  return { x: pt.x + stub, y: pt.y };
  }
}

// Route orthogonally between two consecutive points, inserting a corner
// if they aren't axis-aligned. `goHorizFirst` picks the L-bend direction.
function orthogonalSegment(
  a: { x: number; y: number },
  b: { x: number; y: number },
  goHorizFirst: boolean
): { x: number; y: number }[] {
  if (a.x === b.x || a.y === b.y) return [b];
  if (goHorizFirst) {
    return [{ x: b.x, y: a.y }, b];
  }
  return [{ x: a.x, y: b.y }, b];
}

// Build a 90-degree-only (Manhattan) routed SVG path between two edge points.
// Exits the source edge perpendicular by `2 * rowHeight`, routes through
// optional waypoints with 90° bends, then approaches the target edge
// perpendicular.  When `toEdge` is null the path routes directly to `to`
// (used for live preview during drawing).
export function orthogonalPath(
  from: { x: number; y: number },
  fromEdge: 'top' | 'right' | 'bottom' | 'left',
  to: { x: number; y: number },
  toEdge: 'top' | 'right' | 'bottom' | 'left' | null,
  waypoints: { x: number; y: number }[],
  rowHeight: number,
): string {
  const stub = 2 * rowHeight;
  const exitPt = stubPoint(from, fromEdge, stub);

  const points: { x: number; y: number }[] = [from, exitPt];

  // After exiting, first segment should be perpendicular to exit direction
  // Exit horizontal (left/right) → go vertical next
  // Exit vertical (top/bottom) → go horizontal next
  const exitIsHorizontal =
    fromEdge === 'left' || fromEdge === 'right';

  // Route through each waypoint
  let current = exitPt;
  let goHoriz = !exitIsHorizontal; // first turn is perpendicular to exit

  for (const wp of waypoints) {
    if (wp.x === current.x && wp.y === current.y) continue;
    const seg = orthogonalSegment(current, wp, goHoriz);
    points.push(...seg);
    // Toggle direction for next segment
    if (current.x !== wp.x && current.y !== wp.y) {
      goHoriz = !goHoriz;
    } else {
      // Moved on one axis only — next should be perpendicular
      goHoriz = current.y !== wp.y;
    }
    current = wp;
  }

  if (toEdge !== null) {
    // Approach the target perpendicular to its edge
    const entryPt = stubPoint(to, toEdge, stub);
    const entryIsHorizontal =
      toEdge === 'left' || toEdge === 'right';

    if (current.x !== entryPt.x || current.y !== entryPt.y) {
      if (current.x === entryPt.x || current.y === entryPt.y) {
        points.push(entryPt);
      } else {
        // Pick corner so the last leg is perpendicular to entry direction
        if (entryIsHorizontal) {
          // Entry is horizontal → approach vertically → go horiz first, then vert
          points.push({ x: entryPt.x, y: current.y });
        } else {
          // Entry is vertical → approach horizontally → go vert first, then horiz
          points.push({ x: current.x, y: entryPt.y });
        }
        points.push(entryPt);
      }
    }
    points.push(to);
  } else {
    // Preview mode — route directly to cursor
    if (current.x !== to.x || current.y !== to.y) {
      const seg = orthogonalSegment(current, to, goHoriz);
      points.push(...seg);
    }
  }

  // Deduplicate consecutive identical points
  const deduped: { x: number; y: number }[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    if (points[i].x !== points[i - 1].x ||
        points[i].y !== points[i - 1].y) {
      deduped.push(points[i]);
    }
  }

  if (deduped.length === 0) return '';
  let d = `M ${deduped[0].x} ${deduped[0].y}`;
  for (let i = 1; i < deduped.length; i++) {
    d += ` L ${deduped[i].x} ${deduped[i].y}`;
  }
  return d;
}

// Build TOC entries from stages and blocks
export function buildCanvasTOC(
  stages: CanvasStage[],
  blocks: CanvasBlock[]
): TOCEntry[] {
  const entries: TOCEntry[] = [];
  // Sticky notes are canvas-level annotations and should not appear in the TOC
  const tocBlocks = blocks.filter(b => b.type !== 'sticky_note');
  const ungrouped = tocBlocks.filter(b => !b.stageId);

  // Staged blocks grouped under their stage
  for (const stage of stages) {
    entries.push({
      type: 'stage',
      id: stage.id,
      number: `${stage.stageNumber}`,
      label: stage.title,
      blockId: null,
      children: stage.blockIds
        .map(bid => tocBlocks.find(b => b.id === bid))
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

// Get all 4 snap-point positions for a block (pixel coords)
export function getBlockSnapPoints(
  position: BlockPosition,
  colWidth: number,
  rowHeight: number
): Array<{
  edge: 'top' | 'right' | 'bottom' | 'left';
  point: { x: number; y: number };
}> {
  return (['top', 'right', 'bottom', 'left'] as const).map(
    edge => ({
      edge,
      point: getEdgeMidpoint(position, edge, colWidth, rowHeight),
    })
  );
}

// Prevent stage zone overlaps by shifting blocks in later stages
// downward when they overlap with blocks in earlier stages.
export function preventStageOverlap(
  stages: CanvasStage[],
  blocks: CanvasBlock[]
): CanvasBlock[] {
  const sorted = [...stages].sort(
    (a, b) => a.stageNumber - b.stageNumber
  );
  if (sorted.length < 2) return blocks;

  const adjusted = blocks.map(b => ({
    ...b,
    position: { ...b.position },
  }));

  for (let i = 1; i < sorted.length; i++) {
    const prevStage = sorted[i - 1];
    const currStage = sorted[i];

    const prevBlocks = adjusted.filter(
      b => b.stageId === prevStage.id
    );
    if (prevBlocks.length === 0) continue;

    const prevMaxRow = Math.max(
      ...prevBlocks.map(
        b => b.position.row + b.position.rowSpan - 1
      )
    );

    const currBlocks = adjusted.filter(
      b => b.stageId === currStage.id
    );
    if (currBlocks.length === 0) continue;

    const currMinRow = Math.min(
      ...currBlocks.map(b => b.position.row)
    );

    if (currMinRow <= prevMaxRow + 1) {
      const shiftAmount =
        prevMaxRow + 1 - currMinRow + 2; // overlap + 2-row gap

      // Collect IDs for current stage and all subsequent stages
      const stagesToShift = new Set(
        sorted.slice(i).map(s => s.id)
      );

      for (const block of adjusted) {
        if (
          block.stageId &&
          stagesToShift.has(block.stageId)
        ) {
          block.position.row += shiftAmount;
        }
      }
    }
  }

  return adjusted;
}
