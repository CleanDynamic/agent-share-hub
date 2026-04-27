/**
 * Block insertion helper used by both click-to-insert (Block Library tool)
 * and drag-to-place (StageCanvas drop handler).
 *
 * Single source of truth for: id generation, default sizing, the layout
 * algorithm for click-inserts, and the transient "newly created" registry
 * that drives the scale-in animation on the canvas.
 */
import { useDocumentStore } from '@/lib/documentStore';
import type { Block, BlockType } from '@/types/document';

const DEFAULT_BLOCK_WIDTH = 220;
const DEFAULT_BLOCK_HEIGHT = 120;

// Click-insert flow layout: simple grid laid out left→right, top→bottom.
// Used as a fallback so the user can keep clicking without overlap.
const CLICK_GRID_COL_WIDTH = 240;
const CLICK_GRID_ROW_HEIGHT = 160;
const CLICK_GRID_TOP = 100;

// ── Newly created registry (powers a one-shot scale-in animation) ─────
const newlyCreatedIds = new Set<string>();
const newlyCreatedListeners = new Set<() => void>();

function notify() {
  for (const cb of [...newlyCreatedListeners]) cb();
}

export function isBlockNewlyCreated(blockId: string): boolean {
  return newlyCreatedIds.has(blockId);
}

export function subscribeNewlyCreated(cb: () => void): () => void {
  newlyCreatedListeners.add(cb);
  return () => newlyCreatedListeners.delete(cb);
}

function markNewlyCreated(blockId: string, ttl = 240) {
  newlyCreatedIds.add(blockId);
  notify();
  window.setTimeout(() => {
    newlyCreatedIds.delete(blockId);
    notify();
  }, ttl);
}

// ── Insert APIs ───────────────────────────────────────────────────────
export interface InsertBlockOptions {
  /** Optional explicit canvas-space position. When omitted we auto-place. */
  position?: { x: number; y: number };
  /** Used by the click-insert layout to wrap rows. Defaults to a wide canvas. */
  canvasWidth?: number;
  /** When true, select the new block after insertion. Defaults to true. */
  select?: boolean;
}

/**
 * Insert a new block into a stage. Returns the created block id, or `null`
 * if no `stageId` was provided (e.g. no stage is currently open).
 */
export function insertBlockInStage(
  stageId: string | null,
  type: string,
  opts: InsertBlockOptions = {},
): string | null {
  if (!stageId) return null;

  const store = useDocumentStore.getState();
  const stageBlocks = Object.values(store.blocks).filter((b) => b.stage_id === stageId);
  const blockCount = stageBlocks.length;

  let position = opts.position;
  if (!position) {
    const canvasWidth = Math.max(CLICK_GRID_COL_WIDTH * 2, opts.canvasWidth ?? 960);
    const cols = Math.max(1, Math.floor(canvasWidth / CLICK_GRID_COL_WIDTH));
    const x = (blockCount * CLICK_GRID_COL_WIDTH) % canvasWidth;
    const y = CLICK_GRID_TOP + Math.floor(blockCount / cols) * CLICK_GRID_ROW_HEIGHT;
    position = { x, y };
  }

  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const now = new Date().toISOString();
  const newBlock: Block = {
    id,
    stage_id: stageId,
    type: type as BlockType,
    position_x: position.x,
    position_y: position.y,
    width: DEFAULT_BLOCK_WIDTH,
    height: DEFAULT_BLOCK_HEIGHT,
    z_index: blockCount,
    name: null,
    properties: {},
    locked: false,
    created_at: now,
    updated_at: now,
  };

  store.addBlock(newBlock);
  markNewlyCreated(id);

  if (opts.select !== false) {
    store.setSelection({ kind: 'block', ids: [id] });
  }

  return id;
}

/** Snap a value to the nearest grid step. */
export function snapToGrid(value: number, step = 20): number {
  return Math.round(value / step) * step;
}
