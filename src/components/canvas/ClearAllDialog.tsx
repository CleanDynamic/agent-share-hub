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
        background: 'rgba(0,0,0,0.60)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(10,10,16,0.98)',
          border: '1px solid rgba(255,255,255,0.12)',
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
          <AlertTriangle size={20} color="#F59E0B" />
          <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
            Clear entire canvas?
          </span>
        </div>

        <p style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.50)',
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
              background: 'rgba(255, 255, 255, 0.14)',
              border: 'none',
              borderRadius: 8,
              color: 'rgba(255,255,255,0.60)',
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
              background: 'rgba(239,68,68,0.85)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
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
