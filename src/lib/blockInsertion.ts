/**
 * blockInsertion
 *
 * Shared utility for adding new blocks into a stage from the Block Library
 * (click-to-insert) or via drag-and-drop onto the canvas.
 *
 * Also tracks "newly created" block ids briefly so the canvas can play a
 * scale-in animation, and stores the currently-dragged block type in a
 * module-level ref (because `dataTransfer.getData` is empty during
 * `dragover` in most browsers).
 */

import { useDocumentStore } from '@/lib/documentStore';
import { eventBus } from '@/lib/eventBus';
import type { Block, BlockType } from '@/types/document';

// ─── Accent colors (must mirror BlockLibraryTool's BLOCKS palette) ──
export const BLOCK_TYPE_ACCENT: Record<BlockType, string> = {
  text:     'rgba(255,255,255,0.60)',
  heading:  'rgba(255,255,255,0.50)',
  note:     '#F59E0B',
  quote:    'rgba(255,255,255,0.60)',
  prompt:   '#E8571A',
  agent:    '#7C3AED',
  model:    '#A78BFA',
  result:   '#7C3AED',
  code:     '#22C55E',
  image:    'rgba(255,255,255,0.60)',
  video:    'rgba(255,255,255,0.60)',
  resource: '#06B6D4',
  tutorial: '#2EC4B6',
  tool:     '#3B82F6',
  workflow: '#3B82F6',
  compare:  '#EC4899',
};

const DEFAULT_BLOCK_WIDTH = 220;
const DEFAULT_BLOCK_HEIGHT = 120;
const CLICK_GRID_COL_WIDTH = 240;
const CLICK_GRID_ROW_HEIGHT = 160;
const CLICK_GRID_TOP = 100;
const CLICK_CANVAS_WIDTH = 1200;

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Newly-created tracking (powers the scale-in animation) ─────────
const newlyCreated = new Set<string>();
const newlyCreatedListeners = new Set<() => void>();
const NEWLY_CREATED_TTL_MS = 250; // > 200ms animation duration

function notifyNewlyCreated() {
  for (const fn of newlyCreatedListeners) fn();
}

export function markBlockNewlyCreated(blockId: string): void {
  newlyCreated.add(blockId);
  notifyNewlyCreated();
  window.setTimeout(() => {
    newlyCreated.delete(blockId);
    notifyNewlyCreated();
  }, NEWLY_CREATED_TTL_MS);
}

export function isBlockNewlyCreated(blockId: string): boolean {
  return newlyCreated.has(blockId);
}

export function subscribeNewlyCreated(listener: () => void): () => void {
  newlyCreatedListeners.add(listener);
  return () => {
    newlyCreatedListeners.delete(listener);
  };
}

// ─── Drag-type ref (set by BlockCard, read by canvas dragover) ──────
let currentDragType: BlockType | null = null;

export function setDragType(type: BlockType): void {
  currentDragType = type;
}

export function getDragType(): BlockType | null {
  return currentDragType;
}

export function clearDragType(): void {
  currentDragType = null;
}

// ─── Insert ─────────────────────────────────────────────────────────
export interface InsertBlockOptions {
  /** Explicit canvas position. Caller is responsible for snapping. */
  position?: { x: number; y: number };
  /** Width to use; defaults to 220. */
  width?: number;
  /** Height to use; defaults to 120. */
  height?: number;
}

/**
 * Create a new block in the given stage and select it.
 * - When `options.position` is omitted, auto-place using a wrap-around
 *   grid based on the current count of blocks in the stage.
 * - When provided, use those coordinates verbatim.
 *
 * Returns the new block's id.
 */
export function insertBlockInStage(
  stageId: string,
  type: BlockType,
  options: InsertBlockOptions = {},
): string {
  const store = useDocumentStore.getState();

  const existingCount = Object.values(store.blocks).filter(
    (b) => b.stage_id === stageId,
  ).length;

  let x: number;
  let y: number;

  if (options.position) {
    x = options.position.x;
    y = options.position.y;
  } else {
    const cols = Math.max(1, Math.floor(CLICK_CANVAS_WIDTH / CLICK_GRID_COL_WIDTH));
    x = (existingCount * CLICK_GRID_COL_WIDTH) % CLICK_CANVAS_WIDTH;
    y = CLICK_GRID_TOP + Math.floor(existingCount / cols) * CLICK_GRID_ROW_HEIGHT;
  }

  const id = uuid();
  const now = new Date().toISOString();
  const block: Block = {
    id,
    stage_id: stageId,
    type,
    position_x: x,
    position_y: y,
    width: options.width ?? DEFAULT_BLOCK_WIDTH,
    height: options.height ?? DEFAULT_BLOCK_HEIGHT,
    z_index: 0,
    name: capitalize(type),
    properties: {},
    locked: false,
    created_at: now,
    updated_at: now,
  };

  store.addBlock(block);
  store.setSelection({ kind: 'block', ids: [id] });
  markBlockNewlyCreated(id);

  // First block into an empty stage → ask the canvas to fit-view so the
  // user lands looking at their new block, not at empty origin space.
  if (existingCount === 0) {
    eventBus.emit('canvas:fit-needed', { stageId });
  }

  return id;
}
