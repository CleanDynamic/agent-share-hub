import * as React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Bot,
  Play,
  MoreHorizontal,
  ArrowUpRight,
  ChevronDown,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { useDocumentStore } from '@/lib/documentStore';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

type BlockStatus = 'idle' | 'running' | 'success' | 'error';
type MemoryStrategy = 'none' | 'short' | 'long';

interface AgentBlockData {
  blockId: string;
  label?: string;
  [key: string]: unknown;
}

const AGENT_COLOR = '#7C3AED';

const models = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'claude-sonnet', label: 'Claude Sonnet' },
  { value: 'claude-opus', label: 'Claude Opus' },
];

const availableTools = [
  { value: 'web_search', label: 'Web Search' },
  { value: 'code_interpreter', label: 'Code Interpreter' },
  { value: 'file_reader', label: 'File Reader' },
  { value: 'calculator', label: 'Calculator' },
  { value: 'image_gen', label: 'Image Generation' },
  { value: 'api_call', label: 'API Call' },
];

const memoryOptions: MemoryStrategy[] = ['none', 'short', 'long'];

const PORT_STYLE: React.CSSProperties = {
  width: 8,
  height: 8,
  background: '#2EC4B6',
  border: '2px solid white',
  opacity: 0,
  transition: 'opacity 150ms ease',
};

function StatusDot({ status }: { status: BlockStatus }) {
  if (status === 'running') {
    return <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />;
  }
  if (status === 'success') {
    return (
      <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-emerald-500 text-white">
        <Check size={8} strokeWidth={3} />
      </span>
    );
  }
  if (status === 'error') {
    return <span className="inline-block w-2 h-2 rounded-full bg-red-500" />;
  }
  return <span className="inline-block w-2 h-2 rounded-full bg-white/25" />;
}

