import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GitBranch,
  AlertTriangle,
  Bell,
  Plus,
  Minus,
  FileCode,
  Wifi,
  MoreHorizontal,
  Check,
  LoaderCircle,
  CloudOff,
  CircleAlert,
  Focus,
  Users,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { SaveStatus } from '@/lib/documentPersistence';

interface StatusBarProps {
  branch?: string;
  syncStatus?: { behind: number; ahead: number };
  errors?: number;
  warnings?: number;
  documentTitle?: string;
  wordCount?: number;
  characterCount?: number;
  readingMinutes?: number;
  saveStatus?: SaveStatus;
  zoom?: number;
  focusMode?: 'edit' | 'view' | 'focus';
  collaborators?: number;
  onZoomChange?: (zoom: number) => void;
  onMoreTemplates?: () => void;
  onMoreGrammarCheck?: () => void;
  onMoreHistory?: () => void;
  onMoreNotes?: () => void;
  onMoreClearAll?: () => void;
}

const itemButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  height: 22,
  padding: '0 6px',
  borderRadius: 4,
  border: 'none',
  background: 'transparent',
  color: 'hsl(var(--foreground) / 0.62)',
  fontFamily: 'Inter, sans-serif',
  fontSize: 11,
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
  flexShrink: 0,
  transition: 'background 120ms ease, color 120ms ease',
} satisfies React.CSSProperties;

