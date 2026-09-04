import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sliders,
  Shapes,
  List,
  MessageSquare,
  Clock,
  Home,
  Compass,
  BookMarked,
  Upload as UploadIcon,
  FileText,
  Mail,
  Bell,
  User,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { useDraftCount } from '@/hooks/useDraftCount';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSelection } from '@/hooks/useSelection';
import { useDocumentStore } from '@/lib/documentStore';

import { insertBlockInStage } from '@/lib/blockInsertion';
import {
  useWorkspaceStore,
  type WorkspaceToolId,
} from '@/lib/workspaceStore';

import { InspectorTool } from './tools/InspectorTool';
import { BlockLibraryTool } from './tools/BlockLibraryTool';
import { OutlineTool } from './tools/OutlineTool';
import { CommentsTool } from './tools/CommentsTool';
import { VersionHistoryTool } from './tools/VersionHistoryTool';

interface ToolDefinition {
  id: WorkspaceToolId;
  label: string;
  icon: LucideIcon;
  render: () => ReactElement;
}

// Master registry of every tool. The visible tab rail is derived from this
// list per render based on whether a stage is in full mode.
const TOOLS: readonly ToolDefinition[] = [
  { id: 'nav', label: 'Navigation', icon: Home, render: () => <NavTool /> },
  { id: 'inspector', label: 'Inspector', icon: Sliders, render: () => <InspectorTool /> },
  { id: 'library', label: 'Block Library', icon: Shapes, render: () => <BlockLibraryHost /> },
  { id: 'outline', label: 'Outline', icon: List, render: () => <OutlineTool /> },
  { id: 'comments', label: 'Comments', icon: MessageSquare, render: () => <CommentsTool /> },
  { id: 'versions', label: 'Version History', icon: Clock, render: () => <VersionHistoryTool /> },
];

const TOOL_BY_ID: Record<WorkspaceToolId, ToolDefinition> = TOOLS.reduce(
  (acc, t) => ({ ...acc, [t.id]: t }),
  {} as Record<WorkspaceToolId, ToolDefinition>,
);

// Tab orders for each mode. Library is hidden entirely in article mode.
const ARTICLE_MODE_ORDER: readonly WorkspaceToolId[] = [
  'inspector',
  'outline',
  'comments',
  'versions',
];
const STAGE_MODE_ORDER: readonly WorkspaceToolId[] = [
  'library',
  'inspector',
  'outline',
  'comments',
  'versions',
];

const TYPE_DOT_COLOR: Record<string, string> = {
  block: '#E8571A',
  stage: '#55E0D2',
  arrow: '#F59E0B',
};

function useSelectionLabel(): { label: string | null; kind: string | null } {
  const selection = useDocumentStore((s) => s.selection);
  const blocks = useDocumentStore((s) => s.blocks);
  const stages = useDocumentStore((s) => s.stages);
  const connections = useDocumentStore((s) => s.connections);

  if (selection.ids.length !== 1) return { label: null, kind: null };
  const id = selection.ids[0];

  if (selection.kind === 'block') {
    const block = blocks[id];
    if (!block) return { label: null, kind: null };
    return { label: block.name ?? 'Untitled block', kind: 'block' };
  }
  if (selection.kind === 'stage') {
    const stage = stages[id];
    if (!stage) return { label: null, kind: null };
    return { label: stage.stage_name ?? 'Untitled stage', kind: 'stage' };
  }
  if (selection.kind === 'arrow') {
    const conn = connections[id];
    if (!conn) return { label: null, kind: null };
    return { label: conn.label ?? 'Arrow', kind: 'arrow' };
  }
  return { label: null, kind: null };
}

