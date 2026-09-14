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
      className="flex flex-col items-center gap-1.5"
      style={{
        background: "color-mix(in srgb, var(--cat-breakage) 5%, transparent)",
        border: "1.5px dashed var(--cat-breakage)",
        borderRadius: 6,
        padding: 12,
        minHeight: 80,
        width: '100%',
        maxWidth: 220,
        cursor: 'default',
        justifyContent: 'center',
      }}
    >
      <Puzzle size={18} style={{ color: "var(--cat-breakage)" }} strokeWidth={1.5} />
      <span
        style={{
          fontFamily: 'Figtree, sans-serif',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text)',
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
            color: 'var(--text2)',
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
          color: "var(--cat-breakage)",
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
