import React from 'react';

export function BlobBackground() {
  return (
    <div
      data-visual-slot="background"
      style={{
        position: 'fixed', inset: 0, zIndex: 0,
        pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
      }}
    />
  );
}

export default BlobBackground;
