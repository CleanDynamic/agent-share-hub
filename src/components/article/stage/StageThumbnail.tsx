import * as React from 'react';
import { Maximize2 } from 'lucide-react';
import { BountyMoreMenu } from '@/components/bounty/BountyMoreMenu';
import { MissingStageBadge } from '@/components/bounty/MissingStageBadge';

export type ThumbnailBlockType =
  | 'prompt'
  | 'code'
  | 'result'
  | 'agent'
  | 'tool'
  | 'model'
  | 'workflow'
  | 'compare'
  | 'tutorial'
  | 'resource'
  | 'note'
  | 'text'
  | 'heading'
  | 'image'
  | 'video'
  | 'quote'
  | string;

export interface ThumbnailBlock {
  id: string;
  type: ThumbnailBlockType;
  name?: string | null;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
}

export interface ThumbnailConnection {
  id?: string;
  from_block_id?: string;
  to_block_id?: string;
  connection_type?: string;
  [key: string]: any;
}

interface StageThumbnailProps {
  stageNumber: number;
  stageName: string;
  blocks: ThumbnailBlock[];
  connections?: ThumbnailConnection[];
  onOpen?: () => void;
  onRename?: (name: string) => void;
  /** Bounty mode UI affordances. Adds the ⋯ more-menu and missing badge swap. */
  isBounty?: boolean;
  isMissing?: boolean;
  missingDescription?: string | null;
  onToggleMissing?: () => void;
  stageId?: string | null;
}

// Block-type colour palette (full hex; opacity applied at render time)
const NEUTRAL = 'var(--recess)';
const blockTypeColor: Record<string, string> = {
  prompt: 'var(--action)',
  code: 'var(--cat-configuration)',
  result: 'var(--cat-agents)',
  agent: 'var(--cat-agents)',
  tool: 'var(--cat-data)',
  model: 'var(--cat-agents)',
  workflow: 'var(--cat-data)',
  compare: 'var(--cat-media)',
  tutorial: 'var(--evidence)',
  resource: 'var(--cat-data)',
  note: 'var(--cat-narrative)',
  text: NEUTRAL,
  heading: NEUTRAL,
  image: NEUTRAL,
  video: NEUTRAL,
  quote: NEUTRAL,
};

function colorForType(type: string): string {
  return blockTypeColor[type] ?? NEUTRAL;
}

