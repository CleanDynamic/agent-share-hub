import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Save, Send, Loader2, Plus, ChevronUp, Undo2, Redo2, MoreHorizontal, Minus } from 'lucide-react';
import type { useCanvasDocument } from '@/hooks/useCanvasDocument';
import type { BlockPosition } from '@/lib/canvas-types';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

const QUICK_BLOCK_TYPES = [
  { type: 'text', label: 'Text', accent: 'rgba(255,255,255,0.20)', desc: 'Plain text or notes' },
  { type: 'prompt', label: 'Prompt', accent: '#8B4513', desc: 'AI prompt' },
  { type: 'code', label: 'Code', accent: '#3B82F6', desc: 'Code snippet' },
  { type: 'result', label: 'Result', accent: '#22C55E', desc: 'Output' },
  { type: 'image', label: 'Image', accent: '#F59E0B', desc: 'Visual' },
  { type: 'agent_config', label: 'Agent', accent: '#7C3AED', desc: 'AI agent config' },
  { type: 'workflow', label: 'Workflow', accent: '#1F7A6D', desc: 'Multi-step process' },
  { type: 'comparison', label: 'Compare', accent: '#EC4899', desc: 'Side-by-side' },
  { type: 'tool_setup', label: 'Tool', accent: '#06B6D4', desc: 'Tool setup' },
  { type: 'model_params', label: 'Model', accent: '#A78BFA', desc: 'Model config' },
  { type: 'tutorial_step', label: 'Tutorial', accent: '#8B4513', desc: 'Step-by-step' },
  { type: 'section_heading', label: 'Heading', accent: 'rgba(255,255,255,0.40)', desc: 'Section divider' },
  { type: 'resource', label: 'Resource', accent: '#64748B', desc: 'Link / reference' },
  { type: 'sticky_note', label: 'Note', accent: '#FBBF24', desc: 'Sticky note comment' },
  { type: 'video', label: 'Video', accent: '#EC4899', desc: 'Video embed' },
];

interface CanvasToolbarProps {
  doc: ReturnType<typeof useCanvasDocument>;
  onSave?: () => void;
  onPublish?: () => void;
  saving?: boolean;
  submitting?: boolean;
  onTemplates?: () => void;
  onHistory?: () => void;
  onAnnotations?: () => void;
  onGrammarCheck?: () => void;
  annotationCount?: number;
  onBack?: () => void;
  blockCount?: number;
  onInsertBlock?: (type: string, position: Partial<BlockPosition>) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  zoom?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onClearAll?: () => void;
}

