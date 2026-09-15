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
  MessageCircle,
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
  unresolvedComments?: number;
  onCommentsClick?: () => void;
  onZoomChange?: (zoom: number) => void;
  onMoreTemplates?: () => void;
  onMoreGrammarCheck?: () => void;
  onMoreHistory?: () => void;
  onMoreNotes?: () => void;
  onMoreClearAll?: () => void;
  /** 'blueprint' (default) or 'blog' — blog hides the zoom control. */
  mode?: 'blueprint' | 'blog' | 'bounty' | 'solve';
}

const itemButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  height: 22,
  padding: '0 6px',
  borderRadius: 5,
  border: 'none',
  background: 'transparent',
  color: 'var(--text2)',
  fontFamily: 'Figtree, sans-serif',
  fontSize: 11,
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
  flexShrink: 0,
  transition: 'all 120ms ease-out',
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
  unresolvedComments = 0,
  onCommentsClick,
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
          color: 'var(--cat-artefact)',
          spin: true,
        };
      case 'offline':
        return {
          icon: CloudOff,
          label: 'Offline',
          color: 'var(--text2)',
          spin: false,
        };
      case 'error':
        return {
          icon: CircleAlert,
          label: 'Save error',
          color: 'var(--cat-breakage)',
          spin: false,
        };
      default:
        return {
          icon: Check,
          label: 'Saved',
          color: 'var(--cat-configuration)',
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
        borderTop: '1px solid var(--line)',
        /* --line IS A HAIRLINE, NOT A SURFACE. Used as this bar's ground it put
           --text2 at 4.03:1 and the saved indicator at 4.06:1, both under the
           text floor. --recess is the token for a surface the page is cut
           into, and --text2 measures 4.55:1 on it. */
        background: 'var(--recess)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
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
            <AlertTriangle size={12} strokeWidth={1.8} style={{ color: 'var(--cat-breakage)' }} />
            <span>{errors}</span>
            <span style={{ color: 'var(--text2)' }}>·</span>
            <Bell size={12} strokeWidth={1.8} style={{ color: 'var(--cat-artefact)' }} />
            <span>{warnings}</span>
          </div>
        ) : null}

        <div style={{ ...itemButtonStyle, cursor: 'default' }}>
          <span>{wordCount} words</span>
          {showSecondary ? (
            <>
              <span style={{ color: 'var(--text2)' }}>·</span>
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

        <button
          type="button"
          onClick={onCommentsClick}
          style={{
            ...itemButtonStyle,
            cursor: onCommentsClick ? 'pointer' : 'default',
            color: unresolvedComments > 0 ? 'var(--action)' : itemButtonStyle.color,
          }}
          aria-label={`${unresolvedComments} unresolved comments`}
          title={`${unresolvedComments} unresolved comment${unresolvedComments === 1 ? '' : 's'}`}
        >
          <MessageCircle size={12} strokeWidth={1.8} />
          <span>{unresolvedComments}</span>
        </button>

        <div style={{ ...itemButtonStyle, cursor: 'default' }}>
          <Focus size={12} strokeWidth={1.8} />
          <span>{focusMode === 'focus' ? 'Focus' : focusMode === 'view' ? 'View' : 'Edit'}</span>
        </div>

        {showSecondary ? (
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
                background: 'var(--cat-data)',
                border: '0.5px solid var(--line)',
                boxShadow: '0 10px 30px var(--recess)',
                borderRadius: 8,
                minWidth: 188,
              }}
            >
              <DropdownMenuItem inset style={{ fontSize: 11, color: 'var(--text2)' }}>
                Words: {wordCount}
              </DropdownMenuItem>
              <DropdownMenuItem inset style={{ fontSize: 11, color: 'var(--text2)' }}>
                Characters: {characterCount}
              </DropdownMenuItem>
              <DropdownMenuItem inset style={{ fontSize: 11, color: 'var(--text2)' }}>
                Read time: {readingMinutes} min
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

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
                background: 'var(--cat-data)',
                border: '0.5px solid var(--line)',
                boxShadow: '0 10px 30px var(--text)',
                borderRadius: 8,
                minWidth: 92,
              }}
            >
              {[50, 75, 100, 125, 150, 200].map((z) => (
                <DropdownMenuItem
                  key={z}
                  inset
                  onClick={() => handleZoomChange(z)}
                  style={{ fontSize: 11, color: 'var(--text2)' }}
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

        {showSecondary ? (
          <button
            type="button"
            onClick={() => setNotifications((current) => !current)}
            style={{
              ...itemButtonStyle,
              background: notifications ? 'var(--recess)' : 'transparent',
              color: notifications ? 'var(--text)' : itemButtonStyle.color,
            }}
            aria-label="Notifications"
          >
            <Wifi size={12} strokeWidth={1.8} />
          </button>
        ) : null}

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
              background: 'var(--cat-data)',
              border: '0.5px solid var(--line)',
              boxShadow: '0 10px 30px var(--text)',
              borderRadius: 8,
              minWidth: 184,
            }}
          >
            <DropdownMenuItem inset onClick={onMoreTemplates} style={{ fontSize: 11, color: 'var(--text2)' }}>
              Templates
            </DropdownMenuItem>
            <DropdownMenuItem inset onClick={onMoreGrammarCheck} style={{ fontSize: 11, color: 'var(--text2)' }}>
              Grammar Check
            </DropdownMenuItem>
            <DropdownMenuItem inset onClick={onMoreHistory} style={{ fontSize: 11, color: 'var(--text2)' }}>
              History
            </DropdownMenuItem>
            <DropdownMenuItem inset onClick={onMoreNotes} style={{ fontSize: 11, color: 'var(--text2)' }}>
              Notes
            </DropdownMenuItem>
            <DropdownMenuSeparator style={{ background: 'var(--recess)' }} />
            <DropdownMenuItem inset onClick={onMoreClearAll} style={{ fontSize: 11, color: 'var(--cat-breakage)' }}>
              Clear All
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}