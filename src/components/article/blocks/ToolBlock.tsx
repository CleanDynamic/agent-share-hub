import * as React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MoreHorizontal, ArrowUpRight, Wrench } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useDocumentStore } from '@/lib/documentStore';
import { isNameUnique } from '@/lib/variables';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface ToolBlockData {
  blockId: string;
  label?: string;
  [key: string]: unknown;
}

const TYPE_COLOR = '#F97316';

const PORT_STYLE: React.CSSProperties = {
  width: 8,
  height: 8,
  background: '#2EC4B6',
  border: '2px solid white',
  opacity: 0,
  transition: 'opacity 150ms ease',
};

export function ToolBlockNode({ id, data, selected }: NodeProps) {
  const blockId = (data as ToolBlockData).blockId ?? id;

  const block = useDocumentStore((s) => s.blocks[blockId]);
  const allBlocks = useDocumentStore((s) => s.blocks);
  const updateBlock = useDocumentStore((s) => s.updateBlock);
  const setSelection = useDocumentStore((s) => s.setSelection);

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'params' | 'return'>('params');
  const [hovered, setHovered] = React.useState(false);

  if (!block) return null;

  const props = (block.properties ?? {}) as {
    description?: string;
    parameters?: string;
    returnSchema?: string;
    implementationRef?: string;
  };

  const name = block.name ?? '';
  const description = props.description ?? '';
  const parameters = props.parameters ?? '{}';
  const returnSchema = props.returnSchema ?? '{}';
  const implementationRef = props.implementationRef ?? '';

  const paramCount = React.useMemo(() => {
    try {
      const parsed = JSON.parse(parameters);
      if (parsed?.properties && typeof parsed.properties === 'object') {
        return Object.keys(parsed.properties).length;
      }
      return 0;
    } catch {
      return 0;
    }
  }, [parameters]);

  const patchProps = (patch: Record<string, unknown>) => {
    updateBlock(blockId, {
      properties: { ...(block.properties ?? {}), ...patch },
    });
  };

  const onNameChange = (v: string) => {
    if (!isNameUnique(v, blockId, allBlocks)) {
      toast.error(`Name "${v.trim()}" is already used by another block.`);
      return;
    }
    updateBlock(blockId, { name: v });
  };
  const selectThis = () => setSelection({ kind: 'block', ids: [blockId] });

  const portOpacity = hovered || selected ? 1 : 0;

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={selectThis}
        className="group relative rounded-lg p-2.5 bg-[rgba(20,20,28,0.85)] backdrop-blur-md transition-all"
        style={{
          width: 260,
          border: selected
            ? `1px solid ${TYPE_COLOR}99`
            : '1px solid rgba(255,255,255,0.08)',
          boxShadow: selected ? `0 0 0 2px ${TYPE_COLOR}26` : 'none',
        }}
      >
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
            style={{ background: TYPE_COLOR }}
          />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
            Tool
          </span>
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Name"
            className="flex-1 min-w-0 bg-transparent text-[10px] font-medium text-white/70 placeholder:text-white/30 outline-none nodrag"
          />
          <button
            type="button"
            className="p-0.5 text-white/40 hover:text-white/80 nodrag"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal size={12} />
          </button>
        </div>

        {/* Compact info */}
        <div
          className="flex items-center gap-2 px-2 py-2 mb-2 rounded-md"
          style={{
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <Wrench size={12} style={{ color: TYPE_COLOR }} />
          <span className="text-[11px] text-white/70 truncate flex-1">
            {description || 'No description'}
          </span>
        </div>

        <div className="text-[10px] text-white/40 mb-2 truncate">
          {paramCount} parameter{paramCount !== 1 ? 's' : ''}
          {implementationRef ? ` · ${implementationRef}` : ''}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end">
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
          className="w-[560px] sm:max-w-[560px] bg-[rgba(15,15,20,0.98)] border-white/10 text-white overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle className="text-white/90 text-base">Tool block</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            <input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Tool name"
              className="w-full px-3 py-2 rounded-md bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 placeholder:text-white/30 outline-none focus:border-white/[0.12] transition-colors"
            />

            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => patchProps({ description: e.target.value })}
                placeholder="What does this tool do?"
                className={cn(
                  'w-full h-20 p-3 rounded-md resize-none',
                  'bg-white/[0.03] border border-white/[0.06]',
                  'text-xs text-white/70 placeholder:text-white/30',
                  'outline-none focus:border-white/[0.12] transition-colors',
                )}
              />
            </div>

            {/* Schema tabs */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('params')}
                  className={cn(
                    'px-2 py-1 text-[11px] font-medium rounded transition-colors',
                    activeTab === 'params'
                      ? 'bg-white/[0.08] text-white'
                      : 'text-white/40 hover:text-white/60',
                  )}
                >
                  Parameters
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('return')}
                  className={cn(
                    'px-2 py-1 text-[11px] font-medium rounded transition-colors',
                    activeTab === 'return'
                      ? 'bg-white/[0.08] text-white'
                      : 'text-white/40 hover:text-white/60',
                  )}
                >
                  Return Schema
                </button>
              </div>

              <textarea
                value={activeTab === 'params' ? parameters : returnSchema}
                onChange={(e) =>
                  activeTab === 'params'
                    ? patchProps({ parameters: e.target.value })
                    : patchProps({ returnSchema: e.target.value })
                }
                placeholder={`{\n  "type": "object",\n  "properties": {\n    ...\n  }\n}`}
                className={cn(
                  'w-full h-48 p-3 rounded-md resize-none font-mono',
                  'bg-white/[0.03] border border-white/[0.06]',
                  'text-[11px] text-white/70 placeholder:text-white/30',
                  'outline-none focus:border-white/[0.12] transition-colors',
                )}
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                Implementation reference
              </label>
              <input
                type="text"
                value={implementationRef}
                onChange={(e) => patchProps({ implementationRef: e.target.value })}
                placeholder="e.g., /api/tools/my-tool or function:myTool"
                className={cn(
                  'w-full px-3 py-2 rounded-md font-mono',
                  'bg-white/[0.03] border border-white/[0.06]',
                  'text-xs text-white/70 placeholder:text-white/30',
                  'outline-none focus:border-white/[0.12] transition-colors',
                )}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
