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
  onBlockChange?: (id: string, patch: Partial<CanvasBlock>) => void;
  onBlockDepthChange?: (id: string, depth: number) => void;
  onStageReorder?: (newStages: CanvasStage[]) => void;
  onBlockReorder?: (stageId: string, newBlockIds: string[]) => void;
}

type DragItem =
  | { kind: 'stage'; stageId: string }
  | { kind: 'block'; blockId: string; stageId: string };

type DropIndicator =
  | { kind: 'stage'; stageId: string; position: 'before' | 'after' }
  | { kind: 'block'; stageId: string; blockId: string; position: 'before' | 'after' }
  | null;

export function CanvasTOC({
  open, onToggle, stages, blocks, mode,
  onBlockClick, onStageAdd,
  onBlockChange, onBlockDepthChange,
  onStageReorder, onBlockReorder,
}: CanvasTOCProps) {

  const [collapsed, setCollapsed] =
    useState<Set<string>>(new Set());
  const [addingStage, setAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator>(null);

  const toc = buildCanvasTOC(stages, blocks);

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startEditingBlock = (block: CanvasBlock) => {
    setEditingBlockId(block.id);
    setEditingValue(
      block.subheading || block.type?.replace(/_/g, ' ') || ''
    );
  };

  const commitBlockEdit = () => {
    if (editingBlockId && onBlockChange) {
      onBlockChange(editingBlockId, {
        subheading: editingValue.trim() || null,
      });
    }
    setEditingBlockId(null);
    setEditingValue('');
  };

  const cancelBlockEdit = () => {
    setEditingBlockId(null);
    setEditingValue('');
  };

  // ── Stage drag/drop reordering ──────────────────
  const handleStageDragStart = (stageId: string) => (e: React.DragEvent) => {
    setDragItem({ kind: 'stage', stageId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleStageDragOver = (stageId: string) => (e: React.DragEvent) => {
    if (!dragItem || dragItem.kind !== 'stage') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position = e.clientY < midpoint ? 'before' : 'after';
    setDropIndicator({ kind: 'stage', stageId, position });
  };

  const handleStageDrop = (targetStageId: string) => (e: React.DragEvent) => {
    if (!dragItem || dragItem.kind !== 'stage') return;
    e.preventDefault();
    const fromId = dragItem.stageId;
    if (fromId === targetStageId) {
      setDragItem(null);
      setDropIndicator(null);
      return;
    }
    const sorted = [...stages].sort((a, b) => a.stageNumber - b.stageNumber);
    const fromIdx = sorted.findIndex(s => s.id === fromId);
    const targetIdx = sorted.findIndex(s => s.id === targetStageId);
    if (fromIdx === -1 || targetIdx === -1) {
      setDragItem(null);
      setDropIndicator(null);
      return;
    }
    const insertPos = dropIndicator?.kind === 'stage' && dropIndicator.position === 'after'
      ? targetIdx + 1
      : targetIdx;

    const moved = [...sorted];
    const [item] = moved.splice(fromIdx, 1);
    const adjustedInsert = insertPos > fromIdx ? insertPos - 1 : insertPos;
    moved.splice(adjustedInsert, 0, item);

    // Reassign stageNumbers sequentially
    const renumbered = moved.map((s, i) => ({
      ...s,
      stageNumber: i + 1,
    }));

    onStageReorder?.(renumbered);
    setDragItem(null);
    setDropIndicator(null);
  };

  // ── Block drag/drop reordering within stage ────
  const handleBlockDragStart = (blockId: string, stageId: string) => (e: React.DragEvent) => {
    setDragItem({ kind: 'block', blockId, stageId });
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  };

  const handleBlockDragOver = (stageId: string, blockId: string) => (e: React.DragEvent) => {
    if (!dragItem || dragItem.kind !== 'block') return;
    if (dragItem.stageId !== stageId) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position = e.clientY < midpoint ? 'before' : 'after';
    setDropIndicator({ kind: 'block', stageId, blockId, position });
  };

  const handleBlockDrop = (stageId: string, targetBlockId: string) => (e: React.DragEvent) => {
    if (!dragItem || dragItem.kind !== 'block') return;
    if (dragItem.stageId !== stageId) return;
    e.preventDefault();
    e.stopPropagation();
    const fromId = dragItem.blockId;
    if (fromId === targetBlockId) {
      setDragItem(null);
      setDropIndicator(null);
      return;
    }
    const stage = stages.find(s => s.id === stageId);
    if (!stage) {
      setDragItem(null);
      setDropIndicator(null);
      return;
    }
    const ids = [...stage.blockIds];
    const fromIdx = ids.indexOf(fromId);
    const targetIdx = ids.indexOf(targetBlockId);
    if (fromIdx === -1 || targetIdx === -1) {
      setDragItem(null);
      setDropIndicator(null);
      return;
    }
    const insertPos = dropIndicator?.kind === 'block' && dropIndicator.position === 'after'
      ? targetIdx + 1
      : targetIdx;

    const moved = [...ids];
    moved.splice(fromIdx, 1);
    const adjustedInsert = insertPos > fromIdx ? insertPos - 1 : insertPos;
    moved.splice(adjustedInsert, 0, fromId);

    onBlockReorder?.(stageId, moved);
    setDragItem(null);
    setDropIndicator(null);
  };

  const handleDragEnd = () => {
    setDragItem(null);
    setDropIndicator(null);
  };

  return (
    <>
      {/* TOC toggle tab */}
      <div style={{
        width: open ? 220 : 32,
        flexShrink: 0,
        transition: 'width 0.20s ease',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        overflow: 'hidden',
        background: 'rgba(6,6,10,0.55)',
        backdropFilter: 'blur(16px)',
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
  ): React.ReactNode {
    const isCollapsed = collapsed.has(entry.id);
    const isStage = entry.type === 'stage';
    const stageObj = isStage
      ? stages.find(s => s.id === entry.id) : null;
    const stageColour = stageObj
      ? stageObj.colour.replace('0.06', '0.80')
      : 'rgba(255,255,255,0.25)';

    const isDropBefore = isStage
      && dropIndicator?.kind === 'stage'
      && dropIndicator.stageId === entry.id
      && dropIndicator.position === 'before';
    const isDropAfter = isStage
      && dropIndicator?.kind === 'stage'
      && dropIndicator.stageId === entry.id
      && dropIndicator.position === 'after';

    return (
      <div
        key={entry.id}
        draggable={mode === 'edit' && isStage}
        onDragStart={isStage ? handleStageDragStart(entry.id) : undefined}
        onDragOver={isStage ? handleStageDragOver(entry.id) : undefined}
        onDrop={isStage ? handleStageDrop(entry.id) : undefined}
        onDragEnd={handleDragEnd}
        style={{ position: 'relative' }}
      >
        {/* Stage drop indicator — before */}
        {isDropBefore && (
          <div style={{
            position: 'absolute',
            left: 0, right: 0, top: -1,
            height: 2,
            background: '#8B4513',
            zIndex: 5,
          }} />
        )}

        {/* Entry row */}
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
            ((e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.12)')
          }
          onMouseLeave={e =>
            ((e.currentTarget as HTMLElement).style.background = 'transparent')
          }
          onClick={() => {
            if (isStage) {
              toggleCollapse(entry.id);
            } else if (entry.blockId && editingBlockId !== entry.blockId) {
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

          {/* Label — editable for blocks */}
          {!isStage && entry.blockId && editingBlockId === entry.blockId ? (
            <input
              autoFocus
              value={editingValue}
              onClick={(e) => e.stopPropagation()}
              onChange={e => setEditingValue(e.target.value)}
              onBlur={commitBlockEdit}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitBlockEdit();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelBlockEdit();
                }
              }}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(139,69,19,0.4)',
                borderRadius: 4,
                padding: '2px 4px',
                fontSize: 11,
                color: '#fff',
                outline: 'none',
                fontFamily: 'Inter, sans-serif',
                minWidth: 0,
              }}
            />
          ) : (
            <span
              style={{
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
              }}
              onClick={(e) => {
                if (!isStage && entry.blockId && mode === 'edit') {
                  e.stopPropagation();
                  const block = blocks.find(b => b.id === entry.blockId);
                  if (block) startEditingBlock(block);
                }
              }}
            >
              {entry.label || 'Untitled'}
            </span>
          )}

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

        {/* Stage drop indicator — after */}
        {isDropAfter && (
          <div style={{
            position: 'absolute',
            left: 0, right: 0, bottom: -1,
            height: 2,
            background: '#8B4513',
            zIndex: 5,
          }} />
        )}

        {/* Children (blocks within stage) */}
        {isStage && !isCollapsed && (
          <div>
            {entry.children.map(child =>
              renderBlockEntry(child, entry.id)
            )}
          </div>
        )}
      </div>
    );
  }

  function renderBlockEntry(
    entry: TOCEntry,
    parentStageId: string
  ): React.ReactNode {
    if (!entry.blockId) return null;
    const block = blocks.find(b => b.id === entry.blockId);
    if (!block) return null;
    const depth = Math.max(0, Math.min(2, block.depth ?? 0));

    const isDropBefore = dropIndicator?.kind === 'block'
      && dropIndicator.stageId === parentStageId
      && dropIndicator.blockId === entry.blockId
      && dropIndicator.position === 'before';
    const isDropAfter = dropIndicator?.kind === 'block'
      && dropIndicator.stageId === parentStageId
      && dropIndicator.blockId === entry.blockId
      && dropIndicator.position === 'after';

    const isEditing = editingBlockId === entry.blockId;
    const baseIndent = 20;
    const depthIndent = depth * 14;

    return (
      <div
        key={entry.id}
        draggable={mode === 'edit'}
        onDragStart={handleBlockDragStart(entry.blockId, parentStageId)}
        onDragOver={handleBlockDragOver(parentStageId, entry.blockId)}
        onDrop={handleBlockDrop(parentStageId, entry.blockId)}
        onDragEnd={handleDragEnd}
        style={{ position: 'relative' }}
      >
        {/* Block drop indicator — before */}
        {isDropBefore && (
          <div style={{
            position: 'absolute',
            left: baseIndent, right: 0, top: -1,
            height: 2,
            background: '#8B4513',
            zIndex: 5,
          }} />
        )}

        <div
          className="toc-block-row"
          style={{
            display: 'flex', alignItems: 'center',
            gap: 5,
            padding: `3px 12px 3px ${baseIndent + depthIndent}px`,
            cursor: 'pointer',
            transition: 'background 0.1s',
            position: 'relative',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.12)';
            const controls = (e.currentTarget as HTMLElement).querySelector('.depth-controls') as HTMLElement;
            if (controls) controls.style.opacity = '1';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            const controls = (e.currentTarget as HTMLElement).querySelector('.depth-controls') as HTMLElement;
            if (controls) controls.style.opacity = '0';
          }}
          onClick={() => {
            if (entry.blockId && !isEditing) {
              onBlockClick(entry.blockId);
            }
          }}
        >
          {/* Block index */}
          {entry.number && (
            <span style={{
              fontSize: 9, fontWeight: 700,
              color: 'rgba(255,255,255,0.25)',
              flexShrink: 0,
              minWidth: 28,
              fontFamily: 'monospace',
            }}>
              {entry.number}
            </span>
          )}

          {/* Label or input */}
          {isEditing ? (
            <input
              autoFocus
              value={editingValue}
              onClick={(e) => e.stopPropagation()}
              onChange={e => setEditingValue(e.target.value)}
              onBlur={commitBlockEdit}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitBlockEdit();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelBlockEdit();
                }
              }}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(139,69,19,0.4)',
                borderRadius: 4,
                padding: '2px 4px',
                fontSize: 11,
                color: '#fff',
                outline: 'none',
                fontFamily: 'Inter, sans-serif',
                minWidth: 0,
              }}
            />
          ) : (
            <span
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: 'rgba(255,255,255,0.45)',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.5,
              }}
              onClick={(e) => {
                if (mode === 'edit') {
                  e.stopPropagation();
                  startEditingBlock(block);
                }
              }}
            >
              {entry.label || 'Untitled'}
            </span>
          )}

          {/* Depth controls — only on hover, edit mode */}
          {mode === 'edit' && !isEditing && (
            <div
              className="depth-controls"
              onClick={e => e.stopPropagation()}
              style={{
                display: 'flex',
                gap: 2,
                opacity: 0,
                transition: 'opacity 0.15s',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                title="Outdent"
                disabled={depth === 0}
                onClick={() => {
                  if (depth > 0 && entry.blockId) {
                    onBlockDepthChange?.(entry.blockId, depth - 1);
                  }
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: depth === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.45)',
                  cursor: depth === 0 ? 'not-allowed' : 'pointer',
                  fontSize: 11,
                  padding: '0 2px',
                  lineHeight: 1,
                }}
              >
                ←
              </button>
              <button
                type="button"
                title="Indent"
                disabled={depth === 2}
                onClick={() => {
                  if (depth < 2 && entry.blockId) {
                    onBlockDepthChange?.(entry.blockId, depth + 1);
                  }
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: depth === 2 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.45)',
                  cursor: depth === 2 ? 'not-allowed' : 'pointer',
                  fontSize: 11,
                  padding: '0 2px',
                  lineHeight: 1,
                }}
              >
                →
              </button>
            </div>
          )}
        </div>

        {/* Block drop indicator — after */}
        {isDropAfter && (
          <div style={{
            position: 'absolute',
            left: baseIndent, right: 0, bottom: -1,
            height: 2,
            background: '#8B4513',
            zIndex: 5,
          }} />
        )}
      </div>
    );
  }
}
