import { Puzzle } from 'lucide-react';

interface MissingBlockOverlayProps {
  description?: string | null;
  solutionCount?: number;
}

/**
 * Compact amber overlay that replaces a block's body when the block is
 * marked as `is_missing` on a bounty post. The block frame's type-dot,
 * name and header remain visible above this overlay. Visual spec from v0
 * session A.
 */
export function MissingBlockOverlay({
  description,
  solutionCount = 0,
}: MissingBlockOverlayProps) {
  const truncated =
    description && description.length > 40 ? `${description.slice(0, 40)}…` : description;

  return (
    <div
      className="flex flex-col items-center gap-1.5 transition-shadow duration-200 hover:shadow-[0_0_12px_rgba(245,158,11,0.15)]"
      style={{
        background: 'rgba(245,158,11,0.04)',
        border: '0.5px dashed rgba(245,158,11,0.30)',
        borderRadius: 6,
        padding: 12,
        minHeight: 80,
        width: '100%',
        maxWidth: 220,
        cursor: 'default',
        justifyContent: 'center',
      }}
    >
      <Puzzle size={18} style={{ color: 'rgba(245,158,11,0.85)' }} strokeWidth={1.5} />
      <span
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 11,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.75)',
        }}
      >
        Solve this
      </span>
      {truncated ? (
        <p
          className="text-center"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 10,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.45)',
            maxWidth: 196,
            margin: 0,
          }}
        >
          {truncated}
        </p>
      ) : null}
      <span
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 9,
          fontWeight: 500,
          color: 'rgba(245,158,11,0.85)',
          marginTop: 2,
        }}
      >
        {solutionCount} solution{solutionCount !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