export function WorkspaceShell({ showNavTab = false }: { showNavTab?: boolean } = {}) {
  const activeTool = useWorkspaceStore((s) => s.activeTool);
  const setActiveTool = useWorkspaceStore((s) => s.setActiveTool);
  const stageOpen = useWorkspaceStore((s) => s.stageOpen);
  const setStageOpen = useWorkspaceStore((s) => s.setStageOpen);
  const { selection } = useSelection();
  const { label: selectionLabel, kind: selectionKind } = useSelectionLabel();

  // ── Stage open/close → reorder tabs and override active tool ─────
  // Stage events take priority over the selection-driven auto-switch
  // below, so we mark the most recent change here and skip the next
  // selection-effect run while a stage is open.
  const stageOpenRef = useRef(stageOpen);
  stageOpenRef.current = stageOpen;

  // Derive stage-open from the document store (single source of truth) and
  // mirror it into the workspace store so the rest of the tab logic
  // (visibility, default tool, return-to-Inspector on close) keeps working
  // exactly as before.
  const docStageOpenMap = useDocumentStore((s) => s.stageOpen);
  const docStageOpen = useMemo(
    () => Object.values(docStageOpenMap).some(Boolean),
    [docStageOpenMap],
  );
  useEffect(() => {
    setStageOpen(docStageOpen);
  }, [docStageOpen, setStageOpen]);

  // ── Selection-driven auto-switch (Step 1.7) ──────────────────────
  // Skipped while a stage is open so the user stays parked on Library.
  // Skipped when the user is parked on the Navigation tab.
  useEffect(() => {
    if (stageOpenRef.current) return;
    if (useWorkspaceStore.getState().activeTool === 'nav') return;
    if (
      selection.kind === 'block' ||
      selection.kind === 'stage' ||
      selection.kind === 'arrow'
    ) {
      setActiveTool('inspector');
    }
  }, [selection.kind, selection.ids, setActiveTool]);

  // ── Cross-fade tab icons whenever the rail composition changes ───
  const [iconsVisible, setIconsVisible] = useState(true);
  useEffect(() => {
    setIconsVisible(false);
    const t = window.setTimeout(() => setIconsVisible(true), 30);
    return () => window.clearTimeout(t);
  }, [stageOpen, showNavTab]);

  const visibleTools = useMemo(() => {
    const baseOrder = stageOpen ? STAGE_MODE_ORDER : ARTICLE_MODE_ORDER;
    const order: WorkspaceToolId[] = showNavTab ? ['nav', ...baseOrder] : [...baseOrder];
    return order.map((id) => TOOL_BY_ID[id]);
  }, [stageOpen, showNavTab]);

  // Defensive: if activeTool ever points at a hidden tab, fall back to
  // the first visible tab (covers any external setActiveTool callers).
  const effectiveActive: WorkspaceToolId = visibleTools.some((t) => t.id === activeTool)
    ? activeTool
    : visibleTools[0]?.id ?? 'inspector';

  const ActiveRender = TOOL_BY_ID[effectiveActive]?.render ?? TOOLS[0].render;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {/* Selection strip */}
      <div
        style={{
          height: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 12px',
          fontSize: 11,
          color: 'rgba(255,255,255,0.60)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        }}
      >
        {selectionLabel && (
          <>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background:
                  (selectionKind && TYPE_DOT_COLOR[selectionKind]) ??
                  'rgba(255,255,255,0.40)',
                flexShrink: 0,
              }}
            />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectionLabel}
            </span>
          </>
        )}
      </div>

      {/* Tab rail */}
      <div
        style={{
          height: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '0 8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          flexShrink: 0,
        }}
      >
        {visibleTools.map((tool) => (
          <WorkspaceTabButton
            key={tool.id}
            tool={tool}
            active={tool.id === effectiveActive}
            iconVisible={iconsVisible}
            onClick={() => setActiveTool(tool.id)}
          />
        ))}
      </div>

      {/* Active tool content */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: 12,
          overflow: 'hidden',
        }}
      >
        <ActiveRender />
      </div>
    </div>
  );
}

interface WorkspaceTabButtonProps {
  tool: ToolDefinition;
  active: boolean;
  iconVisible: boolean;
  onClick: () => void;
}

