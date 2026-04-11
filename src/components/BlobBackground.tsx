import React from 'react';

export function BlobBackground() {
  return (
    <div
      data-visual-slot="background"
      style={{
        position: 'fixed', inset: 0, zIndex: 0,
        pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 60% 50% at 20% 40%, rgba(46,196,182,0.07) 0%, transparent 70%),
          radial-gradient(ellipse 50% 40% at 80% 30%, rgba(232,87,26,0.05) 0%, transparent 70%),
          radial-gradient(ellipse 70% 60% at 50% 80%, rgba(46,196,182,0.04) 0%, transparent 70%),
          #07070D
        `,
      }}
    />
  );
}

export default BlobBackground;
