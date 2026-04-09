import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Save, Send, Loader2, Plus, ChevronUp } from 'lucide-react';
import type { useCanvasDocument } from '@/hooks/useCanvasDocument';
import type { BlockPosition } from '@/lib/canvas-types';

const QUICK_BLOCK_TYPES = [
  { type: 'text', label: 'Text', accent: 'rgba(255,255,255,0.20)', desc: 'Plain text or notes' },
  { type: 'prompt', label: 'Prompt', accent: '#E8571A', desc: 'AI prompt' },
  { type: 'code', label: 'Code', accent: '#3B82F6', desc: 'Code snippet' },
  { type: 'result', label: 'Result', accent: '#22C55E', desc: 'Output' },
  { type: 'image', label: 'Image', accent: '#F59E0B', desc: 'Visual' },
  { type: 'agent_config', label: 'Agent', accent: '#7C3AED', desc: 'AI agent config' },
  { type: 'workflow', label: 'Workflow', accent: '#2EC4B6', desc: 'Multi-step process' },
  { type: 'comparison', label: 'Compare', accent: '#EC4899', desc: 'Side-by-side' },
  { type: 'tool_setup', label: 'Tool', accent: '#06B6D4', desc: 'Tool setup' },
  { type: 'model_params', label: 'Model', accent: '#A78BFA', desc: 'Model config' },
  { type: 'tutorial_step', label: 'Tutorial', accent: '#E8571A', desc: 'Step-by-step' },
  { type: 'section_heading', label: 'Heading', accent: 'rgba(255,255,255,0.40)', desc: 'Section divider' },
  { type: 'resource', label: 'Resource', accent: '#64748B', desc: 'Link / reference' },
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
  annotationCount?: number;
  onBack?: () => void;
  blockCount?: number;
  onInsertBlock?: (type: string, position: Partial<BlockPosition>) => void;
}

export function CanvasToolbar(props: CanvasToolbarProps) {
  const {
    doc, onSave, onPublish, saving, submitting,
    onTemplates, onHistory, onAnnotations,
    annotationCount = 0, onBack, blockCount = 0,
    onInsertBlock,
  } = props;

  const [addBlockOpen, setAddBlockOpen] = useState(false);

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

  const statusLabel = saving ? 'Saving…' : doc.isDirty ? 'Unsaved' : 'Saved';
  const statusColor = saving
    ? 'rgba(245,158,11,0.7)'
    : doc.isDirty ? 'rgba(239,68,68,0.6)' : 'rgba(34,197,94,0.5)';

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '5px 10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 8,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11, cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  };

  return (
    <>
      {/* Add Block dropdown (opens upward from toolbar) */}
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
            {QUICK_BLOCK_TYPES.map(bt => (
              <button
                key={bt.type}
                type="button"
                onClick={() => {
                  const span = bt.type === 'section_heading' ? 2 : 3;
                  onInsertBlock?.(bt.type, {
                    col: 1, colSpan: 4, rowSpan: span,
                  });
                  setAddBlockOpen(false);
                }}
                style={{
                  padding: '6px 8px',
                  borderRadius: 6,
                  fontSize: 11, cursor: 'pointer',
                  background: `${bt.accent}12`,
                  border: `1px solid ${bt.accent}30`,
                  color: bt.accent,
                  fontWeight: 600,
                  transition: 'all 0.10s',
                  textAlign: 'left',
                }}
              >
                <div>{bt.label}</div>
                <div style={{ fontSize: 9, fontWeight: 400, opacity: 0.6 }}>{bt.desc}</div>
              </button>
            ))}
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
        gap: 5,
        alignItems: 'center',
        zIndex: 100,
        background: 'rgba(10,10,16,0.85)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: '5px 8px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        {/* Back */}
        {onBack && (
          <>
            <button type="button" onClick={onBack} title="Back" style={btnBase}>
              <ArrowLeft size={13} /> Back
            </button>
            <Divider />
          </>
        )}

        {/* Add Block */}
        <button
          type="button"
          onClick={() => setAddBlockOpen(o => !o)}
          title="Add a block"
          style={{
            ...btnBase,
            background: addBlockOpen ? 'rgba(232,87,26,0.15)' : 'rgba(232,87,26,0.08)',
            border: '1px solid rgba(232,87,26,0.25)',
            color: '#E8571A',
            fontWeight: 700,
          }}
        >
          <Plus size={13} /> Block
          <ChevronUp size={10} style={{
            transform: addBlockOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s',
          }} />
        </button>

        {/* Templates */}
        {onTemplates && (
          <button type="button" onClick={onTemplates} title="Browse templates" style={btnBase}>
            Templates
          </button>
        )}

        {/* History */}
        <button type="button" onClick={onHistory} title="Version history" style={btnBase}>
          History
        </button>

        {/* Notes */}
        {onAnnotations && (
          <button
            type="button"
            onClick={onAnnotations}
            title="Creator annotations"
            style={{
              ...btnBase,
              ...(annotationCount > 0 ? {
                background: 'rgba(245,158,11,0.10)',
                border: '1px solid rgba(245,158,11,0.25)',
                color: 'rgba(245,158,11,0.70)',
              } : {}),
            }}
          >
            Notes{annotationCount > 0 ? ` (${annotationCount})` : ''}
          </button>
        )}

        <Divider />

        {/* Block count + status */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 1, minWidth: 50,
        }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: 500 }}>
            {blockCount} block{blockCount !== 1 ? 's' : ''}
          </span>
          <span style={{
            fontSize: 9, color: statusColor, fontWeight: 600, transition: 'color 0.2s',
          }}>
            {statusLabel}
          </span>
        </div>

        <Divider />

        {/* Save Draft */}
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          title="Save draft (Ctrl+S)"
          style={{
            ...btnBase,
            padding: '5px 12px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.65)',
            fontSize: 12, fontWeight: 600,
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
            padding: '5px 14px',
            background: submitting ? 'rgba(232,87,26,0.3)' : 'rgba(232,87,26,0.85)',
            border: '1px solid rgba(232,87,26,0.5)',
            color: '#fff',
            fontSize: 12, fontWeight: 700,
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

function Divider() {
  return (
    <div style={{
      width: 1, height: 20,
      background: 'rgba(255,255,255,0.08)',
      margin: '0 1px',
    }} />
  );
}
