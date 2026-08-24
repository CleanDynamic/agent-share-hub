// =============================================================================
// NeoScale — local_id minting (NS-P20a)
// =============================================================================
// A proposed node's local_id is a handle within ONE response and nothing more.
// The client maps it to a uuid on materialisation; it is never stored, never
// referenced across responses, and never meaningful once the proposal is
// accepted or discarded. NS-P13 minted them from a counter and NS-P20 from the
// growing array's length, which is the same sequence written two ways.
//
// It still has to be RIGHT, because it is what links a node to itself between
// the proposal a creator sees and the selection they send back.
// =============================================================================

/**
 * `node-1`, `node-2`, … in mint order.
 *
 * A minter, not an index into the array being built: reading the length of the
 * array you are pushing to gives the same answer only for as long as every mint
 * is followed by exactly one push, which is a coupling nothing enforces.
 */
export function createLocalIdMinter(prefix = "node"): () => string {
  let sequence = 0;
  return () => `${prefix}-${++sequence}`;
}

/**
 * Renumber in place, after a sort.
 *
 * A reader that builds nodes in passes (events first, then code) leaves them in
 * construction order rather than session order. Sorting makes the proposal read
 * top to bottom the way the session ran, and because a local_id means nothing
 * outside the response, renumbering after the sort costs nothing and keeps the
 * handles ascending too.
 */
export function renumberLocalIds(
  nodes: { local_id: string }[],
  prefix = "node",
): void {
  nodes.forEach((node, position) => {
    node.local_id = `${prefix}-${position + 1}`;
  });
}
