import * as React from 'react';
import { MoreHorizontal, CirclePlus, CircleX } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface BountyMoreMenuProps {
  isMissing: boolean;
  onToggleMissing: () => void;
  /** Visual size of the trigger button. Default 22. */
  size?: number;
  /** Optional title for the trigger button. */
  triggerTitle?: string;
  /** When true, the trigger button is laid out absolutely and shown only on parent hover. */
  floating?: boolean;
}

/**
 * Compact ⋯ trigger that opens a single-item menu used by both stages and
 * blocks in bounty mode. The menu item visually reflects the current
 * `is_missing` state per the Phase 5.4 polish spec.
 */
export function BountyMoreMenu({
  isMissing,
  onToggleMissing,
  size = 22,
  triggerTitle = 'More',
  floating = false,
}: BountyMoreMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-stop-open="true"
          aria-label="More"
          title={triggerTitle}
          onClick={(e) => e.stopPropagation()}
          style={{
            ...(floating
              ? {
                  position: 'absolute',
                  top: 4,
                  right: 4,
                }
              : {}),
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: size,
            height: size,
            background: 'rgba(15,15,20,0.55)',
            border: '0.5px solid rgba(255,255,255,0.10)',
            borderRadius: 4,
            color: 'rgba(255,255,255,0.65)',
            cursor: 'pointer',
            zIndex: 5,
          }}
        >
          <MoreHorizontal size={Math.round(size * 0.6)} strokeWidth={1.8} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} style={{ minWidth: 180 }}>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            onToggleMissing();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: 'Figtree, sans-serif',
            fontSize: 12,
            fontWeight: 500,
            color: isMissing ? '#F59E0B' : 'rgba(255,255,255,0.75)',
          }}
        >
          {isMissing ? (
            <CircleX size={12} strokeWidth={1.8} />
          ) : (
            <CirclePlus size={12} strokeWidth={1.8} />
          )}
          {isMissing ? 'Unmark missing' : 'Mark as missing'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
