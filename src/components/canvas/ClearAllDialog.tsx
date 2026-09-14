import { AlertTriangle } from 'lucide-react';

interface ClearAllDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ClearAllDialog({ open, onClose, onConfirm }: ClearAllDialogProps) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'color-mix(in srgb, var(--porthole) 62%, transparent)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          padding: 24,
          maxWidth: 380,
          width: '90%',
          marginTop: '30vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={20} color="var(--cat-breakage)" />
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            Clear entire canvas?
          </span>
        </div>

        <p style={{
          fontSize: 12,
          color: 'var(--text2)',
          margin: 0,
          lineHeight: 1.5,
        }}>
          This will permanently delete all blocks, arrows, and stages. This action cannot be undone.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 500,
              background: 'var(--recess)',
              border: 'none',
              borderRadius: 8,
              color: 'var(--text2)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            style={{
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 700,
              background: 'color-mix(in srgb, var(--cat-breakage) 85%, transparent)',
              border: 'none',
              borderRadius: 8,
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            Clear Everything
          </button>
        </div>
      </div>
    </div>
  );
}
