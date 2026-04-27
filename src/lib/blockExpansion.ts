/**
 * blockExpansion
 *
 * Tracks which block (if any) is currently expanded "in-place" on the
 * fullscreen stage canvas. Only one block can be expanded at a time.
 *
 * Lives outside Zustand because it's a transient, canvas-only UI state
 * that does not need to participate in dirty tracking, undo/redo, or
 * persistence.
 */

import { useEffect, useState } from 'react';

let expandedBlockId: string | null = null;
const listeners = new Set<(id: string | null) => void>();

export function getExpandedBlockId(): string | null {
  return expandedBlockId;
}

export function setExpandedBlockId(id: string | null): void {
  if (expandedBlockId === id) return;
  expandedBlockId = id;
  for (const fn of [...listeners]) fn(id);
}

export function toggleExpandedBlockId(id: string): void {
  setExpandedBlockId(expandedBlockId === id ? null : id);
}

export function subscribeExpandedBlockId(
  listener: (id: string | null) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** React hook: returns the currently-expanded block id (or null). */
export function useExpandedBlockId(): string | null {
  const [id, setId] = useState<string | null>(expandedBlockId);
  useEffect(() => subscribeExpandedBlockId(setId), []);
  return id;
}
