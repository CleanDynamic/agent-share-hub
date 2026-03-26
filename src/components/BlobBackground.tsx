import React from 'react';

export function BlobBackground() {
  /* ── SWAP THIS COMPONENT ──────────────────────────
     Replace this entire component with your external
     blob/3D background when ready.
     Requirements: position fixed, inset 0, zIndex 0,
     pointerEvents none, transparent background.
  ─────────────────────────────────────────────────── */
  return (
    <div
      data-visual-slot="background"
      style={{
        position: 'fixed', inset: 0, zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}

export default BlobBackground;
