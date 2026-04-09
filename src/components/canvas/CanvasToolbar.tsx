import { useEffect, useCallback } from 'react';
import { ArrowLeft, Save, Send, Loader2 } from 'lucide-react';
import type { useCanvasDocument } from '@/hooks/useCanvasDocument';

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
}

export function CanvasToolbar(props: CanvasToolbarProps) {
  const {
    doc, onSave, onPublish, saving, submitting,
    onTemplates, onHistory, onAnnotations,
    annotationCount = 0, onBack, blockCount = 0,
  } = props;

  // Ctrl/Cmd + S shortcut
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

  const statusLabel = saving
    ? 'Saving…'
    : doc.isDirty
      ? 'Unsaved changes'
      : 'Saved';

  const statusColor = saving
    ? 'rgba(245,158,11,0.7)'
    : doc.isDirty
      ? 'rgba(239,68,68,0.6)'
      : 'rgba(34,197,94,0.5)';

  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: 6,
      alignItems: 'center',
      zIndex: 100,
      background: 'rgba(10,10,16,0.85)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14,
      padding: '6px 10px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      {/* Back button */}
      {onBack && (
        <>
          <button
            type="button"
            onClick={onBack}
            title="Back to type chooser"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 10px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 8,
              color: 'rgba(255,255,255,0.45)',
              fontSize: 11, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <ArrowLeft size={13} />
            Back
          </button>
          <div style={{
            width: 1, height: 20,
            background: 'rgba(255,255,255,0.08)',
            margin: '0 2px',
          }} />
        </>
      )}

      {/* Templates */}
      {onTemplates && (
        <button
          type="button"
          onClick={onTemplates}
          title="Browse templates"
          style={{
            padding: '5px 10px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 8,
            color: 'rgba(255,255,255,0.40)',
            fontSize: 11, cursor: 'pointer',
          }}
        >
          Templates
        </button>
      )}

      {/* History */}
      <button
        type="button"
        onClick={onHistory}
        title="Version history"
        style={{
          padding: '5px 10px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 8,
          color: 'rgba(255,255,255,0.40)',
          fontSize: 11, cursor: 'pointer',
        }}
      >
        History
      </button>

      {/* Notes */}
      {onAnnotations && (
        <button
          type="button"
          onClick={onAnnotations}
          title="Creator annotations"
          style={{
            padding: '5px 10px',
            background: annotationCount > 0
              ? 'rgba(245,158,11,0.10)'
              : 'rgba(255,255,255,0.04)',
            border: annotationCount > 0
              ? '1px solid rgba(245,158,11,0.25)'
              : '1px solid rgba(255,255,255,0.09)',
            borderRadius: 8,
            color: annotationCount > 0
              ? 'rgba(245,158,11,0.70)'
              : 'rgba(255,255,255,0.40)',
            fontSize: 11, cursor: 'pointer',
          }}
        >
          Notes{annotationCount > 0 ? ` (${annotationCount})` : ''}
        </button>
      )}

      {/* Divider */}
      <div style={{
        width: 1, height: 20,
        background: 'rgba(255,255,255,0.08)',
        margin: '0 2px',
      }} />

      {/* Block count + status */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 1,
        minWidth: 60,
      }}>
        <span style={{
          fontSize: 10, color: 'rgba(255,255,255,0.25)',
          fontWeight: 500,
        }}>
          {blockCount} block{blockCount !== 1 ? 's' : ''}
        </span>
        <span style={{
          fontSize: 9, color: statusColor,
          fontWeight: 600,
          transition: 'color 0.2s',
        }}>
          {statusLabel}
        </span>
      </div>

      {/* Divider */}
      <div style={{
        width: 1, height: 20,
        background: 'rgba(255,255,255,0.08)',
        margin: '0 2px',
      }} />

      {/* Save Draft */}
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        title="Save draft (Ctrl+S)"
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 14px',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8,
          color: 'rgba(255,255,255,0.65)',
          fontSize: 12, fontWeight: 600,
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.6 : 1,
          transition: 'all 0.15s',
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
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 16px',
          background: submitting
            ? 'rgba(232,87,26,0.3)'
            : 'rgba(232,87,26,0.85)',
          border: '1px solid rgba(232,87,26,0.5)',
          borderRadius: 8,
          color: '#fff',
          fontSize: 12, fontWeight: 700,
          cursor: submitting ? 'not-allowed' : 'pointer',
          opacity: submitting ? 0.7 : 1,
          transition: 'all 0.15s',
        }}
      >
        {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        Publish
      </button>
    </div>
  );
}
