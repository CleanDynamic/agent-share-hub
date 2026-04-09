import { useState } from 'react';
import { buildCanvasTOC, type TOCEntry } from '@/lib/canvas-utils';
import type { CanvasBlock, CanvasStage } from '@/lib/canvas-types';

interface CanvasTOCProps {
  open: boolean;
  onToggle: () => void;
  stages: CanvasStage[];
  blocks: CanvasBlock[];
  mode: 'edit' | 'view';
  onBlockClick: (blockId: string) => void;
  onStageAdd?: (title: string) => void;
  onStageEdit?: (stageId: string, patch: Partial<CanvasStage>) => void;
  onStageDelete?: (stageId: string) => void;
}

export function CanvasTOC({
  open, onToggle, stages, blocks, mode,
  onBlockClick, onStageAdd,
  onStageEdit, onStageDelete,
}: CanvasTOCProps) {

  const [collapsed, setCollapsed] =
    useState<Set<string>>(new Set());
  const [addingStage, setAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [editingStage, setEditingStage] =
    useState<string | null>(null);

  const toc = buildCanvasTOC(stages, blocks);

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const STAGE_COLOURS_DISPLAY = [
    '#E8571A', '#2EC4B6', '#7C3AED',
    '#3B82F6', '#F59E0B', '#22C55E',
  ];

  return (
    <>
      {/* TOC toggle tab */}
      <div style={{
        width: open ? 200 : 32,
        flexShrink: 0,
        transition: 'width 0.20s ease',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        overflow: 'hidden',
        background: 'rgba(6,6,10,0.95)',
        position: 'relative',
      }}>

        {/* Toggle button */}
        <button
          onClick={onToggle}
          style={{
            position: 'absolute',
            top: 16,
            right: open ? 8 : 6,
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.30)',
            cursor: 'pointer', fontSize: 11,
            fontWeight: 700,
            fontFamily: 'Inter, sans-serif',
            writingMode: open ? 'horizontal-tb' : 'vertical-rl',
            letterSpacing: open ? 0 : '0.12em',
            textTransform: 'uppercase',
            padding: '4px',
            zIndex: 2,
            transition: 'color 0.15s',
            whiteSpace: 'nowrap',
          }}
          title={open ? 'Close TOC' : 'Open TOC'}
        >
          {open ? '‹ Hide' : 'TOC'}
        </button>

        {/* TOC content */}
        {open && (
          <div style={{
            flex: 1, overflowY: 'auto',
            padding: '16px 0 16px 0',
            paddingTop: 44,
          }}>
            {/* Header */}
            <div style={{
              padding: '0 12px 10px 12px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              marginBottom: 8,
            }}>
              <div style={{
                fontSize: 9, fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                color: 'rgba(255,255,255,0.22)',
              }}>
                Contents
              </div>
            </div>

            {/* TOC entries */}
            {toc.map(entry => renderTOCEntry(entry))}

            {/* Empty state */}
            {toc.length === 0 && (
              <div style={{
                padding: '20px 12px',
                fontSize: 11,
                color: 'rgba(255,255,255,0.18)',
                fontStyle: 'italic',
                lineHeight: 1.6,
              }}>
                Add blocks to build your contents
              </div>
            )}

            {/* Add stage button — edit mode */}
            {mode === 'edit' && (
              <div style={{
                padding: '12px 12px 0 12px',
                borderTop: '1px solid rgba(255,255,255,0.05)',
                marginTop: 12,
              }}>
                {!addingStage ? (
                  <button
                    type="button"
                    onClick={() => setAddingStage(true)}
                    style={{
                      width: '100%',
                      padding: '6px 0',
                      background: 'none',
                      border: '1px dashed rgba(255,255,255,0.12)',
                      borderRadius: 6, fontSize: 11,
                      color: 'rgba(255,255,255,0.30)',
                      cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    + Add stage
                  </button>
                ) : (
                  <div>
                    <input
                      autoFocus
                      value={newStageName}
                      onChange={e => setNewStageName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newStageName.trim()) {
                          onStageAdd?.(newStageName.trim());
                          setNewStageName('');
                          setAddingStage(false);
                        }
                        if (e.key === 'Escape') {
                          setAddingStage(false);
                          setNewStageName('');
                        }
                      }}
                      placeholder="Stage name..."
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 6,
                        padding: '6px 8px',
                        fontSize: 12,
                        color: '#fff', outline: 'none',
                        boxSizing: 'border-box',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    />
                    <div style={{
                      fontSize: 10, marginTop: 4,
                      color: 'rgba(255,255,255,0.20)',
                    }}>
                      Press Enter to create
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );

  function renderTOCEntry(
    entry: TOCEntry,
    depth = 0
  ): React.ReactNode {
    const isCollapsed = collapsed.has(entry.id);
    const isStage = entry.type === 'stage';
    const stageObj = isStage
      ? stages.find(s => s.id === entry.id) : null;
    const stageColour = stageObj
      ? stageObj.colour.replace('0.06', '0.80')
      : 'rgba(255,255,255,0.25)';

    return (
      <div key={entry.id}>
        {/* Entry button */}
        <div
          style={{
            display: 'flex', alignItems: 'center',
            gap: 5,
            padding: isStage
              ? '5px 12px' : '3px 12px 3px 20px',
            cursor: 'pointer',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e =>
            (e.currentTarget as HTMLElement)
              .style.background = 'rgba(255,255,255,0.04)'
          }
          onMouseLeave={e =>
            (e.currentTarget as HTMLElement)
              .style.background = 'transparent'
          }
          onClick={() => {
            if (isStage) {
              toggleCollapse(entry.id);
            } else if (entry.blockId) {
              onBlockClick(entry.blockId);
            }
          }}
        >
          {/* Stage number / block index */}
          {entry.number && (
            <span style={{
              fontSize: 9, fontWeight: 700,
              color: isStage
                ? stageColour
                : 'rgba(255,255,255,0.25)',
              flexShrink: 0,
              minWidth: 16,
              fontFamily: 'monospace',
            }}>
              {entry.number}
            </span>
          )}

          {/* Label */}
          <span style={{
            fontSize: isStage ? 12 : 11,
            fontWeight: isStage ? 700 : 400,
            color: isStage
              ? 'rgba(255,255,255,0.75)'
              : 'rgba(255,255,255,0.45)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.5,
          }}>
            {entry.label || 'Untitled'}
          </span>

          {/* Collapse toggle for stages */}
          {isStage && entry.children.length > 0 && (
            <span style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.20)',
              flexShrink: 0,
            }}>
              {isCollapsed ? '▸' : '▾'}
            </span>
          )}
        </div>

        {/* Children (blocks within stage) */}
        {isStage && !isCollapsed &&
          entry.children.map(child =>
            renderTOCEntry(child, depth + 1)
          )
        }
      </div>
    );
  }
}