// Convert a hex (#RRGGBB) or rgba() colour to rgba with the given alpha.
function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('rgba(') || color.startsWith('rgb(')) {
    // strip existing alpha by parsing 3 numeric components
    const match = color.match(/\d+(?:\.\d+)?/g);
    if (match && match.length >= 3) {
      const [r, g, b] = match;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
  }
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

function placeholderForType(type: string): string {
  return `Untitled ${type || 'block'}`;
}

export function StageThumbnail({
  stageNumber,
  stageName,
  blocks,
  connections = [],
  onOpen,
  onRename,
  isBounty = false,
  isMissing = false,
  missingDescription = null,
  onToggleMissing,
  stageId = null,
}: StageThumbnailProps) {
  const [hovered, setHovered] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedName, setEditedName] = React.useState(stageName);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const stripRef = React.useRef<HTMLDivElement>(null);
  const [stripScrollable, setStripScrollable] = React.useState(false);

  React.useEffect(() => {
    setEditedName(stageName);
  }, [stageName]);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Detect overflow on the colour strip to show right-edge fade
  React.useLayoutEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    setStripScrollable(el.scrollWidth > el.clientWidth + 1);
  }, [blocks]);

  const blockCount = blocks.length;
  const connectionCount = connections.length;
  const statsText = `${blockCount} ${blockCount === 1 ? 'block' : 'blocks'} · ${connectionCount} ${connectionCount === 1 ? 'connection' : 'connections'}`;

  const commitName = () => {
    setIsEditing(false);
    const next = editedName.trim();
    if (next && next !== stageName) {
      onRename?.(next);
    } else {
      setEditedName(stageName);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitName();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditing(false);
      setEditedName(stageName);
    }
  };

  // Click anywhere on the thumbnail (except interactive elements) opens it.
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isEditing) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-stop-open="true"]')) return;
    onOpen?.();
  };

  return (
    <div
      onClick={handleContainerClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        margin: '24px 0',
        background: 'var(--recess)',
        border: `0.5px solid ${hovered ? 'var(--recess)' : 'var(--recess)'}`,
        borderRadius: 10,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 160ms ease',
      }}
    >
      {/* HEADER ROW */}
      <div
        style={{
          height: 32,
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {/* Numbered badge */}
        <div
          style={{
            flexShrink: 0,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: isBounty && isMissing ? 'color-mix(in srgb, var(--cat-breakage) 18%, transparent)' : 'color-mix(in srgb, var(--action) 14%, transparent)',
            color: isBounty && isMissing ? 'var(--cat-breakage)' : 'var(--action)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Figtree, sans-serif',
            fontSize: 11,
            fontWeight: 600,
            lineHeight: 1,
          }}
        >
          {stageNumber}
        </div>

        {/* Stage name (double-click to edit) */}
        {isEditing ? (
          <input
            ref={inputRef}
            data-stop-open="true"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={commitName}
            onKeyDown={handleNameKeyDown}
            onClick={(e) => e.stopPropagation()}
            placeholder="Untitled stage"
            style={{
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--line)',
              outline: 'none',
              padding: '2px 0',
              fontFamily: 'Figtree, sans-serif',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text)',
            }}
          />
        ) : (
          <div
            data-stop-open="true"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            title="Double-click to rename"
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: 'Figtree, sans-serif',
              fontSize: 13,
              fontWeight: stageName ? 600 : 500,
              fontStyle: stageName ? 'normal' : 'italic',
              color: stageName ? 'var(--text)' : 'var(--text2)',
              cursor: 'text',
            }}
          >
            {stageName || 'Untitled stage'}
          </div>
        )}

        {/* Stats pill */}
        <div
          style={{
            flexShrink: 0,
            padding: '2px 8px',
            background: 'var(--recess)',
            borderRadius: 'var(--r-chip)',
            fontFamily: 'Figtree, sans-serif',
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text2)',
            lineHeight: 1.4,
          }}
        >
          {statsText}
        </div>

        {/* Open icon button */}
        <button
          type="button"
          data-stop-open="true"
          onClick={(e) => {
            e.stopPropagation();
            onOpen?.();
          }}
          aria-label="Open stage"
          title="Open stage"
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            background: 'transparent',
            border: 'none',
            borderRadius: 4,
            color: 'var(--text2)',
            cursor: 'pointer',
            transition: 'color 120ms ease, background 120ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text)';
            e.currentTarget.style.background = 'var(--recess)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text2)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <Maximize2 size={14} strokeWidth={1.8} />
        </button>

        {/* Bounty more-menu (⋯) */}
        {isBounty && onToggleMissing ? (
          <div data-stop-open="true" style={{ flexShrink: 0 }}>
            <BountyMoreMenu
              isMissing={isMissing}
              onToggleMissing={onToggleMissing}
              triggerTitle={isMissing ? 'Stage marked as missing' : 'Stage actions'}
            />
          </div>
        ) : null}
      </div>

      {/* Body — when bounty + missing, replace preview/strip/list with MissingStageBadge */}
      {isBounty && isMissing ? (
        <div style={{ padding: 12, borderTop: '0.5px solid color-mix(in srgb, var(--cat-breakage) 18%, transparent)' }}>
          <MissingStageBadge description={missingDescription} slotId={stageId} />
        </div>
      ) : (
        <>
          {/* SPATIAL PREVIEW (mini-map) */}
          {blockCount > 0 ? (
            <SpatialPreview blocks={blocks} connections={connections} />
          ) : null}

          {/* COLOUR STRIP */}
          <div
            style={{
              position: 'relative',
              height: 28,
              padding: '4px 12px',
              borderTop: '0.5px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {blockCount === 0 ? (
              <span
                style={{
                  fontFamily: 'Figtree, sans-serif',
                  fontSize: 11,
                  fontWeight: 400,
                  color: 'var(--text2)',
                }}
              >
                Empty stage
              </span>
            ) : (
              <>
                <div
                  ref={stripRef}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    width: '100%',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none' as any,
                  }}
                >
                  {blocks.map((b) => {
                    const c = colorForType(b.type);
                    return (
                      <div
                        key={b.id}
                        title={b.name || placeholderForType(b.type)}
                        style={{
                          flexShrink: 0,
                          width: 18,
                          height: 16,
                          borderRadius: 4,
                          background: withAlpha(c, 0.22),
                          border: `0.5px solid ${withAlpha(c, 0.35)}`,
                        }}
                      />
                    );
                  })}
                </div>
                {stripScrollable ? (
                  <div
                    aria-hidden="true"
                    style={{
                      pointerEvents: 'none',
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      right: 0,
                      width: 32,
                      background:
                        'linear-gradient(to left, color-mix(in srgb, var(--recess) 85%, transparent), transparent)',
                    }}
                  />
                ) : null}
              </>
            )}
          </div>

          {/* BLOCK LIST (omitted when empty) */}
          {blockCount > 0 ? (
            <div
              style={{
                padding: '8px 12px',
                borderTop: '0.5px solid var(--line)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px 6px',
              }}
            >
              {blocks.map((b) => {
                const c = colorForType(b.type);
                const label = b.name || placeholderForType(b.type);
                return (
                  <BlockLabelPill key={b.id} dotColor={c} label={label} />
                );
              })}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

interface BlockLabelPillProps {
  dotColor: string;
  label: string;
}

function BlockLabelPill({ dotColor, label }: BlockLabelPillProps) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        background: hover ? 'var(--recess)' : 'var(--recess)',
        border: '0.5px solid var(--line)',
        borderRadius: 4,
        fontFamily: 'Figtree, sans-serif',
        fontSize: 11,
        fontWeight: 400,
        color: 'var(--text2)',
        lineHeight: 1.4,
        maxWidth: '100%',
        transition: 'background 120ms ease',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: dotColor,
        }}
      />
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Spatial mini-map preview ──────────────────────────────────────────────

