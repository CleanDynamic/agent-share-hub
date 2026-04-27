import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  type Connection as RFConnection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useDocumentStore } from '@/lib/documentStore';
import { eventBus } from '@/lib/eventBus';
import type { Block, Connection } from '@/types/document';
import { edgeTypes, DEFAULT_EDGE_TYPE } from './edgeTypes';
import { PromptBlockNode } from '../blocks/PromptBlock';
import { CodeBlockNode } from '../blocks/CodeBlock';
import { TextBlockNode } from '../blocks/TextBlock';
import { AgentBlockNode } from '../blocks/AgentBlock';
import { CompareBlockNode } from '../blocks/CompareBlock';
import { HeadingBlockNode } from '../blocks/HeadingBlock';
import { ModelBlockNode } from '../blocks/ModelBlock';
import { NoteBlockNode } from '../blocks/NoteBlock';
import { ResultBlockNode } from '../blocks/ResultBlock';
import { ResourceBlockNode } from '../blocks/ResourceBlock';
import { ToolBlockNode } from '../blocks/ToolBlock';
import { WorkflowBlockNode } from '../blocks/WorkflowBlock';

interface StageCanvasProps {
  stageId: string;
}

const nodeTypes = {
  prompt: PromptBlockNode,
  code: CodeBlockNode,
  text: TextBlockNode,
  agent: AgentBlockNode,
  compare: CompareBlockNode,
  heading: HeadingBlockNode,
  model: ModelBlockNode,
  note: NoteBlockNode,
  result: ResultBlockNode,
  resource: ResourceBlockNode,
  tool: ToolBlockNode,
  workflow: WorkflowBlockNode,
};

const BLOCK_TYPE_TO_NODE: Partial<Record<Block['type'], string>> = {
  prompt: 'prompt',
  code: 'code',
  text: 'text',
  agent: 'agent',
  compare: 'compare',
  heading: 'heading',
  model: 'model',
  note: 'note',
  result: 'result',
  resource: 'resource',
  tool: 'tool',
  workflow: 'workflow',
};


function blockToNode(block: Block): Node {
  return {
    id: block.id,
    type: BLOCK_TYPE_TO_NODE[block.type],
    position: { x: block.position_x, y: block.position_y },
    data: { label: block.name ?? block.type, blockId: block.id },
    width: block.width,
    height: block.height,
  };
}

function connectionToEdge(conn: Connection): Edge {
  return {
    id: conn.id,
    source: conn.from_block_id,
    target: conn.to_block_id,
    type: DEFAULT_EDGE_TYPE,
    label: conn.label ?? undefined,
    data: {
      connectionType: conn.connection_type,
      carriesData: conn.carries_data,
    },
  };
}

export function StageCanvas({ stageId }: StageCanvasProps) {
  const blocks = useDocumentStore((s) => s.blocks);
  const connections = useDocumentStore((s) => s.connections);
  const moveBlock = useDocumentStore((s) => s.moveBlock);
  const updateBlock = useDocumentStore((s) => s.updateBlock);
  const removeBlock = useDocumentStore((s) => s.removeBlock);
  const addConnection = useDocumentStore((s) => s.addConnection);
  const removeConnection = useDocumentStore((s) => s.removeConnection);
  const setSelection = useDocumentStore((s) => s.setSelection);

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
        } else if (change.type === 'select') {
          if (change.selected) {
            setSelection({ kind: 'arrow', ids: [change.id] });
          }
        }
      }
    },
    [removeConnection, setSelection],
  );

  /**
   * New edge — initialise with sensible defaults: feeds_into / carries_data.
   */
  const onConnect = useCallback(
    (params: RFConnection) => {
      if (!params.source || !params.target) return;
      const id = (
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `conn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      ) as string;
      addConnection({
        id,
        from_block_id: params.source,
        to_block_id: params.target,
        from_port: (params.sourceHandle as Connection['from_port']) ?? 'right',
        to_port: (params.targetHandle as Connection['to_port']) ?? 'left',
        connection_type: 'feeds_into',
        carries_data: true,
        label: null,
        created_at: new Date().toISOString(),
      });
    },
    [addConnection],
  );

  /**
   * Live dataflow: when any block finishes a run, look at its outgoing
   * data-carrying connections and emit `arrow:data-flow` for each. The Result
   * block (and any future consumers) listen for this and update.
   *
   * The animation itself is handled by the DataFlowEdge custom edge type.
   */
  useEffect(() => {
    return eventBus.on('block:run:complete', ({ blockId, result }) => {
      const sourceBlock = useDocumentStore.getState().blocks[blockId];
      if (!sourceBlock) return;
      const allConnections = useDocumentStore.getState().connections;
      for (const conn of Object.values(allConnections)) {
        if (conn.from_block_id !== blockId) continue;
        if (!conn.carries_data) continue;
        eventBus.emit('arrow:data-flow', {
          connectionId: conn.id,
          sourceId: conn.from_block_id,
          targetId: conn.to_block_id,
          data: result,
        });
      }
    });
  }, []);

  return (
    <div className="absolute inset-0 stage-canvas-root">
      <style>{`
        .stage-canvas-root .react-flow,
        .stage-canvas-root .react-flow__pane,
        .stage-canvas-root .react-flow__renderer,
        .stage-canvas-root .react-flow__viewport,
        .stage-canvas-root .react-flow__background {
          background: transparent !important;
        }
        .stage-canvas-root .react-flow__attribution {
          display: none !important;
        }
        .stage-canvas-root .react-flow__minimap,
        .stage-canvas-root .react-flow__controls {
          display: none !important;
        }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: DEFAULT_EDGE_TYPE }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.25}
        maxZoom={2}
        panOnDrag={[1]}
        panActivationKeyCode="Space"
        selectionOnDrag
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(255,255,255,0.06)"
        />
      </ReactFlow>
    </div>
  );
}
