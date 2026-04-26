import * as React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MoreHorizontal, ArrowUpRight, ChevronDown, Cpu } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useDocumentStore } from '@/lib/documentStore';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

type Provider = 'openai' | 'anthropic' | 'google' | 'groq' | 'custom';

interface ModelBlockData {
  blockId: string;
  label?: string;
  [key: string]: unknown;
}

const MODEL_COLOR = '#A78BFA';

const providers: { value: Provider; label: string; icon: string }[] = [
  { value: 'openai', label: 'OpenAI', icon: '🤖' },
  { value: 'anthropic', label: 'Anthropic', icon: '🔮' },
  { value: 'google', label: 'Google', icon: '🌐' },
  { value: 'groq', label: 'Groq', icon: '⚡' },
  { value: 'custom', label: 'Custom', icon: '🔧' },
];

const PORT_STYLE: React.CSSProperties = {
  width: 8,
  height: 8,
  background: '#2EC4B6',
  border: '2px solid white',
  opacity: 0,
  transition: 'opacity 150ms ease',
};

export function ModelBlockNode({ id, data, selected }: NodeProps) {
  const blockId = (data as ModelBlockData).blockId ?? id;

  const block = useDocumentStore((s) => s.blocks[blockId]);
  const updateBlock = useDocumentStore((s) => s.updateBlock);

  const [expanded, setExpanded] = React.useState(false);
  const [showProviderDropdown, setShowProviderDropdown] = React.useState(false);

  if (!block) return null;

  const props = (block.properties ?? {}) as {
    provider?: Provider;
    modelName?: string;
    apiEndpoint?: string;
    defaultTemperature?: number;
    defaultMaxTokens?: number;
  };

  const provider: Provider = props.provider ?? 'openai';
  const modelName = props.modelName ?? '';
  const apiEndpoint = props.apiEndpoint ?? '';
  const defaultTemperature = props.defaultTemperature ?? 0.7;
  const defaultMaxTokens = props.defaultMaxTokens ?? 4096;

  const currentProvider = providers.find((p) => p.value === provider);

  const patchProps = (patch: Record<string, unknown>) => {
    updateBlock(blockId, {
      properties: { ...(block.properties ?? {}), ...patch },
    });
  };

  return (
    <>
      <div
        className={cn(
          'group relative rounded-xl border bg-[rgba(20,20,28,0.75)]',
          'backdrop-blur-md shadow-lg w-[240px]',
          selected ? 'border-white/30' : 'border-white/10',
        )}
        style={{ padding: 12 }}
      >
        <Handle type="target" position={Position.Top} style={PORT_STYLE} />
        <Handle type="source" position={Position.Bottom} style={PORT_STYLE} />
        <Handle type="target" position={Position.Left} style={PORT_STYLE} />
        <Handle type="source" position={Position.Right} style={PORT_STYLE} />

        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: MODEL_COLOR }}
          />
          <Cpu size={12} className="text-white/60" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
            Model
          </span>
          <div className="flex-1" />
          <button
            type="button"
            className="text-white/40 hover:text-white/80 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal size={14} />
          </button>
        </div>

        {/* Compact info */}
        <div className="flex items-center gap-2 px-2 py-2 rounded-md bg-white/[0.03] border border-white/[0.06]">
          <span className="text-base leading-none">{currentProvider?.icon}</span>
          <span className="text-xs text-white/80 truncate">
            {modelName || currentProvider?.label}
          </span>
        </div>

        {/* Footer expand */}
        <div className="flex justify-end mt-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(true);
            }}
            className="text-white/40 hover:text-white/80 transition-colors"
            aria-label="Expand model block"
          >
            <ArrowUpRight size={14} />
          </button>
        </div>
      </div>

      <Sheet open={expanded} onOpenChange={setExpanded}>
        <SheetContent side="right" className="w-[420px] sm:max-w-[420px] bg-[rgba(20,20,28,0.95)] border-white/10 text-white">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-white">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: MODEL_COLOR }}
              />
              <Cpu size={14} className="text-white/70" />
              <span>Model</span>
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Provider */}
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1">
                Provider
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowProviderDropdown((v) => !v)}
                  className={cn(
                    'w-full px-3 py-2 rounded-md text-left flex items-center gap-2',
                    'bg-white/[0.03] border border-white/[0.06]',
                    'text-xs text-white/80',
                    'hover:border-white/[0.12] transition-colors',
                  )}
                >
                  <span>{currentProvider?.icon}</span>
                  <span className="flex-1">{currentProvider?.label}</span>
                  <ChevronDown size={12} className="text-white/50" />
                </button>
                {showProviderDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-[rgba(20,20,28,0.95)] border border-white/10 rounded-md shadow-lg overflow-hidden">
                    {providers.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => {
                          patchProps({ provider: p.value });
                          setShowProviderDropdown(false);
                        }}
                        className={cn(
                          'w-full px-3 py-1.5 text-left text-xs flex items-center gap-2',
                          'hover:bg-white/[0.06] transition-colors',
                          p.value === provider ? 'text-white' : 'text-white/60',
                        )}
                      >
                        <span>{p.icon}</span>
                        <span>{p.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Model name */}
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1">
                Model name
              </label>
              <input
                value={modelName}
                onChange={(e) => patchProps({ modelName: e.target.value })}
                placeholder="e.g., gpt-4o, claude-3-opus"
                className={cn(
                  'w-full px-3 py-2 rounded-md',
                  'bg-white/[0.03] border border-white/[0.06]',
                  'text-xs text-white/80 placeholder:text-white/30',
                  'outline-none focus:border-white/[0.12] transition-colors',
                )}
              />
            </div>

            {/* API endpoint (custom) */}
            {provider === 'custom' && (
              <div>
                <label className="block text-[11px] font-medium text-white/50 mb-1">
                  API endpoint
                </label>
                <input
                  value={apiEndpoint}
                  onChange={(e) => patchProps({ apiEndpoint: e.target.value })}
                  placeholder="https://api.example.com/v1/chat"
                  className={cn(
                    'w-full px-3 py-2 rounded-md',
                    'bg-white/[0.03] border border-white/[0.06]',
                    'text-xs text-white/80 placeholder:text-white/30',
                    'outline-none focus:border-white/[0.12] transition-colors',
                  )}
                />
              </div>
            )}

            {/* Temperature */}
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1">
                Default temperature
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={defaultTemperature}
                  onChange={(e) =>
                    patchProps({ defaultTemperature: parseFloat(e.target.value) })
                  }
                  className="flex-1 h-1 bg-white/[0.06] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#A78BFA]"
                />
                <span className="text-xs text-white/70 w-8 text-right tabular-nums">
                  {defaultTemperature.toFixed(1)}
                </span>
              </div>
            </div>

            {/* Max tokens */}
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1">
                Max tokens
              </label>
              <input
                type="number"
                value={defaultMaxTokens}
                onChange={(e) =>
                  patchProps({ defaultMaxTokens: parseInt(e.target.value) || 0 })
                }
                className={cn(
                  'w-full px-3 py-2 rounded-md',
                  'bg-white/[0.03] border border-white/[0.06]',
                  'text-xs text-white/80',
                  'outline-none focus:border-white/[0.12] transition-colors',
                  '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
                )}
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="px-3 py-1.5 text-xs text-white/70 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-md transition-colors"
              >
                Collapse
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
