/**
 * documentPersistence
 *
 * Subscribes to the editor document store and flushes dirty entities to
 * Supabase in two batched pipelines:
 *
 *   - position changes (block.position_x / position_y only) every 100ms
 *   - any other change (inserts, deletes, property edits, stages,
 *     connections, article body) every 400ms
 *
 * Writes are optimistic: local state is already updated when this layer
 * runs. Each batch ends with a conditional update on
 * content_items.document_version; a rejected version means another
 * client won the race, and a sonner toast prompts the user to refresh.
 *
 * The layer also exposes a tiny status store (saveStatus, lastSavedAt)
 * that UI components can read without touching this file.
 *
 * Usage:
 *
 *   // Somewhere near the editor root
 *   useDocumentPersistence();
 *
 *   // And, in a status indicator component
 *   const { saveStatus, lastSavedAt } = usePersistenceStatus();
 */

import { useEffect } from 'react';
import { create } from 'zustand';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useDocumentStore } from './documentStore';
import { scheduleRecompute } from './metadata/scheduleRecompute';
import type { Block, Connection, Stage } from '@/types/document';

// ── Status store ────────────────────────────────────────────────────────────

export type SaveStatus = 'saved' | 'saving' | 'error' | 'offline';

interface PersistenceStatusState {
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  setSaveStatus: (status: SaveStatus) => void;
  markSaved: () => void;
}

export const usePersistenceStatus = create<PersistenceStatusState>((set) => ({
  saveStatus: 'saved',
  lastSavedAt: null,
  setSaveStatus: (status) => set({ saveStatus: status }),
  markSaved: () => set({ saveStatus: 'saved', lastSavedAt: new Date() }),
}));

// ── Debounce intervals ──────────────────────────────────────────────────────

const POSITION_DEBOUNCE_MS = 100;
const FULL_DEBOUNCE_MS = 400;

// ── Internal module state (singleton per tab) ───────────────────────────────

interface Snapshot {
  articleBody: unknown;
  stages: Record<string, Stage>;
  blocks: Record<string, Block>;
  connections: Record<string, Connection>;
}

let subscribedCount = 0;
let unsubscribeStore: (() => void) | null = null;

let positionTimer: ReturnType<typeof setTimeout> | null = null;
let fullTimer: ReturnType<typeof setTimeout> | null = null;

// Ids awaiting flush, split by pipeline.
const pendingPosition = new Set<string>();
const pendingFull = new Set<string>();

// Article body dirty flag (not keyed by id).
let articleDirty = false;

// Snapshot of the last state we successfully synced, used to diff what
// kind of change happened and to detect deletions.
let lastSynced: Snapshot = {
  articleBody: null,
  stages: {},
  blocks: {},
  connections: {},
};

// Version known to be current on the server, incremented on each
// successful batch.
let localDocumentVersion = 1;

// Whether a flush is in-flight; used to serialise batches.
let flushing = false;

let versionConflictShown = false;

// ── Helpers ─────────────────────────────────────────────────────────────────

function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

function blockPositionOnlyChange(cur: Block, prev: Block): boolean {
  if (cur.position_x === prev.position_x && cur.position_y === prev.position_y) {
    return false;
  }
  // Compare every other field for equality.
  const keys: (keyof Block)[] = [
    'stage_id',
    'type',
    'width',
    'height',
    'z_index',
    'name',
    'locked',
    'created_at',
    'updated_at',
  ];
  for (const k of keys) {
    if (cur[k] !== prev[k]) return false;
  }
  // properties is an object; shallow-JSON compare is enough here.
  if (JSON.stringify(cur.properties) !== JSON.stringify(prev.properties)) {
    return false;
  }
  return true;
}

function classifyDirty(
  id: string,
  state: ReturnType<typeof useDocumentStore.getState>,
): 'position' | 'full' {
  const curBlock = state.blocks[id];
  const prevBlock = lastSynced.blocks[id];
  if (curBlock && prevBlock && blockPositionOnlyChange(curBlock, prevBlock)) {
    return 'position';
  }
  return 'full';
}

function schedulePositionFlush() {
  if (positionTimer) return;
  positionTimer = setTimeout(() => {
    positionTimer = null;
    void flush('position');
  }, POSITION_DEBOUNCE_MS);
}

function scheduleFullFlush() {
  if (fullTimer) return;
  fullTimer = setTimeout(() => {
    fullTimer = null;
    void flush('full');
  }, FULL_DEBOUNCE_MS);
}

function snapshotState(
  state: ReturnType<typeof useDocumentStore.getState>,
): Snapshot {
  return {
    articleBody: state.articleBody,
    stages: { ...state.stages },
    blocks: { ...state.blocks },
    connections: { ...state.connections },
  };
}

// ── Version-conflict handling ───────────────────────────────────────────────

function showVersionConflictToast() {
  if (versionConflictShown) return;
  versionConflictShown = true;
  toast('Your document was updated elsewhere. Refresh to see the latest.');
}

// ── Flush ───────────────────────────────────────────────────────────────────

