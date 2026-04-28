/**
 * scheduleRecompute
 *
 * Debounced trigger for the metadata recompute pipeline. Save handlers
 * call `scheduleRecompute(contentItemId)` after a successful write; the
 * actual recompute fires 5 seconds after the *last* call for that id.
 *
 * `flushRecompute(id)` runs the recompute immediately (used right before
 * publish so freshly-public posts have up-to-date metadata).
 */

import { recomputeMetadata } from "./recomputeMetadata";

const DEBOUNCE_MS = 5000;

const queue = new Map<string, ReturnType<typeof setTimeout>>();

export function scheduleRecompute(contentItemId: string): void {
  if (!contentItemId) return;
  const existing = queue.get(contentItemId);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    queue.delete(contentItemId);
    recomputeMetadata(contentItemId).catch((err) => {
      console.error("[scheduleRecompute] recompute failed", contentItemId, err);
    });
  }, DEBOUNCE_MS);
  queue.set(contentItemId, t);
}

/** Cancel any pending debounced recompute and run it now (awaitable). */
export async function flushRecompute(contentItemId: string): Promise<void> {
  if (!contentItemId) return;
  const existing = queue.get(contentItemId);
  if (existing) {
    clearTimeout(existing);
    queue.delete(contentItemId);
  }
  try {
    await recomputeMetadata(contentItemId);
  } catch (err) {
    console.error("[flushRecompute] recompute failed", contentItemId, err);
  }
}
