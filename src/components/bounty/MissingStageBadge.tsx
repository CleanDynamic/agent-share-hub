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
 * Dashed gap badge that replaces a stage's preview body when the stage is
 * marked as `is_missing` on a bounty post. Visual spec from v0 session A.
 *
 * THE GAP HUE IS BREAKAGE RED, NOT AMBER (BG-P28).
 * A part deliberately unsolved is the theme's GAP, and the theme spends one
 * hue on it: `--cat-breakage`, on the EDGE, dashed, over the ordinary shape.
 * Amber was never available for this — `--lit` is light (a lamp, a glow, a
 * focus ring, a fill with `--on-lit` on it) and 3.01:1 on the Exhibition
 * ground, so it can carry neither this label nor a border that says which
 * state the part is in.
 *
 * IT STILL READS AS AN INVITATION. Red is on the edge and nowhere else: the
 * copy is unchanged, the ground is a 5% wash rather than a warning fill, and
 * the count keeps the neutral chip it would have as an ordinary figure.
 *
 * The hover glow went with the amber. It was written as
 * `hover:shadow-[0_0_12px_rgba(245,158,11,0.15)]`, and an arbitrary value
 * holding a `color-mix(…)` would not survive Tailwind's whitespace split —
 * but the theme rules out animating `box-shadow` at all, so the fix is to drop
 * it rather than to spell it differently.
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
      className="flex flex-col items-center gap-2.5"
      style={{
        background: "color-mix(in srgb, var(--cat-breakage) 5%, transparent)",
        border: "1.5px dashed var(--cat-breakage)",
        borderRadius: "var(--r-control)",
        padding: 24,
        cursor: 'default',
      }}
    >
      <Puzzle size={32} style={{ color: "var(--cat-breakage)" }} strokeWidth={1.5} />
      <span
        style={{
          fontFamily: 'Figtree, sans-serif',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text)',
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
          color: 'var(--text2)',
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
          color: "var(--text2)",
          background: "var(--recess)",
          padding: '2px 8px',
          borderRadius: "var(--r-chip)",
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