async function flush(kind: 'position' | 'full'): Promise<void> {
  if (flushing) {
    // Reschedule; we'll pick these up after the in-flight batch finishes.
    if (kind === 'position') schedulePositionFlush();
    else scheduleFullFlush();
    return;
  }

  if (!isOnline()) {
    usePersistenceStatus.getState().setSaveStatus('offline');
    return;
  }

  const state = useDocumentStore.getState();
  const documentId = state.documentId;
  if (!documentId) return;

  // Pick the ids this pass will write.
  const ids =
    kind === 'position'
      ? Array.from(pendingPosition)
      : Array.from(pendingFull);

  const includeArticle = kind === 'full' && articleDirty;

  if (ids.length === 0 && !includeArticle) return;

  flushing = true;
  usePersistenceStatus.getState().setSaveStatus('saving');

  const prevSnapshot = lastSynced;
  const nextSnapshot = snapshotState(state);

  try {
    if (kind === 'position') {
      await writePositionBatch(ids, state);
    } else {
      await writeFullBatch(ids, state, prevSnapshot, includeArticle);
    }

    const ok = await bumpDocumentVersion(documentId);
    if (!ok) {
      usePersistenceStatus.getState().setSaveStatus('error');
      showVersionConflictToast();
      return;
    }

    // Clear successfully-written ids from the document store's dirty set,
    // and from the pipeline-specific buckets.
    const store = useDocumentStore.getState();
    for (const id of ids) {
      if (kind === 'position') {
        pendingPosition.delete(id);
        // Only clear from dirty if there's no other pending work.
        if (!pendingFull.has(id)) store.clearDirty(id);
      } else {
        pendingFull.delete(id);
        pendingPosition.delete(id);
        store.clearDirty(id);
      }
    }
    if (includeArticle) articleDirty = false;

    // Only full flushes advance the synced snapshot (position flushes
    // write a subset and keep other pending edits waiting).
    if (kind === 'full') lastSynced = nextSnapshot;
    else {
      // Still update the synced positions for classification accuracy.
      for (const id of ids) {
        const b = nextSnapshot.blocks[id];
        if (b && lastSynced.blocks[id]) {
          lastSynced.blocks[id] = {
            ...lastSynced.blocks[id],
            position_x: b.position_x,
            position_y: b.position_y,
          };
        }
      }
    }

    usePersistenceStatus.getState().markSaved();

    // Position-only flushes can't change any auto-detected field
    // (block types / models / tools / counts are all position-agnostic),
    // so only schedule a recompute on full flushes.
    if (kind === 'full') scheduleRecompute(documentId);
  } catch (err) {
    console.error('[documentPersistence] flush failed', err);
    usePersistenceStatus.getState().setSaveStatus(
      isOnline() ? 'error' : 'offline',
    );
  } finally {
    flushing = false;
    // If more work accumulated while we were writing, schedule it now.
    if (pendingPosition.size > 0) schedulePositionFlush();
    if (pendingFull.size > 0 || articleDirty) scheduleFullFlush();
  }
}

// ── Batch writers ───────────────────────────────────────────────────────────

async function writePositionBatch(
  ids: string[],
  state: ReturnType<typeof useDocumentStore.getState>,
): Promise<void> {
  const client = supabase as unknown as {
    from: (t: string) => {
      update: (patch: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{ error: unknown }>;
      };
    };
  };

  for (const id of ids) {
    const block = state.blocks[id];
    if (!block) continue;
    const { error } = await client
      .from('blocks')
      .update({
        position_x: block.position_x,
        position_y: block.position_y,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;
  }
}

async function writeFullBatch(
  ids: string[],
  state: ReturnType<typeof useDocumentStore.getState>,
  prev: Snapshot,
  includeArticle: boolean,
): Promise<void> {
  const stageInserts: Stage[] = [];
  const blockInserts: (Block & { content_item_id?: string })[] = [];
  const connectionInserts: Connection[] = [];

  const stageDeletes: string[] = [];
  const blockDeletes: string[] = [];
  const connectionDeletes: string[] = [];

  for (const id of ids) {
    if (state.stages[id]) stageInserts.push(state.stages[id]);
    else if (prev.stages[id]) stageDeletes.push(id);

    if (state.blocks[id]) blockInserts.push(state.blocks[id]);
    else if (prev.blocks[id]) blockDeletes.push(id);

    if (state.connections[id]) connectionInserts.push(state.connections[id]);
    else if (prev.connections[id]) connectionDeletes.push(id);
  }

  const client = supabase as unknown as {
    from: (t: string) => {
      upsert: (rows: unknown) => Promise<{ error: unknown }>;
      delete: () => {
        in: (col: string, vals: string[]) => Promise<{ error: unknown }>;
      };
      update: (patch: Record<string, unknown>) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: number | string) => {
            select: () => Promise<{ data: unknown[] | null; error: unknown }>;
          };
        };
      };
    };
  };

  if (stageInserts.length > 0) {
    const { error } = await client.from('stages').upsert(stageInserts);
    if (error) throw error;
  }
  if (blockInserts.length > 0) {
    const { error } = await client.from('blocks').upsert(blockInserts);
    if (error) throw error;
  }
  if (connectionInserts.length > 0) {
    const { error } = await client
      .from('block_connections')
      .upsert(connectionInserts);
    if (error) throw error;
  }

  // Deletes are scoped to ids that we last saw; order deletes so that
  // connections go first, then blocks, then stages (avoids FK races
  // even though ON DELETE CASCADE would cover it).
  if (connectionDeletes.length > 0) {
    const { error } = await client
      .from('block_connections')
      .delete()
      .in('id', connectionDeletes);
    if (error) throw error;
  }
  if (blockDeletes.length > 0) {
    const { error } = await client
      .from('blocks')
      .delete()
      .in('id', blockDeletes);
    if (error) throw error;
  }
  if (stageDeletes.length > 0) {
    const { error } = await client
      .from('stages')
      .delete()
      .in('id', stageDeletes);
    if (error) throw error;
  }

  if (includeArticle) {
    const documentId = state.documentId;
    if (!documentId) return;
    const { error } = await (supabase as unknown as {
      from: (t: string) => {
        update: (patch: Record<string, unknown>) => {
          eq: (col: string, val: string) => Promise<{ error: unknown }>;
        };
      };
    })
      .from('content_items')
      .update({ article_body: state.articleBody })
      .eq('id', documentId);
    if (error) throw error;
  }
}

