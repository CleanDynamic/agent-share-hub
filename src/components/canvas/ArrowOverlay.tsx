import { useState } from 'react';
import type { BlockArrow, CanvasBlock,
  ArrowType } from '@/lib/canvas-types';
import { ARROW_TYPE_META } from '@/lib/canvas-types';
import { getEdgeMidpoint, nearestEdge, orthogonalPath }
  from '@/lib/canvas-utils';

interface ArrowOverlayProps {
  arrows: BlockArrow[];
  blocks: CanvasBlock[];
  colWidth: number;
  rowHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  mode: 'edit' | 'view';
  // Live drawing
  drawingPathStr: string | null;
  drawingWaypoints: { x: number; y: number }[];
  onArrowDelete: (id: string) => void;
  onArrowTypeChange: (id: string, type: ArrowType)
    => void;
  onArrowLabelChange: (id: string, label: string)
    => void;
}

export function ArrowOverlay({
  arrows, blocks, colWidth, rowHeight,
  canvasWidth, canvasHeight, mode,
  drawingPathStr, drawingWaypoints,
  onArrowDelete, onArrowTypeChange, onArrowLabelChange,
}: ArrowOverlayProps) {

  const [selectedArrow, setSelectedArrow] =
    useState<string | null>(null);
  const [typePicker, setTypePicker] =
    useState<{
      arrowId: string;
      x: number; y: number
    } | null>(null);

  const blockMap = new Map(
    blocks.map(b => [b.id, b])
  );

  // Calculate orthogonal arrow path between two blocks
  const getArrowPath = (
    arrow: BlockArrow,
    overrideToBlockId?: string,
    overrideToEdge?: BlockArrow['toEdge'],
  ) => {
    const fromBlock = blockMap.get(arrow.fromBlockId);
    const toId = overrideToBlockId ?? arrow.toBlockId;
    const toBlock = blockMap.get(toId);
    if (!fromBlock || !toBlock) return null;

    const fromEdge = arrow.fromEdge;
    const toEdge = overrideToEdge ?? arrow.toEdge;

    const from = getEdgeMidpoint(
      fromBlock.position,
      fromEdge,
      colWidth, rowHeight
    );
    const to = getEdgeMidpoint(
      toBlock.position,
      toEdge,
      colWidth, rowHeight
    );
    const wps = arrow.waypoints ?? [];
    const path = orthogonalPath(
      from, fromEdge, to, toEdge, wps, rowHeight
    );
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;

    return { path, from, to, midX, midY };
  };

  // Render a single arrow path (visible + hit area)
  const renderArrowPath = (
    arrow: BlockArrow,
    pathStr: string,
    midX: number,
    midY: number,
    meta: { color: string; dash: string },
    keySuffix = '',
  ) => {
    const isSelected = selectedArrow === arrow.id;
    return (
      <g key={`${arrow.id}${keySuffix}`}>
        {/* Invisible thick hit area */}
        <path
          d={pathStr}
          fill="none"
          stroke="transparent"
          strokeWidth={30}
          style={{ cursor: 'pointer' }}
          onClick={e => {
            e.stopPropagation();
            setSelectedArrow(
              isSelected ? null : arrow.id
            );
            setTypePicker(
              isSelected ? null : {
                arrowId: arrow.id,
                x: midX,
                y: midY,
              }
            );
          }}
        />

        {/* Visible arrow path */}
        <path
          d={pathStr}
          fill="none"
          stroke={arrow.color ?? meta.color}
          strokeWidth={isSelected ? 4.5 : 3}
          strokeDasharray={meta.dash}
          markerEnd={`url(#arrow-${arrow.arrowType})`}
          style={{ transition: 'stroke-width 0.1s' }}
          opacity={0.80}
        />
      </g>
    );
  };

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: mode === 'edit'
          ? 'all' : 'none',
        zIndex: 8,
        overflow: 'visible',
      }}
      width={canvasWidth}
      height={canvasHeight}
    >
      <defs>
        {/* Arrow head markers for each type */}
        {Object.entries(ARROW_TYPE_META).map(
          ([type, meta]) => (
            <marker
              key={type}
              id={`arrow-${type}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="10"
              markerHeight="10"
              orient="auto-start-reverse"
            >
              <path
                d="M 0 0 L 10 5 L 0 10 z"
                fill={meta.color}
              />
            </marker>
          )
        )}
        {/* Drawing in progress marker */}
        <marker
          id="arrow-drawing"
          viewBox="0 0 10 10"
          refX="9" refY="5"
          markerWidth="10" markerHeight="10"
          orient="auto-start-reverse"
        >
          <path
            d="M 0 0 L 10 5 L 0 10 z"
            fill="rgba(232,87,26,0.60)"
          />
        </marker>
      </defs>

      {/* Rendered arrows */}
      {arrows.map(arrow => {
        const meta = ARROW_TYPE_META[arrow.arrowType];
        const isSelected = selectedArrow === arrow.id;

        // Multi-target arrows
        if (arrow.toBlockIds && arrow.toBlockIds.length > 0) {
          const fromBlock = blockMap.get(arrow.fromBlockId);
          if (!fromBlock) return null;

          // Calculate fork point: last waypoint, or exit stub
          const from = getEdgeMidpoint(
            fromBlock.position,
            arrow.fromEdge,
            colWidth, rowHeight
          );
          const wps = arrow.waypoints ?? [];
          const forkPoint = wps.length > 0
            ? wps[wps.length - 1]
            : from;

          // Render trunk (source → fork) once
          const trunkElements: React.ReactNode[] = [];

          if (wps.length > 0) {
            const trunkPath = orthogonalPath(
              from, arrow.fromEdge,
              forkPoint, null,
              wps.slice(0, -1),
              rowHeight
            );
            trunkElements.push(
              <path
                key={`${arrow.id}-trunk-hit`}
                d={trunkPath}
                fill="none"
                stroke="transparent"
                strokeWidth={30}
                style={{ cursor: 'pointer' }}
                onClick={e => {
                  e.stopPropagation();
                  setSelectedArrow(
                    isSelected ? null : arrow.id
                  );
                  setTypePicker(
                    isSelected ? null : {
                      arrowId: arrow.id,
                      x: forkPoint.x,
                      y: forkPoint.y,
                    }
                  );
                }}
              />,
              <path
                key={`${arrow.id}-trunk`}
                d={trunkPath}
                fill="none"
                stroke={arrow.color ?? meta.color}
                strokeWidth={isSelected ? 4.5 : 3}
                strokeDasharray={meta.dash}
                style={{ transition: 'stroke-width 0.1s' }}
                opacity={0.80}
              />
            );
          }

          // Render branch to each target
          const branchElements = arrow.toBlockIds.map(
            (targetId, idx) => {
              const toBlock = blockMap.get(targetId);
              if (!toBlock) return null;
              const toEdge = nearestEdge(
                forkPoint, toBlock.position,
                colWidth, rowHeight
              );
              const to = getEdgeMidpoint(
                toBlock.position, toEdge,
                colWidth, rowHeight
              );
              const branchFromEdge = wps.length > 0
                ? nearestEdge(
                    forkPoint,
                    fromBlock.position,
                    colWidth, rowHeight
                  )
                : arrow.fromEdge;
              const branchPath = orthogonalPath(
                wps.length > 0 ? forkPoint : from,
                branchFromEdge,
                to, toEdge,
                [],
                rowHeight
              );
              return renderArrowPath(
                arrow, branchPath,
                (forkPoint.x + to.x) / 2,
                (forkPoint.y + to.y) / 2,
                meta,
                `-branch-${idx}`
              );
            }
          );

          return (
            <g key={arrow.id}>
              {trunkElements}
              {branchElements}
            </g>
          );
        }

        // Single-target arrow
        const computed = getArrowPath(arrow);
        if (!computed) return null;

        return (
          <g key={arrow.id}>
            {renderArrowPath(
              arrow, computed.path,
              computed.midX, computed.midY, meta
            )}

            {/* Label chip at midpoint */}
            {arrow.label && (
              <g>
                <rect
                  x={computed.midX - 28}
                  y={computed.midY - 9}
                  width={56} height={18}
                  rx={4}
                  fill="rgba(10,10,16,0.90)"
                  stroke={arrow.color ?? meta.color}
                  strokeWidth={1}
                  strokeOpacity={0.4}
                />
                <text
                  x={computed.midX}
                  y={computed.midY + 4}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={700}
                  fontFamily="Inter, sans-serif"
                  fill={arrow.color ?? meta.color}
                  letterSpacing={0.5}
                >
                  {arrow.label}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Live drawing path */}
      {drawingPathStr && (
        <>
          <path
            d={drawingPathStr}
            fill="none"
            stroke="rgba(232,87,26,0.60)"
            strokeWidth={2}
            strokeDasharray="6,4"
            markerEnd="url(#arrow-drawing)"
            pointerEvents="none"
          />
          {/* Locked waypoint dots */}
          {drawingWaypoints.map((wp, i) => (
            <circle
              key={i}
              cx={wp.x}
              cy={wp.y}
              r={4}
              fill="#E8571A"
              stroke="rgba(6,6,10,0.90)"
              strokeWidth={2}
              pointerEvents="none"
            />
          ))}
        </>
      )}

      {/* Arrow type picker tooltip + instruction field */}
      {typePicker && mode === 'edit' && (() => {
        const arrow = arrows.find(
          a => a.id === typePicker.arrowId
        );
        if (!arrow) return null;
        return (
          <foreignObject
            x={typePicker.x - 130}
            y={typePicker.y - 210}
            width={260}
            height={200}
          >
            <div
              style={{
                background: 'rgba(10,10,16,0.98)',
                border:
                  '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                padding: 10,
                boxShadow:
                  '0 8px 32px rgba(0,0,0,0.60)',
              }}
            >
              <div style={{
                fontSize: 9, fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.10em',
                color: 'rgba(255,255,255,0.25)',
                marginBottom: 8,
                display: 'flex',
                justifyContent: 'space-between',
              }}>
                <span>Relationship</span>
                <button
                  onClick={() => {
                    onArrowDelete(arrow.id);
                    setTypePicker(null);
                    setSelectedArrow(null);
                  }}
                  style={{
                    background: 'none', border: 'none',
                    color: 'rgba(239,68,68,0.70)',
                    cursor: 'pointer', fontSize: 10,
                  }}
                >
                  Delete
                </button>
              </div>
              <div style={{
                display: 'flex', flexWrap: 'wrap',
                gap: 4,
              }}>
                {(Object.keys(ARROW_TYPE_META) as
                  ArrowType[]).map(type => {
                  const m = ARROW_TYPE_META[type];
                  const isActive =
                    arrow.arrowType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => {
                        onArrowTypeChange(
                          arrow.id, type
                        );
                        setTypePicker(null);
                      }}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 4, fontSize: 10,
                        cursor: 'pointer',
                        background: isActive
                          ? `${m.color}20`
                          : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${isActive
                          ? m.color
                          : 'rgba(255,255,255,0.08)'}`,
                        color: isActive
                          ? m.color
                          : 'rgba(255,255,255,0.45)',
                        fontWeight: isActive ? 700 : 400,
                      }}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>

              {/* Instruction / label text field */}
              <textarea
                defaultValue={arrow.label ?? ''}
                rows={3}
                placeholder="Arrow instruction…"
                onBlur={e =>
                  onArrowLabelChange(
                    arrow.id, e.target.value
                  )
                }
                style={{
                  marginTop: 8,
                  width: '100%',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  fontSize: 11,
                  fontFamily: 'Inter, sans-serif',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 6,
                  padding: '6px 8px',
                  resize: 'none',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </foreignObject>
        );
      })()}
    </svg>
  );
}