export function CanvasToolbar(props: CanvasToolbarProps) {
  const {
    doc, onSave, onPublish, saving, submitting,
    onTemplates, onHistory, onAnnotations, onGrammarCheck,
    annotationCount = 0, onBack,
    onInsertBlock, onUndo, onRedo,
    zoom = 1, onZoomIn, onZoomOut,
    onClearAll,
  } = props;

  const [addBlockOpen, setAddBlockOpen] = useState(false);
  const [hoveredType, setHoveredType] = useState<string | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      onSave?.();
    }
  }, [onSave]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '5px 8px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 8,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11, cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  };

  const disabledBtn: React.CSSProperties = {
    ...btnBase,
    opacity: 0.3,
    cursor: 'not-allowed',
  };

  return (
    <>
      {/* Add Block dropdown */}
      {addBlockOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 98 }}
            onClick={() => setAddBlockOpen(false)}
          />
          <div style={{
            position: 'fixed',
            bottom: 60,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(10,10,16,0.98)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12,
            padding: 10,
            width: 320,
            maxHeight: 'calc(100vh - 100px)',
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 4,
            zIndex: 101,
            boxShadow: '0 -8px 32px rgba(0,0,0,0.60)',
          }}>
            <div style={{
              gridColumn: '1 / -1',
              fontSize: 9, fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'rgba(255,255,255,0.25)',
              padding: '2px 4px 6px',
            }}>
              Add block
            </div>
            {QUICK_BLOCK_TYPES.map(bt => {
              const isHovered = hoveredType === bt.type;
              return (
                <button
                  key={bt.type}
                  type="button"
                  onMouseEnter={() => setHoveredType(bt.type)}
                  onMouseLeave={() => setHoveredType(null)}
                  onClick={() => {
                    const isHeading = bt.type === 'section_heading';
                    const isSticky = bt.type === 'sticky_note';
                    const colSpan = isSticky ? 2 : 3;
                    const rowSpan = isSticky ? 3 : isHeading ? 2 : 5;
                    onInsertBlock?.(bt.type, {
                      colSpan, rowSpan,
                    });
                    setAddBlockOpen(false);
                  }}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 6,
                    fontSize: 11, cursor: 'pointer',
                    background: isHovered
                      ? `${bt.accent}25`
                      : `${bt.accent}12`,
                    border: isHovered
                      ? `1px solid ${bt.accent}50`
                      : `1px solid ${bt.accent}30`,
                    color: bt.accent,
                    fontWeight: 600,
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                    transform: isHovered ? 'translateY(-1px)' : 'none',
                    boxShadow: isHovered
                      ? `0 4px 12px ${bt.accent}20`
                      : 'none',
                  }}
                >
                  <div>{bt.label}</div>
                  <div style={{
                    fontSize: 9,
                    fontWeight: 400,
                    opacity: isHovered ? 1 : 0.6,
                  }}>{bt.desc}</div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Toolbar pill */}
      <div style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 3,
        alignItems: 'center',
        zIndex: 100,
        background: 'rgba(10,10,16,0.65)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: '5px 8px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        maxWidth: 'calc(100vw - 32px)',
      }}>
        {/* Back */}
        {onBack && (
          <>
            <button type="button" onClick={onBack} title="Back" style={btnBase}>
              <ArrowLeft size={13} />
            </button>
            <Divider />
          </>
        )}

        {/* Undo / Redo */}
        <button
          type="button"
          onClick={onUndo}
          disabled={!onUndo}
          title="Undo (Ctrl+Z)"
          style={onUndo ? btnBase : disabledBtn}
        >
          <Undo2 size={13} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!onRedo}
          title="Redo (Ctrl+Shift+Z)"
          style={onRedo ? btnBase : disabledBtn}
        >
          <Redo2 size={13} />
        </button>

        <Divider />

        {/* Add Block */}
        <button
          type="button"
          onClick={() => setAddBlockOpen(o => !o)}
          title="Add a block"
          style={{
            ...btnBase,
            background: addBlockOpen ? 'rgba(139,69,19,0.15)' : 'rgba(139,69,19,0.08)',
            border: '1px solid rgba(139,69,19,0.25)',
            color: '#8B4513',
            fontWeight: 700,
          }}
        >
          <Plus size={13} /> Block
          <ChevronUp size={10} style={{
            transform: addBlockOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s',
          }} />
        </button>

        <Divider />

        {/* Zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <button type="button" onClick={onZoomOut} title="Zoom out" style={{ ...btnBase, padding: '5px 5px' }}>
            <Minus size={11} />
          </button>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', fontWeight: 600, minWidth: 32, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button type="button" onClick={onZoomIn} title="Zoom in" style={{ ...btnBase, padding: '5px 5px' }}>
            <Plus size={11} />
          </button>
        </div>

        <Divider />

        {/* Overflow menu: Templates, History, Notes */}
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" title="More options" style={{
              ...btnBase,
              position: 'relative',
            }}>
              <MoreHorizontal size={14} />
              {annotationCount > 0 && (
                <span style={{
                  position: 'absolute', top: -2, right: -2,
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'rgba(245,158,11,0.8)',
                }} />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            sideOffset={8}
            className="w-auto p-1 bg-[rgba(10,10,16,0.98)] border-[rgba(255,255,255,0.12)]"
            style={{ minWidth: 140 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {onTemplates && (
                <button type="button" onClick={onTemplates} style={menuItemStyle}>
                  Templates
                </button>
              )}
              {onGrammarCheck && (
                <button type="button" onClick={onGrammarCheck} style={menuItemStyle}>
                  Grammar Check
                </button>
              )}
              <button type="button" onClick={onHistory} style={menuItemStyle}>
                History
              </button>
              {onAnnotations && (
                <button type="button" onClick={onAnnotations} style={menuItemStyle}>
                  Notes{annotationCount > 0 ? ` (${annotationCount})` : ''}
                </button>
              )}
              {onClearAll && (
                <button type="button" onClick={onClearAll} style={{
                  ...menuItemStyle,
                  color: 'rgba(239,68,68,0.70)',
                }}>
                  Clear All
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Divider />

        {/* Save Draft */}
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          title="Save draft (Ctrl+S)"
          style={{
            ...btnBase,
            padding: '5px 10px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.65)',
            fontSize: 11, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Save
        </button>

        {/* Publish */}
        <button
          type="button"
          onClick={onPublish}
          disabled={submitting}
          title="Publish"
          style={{
            ...btnBase,
            padding: '5px 12px',
            background: submitting ? 'rgba(139,69,19,0.3)' : 'rgba(139,69,19,0.85)',
            border: '1px solid rgba(139,69,19,0.5)',
            color: '#fff',
            fontSize: 11, fontWeight: 700,
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          Publish
        </button>
      </div>
    </>
  );
}

const menuItemStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: 11,
  fontWeight: 500,
  color: 'rgba(255,255,255,0.55)',
  background: 'none',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'background 0.1s',
};

function Divider() {
  return (
    <div style={{
      width: 1, height: 20,
      background: 'rgba(255,255,255,0.08)',
      margin: '0 1px',
    }} />
  );
}