export function StatusBar({
  branch = 'main',
  syncStatus = { behind: 0, ahead: 1 },
  errors = 0,
  warnings = 0,
  documentTitle = '',
  wordCount = 0,
  characterCount = 0,
  readingMinutes = 0,
  saveStatus = 'saved',
  zoom = 100,
  focusMode = 'edit',
  collaborators = 0,
  onZoomChange,
  onMoreTemplates,
  onMoreGrammarCheck,
  onMoreHistory,
  onMoreNotes,
  onMoreClearAll,
}: StatusBarProps) {
  const [notifications, setNotifications] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(9999);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 9999;
      setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const showSecondary = containerWidth >= 720;
  const showTertiary = containerWidth >= 560;

  const currentZoom = useMemo(() => Math.max(25, Math.min(200, Math.round(zoom))), [zoom]);

  const handleZoomChange = (newZoom: number) => {
    const clampedZoom = Math.max(25, Math.min(200, newZoom));
    onZoomChange?.(clampedZoom);
  };

  const saveMeta = useMemo(() => {
    switch (saveStatus) {
      case 'saving':
        return {
          icon: LoaderCircle,
          label: 'Saving',
          color: 'hsl(45 93% 63%)',
          spin: true,
        };
      case 'offline':
        return {
          icon: CloudOff,
          label: 'Offline',
          color: 'hsl(var(--foreground) / 0.58)',
          spin: false,
        };
      case 'error':
        return {
          icon: CircleAlert,
          label: 'Save error',
          color: 'hsl(12 76% 61%)',
          spin: false,
        };
      default:
        return {
          icon: Check,
          label: 'Saved',
          color: 'hsl(142 58% 55%)',
          spin: false,
        };
    }
  }, [saveStatus]);

  const SaveIcon = saveMeta.icon;
  const titleLabel = documentTitle.trim() || 'Untitled document';

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        minHeight: 28,
        padding: '4px 8px',
        borderTop: '0.5px solid hsl(var(--foreground) / 0.06)',
        background: 'hsl(240 20% 8% / 0.72)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        <div style={{ ...itemButtonStyle, cursor: 'default', paddingLeft: 4 }}>
          <GitBranch size={12} strokeWidth={1.8} />
          <span>{branch}</span>
        </div>

        {showTertiary ? (
          <div style={{ ...itemButtonStyle, cursor: 'default' }}>
            <FileCode size={12} strokeWidth={1.8} />
            <span
              style={{
                maxWidth: 100,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {titleLabel}
            </span>
          </div>
        ) : null}

        {showSecondary ? (
          <div style={{ ...itemButtonStyle, cursor: 'default' }}>
            <span>{syncStatus.behind}↓</span>
            <span>{syncStatus.ahead}↑</span>
          </div>
        ) : null}

        <div style={{ ...itemButtonStyle, cursor: 'default' }}>
          <SaveIcon
            size={12}
            strokeWidth={1.8}
            style={{
              color: saveMeta.color,
              animation: saveMeta.spin ? 'spin 1s linear infinite' : undefined,
            }}
          />
          <span style={{ color: saveMeta.color }}>{saveMeta.label}</span>
        </div>

        {showSecondary ? (
          <div style={{ ...itemButtonStyle, cursor: 'default' }}>
            <AlertTriangle size={12} strokeWidth={1.8} style={{ color: 'hsl(12 76% 61%)' }} />
            <span>{errors}</span>
            <span style={{ color: 'hsl(var(--foreground) / 0.42)' }}>·</span>
            <Bell size={12} strokeWidth={1.8} style={{ color: 'hsl(45 93% 63%)' }} />
            <span>{warnings}</span>
          </div>
        ) : null}

        <div style={{ ...itemButtonStyle, cursor: 'default' }}>
          <span>{wordCount} words</span>
          {showSecondary ? (
            <>
              <span style={{ color: 'hsl(var(--foreground) / 0.42)' }}>·</span>
              <span>{readingMinutes} min</span>
            </>
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          flexShrink: 0,
        }}
      >
        {showSecondary ? (
          <div style={{ ...itemButtonStyle, cursor: 'default' }}>
            <Users size={12} strokeWidth={1.8} />
            <span>{collaborators}</span>
          </div>
        ) : null}

        <div style={{ ...itemButtonStyle, cursor: 'default' }}>
          <Focus size={12} strokeWidth={1.8} />
          <span>{focusMode === 'focus' ? 'Focus' : focusMode === 'view' ? 'View' : 'Edit'}</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              style={itemButtonStyle}
              aria-label="Word count details"
            >
              <span>{characterCount} chars</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="top"
            sideOffset={6}
            style={{
              background: 'hsl(240 20% 8% / 0.95)',
              border: '0.5px solid hsl(var(--foreground) / 0.08)',
              boxShadow: '0 10px 30px hsl(240 10% 2% / 0.45)',
              borderRadius: 8,
              minWidth: 188,
            }}
          >
            <DropdownMenuItem inset style={{ fontSize: 11, color: 'hsl(var(--foreground) / 0.7)' }}>
              Words: {wordCount}
            </DropdownMenuItem>
            <DropdownMenuItem inset style={{ fontSize: 11, color: 'hsl(var(--foreground) / 0.7)' }}>
              Characters: {characterCount}
            </DropdownMenuItem>
            <DropdownMenuItem inset style={{ fontSize: 11, color: 'hsl(var(--foreground) / 0.7)' }}>
              Read time: {readingMinutes} min
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            height: 22,
            padding: '0 2px',
          }}
        >
          <button
            type="button"
            onClick={() => handleZoomChange(currentZoom - 10)}
            style={itemButtonStyle}
            aria-label="Zoom out"
          >
            <Minus size={12} strokeWidth={1.8} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" style={itemButtonStyle}>
                <span>{currentZoom}%</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="top"
              sideOffset={6}
              style={{
                background: 'hsl(240 20% 8% / 0.95)',
                border: '0.5px solid hsl(var(--foreground) / 0.08)',
                boxShadow: '0 10px 30px hsl(240 10% 2% / 0.45)',
                borderRadius: 8,
                minWidth: 92,
              }}
            >
              {[50, 75, 100, 125, 150, 200].map((z) => (
                <DropdownMenuItem
                  key={z}
                  inset
                  onClick={() => handleZoomChange(z)}
                  style={{ fontSize: 11, color: 'hsl(var(--foreground) / 0.7)' }}
                >
                  {z}%
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={() => handleZoomChange(currentZoom + 10)}
            style={itemButtonStyle}
            aria-label="Zoom in"
          >
            <Plus size={12} strokeWidth={1.8} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setNotifications((current) => !current)}
          style={{
            ...itemButtonStyle,
            background: notifications ? 'hsl(var(--foreground) / 0.12)' : 'transparent',
            color: notifications ? 'hsl(var(--foreground) / 0.9)' : itemButtonStyle.color,
          }}
          aria-label="Notifications"
        >
          <Wifi size={12} strokeWidth={1.8} />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" style={itemButtonStyle} aria-label="More options">
              <MoreHorizontal size={12} strokeWidth={1.8} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="top"
            sideOffset={6}
            style={{
              background: 'hsl(240 20% 8% / 0.95)',
              border: '0.5px solid hsl(var(--foreground) / 0.08)',
              boxShadow: '0 10px 30px hsl(240 10% 2% / 0.45)',
              borderRadius: 8,
              minWidth: 184,
            }}
          >
            <DropdownMenuItem inset onClick={onMoreTemplates} style={{ fontSize: 11, color: 'hsl(var(--foreground) / 0.7)' }}>
              Templates
            </DropdownMenuItem>
            <DropdownMenuItem inset onClick={onMoreGrammarCheck} style={{ fontSize: 11, color: 'hsl(var(--foreground) / 0.7)' }}>
              Grammar Check
            </DropdownMenuItem>
            <DropdownMenuItem inset onClick={onMoreHistory} style={{ fontSize: 11, color: 'hsl(var(--foreground) / 0.7)' }}>
              History
            </DropdownMenuItem>
            <DropdownMenuItem inset onClick={onMoreNotes} style={{ fontSize: 11, color: 'hsl(var(--foreground) / 0.7)' }}>
              Notes
            </DropdownMenuItem>
            <DropdownMenuSeparator style={{ background: 'hsl(var(--foreground) / 0.06)' }} />
            <DropdownMenuItem inset onClick={onMoreClearAll} style={{ fontSize: 11, color: 'hsl(12 76% 61%)' }}>
              Clear All
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}