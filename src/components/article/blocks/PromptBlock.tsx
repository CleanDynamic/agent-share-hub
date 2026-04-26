import * as React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Play,
  MoreHorizontal,
  ArrowUpRight,
  ChevronDown,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { useDocumentStore } from '@/lib/documentStore';
import { eventBus } from '@/lib/eventBus';
import { runPrompt, approximateTokens } from '@/lib/llm';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

type BlockStatus = 'idle' | 'running' | 'success' | 'error';

interface PromptBlockData {
  blockId: string;
  label?: string;
  [key: string]: unknown;
}

const models = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'claude-sonnet', label: 'Claude Sonnet' },
  { value: 'claude-opus', label: 'Claude Opus' },
  { value: 'gemini-pro', label: 'Gemini Pro' },
  { value: 'gemini-flash', label: 'Gemini Flash' },
];

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
    return (
      <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
    );
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

export function PromptBlockNode({ id, data, selected }: NodeProps) {
  const blockId = (data as PromptBlockData).blockId ?? id;

  const block = useDocumentStore((s) => s.blocks[blockId]);
  const updateBlock = useDocumentStore((s) => s.updateBlock);
  const setSelection = useDocumentStore((s) => s.setSelection);
  const expandedSelection = useDocumentStore(
    (s) => s.selection.kind === 'block' && s.selection.ids[0] === blockId,
  );

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [systemPromptOpen, setSystemPromptOpen] = React.useState(false);
  const [showModelDropdown, setShowModelDropdown] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);

  const props = (block?.properties ?? {}) as Record<string, unknown>;
  const name = block?.name ?? '';
  const promptText = (props.prompt as string) ?? '';
  const systemPrompt = (props.systemPrompt as string) ?? '';
  const model = (props.model as string) ?? 'gpt-4o';
  const temperature = (props.temperature as number) ?? 0.7;
  const maxTokens = (props.maxTokens as number) ?? 2048;
  const status = ((props.status as BlockStatus) ?? 'idle') as BlockStatus;
  const tokenCount = (props.tokenCount as number) ?? 0;

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
  const onPromptChange = (v: string) => patchProps({ prompt: v });
  const onSystemPromptChange = (v: string) => patchProps({ systemPrompt: v });
  const onModelChange = (v: string) => patchProps({ model: v });
  const onTemperatureChange = (v: number) => patchProps({ temperature: v });
  const onMaxTokensChange = (v: number) => patchProps({ maxTokens: v });

  const selectThis = React.useCallback(() => {
    setSelection({ kind: 'block', ids: [blockId] });
  }, [blockId, setSelection]);

  const handleRun = () => {
    toast('Wiring LLM integration in next step.');
  };

  const extractedVariables = React.useMemo(() => {
    const regex = /\{\{(\w+)\}\}/g;
    const matches = promptText.matchAll(regex);
    return [...new Set([...matches].map((m) => m[1]))];
  }, [promptText]);

  const portOpacity = hovered || selected ? 1 : 0;

  // Compact card content (rendered inside the React Flow node)
  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={selectThis}
        className={cn(
          'group relative rounded-lg p-2.5',
          'bg-[rgba(20,20,28,0.85)] backdrop-blur-md',
          'transition-all',
        )}
        style={{
          width: 240,
          border: selected
            ? '1px solid rgba(232,87,26,0.6)'
            : expandedSelection
              ? '1px dashed rgba(232,87,26,0.45)'
              : '1px solid rgba(255,255,255,0.08)',
          boxShadow: selected
            ? '0 0 0 2px rgba(232,87,26,0.18)'
            : 'none',
        }}
      >
        {/* React Flow connection handles */}
        <Handle
          type="target"
          position={Position.Top}
          style={{ ...PORT_STYLE, opacity: portOpacity }}
        />
        <Handle
          type="source"
          position={Position.Right}
          style={{ ...PORT_STYLE, opacity: portOpacity }}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          style={{ ...PORT_STYLE, opacity: portOpacity }}
        />
        <Handle
          type="target"
          position={Position.Left}
          style={{ ...PORT_STYLE, opacity: portOpacity }}
        />

        {/* Header */}
        <div className="flex items-center gap-1.5 mb-2">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: '#8B5CF6' }}
          />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
            Prompt
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
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="p-0.5 text-white/40 hover:text-white/80 nodrag"
            title="More"
          >
            <MoreHorizontal size={12} />
          </button>
        </div>

        {/* Body preview */}
        <div
          className="rounded-md p-2 mb-2"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.05)',
            minHeight: 56,
          }}
        >
          <p className="text-[11px] leading-snug text-white/70 line-clamp-3">
            {promptText || (
              <span className="text-white/30">Enter your prompt...</span>
            )}
          </p>
        </div>

        {/* Stats */}
        <div className="text-[10px] text-white/40 mb-2">
          {tokenCount} tokens · {models.find((m) => m.value === model)?.label}
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
            style={{ background: 'rgba(232,87,26,0.9)' }}
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
            <SheetTitle className="text-white/90 text-base">
              Prompt block
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                Name
              </label>
              <input
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Block name"
                className="w-full px-3 py-2 rounded-md bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 placeholder:text-white/30 outline-none focus:border-white/[0.12] transition-colors"
              />
            </div>

            {/* System prompt collapsible */}
            <div>
              <button
                type="button"
                onClick={() => setSystemPromptOpen((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] font-medium text-white/50 hover:text-white/70 transition-colors mb-2"
              >
                <ChevronDown
                  size={12}
                  className={cn(
                    'transition-transform',
                    systemPromptOpen ? '' : '-rotate-90',
                  )}
                />
                System prompt
              </button>
              {systemPromptOpen && (
                <textarea
                  value={systemPrompt}
                  onChange={(e) => onSystemPromptChange(e.target.value)}
                  placeholder="Enter system prompt..."
                  className="w-full h-20 p-3 rounded-md resize-none bg-white/[0.03] border border-white/[0.06] text-xs text-white/70 placeholder:text-white/30 outline-none focus:border-white/[0.12] transition-colors"
                />
              )}
            </div>

            {/* Prompt */}
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                Prompt
              </label>
              <textarea
                value={promptText}
                onChange={(e) => onPromptChange(e.target.value)}
                placeholder="Enter your prompt... Use {{variable}} syntax for dynamic values."
                className="w-full h-40 p-3 rounded-md resize-none bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 placeholder:text-white/30 leading-relaxed outline-none focus:border-white/[0.12] transition-colors"
              />
            </div>

            {/* Variables */}
            {extractedVariables.length > 0 && (
              <div>
                <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                  Variables detected
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {extractedVariables.map((v) => (
                    <span
                      key={v}
                      className="px-2 py-0.5 text-[10px] font-medium rounded-full"
                      style={{
                        color: '#2EC4B6',
                        background: 'rgba(46,196,182,0.1)',
                        border: '1px solid rgba(46,196,182,0.2)',
                      }}
                    >
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Model + temp + tokens */}
            <div className="grid grid-cols-3 gap-3">
              <div className="relative">
                <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                  Model
                </label>
                <button
                  type="button"
                  onClick={() => setShowModelDropdown((v) => !v)}
                  className="w-full px-3 py-2 rounded-md text-left bg-white/[0.03] border border-white/[0.06] text-xs text-white/70 hover:border-white/[0.12] transition-colors"
                >
                  {models.find((m) => m.value === model)?.label}
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

              <div>
                <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                  Temperature
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={temperature}
                    onChange={(e) =>
                      onTemperatureChange(parseFloat(e.target.value))
                    }
                    className="flex-1 h-1 bg-white/[0.06] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#E8571A]"
                  />
                  <span className="text-[10px] text-white/50 w-6 text-right">
                    {temperature.toFixed(1)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                  Max tokens
                </label>
                <input
                  type="number"
                  value={maxTokens}
                  onChange={(e) =>
                    onMaxTokensChange(parseInt(e.target.value, 10) || 0)
                  }
                  className="w-full px-3 py-2 rounded-md bg-white/[0.03] border border-white/[0.06] text-xs text-white/70 outline-none focus:border-white/[0.12] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
              <span className="text-[11px] text-white/40">
                {tokenCount} tokens estimated
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="px-3 py-1.5 text-[11px] font-medium text-white/50 hover:text-white/70 transition-colors"
                >
                  Collapse
                </button>
                <button
                  type="button"
                  onClick={handleRun}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-full text-white hover:bg-[#E8571A] transition-colors"
                  style={{ background: 'rgba(232,87,26,0.9)' }}
                >
                  <Play className="w-3 h-3 fill-current" />
                  Run
                </button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default PromptBlockNode;
