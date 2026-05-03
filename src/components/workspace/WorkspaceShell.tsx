import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  Sliders,
  Shapes,
  List,
  MessageSquare,
  Clock,
  type LucideIcon,
} from 'lucide-react';

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

export function WorkspaceShell() {
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
  useEffect(() => {
    if (stageOpenRef.current) return;
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
  }, [stageOpen]);

  const visibleTools = useMemo(() => {
    const order = stageOpen ? STAGE_MODE_ORDER : ARTICLE_MODE_ORDER;
    return order.map((id) => TOOL_BY_ID[id]);
  }, [stageOpen]);

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
          borderBottom: '1px solid rgba(255,255,255,0.04)',
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
          borderBottom: '1px solid rgba(255,255,255,0.04)',
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
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
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
