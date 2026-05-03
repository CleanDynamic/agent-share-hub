import { recomputeCanonicalPayload } from "./getCanonicalPayload";

/**
 * Re-runs the canonical payload builder and writes it onto the
 * content_items row. Wrapper kept as its own module to satisfy the
 * Phase-3 spec import path (`./recomputeCanonicalPayload`).
 */
export async function recomputeCanonicalPayloadFor(postId: string): Promise<void> {
  await recomputeCanonicalPayload(postId);
}

// Re-export the underlying impl too for direct imports.
export { recomputeCanonicalPayload };
