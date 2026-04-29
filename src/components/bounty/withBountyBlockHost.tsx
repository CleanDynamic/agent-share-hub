import * as React from 'react';
import type { NodeProps } from '@xyflow/react';

import { useDocumentStore } from '@/lib/documentStore';
import { BountyMoreMenu } from '@/components/bounty/BountyMoreMenu';
import { MissingBlockOverlay } from '@/components/bounty/MissingBlockOverlay';
import { toggleBlockMissing } from '@/lib/bountyMissing';

/**
 * Higher-order node wrapper used in bounty mode. Accepts any existing
 * ReactFlow block node component and adds:
 *   • A floating ⋯ menu in the top-right (visible on hover) that lets the
 *     author toggle `is_missing` on the block.
 *   • A MissingBlockOverlay that replaces the block's body when
 *     `is_missing` is true. The wrapped node still mounts so the block
 *     keeps its position/size; the overlay just paints over it.
 *
 * Outside bounty mode this wrapper is invisible — it just renders the
 * underlying node component.
 */
export function withBountyBlockHost<P extends NodeProps>(
  WrappedNode: React.ComponentType<P>,
) {
  function BountyBlockHost(props: P) {
    const editorMode = useDocumentStore((s) => s.editorMode);
    const isBounty = editorMode === 'bounty';
    const blockId = (props as any).id as string;
    const block = useDocumentStore((s) => s.blocks[blockId]);
    const [hovered, setHovered] = React.useState(false);

    if (!isBounty) return <WrappedNode {...props} />;

    const isMissing = Boolean(block?.is_missing);
    const description = block?.missing_description ?? null;

    return (
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
              pointerEvents: 'none',
            }}
          >
            <MissingBlockOverlay description={description} />
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
  }

  BountyBlockHost.displayName = `BountyBlockHost(${WrappedNode.displayName ?? WrappedNode.name ?? 'Block'})`;
  return BountyBlockHost as unknown as React.ComponentType<P>;
}