const CONNECTION_COLORS: Record<string, string> = {
  feeds_into: 'var(--evidence)',
  references: 'var(--recess)',
  depends_on: 'var(--action)',
  contradicts: 'var(--cat-breakage)',
  alternative_to: 'var(--cat-agents)',
  custom: 'var(--recess)',
};

interface SpatialPreviewProps {
  blocks: ThumbnailBlock[];
  connections: ThumbnailConnection[];
}

function SpatialPreviewImpl({ blocks, connections }: SpatialPreviewProps) {
  // Resolve positioned blocks (default to 0,0 / 240x140 when missing).
  const positioned = blocks.map((b) => ({
    id: b.id,
    type: b.type,
    x: typeof b.position_x === 'number' ? b.position_x : 0,
    y: typeof b.position_y === 'number' ? b.position_y : 0,
    w: typeof b.width === 'number' && b.width > 0 ? b.width : 240,
    h: typeof b.height === 'number' && b.height > 0 ? b.height : 140,
  }));

  if (positioned.length === 0) return null;

  // Bounding box
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of positioned) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x + p.w > maxX) maxX = p.x + p.w;
    if (p.y + p.h > maxY) maxY = p.y + p.h;
  }
  // Pad slightly so strokes aren't clipped
  const pad = 8;
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  const vbW = Math.max(1, maxX - minX);
  const vbH = Math.max(1, maxY - minY);

  const blockById = new Map(positioned.map((p) => [p.id, p]));

  return (
    <div
      style={{
        height: 80,
        margin: '6px 12px',
        background: 'var(--recess)',
        borderRadius: 6,
        overflow: 'hidden',
        borderTop: '0.5px solid var(--line)',
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`${minX} ${minY} ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', pointerEvents: 'none' }}
      >
        {/* Connections (under blocks) */}
        {connections.map((c, idx) => {
          const from = c.from_block_id ? blockById.get(c.from_block_id) : undefined;
          const to = c.to_block_id ? blockById.get(c.to_block_id) : undefined;
          if (!from || !to) return null;
          const fx = from.x + from.w / 2;
          const fy = from.y + from.h / 2;
          const tx = to.x + to.w / 2;
          const ty = to.y + to.h / 2;
          const stroke =
            CONNECTION_COLORS[c.connection_type ?? 'references'] ??
            'var(--text2)';
          return (
            <polyline
              key={c.id ?? `c-${idx}`}
              points={`${fx},${fy} ${tx},${ty}`}
              fill="none"
              stroke={stroke}
              strokeWidth={Math.max(1, vbW / 400)}
              strokeLinecap="round"
            />
          );
        })}

        {/* Blocks */}
        {positioned.map((p) => {
          const c = colorForType(p.type);
          return (
            <rect
              key={p.id}
              x={p.x}
              y={p.y}
              width={p.w}
              height={p.h}
              rx={Math.max(2, Math.min(p.w, p.h) * 0.04)}
              ry={Math.max(2, Math.min(p.w, p.h) * 0.04)}
              fill={withAlpha(c, 0.55)}
              stroke={withAlpha(c, 0.85)}
              strokeWidth={Math.max(1, vbW / 400)}
            />
          );
        })}
      </svg>
    </div>
  );
}

export const SpatialPreview = React.memo(
  SpatialPreviewImpl,
  (prev, next) => {
    if (prev.blocks.length !== next.blocks.length) return false;
    if (prev.connections.length !== next.connections.length) return false;
    for (let i = 0; i < prev.blocks.length; i++) {
      const a = prev.blocks[i];
      const b = next.blocks[i];
      if (
        a.id !== b.id ||
        a.type !== b.type ||
        a.position_x !== b.position_x ||
        a.position_y !== b.position_y ||
        a.width !== b.width ||
        a.height !== b.height
      ) {
        return false;
      }
    }
    for (let i = 0; i < prev.connections.length; i++) {
      const a = prev.connections[i];
      const b = next.connections[i];
      if (
        a.id !== b.id ||
        a.from_block_id !== b.from_block_id ||
        a.to_block_id !== b.to_block_id ||
        a.connection_type !== b.connection_type
      ) {
        return false;
      }
    }
    return true;
  },
);
