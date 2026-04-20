import { useEffect } from 'react';
import {
  Sliders,
  Shapes,
  List,
  MessageSquare,
  Sparkles,
  Clock,
  type LucideIcon,
} from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSelection } from '@/hooks/useSelection';
import { useDocumentStore } from '@/lib/documentStore';
import {
  useWorkspaceStore,
  type WorkspaceToolId,
} from '@/lib/workspaceStore';

import { InspectorTool } from './tools/InspectorTool';
import { BlockLibraryTool } from './tools/BlockLibraryTool';
import { OutlineTool } from './tools/OutlineTool';
import { CommentsTool } from './tools/CommentsTool';
import { AIAssistantTool } from './tools/AIAssistantTool';
import { VersionHistoryTool } from './tools/VersionHistoryTool';

interface ToolDefinition {
  id: WorkspaceToolId;
  label: string;
  icon: LucideIcon;
  render: () => JSX.Element;
}

const TOOLS: readonly ToolDefinition[] = [
  { id: 'inspector', label: 'Inspector', icon: Sliders, render: () => <InspectorTool /> },
  { id: 'library', label: 'Block Library', icon: Shapes, render: () => <BlockLibraryTool /> },
  { id: 'outline', label: 'Outline', icon: List, render: () => <OutlineTool /> },
  { id: 'comments', label: 'Comments', icon: MessageSquare, render: () => <CommentsTool /> },
  { id: 'ai', label: 'AI Assistant', icon: Sparkles, render: () => <AIAssistantTool /> },
  { id: 'versions', label: 'Version History', icon: Clock, render: () => <VersionHistoryTool /> },
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
  const { selection } = useSelection();
  const { label: selectionLabel, kind: selectionKind } = useSelectionLabel();

  useEffect(() => {
    if (
      selection.kind === 'block' ||
      selection.kind === 'stage' ||
      selection.kind === 'arrow'
    ) {
      setActiveTool('inspector');
    }
  }, [selection.kind, selection.ids, setActiveTool]);

  const ActiveRender = TOOLS.find((t) => t.id === activeTool)?.render ?? TOOLS[0].render;

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
        {TOOLS.map((tool) => (
          <WorkspaceTabButton
            key={tool.id}
            tool={tool}
            active={tool.id === activeTool}
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
  onClick: () => void;
}

function WorkspaceTabButton({ tool, active, onClick }: WorkspaceTabButtonProps) {
  const Icon = tool.icon;
  const iconColor = active
    ? '#E8571A'
    : 'rgba(255,255,255,0.45)';

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
            borderRadius: 6,
            border: 'none',
            background: active ? 'rgba(232,87,26,0.10)' : 'transparent',
            borderBottom: active ? '2px solid #E8571A' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            transition: 'background-color 120ms ease, color 120ms ease',
          }}
          onMouseEnter={(e) => {
            if (active) return;
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            const svg = e.currentTarget.querySelector('svg');
            if (svg) svg.style.color = 'rgba(255,255,255,0.70)';
          }}
          onMouseLeave={(e) => {
            if (active) return;
            e.currentTarget.style.background = 'transparent';
            const svg = e.currentTarget.querySelector('svg');
            if (svg) svg.style.color = 'rgba(255,255,255,0.45)';
          }}
        >
          <Icon size={18} style={{ color: iconColor }} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tool.label}</TooltipContent>
    </Tooltip>
  );
}
