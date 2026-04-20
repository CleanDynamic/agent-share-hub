export function InspectorTool() {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        color: 'rgba(255,255,255,0.70)',
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>
        Inspector
      </div>
      <div style={{ color: 'rgba(255,255,255,0.50)' }}>
        Inspector coming in Step 2.
      </div>
    </div>
  );
}
