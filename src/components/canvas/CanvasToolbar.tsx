import { useState } from 'react';
import type { useCanvasDocument } from '@/hooks/useCanvasDocument';

interface CanvasToolbarProps {
  doc: ReturnType<typeof useCanvasDocument>;
  onSave?: () => void;
  onPublish?: () => void;
  onTemplates?: () => void;
  saving?: boolean;
  submitting?: boolean;
  isDirty: boolean;
}

export function CanvasToolbar({
  doc, onSave, onPublish, onTemplates,
  saving, submitting, isDirty,
}: CanvasToolbarProps) {
  const [showColumnPicker, setShowColumnPicker] =
    useState(false);

  return (
    <div style={{
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      height: 56,
      background: 'rgba(6,6,10,0.97)',
      backdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center',
      padding: '0 16px', gap: 8,
      zIndex: 30,
    }}>

      {/* Left: layout controls */}
      <div style={{
        display: 'flex', alignItems: 'center',
        gap: 6, flex: 1,
      }}>

        {/* Layout mode toggle */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 7, overflow: 'hidden',
        }}>
          {(['freeform', 'pipeline'] as const).map(
            m => (
              <button
                key={m}
                type="button"
                onClick={() =>
                  doc.setLayoutMode(m)
                }
                style={{
                  padding: '5px 12px',
                  background:
                    doc.layoutMode === m
                      ? 'rgba(232,87,26,0.20)'
                      : 'transparent',
                  border: 'none',
                  color: doc.layoutMode === m
                    ? '#E8571A'
                    : 'rgba(255,255,255,0.35)',
                  fontSize: 11, fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  fontFamily: 'Inter, sans-serif',
                  textTransform: 'capitalize',
                }}
              >
                {m}
              </button>
            )
          )}
        </div>

        {/* Column count picker */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() =>
              setShowColumnPicker(o => !o)
            }
            style={{
              padding: '5px 10px',
              background: 'rgba(255,255,255,0.04)',
              border:
                '1px solid rgba(255,255,255,0.09)',
              borderRadius: 7,
              color: 'rgba(255,255,255,0.40)',
              fontSize: 11, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {doc.columnCount} cols
          </button>

          {showColumnPicker && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: 0, marginBottom: 6,
              background: 'rgba(10,10,16,0.98)',
              border:
                '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8, padding: 8,
              display: 'flex', gap: 4,
              boxShadow:
                '0 8px 24px rgba(0,0,0,0.50)',
              zIndex: 50,
            }}>
              {[4, 6, 8, 10, 12, 16].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    doc.setColumnCount(c);
                    setShowColumnPicker(false);
                  }}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 5, fontSize: 11,
                    cursor: 'pointer',
                    background:
                      doc.columnCount === c
                        ? 'rgba(232,87,26,0.20)'
                        : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${
                      doc.columnCount === c
                        ? 'rgba(232,87,26,0.40)'
                        : 'rgba(255,255,255,0.08)'
                    }`,
                    color: doc.columnCount === c
                      ? '#E8571A'
                      : 'rgba(255,255,255,0.55)',
                    fontWeight:
                      doc.columnCount === c ? 700 : 400,
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Templates button */}
        <button
          type="button"
          onClick={onTemplates}
          style={{
            padding: '5px 12px',
            background: 'rgba(255,255,255,0.04)',
            border:
              '1px solid rgba(255,255,255,0.09)',
            borderRadius: 7,
            color: 'rgba(255,255,255,0.45)',
            fontSize: 11, cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Templates
        </button>
      </div>

      {/* Centre: autosave indicator */}
      <div style={{
        fontSize: 11,
        color: isDirty
          ? 'rgba(245,158,11,0.70)'
          : 'rgba(255,255,255,0.20)',
        transition: 'color 0.3s',
        flexShrink: 0,
      }}>
        {saving ? 'Saving…'
          : isDirty ? 'Unsaved changes'
          : 'All changes saved'}
      </div>

      {/* Right: actions */}
      <div style={{
        display: 'flex', gap: 8,
        flex: 1, justifyContent: 'flex-end',
      }}>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !isDirty}
          style={{
            padding: '7px 14px', borderRadius: 8,
            fontSize: 12, cursor: 'pointer',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'rgba(255,255,255,0.55)',
            opacity: saving || !isDirty ? 0.5 : 1,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Save draft
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={submitting}
          style={{
            padding: '7px 18px', borderRadius: 8,
            fontSize: 12, fontWeight: 700,
            cursor: submitting ? 'default' : 'pointer',
            background: submitting
              ? 'rgba(232,87,26,0.40)' : '#E8571A',
            border: 'none', color: '#fff',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {submitting ? 'Publishing…' : 'Publish'}
        </button>
      </div>
    </div>
  );
}
