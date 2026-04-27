import * as React from 'react';
import { Maximize2 } from 'lucide-react';

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
}

// Block-type colour palette (full hex; opacity applied at render time)
const NEUTRAL = 'rgba(255,255,255,0.40)';
const blockTypeColor: Record<string, string> = {
  prompt: '#E8571A',
  code: '#22C55E',
  result: '#7C3AED',
  agent: '#7C3AED',
  tool: '#3B82F6',
  model: '#A78BFA',
  workflow: '#3B82F6',
  compare: '#EC4899',
  tutorial: '#2EC4B6',
  resource: '#06B6D4',
  note: '#F59E0B',
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
        background: 'rgba(255,255,255,0.02)',
        border: `0.5px solid ${hovered ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)'}`,
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
            background: 'rgba(232,87,26,0.14)',
            color: '#E8571A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Inter, sans-serif',
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
              borderBottom: '1px solid rgba(255,255,255,0.20)',
              outline: 'none',
              padding: '2px 0',
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.85)',
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
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
              fontWeight: stageName ? 600 : 500,
              fontStyle: stageName ? 'normal' : 'italic',
              color: stageName ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.30)',
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
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 100,
            fontFamily: 'Inter, sans-serif',
            fontSize: 11,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.45)',
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
            color: 'rgba(255,255,255,0.40)',
            cursor: 'pointer',
            transition: 'color 120ms ease, background 120ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.40)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <Maximize2 size={14} strokeWidth={1.8} />
        </button>
      </div>

      {/* COLOUR STRIP */}
      <div
        style={{
          position: 'relative',
          height: 28,
          padding: '4px 12px',
          borderTop: '0.5px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {blockCount === 0 ? (
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 11,
              fontWeight: 400,
              color: 'rgba(255,255,255,0.30)',
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
                    'linear-gradient(to left, rgba(15,15,20,0.85), rgba(15,15,20,0))',
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
            borderTop: '0.5px solid rgba(255,255,255,0.06)',
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
        background: hover ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.025)',
        border: '0.5px solid rgba(255,255,255,0.06)',
        borderRadius: 4,
        fontFamily: 'Inter, sans-serif',
        fontSize: 11,
        fontWeight: 400,
        color: 'rgba(255,255,255,0.70)',
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