export function AgentBlockNode({ id, data, selected }: NodeProps) {
  const blockId = (data as AgentBlockData).blockId ?? id;

  const block = useDocumentStore((s) => s.blocks[blockId]);
  const updateBlock = useDocumentStore((s) => s.updateBlock);
  const setSelection = useDocumentStore((s) => s.setSelection);
  const expandedSelection = useDocumentStore(
    (s) => s.selection.kind === 'block' && s.selection.ids[0] === blockId,
  );

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [showModelDropdown, setShowModelDropdown] = React.useState(false);
  const [showToolsDropdown, setShowToolsDropdown] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const [status, setStatus] = React.useState<BlockStatus>('idle');

  const props = (block?.properties ?? {}) as Record<string, unknown>;
  const name = block?.name ?? '';
  const role = (props.role as string) ?? '';
  const model = (props.model as string) ?? 'gpt-4o';
  const tools = (props.tools as string[] | undefined) ?? [];
  const memoryStrategy = ((props.memoryStrategy as MemoryStrategy) ?? 'none') as MemoryStrategy;
  const systemPrompt = (props.systemPrompt as string) ?? '';

  const patchProps = React.useCallback(
    (patch: Record<string, unknown>) => {
      if (!block) return;
      updateBlock(blockId, {
        properties: { ...(block.properties ?? {}), ...patch },
      });
    },
    [block, blockId, updateBlock],
  );

  const onNameChange = (v: string) => updateBlock(blockId, { name: v });
  const onRoleChange = (v: string) => patchProps({ role: v });
  const onModelChange = (v: string) => patchProps({ model: v });
  const onToolsChange = (v: string[]) => patchProps({ tools: v });
  const onMemoryStrategyChange = (v: MemoryStrategy) => patchProps({ memoryStrategy: v });
  const onSystemPromptChange = (v: string) => patchProps({ systemPrompt: v });

  const toggleTool = (toolValue: string) => {
    const next = tools.includes(toolValue)
      ? tools.filter((t) => t !== toolValue)
      : [...tools, toolValue];
    onToolsChange(next);
  };

  const selectThis = React.useCallback(() => {
    setSelection({ kind: 'block', ids: [blockId] });
  }, [blockId, setSelection]);

  const handleRun = React.useCallback(() => {
    if (!systemPrompt.trim() && !role.trim()) {
      toast.error('Add a role or system prompt before running');
      return;
    }
    setStatus('running');
    // Stub — agent execution wiring lives outside the visual layer.
    toast.message('Agent run triggered', {
      description: 'Agent execution wiring will be added in the next step.',
    });
    window.setTimeout(() => setStatus('idle'), 800);
  }, [role, systemPrompt]);

  const portOpacity = hovered || selected ? 1 : 0;
  const modelLabel = models.find((m) => m.value === model)?.label ?? model;

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={selectThis}
        className={cn('group relative rounded-lg p-2.5 backdrop-blur-md transition-all')}
        style={{
          width: 240,
          background: 'rgba(20,20,28,0.85)',
          border: selected
            ? `1px solid ${AGENT_COLOR}99`
            : expandedSelection
              ? `1px dashed ${AGENT_COLOR}73`
              : '1px solid rgba(255,255,255,0.08)',
          boxShadow: selected ? `0 0 0 2px ${AGENT_COLOR}2E` : 'none',
        }}
      >
        {/* React Flow handles */}
        <Handle type="target" position={Position.Top} style={{ ...PORT_STYLE, opacity: portOpacity }} />
        <Handle type="source" position={Position.Right} style={{ ...PORT_STYLE, opacity: portOpacity }} />
        <Handle type="source" position={Position.Bottom} style={{ ...PORT_STYLE, opacity: portOpacity }} />
        <Handle type="target" position={Position.Left} style={{ ...PORT_STYLE, opacity: portOpacity }} />

        {/* Header */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: AGENT_COLOR }} />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
            Agent
          </span>
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Name"
            className="flex-1 min-w-0 bg-transparent text-[10px] font-medium text-white/70 placeholder:text-white/30 outline-none nodrag"
          />
          <StatusDot status={status} />
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="p-0.5 text-white/40 hover:text-white/80 nodrag"
            title="More"
          >
            <MoreHorizontal size={12} />
          </button>
        </div>

        {/* Body preview */}
        <div
          className="rounded-md p-2 mb-2 flex items-start gap-2"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.05)',
            minHeight: 56,
          }}
        >
          <Bot size={14} className="text-white/40 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] leading-snug text-white/70 line-clamp-3">
            {role || <span className="text-white/30">Describe what this agent does...</span>}
          </p>
        </div>

        {/* Stats */}
        <div className="text-[10px] text-white/40 mb-2 flex items-center gap-2">
          <span>{modelLabel}</span>
          <span className="text-white/20">·</span>
          <span>
            {tools.length} {tools.length === 1 ? 'tool' : 'tools'}
          </span>
          <span className="text-white/20">·</span>
          <span>memory: {memoryStrategy}</span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              selectThis();
              handleRun();
            }}
            className="nodrag flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-semibold text-white"
            style={{ background: `${AGENT_COLOR}E6` }}
          >
            <Play size={10} className="fill-current" />
            Run
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              selectThis();
              setDrawerOpen(true);
            }}
            className="nodrag p-1 text-white/45 hover:text-white/85 rounded transition-colors"
            title="Expand"
          >
            <ArrowUpRight size={12} />
          </button>
        </div>
      </div>

      {/* Expanded drawer */}
      <Sheet
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (open) selectThis();
        }}
      >
        <SheetContent
          side="right"
          className="w-[480px] sm:max-w-[480px] bg-[rgba(15,15,20,0.98)] border-white/10 text-white overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle className="text-white/90 text-base flex items-center gap-2">
              <Bot size={14} style={{ color: AGENT_COLOR }} />
              Agent block
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1.5">Name</label>
              <input
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Agent name"
                className="w-full px-3 py-2 rounded-md bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 placeholder:text-white/30 outline-none focus:border-white/[0.12] transition-colors"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                Role description
              </label>
              <textarea
                value={role}
                onChange={(e) => onRoleChange(e.target.value)}
                placeholder="Describe what this agent does..."
                className="w-full h-16 p-3 rounded-md resize-none bg-white/[0.03] border border-white/[0.06] text-xs text-white/70 placeholder:text-white/30 outline-none focus:border-white/[0.12] transition-colors"
              />
            </div>

            {/* Model */}
            <div className="relative">
              <label className="block text-[11px] font-medium text-white/50 mb-1.5">Model</label>
              <button
                type="button"
                onClick={() => setShowModelDropdown((v) => !v)}
                className="w-full px-3 py-2 rounded-md text-left flex items-center justify-between bg-white/[0.03] border border-white/[0.06] text-xs text-white/70 hover:border-white/[0.12] transition-colors"
              >
                {modelLabel}
                <ChevronDown size={12} className="text-white/40" />
              </button>
              {showModelDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 py-1 bg-[rgba(22,22,30,0.98)] border border-white/[0.08] rounded-md z-10">
                  {models.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => {
                        onModelChange(m.value);
                        setShowModelDropdown(false);
                      }}
                      className={cn(
                        'w-full px-3 py-1.5 text-left text-xs hover:bg-white/[0.06] transition-colors',
                        m.value === model ? 'text-white' : 'text-white/60',
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tools */}
            <div className="relative">
              <label className="block text-[11px] font-medium text-white/50 mb-1.5">Tools</label>
              <button
                type="button"
                onClick={() => setShowToolsDropdown((v) => !v)}
                className="w-full px-3 py-2 rounded-md text-left flex items-center justify-between bg-white/[0.03] border border-white/[0.06] text-xs text-white/70 hover:border-white/[0.12] transition-colors"
              >
                {tools.length > 0 ? `${tools.length} tools selected` : 'Select tools...'}
                <ChevronDown size={12} className="text-white/40" />
              </button>
              {showToolsDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 py-1 bg-[rgba(22,22,30,0.98)] border border-white/[0.08] rounded-md z-10 max-h-[160px] overflow-auto">
                  {availableTools.map((tool) => (
                    <button
                      key={tool.value}
                      type="button"
                      onClick={() => toggleTool(tool.value)}
                      className={cn(
                        'w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-white/[0.06] transition-colors',
                        tools.includes(tool.value) ? 'text-white' : 'text-white/60',
                      )}
                    >
                      <div
                        className={cn(
                          'w-3 h-3 rounded border flex items-center justify-center',
                          tools.includes(tool.value)
                            ? 'border-transparent'
                            : 'border-white/20',
                        )}
                        style={{
                          background: tools.includes(tool.value) ? AGENT_COLOR : 'transparent',
                        }}
                      >
                        {tools.includes(tool.value) && (
                          <Check size={8} strokeWidth={3} className="text-white" />
                        )}
                      </div>
                      {tool.label}
                    </button>
                  ))}
                </div>
              )}
              {tools.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {tools.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 text-[9px] font-medium rounded-full"
                      style={{ color: AGENT_COLOR, background: `${AGENT_COLOR}1A` }}
                    >
                      {availableTools.find((at) => at.value === t)?.label ?? t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Memory strategy */}
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                Memory strategy
              </label>
              <div className="flex gap-2">
                {memoryOptions.map((strategy) => {
                  const active = memoryStrategy === strategy;
                  return (
                    <button
                      key={strategy}
                      type="button"
                      onClick={() => onMemoryStrategyChange(strategy)}
                      className={cn(
                        'flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors border',
                        active
                          ? 'text-white'
                          : 'bg-white/[0.03] text-white/55 border-white/[0.06] hover:border-white/[0.12]',
                      )}
                      style={
                        active
                          ? {
                              background: `${AGENT_COLOR}33`,
                              borderColor: `${AGENT_COLOR}4D`,
                              color: AGENT_COLOR,
                            }
                          : undefined
                      }
                    >
                      {strategy.charAt(0).toUpperCase() + strategy.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* System prompt */}
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                System prompt
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => onSystemPromptChange(e.target.value)}
                placeholder="Enter system prompt..."
                className="w-full h-32 p-3 rounded-md resize-none bg-white/[0.03] border border-white/[0.06] text-xs text-white/75 placeholder:text-white/30 outline-none focus:border-white/[0.12] transition-colors"
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="px-3 py-1.5 text-[11px] font-medium text-white/50 hover:text-white/80 transition-colors"
              >
                Collapse
              </button>
              <button
                type="button"
                onClick={handleRun}
                className="flex items-center gap-2 px-4 py-2 text-white text-xs font-semibold rounded-full transition-colors"
                style={{ background: `${AGENT_COLOR}E6` }}
              >
                <Play size={12} className="fill-current" />
                Run Agent
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
