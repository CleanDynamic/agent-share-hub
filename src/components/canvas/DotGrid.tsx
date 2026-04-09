interface DotGridProps {
  columnCount: number;
  rowHeight: number;
  width: number;
  height: number;
}

export function DotGrid({
  columnCount, rowHeight, width, height
}: DotGridProps) {
  const colWidth = width / columnCount;
  const dots: { x: number; y: number }[] = [];

  const cols = columnCount + 1;
  const rows = Math.ceil(height / rowHeight) + 2;

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      dots.push({
        x: Math.round(c * colWidth),
        y: Math.round(r * rowHeight),
      });
    }
  }

  if (width === 0 || height === 0) return null;

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'visible',
      }}
      width={width}
      height={height}
    >
      {dots.map((dot, i) => (
        <circle
          key={i}
          cx={dot.x}
          cy={dot.y}
          r={1.2}
          fill="rgba(255,255,255,0.09)"
        />
      ))}
    </svg>
  );
}
