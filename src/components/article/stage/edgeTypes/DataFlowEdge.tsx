/**
 * DataFlowEdge — single React Flow custom edge implementing every
 * `connection_type` variant. The visual treatment comes from the connection's
 * `connection_type` (and optional `customColor`) which we read out of the
 * documentStore by id.
 *
 * Data-flow animation: when an `arrow:data-flow` event fires for this edge,
 * we sweep a teal gradient marker along the edge path over 400ms using
 * SVG `<animateMotion>`.
 */

import * as React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';

import { useDocumentStore } from '@/lib/documentStore';
import { eventBus } from '@/lib/eventBus';
import type { ConnectionType } from '@/types/document';

const COLOR: Record<ConnectionType, string> = {
  feeds_into: '#2EC4B6',
  alternative_to: 'rgba(255,255,255,0.4)',
  depends_on: '#E8571A',
  contradicts: '#EF4444',
  references: 'rgba(255,255,255,0.5)',
  custom: '#FFFFFF',
};

interface StyleSpec {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  markerEnd?: string;
}

function styleFor(type: ConnectionType, customColor?: string): StyleSpec {
  switch (type) {
    case 'alternative_to':
      return {
        stroke: COLOR.alternative_to,
        strokeWidth: 1.5,
        strokeDasharray: '6 4',
      };
    case 'depends_on':
      return {
        stroke: COLOR.depends_on,
        strokeWidth: 2,
      };
    case 'contradicts':
      return { stroke: COLOR.contradicts, strokeWidth: 2 };
    case 'references':
      return {
        stroke: COLOR.references,
        strokeWidth: 1.5,
        strokeDasharray: '2 4',
      };
    case 'custom':
      return { stroke: customColor || COLOR.custom, strokeWidth: 2 };
    case 'feeds_into':
    default:
      return { stroke: COLOR.feeds_into, strokeWidth: 2 };
  }
}

export function DataFlowEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    selected,
  } = props;

  const conn = useDocumentStore((s) => s.connections[id]);
  const type: ConnectionType = conn?.connection_type ?? 'feeds_into';
  const customColor = (conn?.properties as Record<string, unknown> | undefined)
    ?.color as string | undefined;
  const label = conn?.label ?? undefined;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const style = styleFor(type, customColor);

  // Sweep marker — a small teal dot that traverses the edge whenever the
  // source emits data.
  const [sweepKey, setSweepKey] = React.useState(0);
  React.useEffect(() => {
    return eventBus.on('arrow:data-flow', (p) => {
      if (p.connectionId === id) setSweepKey((k) => k + 1);
    });
  }, [id]);

  const pathId = `edge-path-${id}`;
  const sweepColor = type === 'feeds_into' ? '#2EC4B6' : style.stroke;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: style.stroke,
          strokeWidth: selected ? style.strokeWidth + 0.5 : style.strokeWidth,
          strokeDasharray: style.strokeDasharray,
          opacity: selected ? 1 : 0.85,
        }}
      />

      {/* Hidden duplicate path used purely as the motion track. */}
      <path id={pathId} d={edgePath} fill="none" stroke="none" />

      {/* Sweep marker — keyed so each event re-mounts the animation. */}
      {sweepKey > 0 && (
        <g key={sweepKey} pointerEvents="none">
          <circle r={4} fill={sweepColor} opacity={0.95}>
            <animateMotion dur="0.4s" repeatCount="1" fill="freeze">
              <mpath href={`#${pathId}`} />
            </animateMotion>
            <animate
              attributeName="opacity"
              values="0;1;1;0"
              dur="0.4s"
              repeatCount="1"
              fill="freeze"
            />
          </circle>
        </g>
      )}

      {/* Marker overlays for depends_on (diamond) and contradicts (X). */}
      {type === 'depends_on' && (
        <g
          transform={`translate(${targetX} ${targetY}) rotate(45)`}
          pointerEvents="none"
        >
          <rect
            x={-5}
            y={-5}
            width={10}
            height={10}
            fill={COLOR.depends_on}
            stroke="rgba(0,0,0,0.4)"
            strokeWidth={0.5}
          />
        </g>
      )}
      {type === 'contradicts' && (
        <g pointerEvents="none">
          <circle
            cx={(sourceX + targetX) / 2}
            cy={(sourceY + targetY) / 2}
            r={7}
            fill={COLOR.contradicts}
          />
          <text
            x={(sourceX + targetX) / 2}
            y={(sourceY + targetY) / 2 + 3}
            textAnchor="middle"
            fontSize={9}
            fontWeight={700}
            fill="white"
          >
            ×
          </text>
        </g>
      )}

      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 4,
              background: 'rgba(20,20,28,0.9)',
              color: 'rgba(255,255,255,0.85)',
              border: `1px solid ${style.stroke}`,
            }}
            className="nodrag nopan"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default DataFlowEdge;
