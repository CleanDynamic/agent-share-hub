import { Puzzle } from 'lucide-react';
import { SubmitSolutionButton } from './SubmitSolutionButton';
import { useBountyProvenance } from './BountyProvenanceContext';

interface MissingBlockOverlayProps {
  description?: string | null;
  solutionCount?: number;
  slotId?: string | null;
}

/**
 * Compact amber overlay that replaces a block's body when the block is
 * marked as `is_missing` on a bounty post. The block frame's type-dot,
 * name and header remain visible above this overlay. Visual spec from v0
 * session A.
 */
export function MissingBlockOverlay({
  description,
  solutionCount,
  slotId,
}: MissingBlockOverlayProps) {
  const ctx = useBountyProvenance();
  const effectiveCount =
    solutionCount ?? (slotId ? ctx?.slotSolutionCounts[slotId] ?? 0 : 0);
  const showCta = !!slotId && !!ctx && ctx.bountyStatus !== 'solved';
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
          fontFamily: 'Figtree, sans-serif',
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
            fontFamily: 'Figtree, sans-serif',
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
          fontFamily: 'Figtree, sans-serif',
          fontSize: 9,
          fontWeight: 500,
          color: 'rgba(245,158,11,0.85)',
          marginTop: 2,
        }}
      >
        {effectiveCount} solution{effectiveCount !== 1 ? 's' : ''}
      </span>
      {showCta ? (
        <SubmitSolutionButton slotKind="block" slotId={slotId!} size="block" />
      ) : null}
    </div>
  );
}
