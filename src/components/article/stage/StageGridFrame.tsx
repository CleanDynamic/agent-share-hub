import * as React from 'react';
import { LayoutTemplate, MoreHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { feedback } from '@/lib/theme/motion';

type WidthMode = 'narrow' | 'wide' | 'full';
type BlockType = 'text' | 'prompt' | 'code' | 'result';

interface StageGridFrameProps {
  stageNumber: number;
  stageName: string;
  blockCount: number;
  children?: React.ReactNode;
  widthMode?: WidthMode;
  height?: number;
  onRename?: (name: string) => void;
  onExpand?: () => void;
  onDelete?: () => void;
  onQuickInsert?: (type: BlockType) => void;
  onOpenTemplates?: () => void;
  zoom?: number;
  onZoom?: (zoom: number) => void;
  onFitView?: () => void;
  minimapOpen?: boolean;
  onToggleMinimap?: () => void;
  onResize?: (height: number) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function StageGridFrame({
  stageNumber,
  stageName,
  blockCount,
  children,
  height = 280,
  onRename,
  onDelete,
  onOpenTemplates,
  onResize,
  onContextMenu,
}: StageGridFrameProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedName, setEditedName] = React.useState(stageName);
  const [isResizing, setIsResizing] = React.useState(false);
  const [currentHeight, setCurrentHeight] = React.useState(height);
  const [hovered, setHovered] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!isResizing) setCurrentHeight(height);
  }, [height, isResizing]);

  React.useEffect(() => {
    setEditedName(stageName);
  }, [stageName]);

  const handleNameSubmit = () => {
    setIsEditing(false);
    if (editedName.trim() && editedName !== stageName) {
      onRename?.(editedName.trim());
    } else {
      setEditedName(stageName);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleNameSubmit();
    else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditedName(stageName);
    }
  };

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const startY = e.clientY;
    const startHeight = currentHeight;
    let latest = startHeight;

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientY - startY;
      latest = Math.min(600, Math.max(200, startHeight + delta));
      setCurrentHeight(latest);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      onResize?.(latest);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const overlayVisible = hovered || isEditing || isResizing;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={onContextMenu}
      className="relative w-full mx-auto rounded-[8px] overflow-hidden"
      style={{
        maxWidth: 720,
        margin: '16px auto',
        background: 'var(--recess)',
        border: '0.5px solid var(--line)',
      }}
    >
      {/* Canvas Area */}
      <div
        className="relative w-full"
        style={{ height: currentHeight }}
      >
        <div className="absolute inset-0">{children}</div>

        {/* Hover overlay header */}
        <div
          className="absolute left-0 right-0 top-0 flex items-center gap-2 px-3 pointer-events-none"
          style={{
            height: 28,
            background:
              'linear-gradient(to bottom, color-mix(in srgb, var(--recess) 85%, transparent) 0%, color-mix(in srgb, var(--recess) 55%, transparent) 70%, transparent 100%)',
            opacity: overlayVisible ? 1 : 0,
            transition: feedback("opacity"),
          }}
        >
          <div
            className="flex items-center justify-center flex-shrink-0 pointer-events-auto"
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: 'color-mix(in srgb, var(--action) 18%, transparent)',
              color: 'var(--action)',
              fontFamily: 'Figtree, sans-serif',
              fontSize: 10,
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            {stageNumber}
          </div>

          {isEditing ? (
            <input
              ref={inputRef}
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={handleKeyDown}
              placeholder="Untitled stage"
              className="flex-1 bg-transparent text-[13px] font-medium text-white/85 outline-none border-b border-white/20 py-0.5 pointer-events-auto placeholder:italic placeholder:text-white/30"
              style={{ fontFamily: 'Figtree, sans-serif' }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex-1 text-left truncate transition-colors pointer-events-auto hover:text-white"
              style={{
                fontFamily: 'Figtree, sans-serif',
                fontSize: 13,
                fontWeight: stageName ? 600 : 500,
                fontStyle: stageName ? 'normal' : 'italic',
                color: stageName ? 'var(--text)' : 'var(--text2)',
              }}
              title={stageName ? 'Click to rename' : 'Click to name this stage'}
            >
              {stageName || 'Untitled stage'}
            </button>
          )}

          <span
            className="flex-shrink-0 pointer-events-none"
            style={{
              fontFamily: 'Figtree, sans-serif',
              fontSize: 10,
              color: 'var(--text2)',
            }}
          >
            {blockCount} {blockCount === 1 ? 'block' : 'blocks'}
          </span>

          <div className="flex items-center gap-0.5 flex-shrink-0 pointer-events-auto">
            <button
              type="button"
              className="p-1 text-white/45 hover:text-white/85 hover:bg-white/[0.08] rounded transition-colors"
              title="More options"
            >
              <MoreHorizontal size={12} strokeWidth={1.8} />
            </button>
            {onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                className="p-1 text-white/45 hover:text-red-400 hover:bg-white/[0.08] rounded transition-colors"
                title="Delete stage"
              >
                <X size={12} strokeWidth={1.8} />
              </button>
            ) : null}
          </div>
        </div>

        {/* Hover overlay footer */}
        <div
          className="absolute left-0 right-0 bottom-0 flex items-center gap-1.5 px-3 pointer-events-none"
          style={{
            height: 32,
            background:
              'linear-gradient(to top, color-mix(in srgb, var(--recess) 85%, transparent) 0%, color-mix(in srgb, var(--recess) 55%, transparent) 70%, transparent 100%)',
            opacity: overlayVisible ? 1 : 0,
            transition: feedback("opacity"),
          }}
        >
          {null}
        </div>
      </div>

      {/* Resize handle (hairline, hover-only) */}
      <div
        onMouseDown={handleResizeStart}
        className={cn(
          'absolute left-0 right-0 bottom-0 cursor-ns-resize',
        )}
        style={{
          height: 4,
          background: overlayVisible ? 'var(--recess)' : 'transparent',
          transition: feedback("background-color"),
        }}
      />
    </div>
  );
}
