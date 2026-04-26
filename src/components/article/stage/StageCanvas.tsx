import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useDocumentStore } from '@/lib/documentStore';
import type { Block, Connection } from '@/types/document';

interface StageCanvasProps {
  stageId: string;
}

function blockToNode(block: Block): Node {
  return {
    id: block.id,
    position: { x: block.position_x, y: block.position_y },
    data: { label: block.name ?? block.type },
    width: block.width,
    height: block.height,
  };
}

function connectionToEdge(conn: Connection): Edge {
  return {
    id: conn.id,
    source: conn.from_block_id,
    target: conn.to_block_id,
    label: conn.label ?? undefined,
  };
}

export function StageCanvas({ stageId }: StageCanvasProps) {
  const blocks = useDocumentStore((s) => s.blocks);
  const connections = useDocumentStore((s) => s.connections);
  const moveBlock = useDocumentStore((s) => s.moveBlock);
  const updateBlock = useDocumentStore((s) => s.updateBlock);
  const removeBlock = useDocumentStore((s) => s.removeBlock);
  const removeConnection = useDocumentStore((s) => s.removeConnection);

  const nodes = useMemo<Node[]>(
    () =>
      Object.values(blocks)
        .filter((b) => b.stage_id === stageId)
        .map(blockToNode),
    [blocks, stageId],
  );

  const edges = useMemo<Edge[]>(() => {
    const stageBlockIds = new Set(
      Object.values(blocks)
        .filter((b) => b.stage_id === stageId)
        .map((b) => b.id),
    );
    return Object.values(connections)
      .filter(
        (c) =>
          stageBlockIds.has(c.from_block_id) && stageBlockIds.has(c.to_block_id),
      )
      .map(connectionToEdge);
  }, [blocks, connections, stageId]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          moveBlock(change.id, change.position.x, change.position.y);
        } else if (change.type === 'dimensions' && change.dimensions) {
          updateBlock(change.id, {
            width: change.dimensions.width,
            height: change.dimensions.height,
          });
        } else if (change.type === 'remove') {
          removeBlock(change.id);
        }
      }
    },
    [moveBlock, updateBlock, removeBlock],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type === 'remove') {
          removeConnection(change.id);
        }
      }
    },
    [removeConnection],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
      minZoom={0.25}
      maxZoom={2}
      panOnDrag={[1]}
      panActivationKeyCode="Space"
      selectionOnDrag
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        color="rgba(255,255,255,0.08)"
      />
      <MiniMap />
    </ReactFlow>
  );
}
