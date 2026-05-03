import * as React from 'react';
import type { NodeProps } from '@xyflow/react';

import { useDocumentStore } from '@/lib/documentStore';
import { BountyMoreMenu } from '@/components/bounty/BountyMoreMenu';
import { MissingBlockOverlay } from '@/components/bounty/MissingBlockOverlay';
import { InlineSolutionMarker } from '@/components/bounty/InlineSolutionMarker';
import { useBountyProvenance } from '@/components/bounty/BountyProvenanceContext';
import { toggleBlockMissing } from '@/lib/bountyMissing';

export function withBountyBlockHost<P extends NodeProps>(
  WrappedNode: React.ComponentType<P>,
) {
  function BountyBlockHost(props: P) {
    const editorMode = useDocumentStore((s) => s.editorMode);
    const isBounty = editorMode === 'bounty';
    const blockId = (props as any).id as string;
    const block = useDocumentStore((s) => s.blocks[blockId]);
    const [hovered, setHovered] = React.useState(false);
    const provenance = useBountyProvenance();
    const acceptance = provenance?.slotAcceptance[blockId];

    if (!isBounty) return <WrappedNode {...props} />;

    const isMissing = Boolean(block?.is_missing);
    const description = block?.missing_description ?? null;

    const inner = (
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ position: 'relative', width: '100%', height: '100%' }}
      >
        <WrappedNode {...props} />

        {isMissing ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 6,
              background: 'rgba(15,15,20,0.55)',
              backdropFilter: 'blur(2px)',
              borderRadius: 8,
              pointerEvents: 'auto',
            }}
          >
            <MissingBlockOverlay description={description} slotId={blockId} />
          </div>
        ) : null}

        {hovered || isMissing ? (
          <BountyMoreMenu
            floating
            isMissing={isMissing}
            onToggleMissing={() => { toggleBlockMissing(blockId); }}
            triggerTitle={isMissing ? 'Block marked as missing' : 'Block actions'}
            size={20}
          />
        ) : null}
      </div>
    );

    if (acceptance && acceptance.solver && !isMissing) {
      return (
        <InlineSolutionMarker
          kind="block"
          solver={{
            id: acceptance.solver.id,
            displayName: acceptance.solver.display_name || acceptance.solver.username || 'Solver',
            handle: acceptance.solver.username || acceptance.solver.id.slice(0, 8),
            avatarUrl: acceptance.solver.avatar_url || '',
            isTrustedSolver: !!acceptance.solver.is_trusted_solver,
          }}
          acceptedAt={new Date(acceptance.acceptedAt).toLocaleDateString()}
          onViewOriginal={() => provenance?.onViewOriginalSolution?.(blockId)}
        >
          {inner}
        </InlineSolutionMarker>
      );
    }

    return inner;
  }

  BountyBlockHost.displayName = `BountyBlockHost(${WrappedNode.displayName ?? WrappedNode.name ?? 'Block'})`;
  return BountyBlockHost as unknown as React.ComponentType<P>;
}
