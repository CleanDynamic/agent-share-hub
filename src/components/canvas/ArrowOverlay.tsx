import { useState } from 'react';
import type { BlockArrow, CanvasBlock,
  ArrowType } from '@/lib/canvas-types';
import { ARROW_TYPE_META } from '@/lib/canvas-types';
import { getEdgeMidpoint, bezierPath }
  from '@/lib/canvas-utils';

interface ArrowOverlayProps {
  arrows: BlockArrow[];
  blocks: CanvasBlock[];
  colWidth: number;
  rowHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  mode: 'edit' | 'view';
  // Arrow drawing state from parent
  drawingFrom: {
    blockId: string;
    edge: 'top'|'right'|'bottom'|'left'
  } | null;
  mousePos: { x: number; y: number } | null;
  onArrowComplete: (
    toBlockId: string,
    toEdge: 'top'|'right'|'bottom'|'left'
  ) => void;
  onArrowDelete: (id: string) => void;
  onArrowTypeChange: (id: string, type: ArrowType)
    => void;
  onArrowLabelChange: (id: string, label: string)
    => void;
}

export function ArrowOverlay({
  arrows, blocks, colWidth, rowHeight,
  canvasWidth, canvasHeight, mode,
  drawingFrom, mousePos,
  onArrowComplete, onArrowDelete,
  onArrowTypeChange, onArrowLabelChange,
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

  // Calculate arrow path between two blocks
  const getArrowPath = (arrow: BlockArrow) => {
    const fromBlock = blockMap.get(arrow.fromBlockId);
    const toBlock = blockMap.get(arrow.toBlockId);
    if (!fromBlock || !toBlock) return null;

    const from = getEdgeMidpoint(
      fromBlock.position,
      arrow.fromEdge,
      colWidth, rowHeight
    );
    const to = getEdgeMidpoint(
      toBlock.position,
      arrow.toEdge,
      colWidth, rowHeight
    );
    const path = bezierPath(
      from, to, arrow.fromEdge, arrow.toEdge
    );
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;

    return { path, from, to, midX, midY };
  };

  // Live drawing line from connection point to cursor
  const getDrawingPath = () => {
    if (!drawingFrom || !mousePos) return null;
    const fromBlock = blockMap.get(drawingFrom.blockId);
    if (!fromBlock) return null;
    const from = getEdgeMidpoint(
      fromBlock.position,
      drawingFrom.edge,
      colWidth, rowHeight
    );
    return bezierPath(
      from, mousePos,
      drawingFrom.edge, 'left'
    );
  };

  const drawingPath = getDrawingPath();

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
              markerWidth="6"
              markerHeight="6"
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
          markerWidth="6" markerHeight="6"
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
        const computed = getArrowPath(arrow);
        if (!computed) return null;
        const meta = ARROW_TYPE_META[arrow.arrowType];
        const isSelected = selectedArrow === arrow.id;

        return (
          <g key={arrow.id}>
            {/* Invisible thick hit area */}
            <path
              d={computed.path}
              fill="none"
              stroke="transparent"
              strokeWidth={20}
              style={{ cursor: 'pointer' }}
              onClick={e => {
                e.stopPropagation();
                setSelectedArrow(
                  isSelected ? null : arrow.id
                );
                setTypePicker(
                  isSelected ? null : {
                    arrowId: arrow.id,
                    x: computed.midX,
                    y: computed.midY,
                  }
                );
              }}
            />

            {/* Visible arrow path */}
            <path
              d={computed.path}
              fill="none"
              stroke={arrow.color ?? meta.color}
              strokeWidth={isSelected ? 2.5 : 1.5}
              strokeDasharray={meta.dash}
              markerEnd={`url(#arrow-${arrow.arrowType})`}
              style={{ transition: 'stroke-width 0.1s' }}
              opacity={0.80}
            />

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
      {drawingPath && (
        <path
          d={drawingPath}
          fill="none"
          stroke="rgba(232,87,26,0.60)"
          strokeWidth={2}
          strokeDasharray="6,4"
          markerEnd="url(#arrow-drawing)"
          pointerEvents="none"
        />
      )}

      {/* Arrow type picker tooltip */}
      {typePicker && mode === 'edit' && (() => {
        const arrow = arrows.find(
          a => a.id === typePicker.arrowId
        );
        if (!arrow) return null;
        return (
          <foreignObject
            x={typePicker.x - 110}
            y={typePicker.y - 130}
            width={220}
            height={120}
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
            </div>
          </foreignObject>
        );
      })()}
    </svg>
  );
}