async function bumpDocumentVersion(documentId: string): Promise<boolean> {
  const expected = localDocumentVersion;
  const next = expected + 1;

  const { data, error } = await (supabase as unknown as {
    from: (t: string) => {
      update: (patch: Record<string, unknown>) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: number) => {
            select: () => Promise<{ data: unknown[] | null; error: unknown }>;
          };
        };
      };
    };
  })
    .from('content_items')
    .update({
      document_version: next,
      last_edited_at: new Date().toISOString(),
    })
    .eq('id', documentId)
    .eq('document_version', expected)
    .select();

  if (error) throw error;
  const rows = (data ?? []) as unknown[];
  if (rows.length === 0) return false;

  localDocumentVersion = next;
  return true;
}

// ── Store subscription ──────────────────────────────────────────────────────

function startSubscription() {
  // Seed the synced snapshot so the first diff is meaningful.
  lastSynced = snapshotState(useDocumentStore.getState());

  return useDocumentStore.subscribe((state, prevState) => {
    // Reset on document switch.
    if (state.documentId !== prevState.documentId) {
      pendingPosition.clear();
      pendingFull.clear();
      articleDirty = false;
      localDocumentVersion = 1;
      versionConflictShown = false;
      lastSynced = snapshotState(state);
      return;
    }

    if (state.articleBody !== prevState.articleBody) {
      articleDirty = true;
      scheduleFullFlush();
    }

    // Newly-dirty ids since last tick.
    for (const id of state.dirty) {
      if (prevState.dirty.has(id)) continue;
      const bucket = classifyDirty(id, state);
      if (bucket === 'position') {
        pendingPosition.add(id);
        schedulePositionFlush();
      } else {
        pendingFull.add(id);
        scheduleFullFlush();
      }
    }
  });
}

function stopSubscription() {
  if (unsubscribeStore) {
    unsubscribeStore();
    unsubscribeStore = null;
  }
  if (positionTimer) {
    clearTimeout(positionTimer);
    positionTimer = null;
  }
  if (fullTimer) {
    clearTimeout(fullTimer);
    fullTimer = null;
  }
  pendingPosition.clear();
  pendingFull.clear();
  articleDirty = false;
}

// ── Online/offline watcher ──────────────────────────────────────────────────

function handleOnline() {
  if (pendingPosition.size > 0) schedulePositionFlush();
  if (pendingFull.size > 0 || articleDirty) scheduleFullFlush();
  else usePersistenceStatus.getState().markSaved();
}

function handleOffline() {
  usePersistenceStatus.getState().setSaveStatus('offline');
}

// ── Public hook ─────────────────────────────────────────────────────────────

export function useDocumentPersistence(): void {
  useEffect(() => {
    subscribedCount += 1;
    if (subscribedCount === 1) {
      unsubscribeStore = startSubscription();
      if (typeof window !== 'undefined') {
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        if (!navigator.onLine) {
          usePersistenceStatus.getState().setSaveStatus('offline');
        }
      }
    }
    return () => {
      subscribedCount -= 1;
      if (subscribedCount === 0) {
        stopSubscription();
        if (typeof window !== 'undefined') {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
        }
      }
    };
  }, []);
}

// ── Test-only helpers ───────────────────────────────────────────────────────

/**
 * Resets module-level state. Intended for unit tests only.
 */
export function __resetPersistenceForTests(): void {
  stopSubscription();
  subscribedCount = 0;
  flushing = false;
  localDocumentVersion = 1;
  versionConflictShown = false;
  lastSynced = {
    articleBody: null,
    stages: {},
    blocks: {},
    connections: {},
  };
  usePersistenceStatus.setState({ saveStatus: 'saved', lastSavedAt: null });
}
