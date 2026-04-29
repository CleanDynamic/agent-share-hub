import { toast } from 'sonner';
import { useDocumentStore } from '@/lib/documentStore';

const TEAL = '#2EC4B6';

const toastOpts = {
  style: {
    background: 'rgba(46,196,182,0.12)',
    border: '0.5px solid rgba(46,196,182,0.35)',
    color: TEAL,
  },
} as const;

/**
 * Toggle a stage's `is_missing` flag and surface a teal confirmation toast.
 * Returns the new is_missing value (or null when the stage doesn't exist).
 */
export function toggleStageMissing(stageId: string): boolean | null {
  const stage = useDocumentStore.getState().stages[stageId];
  if (!stage) return null;
  const next = !stage.is_missing;
  useDocumentStore.getState().updateStage(stageId, { is_missing: next });
  if (next) {
    toast('Marked as missing — solvers will see this slot.', toastOpts);
  } else {
    toast('No longer missing', toastOpts);
  }
  return next;
}

/**
 * Toggle a block's `is_missing` flag and surface a teal confirmation toast.
 * Returns the new is_missing value (or null when the block doesn't exist).
 */
export function toggleBlockMissing(blockId: string): boolean | null {
  const block = useDocumentStore.getState().blocks[blockId];
  if (!block) return null;
  const next = !block.is_missing;
  useDocumentStore.getState().updateBlock(blockId, { is_missing: next });
  if (next) {
    toast('Marked as missing — solvers will see this slot.', toastOpts);
  } else {
    toast('No longer missing', toastOpts);
  }
  return next;
}
