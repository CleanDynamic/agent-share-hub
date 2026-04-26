import * as React from 'react';
import {
  GripVertical,
  Maximize2,
  MoreHorizontal,
  X,
  Minus,
  Plus,
  Maximize,
  Map,
  GripHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  zoom?: number;
  onZoom?: (zoom: number) => void;
  onFitView?: () => void;
  minimapOpen?: boolean;
  onToggleMinimap?: () => void;
  onResize?: (height: number) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

const widthClasses: Record<WidthMode, string> = {
  narrow: 'max-w-[480px]',
  wide: 'max-w-[720px]',
  full: 'max-w-[1120px]',
};

const blockTypeColors: Record<BlockType, string> = {
  text: '#3B82F6',
  prompt: '#8B5CF6',
  code: '#10B981',
  result: '#F59E0B',
};

export function StageGridFrame({
  stageNumber,
  stageName,
  blockCount,
  children,
  widthMode = 'wide',
  height = 400,
  onRename,
  onExpand,
  onDelete,
  onQuickInsert,
  zoom = 100,
  onZoom,
  onFitView,
  minimapOpen = false,
  onToggleMinimap,
  onResize,
  onContextMenu,
}: StageGridFrameProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedName, setEditedName] = React.useState(stageName);
  const [isResizing, setIsResizing] = React.useState(false);
  const [currentHeight, setCurrentHeight] = React.useState(height);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const frameRef = React.useRef<HTMLDivElement>(null);

  // Sync controlled height in
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
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
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
      latest = Math.min(800, Math.max(280, startHeight + delta));
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

  const quickInsertButtons: { type: BlockType; label: string }[] = [
    { type: 'text', label: '+ Text' },
    { type: 'prompt', label: '+ Prompt' },
    { type: 'code', label: '+ Code' },
    { type: 'result', label: '+ Result' },
  ];

  return (
    <div
      ref={frameRef}
      onContextMenu={onContextMenu}
      className={cn(
        'relative w-full mx-auto my-4 rounded-[10px] overflow-hidden',
        widthClasses[widthMode],
      )}
      style={{
        background: 'rgba(20, 20, 28, 0.55)',
        border: '0.5px solid rgba(255,255,255,0.08)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
    >
      {/* Header Bar */}
      <div
        className="flex items-center gap-2 px-3"
        style={{
          height: 36,
          borderBottom: '0.5px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.025)',
        }}
      >
        {/* Drag Handle */}
        <button
          type="button"
          data-drag-handle
          className="flex items-center justify-center text-white/30 hover:text-white/60 transition-colors cursor-grab active:cursor-grabbing"
          style={{ width: 18, height: 18 }}
          aria-label="Drag stage"
        >
          <GripVertical size={14} strokeWidth={1.8} />
        </button>

        {/* Stage Number Badge */}
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'rgba(232,87,26,0.14)',
            color: '#E8571A',
            fontFamily: 'Inter, sans-serif',
            fontSize: 11,
            fontWeight: 600,
            lineHeight: 1,
          }}
        >
          {stageNumber}
        </div>

        {/* Stage Name */}
        {isEditing ? (
          <input
            ref={inputRef}
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-[13px] font-semibold text-white/85 outline-none border-b border-white/20 py-0.5"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex-1 text-left text-[13px] font-semibold text-white/85 hover:text-white truncate transition-colors"
            style={{ fontFamily: 'Inter, sans-serif' }}
            title="Click to rename"
          >
            {stageName}
          </button>
        )}

        {/* Block Count */}
        <span
          className="flex-shrink-0"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 11,
            color: 'rgba(255,255,255,0.4)',
            padding: '2px 8px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.04)',
          }}
        >
          {blockCount} {blockCount === 1 ? 'block' : 'blocks'}
        </span>

        {/* Action Buttons */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={onExpand}
            className="p-1 text-white/40 hover:text-white/80 hover:bg-white/[0.06] rounded transition-colors"
            title="Expand to full canvas"
          >
            <Maximize2 size={13} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className="p-1 text-white/40 hover:text-white/80 hover:bg-white/[0.06] rounded transition-colors"
            title="More options"
          >
            <MoreHorizontal size={13} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1 text-white/40 hover:text-red-400 hover:bg-white/[0.06] rounded transition-colors"
            title="Delete stage"
          >
            <X size={13} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div
        className="relative w-full"
        style={{
          height: currentHeight,
          background:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)',
          backgroundSize: '20px 20px',
        }}
      >
        {/* Children (React Flow renders here) */}
        <div className="absolute inset-0">{children}</div>
      </div>

      {/* Footer Bar */}
      <div
        className="flex items-center justify-between px-3 gap-3"
        style={{
          height: 36,
          borderTop: '0.5px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.025)',
        }}
      >
        {/* Quick Insert Chips */}
        <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {quickInsertButtons.map(({ type, label }) => (
            <button
              key={type}
              type="button"
              onClick={() => onQuickInsert?.(type)}
              className="flex-shrink-0 px-2.5 py-1 text-[11px] font-medium text-white/50 rounded-[5px] border border-dashed border-white/10 hover:border-solid transition-all"
              style={{ fontFamily: 'Inter, sans-serif' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = blockTypeColors[type];
                e.currentTarget.style.color = blockTypeColors[type];
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => onZoom?.(Math.max(25, zoom - 25))}
            className="p-1 text-white/40 hover:text-white/70 hover:bg-white/[0.06] rounded transition-colors"
            title="Zoom out"
          >
            <Minus size={12} strokeWidth={1.8} />
          </button>
          <span
            className="text-white/50 tabular-nums text-center"
            style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, minWidth: 36 }}
          >
            {zoom}%
          </span>
          <button
            type="button"
            onClick={() => onZoom?.(Math.min(200, zoom + 25))}
            className="p-1 text-white/40 hover:text-white/70 hover:bg-white/[0.06] rounded transition-colors"
            title="Zoom in"
          >
            <Plus size={12} strokeWidth={1.8} />
          </button>

          <div className="w-px h-3 bg-white/10 mx-1" />

          <button
            type="button"
            onClick={onFitView}
            className="p-1 text-white/40 hover:text-white/70 hover:bg-white/[0.06] rounded transition-colors"
            title="Fit view"
          >
            <Maximize size={12} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={onToggleMinimap}
            className={cn(
              'p-1 rounded transition-colors',
              minimapOpen
                ? 'text-[#E8571A] bg-white/[0.06]'
                : 'text-white/40 hover:text-white/70 hover:bg-white/[0.06]',
            )}
            title="Toggle minimap"
          >
            <Map size={12} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handleResizeStart}
        className={cn(
          'absolute left-0 right-0 bottom-0 flex items-center justify-center cursor-ns-resize group',
          isResizing && 'bg-white/[0.04]',
        )}
        style={{ height: 6 }}
      >
        <GripHorizontal
          size={12}
          strokeWidth={1.8}
          className={cn(
            'text-white/20 transition-colors',
            isResizing ? 'text-white/50' : 'group-hover:text-white/40',
          )}
        />
      </div>
    </div>
  );
}