function WorkspaceTabButton({ tool, active, iconVisible, onClick }: WorkspaceTabButtonProps) {
  const Icon = tool.icon;
  const iconColor = active
    ? '#2EC4B6'
    : 'rgba(255,255,255,0.65)';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={tool.label}
          aria-pressed={active}
          style={{
            width: 40,
            height: 40,
            borderRadius: 5,
            border: 'none',
            background: active ? 'rgba(46,196,182,0.06)' : 'transparent',
            borderBottom: active ? '2px solid #2EC4B6' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            transition: 'all 120ms ease-out',
          }}
          onMouseEnter={(e) => {
            if (active) return;
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
            const svg = e.currentTarget.querySelector('svg');
            if (svg) svg.style.color = 'rgba(255,255,255,0.85)';
          }}
          onMouseLeave={(e) => {
            if (active) return;
            e.currentTarget.style.background = 'transparent';
            const svg = e.currentTarget.querySelector('svg');
            if (svg) svg.style.color = 'rgba(255,255,255,0.65)';
          }}
        >
          <Icon
            size={18}
            style={{
              color: iconColor,
              opacity: iconVisible ? 1 : 0,
              transition: 'opacity 150ms ease',
            }}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tool.label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Library host — wires the Block Library's click-to-insert handler to the
 * currently open stage. If no stage is open, clicks no-op (the Library
 * tab also won't normally be visible in that state).
 */
function BlockLibraryHost() {
  const stageOpenMap = useDocumentStore((s) => s.stageOpen);
  const openStageId = useMemo(
    () => Object.keys(stageOpenMap).find((id) => stageOpenMap[id]) ?? null,
    [stageOpenMap],
  );

  const handleClick = (blockType: string) => {
    if (!openStageId) return;
    insertBlockInStage(openStageId, blockType as Parameters<typeof insertBlockInStage>[1]);
  };

  return <BlockLibraryTool onBlockClick={handleClick} />;
}

/**
 * NavTool — surfaces the same primary navigation as the LeftPanel so that
 * upload-editor users on lg/md screens (where the left rail is hidden) can
 * still reach core app routes from inside the right panel.
 */
interface NavRow {
  key: string;
  label: string;
  route: string;
  icon: LucideIcon;
  authOnly?: boolean;
  creatorOnly?: boolean;
  badge?: string | null;
  divider?: boolean;
}

function NavTool() {
  const navigate = useNavigate();
  const { isLoggedIn, isCreator } = useAuth();
  const { display: msgBadge } = useUnreadMessages();
  const { display: notifBadge } = useUnreadNotifications();
  const { display: draftBadge } = useDraftCount();

  const rows: NavRow[] = [
    { key: 'home',          label: 'Home',          route: '/',              icon: Home },
    { key: 'discover',      label: 'Discover',      route: '/browse',        icon: Compass },
    { key: 'library',       label: 'Library',       route: '/library',       icon: BookMarked,   authOnly: true },
    { key: 'upload',        label: 'Upload',        route: '/upload',        icon: UploadIcon,   divider: true },
    { key: 'drafts',        label: 'Drafts',        route: '/drafts',        icon: FileText,     authOnly: true, badge: draftBadge },
    { key: 'messages',      label: 'Messages',      route: '/messages',      icon: Mail,         authOnly: true, badge: msgBadge, divider: true },
    { key: 'notifications', label: 'Notifications', route: '/notifications', icon: Bell,         authOnly: true, badge: notifBadge },
    { key: 'profile',       label: 'My Profile',    route: '/profile',       icon: User,         authOnly: true, divider: true },
    { key: 'analytics',     label: 'Analytics',     route: '/analytics',     icon: BarChart3,    authOnly: true, creatorOnly: true },
  ];

  const visible = rows.filter((r) => {
    if (r.authOnly && !isLoggedIn) return false;
    if (r.creatorOnly && !isCreator) return false;
    return true;
  });

  return (
    <div style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {visible.map((r, idx) => {
        const Icon = r.icon;
        return (
          <div key={r.key}>
            {r.divider && idx > 0 && (
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '6px 4px' }} />
            )}
            <button
              type="button"
              onClick={() => navigate(r.route)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                color: 'rgba(255,255,255,0.75)',
                fontFamily: 'Figtree, sans-serif',
                fontSize: 13,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 120ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon size={15} style={{ color: 'rgba(255,255,255,0.55)', flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.label}
              </span>
              {r.badge && (
                <span
                  style={{
                    minWidth: 18,
                    height: 18,
                    padding: '0 5px',
                    borderRadius: 9,
                    background: r.key === 'drafts' ? 'rgba(255,255,255,0.14)' : '#8B4513',
                    color: r.key === 'drafts' ? 'rgba(255,255,255,0.65)' : '#fff',
                    fontSize: 10,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {r.badge}
                </span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
