import { useState } from 'react';
import { getNextRow } from '@/lib/canvas-utils';
import type { CanvasBlock, BlockPosition } from '@/lib/canvas-types';

interface CanvasInsertZoneProps {
  blocks: CanvasBlock[];
  colWidth: number;
  rowHeight: number;
  columnCount: number;
  onInsert: (
    type: string,
    position: Partial<BlockPosition>
  ) => void;
}

const QUICK_BLOCK_TYPES = [
  { type: 'text', label: 'Text', accent: 'rgba(255,255,255,0.20)' },
  { type: 'prompt', label: 'Prompt', accent: '#E8571A' },
  { type: 'code', label: 'Code', accent: '#3B82F6' },
  { type: 'result', label: 'Result', accent: '#22C55E' },
  { type: 'image', label: 'Image', accent: '#F59E0B' },
  { type: 'agent_config', label: 'Agent', accent: '#7C3AED' },
  { type: 'workflow', label: 'Workflow', accent: '#2EC4B6' },
  { type: 'comparison', label: 'Compare', accent: '#EC4899' },
  { type: 'tool_setup', label: 'Tool', accent: '#06B6D4' },
  { type: 'model_params', label: 'Model', accent: '#A78BFA' },
  { type: 'tutorial_step', label: 'Tutorial', accent: '#E8571A' },
  { type: 'section_heading', label: 'Heading', accent: 'rgba(255,255,255,0.40)' },
  { type: 'resource', label: 'Resource', accent: '#64748B' },
];

export function CanvasInsertZone({
  blocks, colWidth: _colWidth, rowHeight,
  columnCount: _columnCount, onInsert,
}: CanvasInsertZoneProps) {
  const [pickerPos, setPickerPos] =
    useState<{ x: number; y: number; row: number } | null>(null);

  // "+" button renders at the bottom of the canvas — below the lowest block
  const nextRow = getNextRow(blocks);
  const y = (nextRow - 1) * rowHeight + 16;

  return (
    <>
      {/* Bottom insert button */}
      <div style={{
        position: 'absolute',
        left: '50%',
        top: y,
        transform: 'translateX(-50%)',
        zIndex: 15,
      }}>
        <button
          type="button"
          onClick={e => {
            const rect = (
              e.currentTarget as HTMLElement
            ).getBoundingClientRect();
            setPickerPos({
              x: rect.x,
              y: rect.y,
              row: nextRow,
            });
          }}
          style={{
            width: 32, height: 32,
            borderRadius: '50%',
            background: 'rgba(232,87,26,0.10)',
            border: '1px dashed rgba(232,87,26,0.35)',
            color: 'rgba(232,87,26,0.70)',
            fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background =
              'rgba(232,87,26,0.18)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background =
              'rgba(232,87,26,0.10)';
          }}
        >
          +
        </button>
      </div>

      {/* Block type picker popover */}
      {pickerPos && (
        <>
          <div
            style={{
              position: 'fixed', inset: 0,
              zIndex: 99,
            }}
            onClick={() => setPickerPos(null)}
          />
          <div style={{
            position: 'fixed',
            left: Math.min(pickerPos.x, window.innerWidth - 310),
            top: Math.max(10, Math.min(pickerPos.y - 10, window.innerHeight - 250)),
            transform: pickerPos.y > 300 ? 'translateY(-100%)' : 'none',
            background: 'rgba(10,10,16,0.98)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12,
            padding: 12,
            width: 290,
            maxHeight: 'calc(100vh - 40px)',
            overflowY: 'auto',
            display: 'flex', flexWrap: 'wrap',
            gap: 5, zIndex: 100,
            boxShadow: '0 12px 40px rgba(0,0,0,0.60)',
          }}>
            <div style={{
              width: '100%',
              fontSize: 9, fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'rgba(255,255,255,0.25)',
              marginBottom: 4,
            }}>
              Add block
            </div>
            {QUICK_BLOCK_TYPES.map(bt => (
              <button
                key={bt.type}
                type="button"
                onClick={() => {
                  onInsert(bt.type, {
                    col: 1,
                    row: pickerPos.row,
                    colSpan: 12,
                    rowSpan: 1,
                  });
                  setPickerPos(null);
                }}
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  fontSize: 11, cursor: 'pointer',
                  background: `${bt.accent}12`,
                  border: `1px solid ${bt.accent}30`,
                  color: bt.accent,
                  fontWeight: 600,
                  transition: 'all 0.10s',
                }}
              >
                {bt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
