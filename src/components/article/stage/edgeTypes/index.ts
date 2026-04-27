/**
 * Registered React Flow edge types for stage canvases. There's currently a
 * single `dataflow` type which renders every `connection_type` variant by
 * reading the connection's metadata from the document store.
 */

import { DataFlowEdge } from './DataFlowEdge';

export const edgeTypes = {
  dataflow: DataFlowEdge,
} as const;

export const DEFAULT_EDGE_TYPE = 'dataflow' as const;
