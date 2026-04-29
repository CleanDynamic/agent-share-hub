import { Puzzle } from 'lucide-react';

interface MissingStageBadgeProps {
  description?: string | null;
  solutionCount?: number;
  status?: 'open' | 'closed' | 'solved';
}

/**
 * Amber dashed badge that replaces a stage's preview body when the stage is
 * marked as `is_missing` on a bounty post. Visual spec from v0 session A.
 */
export function MissingStageBadge({
  description,
  solutionCount = 0,
  status = 'open',
}: MissingStageBadgeProps) {
  const statusLabel = status === 'open' ? 'Open' : status === 'closed' ? 'Closed' : 'Solved';

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
          fontFamily: 'Inter, sans-serif',
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
          fontFamily: 'Inter, sans-serif',
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
          fontFamily: 'Inter, sans-serif',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.06em',
          color: '#F59E0B',
          background: 'rgba(245,158,11,0.10)',
          padding: '2px 8px',
          borderRadius: 100,
        }}
      >
        {statusLabel} · {solutionCount} solution{solutionCount !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
