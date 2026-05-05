import { useEffect, useRef, useState } from 'react';
import type { CanvasStage } from '@/lib/canvas-types';

interface BlockContextMenuProps {
  x: number;
  y: number;
  stages: CanvasStage[];
  onMoveToStage: (stageId: string) => void;
  onRemoveFromStage: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function BlockContextMenu({
  x, y, stages,
  onMoveToStage, onRemoveFromStage, onDelete, onClose,
}: BlockContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [submenuOpen, setSubmenuOpen] = useState(false);

  // Close on outside click / Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const menuItemStyle: React.CSSProperties = {
    padding: '6px 12px',
    fontSize: 11,
    cursor: 'pointer',
    color: 'rgba(255,255,255,0.75)',
    background: 'none',
    border: 'none',
    textAlign: 'left',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 5,
    fontFamily: 'Inter, sans-serif',
    whiteSpace: 'nowrap',
  };

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: y,
    left: x,
    background: 'rgba(10,10,16,0.98)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: 6,
    boxShadow: '0 8px 32px rgba(0,0,0,0.60)',
    zIndex: 300,
    minWidth: 160,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  };

  return (
    <div
      ref={ref}
      style={menuStyle}
      onContextMenu={e => e.preventDefault()}
    >
      {/* Move to Stage with submenu */}
      <div
        style={{ position: 'relative' }}
        onMouseEnter={() => setSubmenuOpen(true)}
        onMouseLeave={() => setSubmenuOpen(false)}
      >
        <button
          type="button"
          style={menuItemStyle}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.14)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <span>Move to Stage</span>
          <span style={{ fontSize: 10, opacity: 0.5 }}>▸</span>
        </button>

        {submenuOpen && stages.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '100%',
              marginLeft: 4,
              background: 'rgba(10,10,16,0.98)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10,
              padding: 6,
              boxShadow: '0 8px 32px rgba(0,0,0,0.60)',
              minWidth: 160,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            {stages.map(stage => (
              <button
                key={stage.id}
                type="button"
                onClick={() => {
                  onMoveToStage(stage.id);
                  onClose();
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.14)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                style={menuItemStyle}
              >
                <span>{stage.stageNumber}. {stage.title}</span>
              </button>
            ))}
          </div>
        )}
        {submenuOpen && stages.length === 0 && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '100%',
              marginLeft: 4,
              background: 'rgba(10,10,16,0.98)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10,
              padding: '8px 12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.60)',
              fontSize: 11,
              color: 'rgba(255,255,255,0.40)',
              fontStyle: 'italic',
              whiteSpace: 'nowrap',
            }}
          >
            No stages yet
          </div>
        )}
      </div>

      {/* Remove from Stage */}
      <button
        type="button"
        onClick={() => {
          onRemoveFromStage();
          onClose();
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.14)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        style={menuItemStyle}
      >
        Remove from Stage
      </button>

      {/* Divider */}
      <div style={{
        height: 1,
        background: 'rgba(255,255,255,0.08)',
        margin: '3px 0',
      }} />

      {/* Delete */}
      <button
        type="button"
        onClick={() => {
          onDelete();
          onClose();
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.10)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        style={{
          ...menuItemStyle,
          color: 'rgba(239,68,68,0.70)',
        }}
      >
        Delete
      </button>
    </div>
  );
}
