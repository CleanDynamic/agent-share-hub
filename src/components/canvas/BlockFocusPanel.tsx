import { useState } from 'react';
import type { CanvasBlock } from '@/lib/canvas-types';

interface BlockFocusPanelProps {
  block: CanvasBlock | null;
  onClose: () => void;
}

export function BlockFocusPanel({
  block,
  onClose,
}: BlockFocusPanelProps) {
  const [copied, setCopied] = useState(false);

  if (!block) return null;

  const copyText = block.textContent ?? '';

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.30)',
          zIndex: 200,
        }}
        onClick={onClose}
      />
      <div
        data-visual-slot="block-focus-panel"
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: 400,
          background: 'rgba(10,10,16,0.99)',
          borderLeft: '1px solid rgba(255,255,255,0.10)',
          zIndex: 201,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.40)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 16px 12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.10em',
                color: 'rgba(255,255,255,0.30)',
                marginBottom: 2,
              }}
            >
              {block.type?.replace(/_/g, ' ')}
            </div>
            {block.subheading && (
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.85)',
                  fontFamily:
                    "'Playfair Display', Georgia, serif",
                }}
              >
                {block.subheading}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.40)',
              cursor: 'pointer',
              fontSize: 18,
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
          }}
        >
          <pre
            style={{
              fontFamily:
                block.type === 'code' || block.type === 'prompt'
                  ? 'Courier New, monospace'
                  : "'Playfair Display', serif",
              fontSize: 14,
              color: 'rgba(255,255,255,0.80)',
              lineHeight: 1.75,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              margin: 0,
            }}
          >
            {copyText}
          </pre>
        </div>

        {/* Copy button */}
        {copyText && (
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(copyText);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              style={{
                width: '100%',
                padding: '9px',
                background: copied
                  ? 'rgba(34,197,94,0.15)'
                  : 'rgba(255,255,255,0.06)',
                border: `1px solid ${
                  copied
                    ? 'rgba(34,197,94,0.30)'
                    : 'rgba(255,255,255,0.10)'
                }`,
                borderRadius: 8,
                color: copied ? '#22C55E' : 'rgba(255,255,255,0.55)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
