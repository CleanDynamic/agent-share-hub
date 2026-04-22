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

interface StageCanvasProps {
  stageId: string;
}

export function StageCanvas({ stageId }: StageCanvasProps) {
  const blocks = useDocumentStore((s) => s.blocks);
  const connections = useDocumentStore((s) => s.connections);
  const moveBlock = useDocumentStore((s) => s.moveBlock);
  const removeBlock = useDocumentStore((s) => s.removeBlock);
  const removeConnection = useDocumentStore((s) => s.removeConnection);

  const nodes = useMemo<Node[]>(
    () =>
      Object.values(blocks)
        .filter((b) => b.stage_id === stageId)
        .map((b) => ({
          id: b.id,
          position: { x: b.position_x, y: b.position_y },
          data: { label: b.name ?? b.type },
          width: b.width,
          height: b.height,
          zIndex: b.z_index,
        })),
    [blocks, stageId],
  );

  const edges = useMemo<Edge[]>(
    () =>
      Object.values(connections)
        .filter((c) => {
          const from = blocks[c.from_block_id];
          const to = blocks[c.to_block_id];
          return from?.stage_id === stageId && to?.stage_id === stageId;
        })
        .map((c) => ({
          id: c.id,
          source: c.from_block_id,
          target: c.to_block_id,
          label: c.label ?? undefined,
        })),
    [connections, blocks, stageId],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          moveBlock(change.id, change.position.x, change.position.y);
        } else if (change.type === 'remove') {
          removeBlock(change.id);
        }
      }
    },
    [moveBlock, removeBlock],
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
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        minZoom={0.25}
        maxZoom={2}
        selectionOnDrag
        panOnDrag={[1]}
        panActivationKeyCode="Space"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(255,255,255,0.08)"
        />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
