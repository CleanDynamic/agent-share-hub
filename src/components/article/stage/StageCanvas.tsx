import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  useReactFlow,
  type Connection as RFConnection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useDocumentStore } from '@/lib/documentStore';
import { eventBus } from '@/lib/eventBus';
import {
  BLOCK_TYPE_ACCENT,
  clearDragType,
  getDragType,
  insertBlockInStage,
  isBlockNewlyCreated,
  subscribeNewlyCreated,
} from '@/lib/blockInsertion';
import type { Block, BlockType, Connection } from '@/types/document';
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
  /** Show React Flow's MiniMap inside the canvas. Default false. */
  showMiniMap?: boolean;
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

const SNAP = 20;

function snap(v: number): number {
  return Math.round(v / SNAP) * SNAP;
}

function blockToNode(block: Block, isNew: boolean): Node {
  return {
    id: block.id,
    type: BLOCK_TYPE_TO_NODE[block.type],
    position: { x: block.position_x, y: block.position_y },
    data: { label: block.name ?? block.type, blockId: block.id },
    width: block.width,
    height: block.height,
    className: isNew ? 'block-scale-in' : undefined,
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
  return (
    <ReactFlowProvider>
      <StageCanvasInner stageId={stageId} />
    </ReactFlowProvider>
  );
}

function StageCanvasInner({ stageId }: StageCanvasProps) {
  const blocks = useDocumentStore((s) => s.blocks);
  const connections = useDocumentStore((s) => s.connections);
  const moveBlock = useDocumentStore((s) => s.moveBlock);
  const updateBlock = useDocumentStore((s) => s.updateBlock);
  const removeBlock = useDocumentStore((s) => s.removeBlock);
  const addConnection = useDocumentStore((s) => s.addConnection);
  const removeConnection = useDocumentStore((s) => s.removeConnection);
  const setSelection = useDocumentStore((s) => s.setSelection);

  const { screenToFlowPosition } = useReactFlow();

  // Force re-render whenever the newly-created set changes so the
  // .block-scale-in class actually paints (the set lives outside Zustand).
  const [, setNewTick] = useState(0);
  useEffect(() => {
    return subscribeNewlyCreated(() => setNewTick((n) => n + 1));
  }, []);

  const nodes = useMemo<Node[]>(
    () =>
      Object.values(blocks)
        .filter((b) => b.stage_id === stageId)
        .map((b) => blockToNode(b, isBlockNewlyCreated(b.id))),
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

  // ── Drag-and-drop from Block Library ────────────────────────────
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [ghost, setGhost] = useState<{
    screenX: number;
    screenY: number;
    type: BlockType;
  } | null>(null);

  const onDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const isBlockDrag = e.dataTransfer.types.includes('application/x-block-type');
      if (!isBlockDrag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      const type = getDragType();
      if (!type) return;
      // Snap the ghost in flow coords, then convert back to screen for paint.
      const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const sx = snap(flow.x);
      const sy = snap(flow.y);
      // Compute the screen position for the snapped flow point so the ghost
      // sits on the grid the block will land on. Use a rect-relative offset
      // by reversing the screenToFlowPosition delta.
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const flowAtCursor = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const screenX = e.clientX - (flowAtCursor.x - sx);
      const screenY = e.clientY - (flowAtCursor.y - sy);
      setGhost({
        screenX: screenX - rect.left,
        screenY: screenY - rect.top,
        type,
      });
    },
    [screenToFlowPosition],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const type = (e.dataTransfer.getData('application/x-block-type') ||
        getDragType()) as BlockType | '';
      if (!type) return;
      e.preventDefault();
      const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const x = snap(flow.x);
      const y = snap(flow.y);
      insertBlockInStage(stageId, type, { position: { x, y } });
      setGhost(null);
      clearDragType();
    },
    [screenToFlowPosition, stageId],
  );

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Only clear when actually leaving the wrapper, not when crossing into a
    // child element.
    if (e.currentTarget === e.target) setGhost(null);
  }, []);

  // ── Live data flow (unchanged) ──────────────────────────────────
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
    <div
      ref={wrapperRef}
      className="absolute inset-0 stage-canvas-root"
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
    >
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
        @keyframes block-scale-in {
          from { transform: scale(0.96); opacity: 0.6; }
          to   { transform: scale(1);    opacity: 1; }
        }
        .stage-canvas-root .react-flow__node.block-scale-in {
          animation: block-scale-in 200ms ease-out;
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
      {ghost && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: ghost.screenX,
            top: ghost.screenY,
            width: 220,
            height: 120,
            border: `1px dashed ${BLOCK_TYPE_ACCENT[ghost.type] ?? 'rgba(255,255,255,0.5)'}`,
            borderRadius: 8,
            background: 'rgba(255,255,255,0.02)',
            opacity: 0.4,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        />
      )}
    </div>
  );
}
