import { Puzzle } from 'lucide-react';
import { SubmitSolutionButton } from './SubmitSolutionButton';
import { useBountyProvenance } from './BountyProvenanceContext';

interface MissingStageBadgeProps {
  description?: string | null;
  solutionCount?: number;
  status?: 'open' | 'closed' | 'solved';
  slotId?: string | null;
}

/**
 * Amber dashed badge that replaces a stage's preview body when the stage is
 * marked as `is_missing` on a bounty post. Visual spec from v0 session A.
 */
export function MissingStageBadge({
  description,
  solutionCount,
  status,
  slotId,
}: MissingStageBadgeProps) {
  const ctx = useBountyProvenance();
  const effectiveStatus = status ?? ctx?.bountyStatus ?? 'open';
  const effectiveCount =
    solutionCount ?? (slotId ? ctx?.slotSolutionCounts[slotId] ?? 0 : 0);
  const statusLabel = effectiveStatus === 'open' ? 'Open' : effectiveStatus === 'closed' ? 'Closed' : 'Solved';

  return (
    <div
      className="flex flex-col items-center gap-2.5 transition-shadow duration-200 hover:shadow-[0_0_12px_rgba(245,158,11,0.15)]"
      style={{
        background: 'rgba(245,158,11,0.04)',
        border: '0.5px dashed rgba(245,158,11,0.30)',
        borderRadius: 8,
        padding: 24,
        cursor: 'default',
      }}
    >
      <Puzzle size={32} style={{ color: 'rgba(245,158,11,0.85)' }} strokeWidth={1.5} />
      <span
        style={{
          fontFamily: 'Figtree, sans-serif',
          fontSize: 14,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.85)',
        }}
      >
        Stage needs solving
      </span>
      <p
        className="text-center"
        style={{
          fontFamily: 'Figtree, sans-serif',
          fontSize: 12,
          fontWeight: 400,
          color: 'rgba(255,255,255,0.55)',
          maxWidth: 360,
          lineHeight: 1.4,
          margin: 0,
        }}
      >
        {description || 'No description provided'}
      </p>
      <span
        style={{
          fontFamily: 'Figtree, sans-serif',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.06em',
          color: '#F59E0B',
          background: 'rgba(245,158,11,0.10)',
          padding: '2px 8px',
          borderRadius: 100,
        }}
      >
        {statusLabel} · {effectiveCount} solution{effectiveCount !== 1 ? 's' : ''}
      </span>
      {slotId && ctx && effectiveStatus !== 'solved' ? (
        <SubmitSolutionButton slotKind="stage" slotId={slotId} size="stage" />
      ) : null}
    </div>
  );
}
