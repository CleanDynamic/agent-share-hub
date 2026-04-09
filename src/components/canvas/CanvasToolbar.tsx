// Placeholder — full implementation in Prompt 3
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
}

export function CanvasToolbar(props: CanvasToolbarProps) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 16, left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex', gap: 6,
      alignItems: 'center',
      zIndex: 100,
    }}>
      {props.onTemplates && (
        <button
          type="button"
          onClick={props.onTemplates}
          style={{
            padding: '5px 12px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 7,
            color: 'rgba(255,255,255,0.40)',
            fontSize: 11, cursor: 'pointer',
          }}
        >
          Templates
        </button>
      )}
      <button
        type="button"
        onClick={props.onHistory}
        style={{
          padding: '5px 12px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 7,
          color: 'rgba(255,255,255,0.40)',
          fontSize: 11, cursor: 'pointer',
        }}
      >
        History
      </button>
      {props.onAnnotations && (
        <button
          type="button"
          onClick={props.onAnnotations}
          style={{
            padding: '5px 12px',
            background: (props.annotationCount ?? 0) > 0
              ? 'rgba(245,158,11,0.10)'
              : 'rgba(255,255,255,0.04)',
            border: (props.annotationCount ?? 0) > 0
              ? '1px solid rgba(245,158,11,0.25)'
              : '1px solid rgba(255,255,255,0.09)',
            borderRadius: 7,
            color: (props.annotationCount ?? 0) > 0
              ? 'rgba(245,158,11,0.70)'
              : 'rgba(255,255,255,0.40)',
            fontSize: 11, cursor: 'pointer',
          }}
        >
          Notes{(props.annotationCount ?? 0) > 0
            ? ` (${props.annotationCount})`
            : ''}
        </button>
      )}
      {props.doc.isDirty && (
        <div style={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.20)',
          marginLeft: 4,
        }}>
          unsaved
        </div>
      )}
    </div>
  );
}
